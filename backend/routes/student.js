import express from "express";
import { checkAuth } from "../middleware/auth.js";
import Research from "../models/Research.js";
import Schedule from "../models/Schedule.js";
import User from "../models/User.js";
import { getAvailableDocuments, downloadDocument, viewDocument } from "../controllers/studentController.js";

const router = express.Router();

/**
 * Graduate Student Functional Requirements
 */

// Upload compliance forms
router.post("/upload-compliance", checkAuth(["student"]), async (req, res) => {
  if (req.user.level !== "graduate") {
    return res.status(403).json({ message: "Only graduate students can upload compliance forms." });
  }

  const { researchId, complianceForm } = req.body;

  const research = await Research.findByIdAndUpdate(
    researchId,
    { $push: { complianceForms: { file: complianceForm, uploadedBy: req.user._id } } },
    { new: true }
  );

  res.json({ message: "Compliance form uploaded", research });
});

// Upload chapters (1–3 + approved title)
router.post("/upload-chapters", checkAuth(["student"]), async (req, res) => {
  if (req.user.level !== "graduate") {
    return res.status(403).json({ message: "Only graduate students can upload chapters." });
  }

  const { researchId, title, chapters } = req.body; // chapters = [ch1, ch2, ch3]

  const research = await Research.findByIdAndUpdate(
    researchId,
    {
      approvedTitle: title,
      $push: { chapters: { uploadedBy: req.user._id, files: chapters } },
    },
    { new: true }
  );

  res.json({ message: "Graduate chapters uploaded", research });
});

// View consultation/defense schedules
router.get("/schedules", checkAuth(["student"]), async (req, res) => {
  if (req.user.level !== "graduate") {
    return res.status(403).json({ message: "Only graduate students can view schedules." });
  }

  const schedules = await Schedule.find({ "participants.user": req.user._id })
    .populate("research", "title")
    .populate("participants.user", "name email")
    .populate("createdBy", "name email");

  res.json(schedules);
});

// Get available consultation slots from adviser
router.get("/available-slots", checkAuth(["student"]), async (req, res) => {
  try {
    if (req.user.level !== "graduate") {
      return res.status(403).json({ message: "Only graduate students can view available slots." });
    }

    // Find student's research to get their adviser
    const research = await Research.findOne({ students: req.user._id })
      .populate("adviser", "name email");

    if (!research || !research.adviser) {
      return res.json({ message: "You don't have an assigned adviser yet.", slots: [] });
    }

    // Find available consultation slots (no student assigned yet or status is 'scheduled')
    const availableSlots = await Schedule.find({
      "participants.user": research.adviser._id,
      "participants.role": "adviser",
      type: "consultation",
      datetime: { $gte: new Date() }, // Only future slots
      status: "scheduled",
      $or: [
        { "participants.1": { $exists: false } }, // No student participant yet
        { "participants.role": { $ne: "student" } } // No student role in participants
      ]
    })
      .populate("participants.user", "name email")
      .populate("createdBy", "name email")
      .sort({ datetime: 1 });

    res.json({ adviser: research.adviser, slots: availableSlots });
  } catch (error) {
    console.error("Error fetching available slots:", error);
    res.status(500).json({ message: error.message });
  }
});

// Request consultation
router.post("/request-consultation", checkAuth(["student"]), async (req, res) => {
  try {
    if (req.user.level !== "graduate") {
      return res.status(403).json({ message: "Only graduate students can request consultations." });
    }

    const { scheduleId, message } = req.body;

    const schedule = await Schedule.findById(scheduleId)
      .populate("participants.user", "name email");

    if (!schedule) {
      return res.status(404).json({ message: "Schedule not found" });
    }

    // Check if slot is still available
    const hasStudent = schedule.participants.some(p => p.role === "student");
    if (hasStudent) {
      return res.status(400).json({ message: "This slot has already been requested by another student." });
    }

    // Check if schedule is in the past
    if (new Date(schedule.datetime) < new Date()) {
      return res.status(400).json({ message: "Cannot request past consultation slots." });
    }

    // Add student as participant
    schedule.participants.push({
      user: req.user._id,
      role: "student",
      status: "invited"
    });

    await schedule.save();

    // TODO: Send notification to adviser about the request

    const updatedSchedule = await Schedule.findById(scheduleId)
      .populate("participants.user", "name email")
      .populate("createdBy", "name email");

    res.json({ 
      message: "Consultation request submitted successfully. Your adviser will review it soon.", 
      schedule: updatedSchedule 
    });
  } catch (error) {
    console.error("Error requesting consultation:", error);
    res.status(500).json({ message: error.message });
  }
});

// Logout
router.post("/logout", checkAuth(["student"]), async (req, res) => {
  // Invalidate token client-side or manage session
  res.json({ message: "Graduate student logged out successfully" });
});

// Login route
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // Find user by email (instead of username)
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Return user data using name instead of username
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      studentId: user.studentId,
      token: generateToken(user._id)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Document routes
router.get("/documents", checkAuth(["student"]), getAvailableDocuments);
router.get("/documents/:id", checkAuth(["student"]), viewDocument);
router.get("/documents/:id/download", checkAuth(["student"]), downloadDocument);

export default router;

