import express from "express";
import { checkAuth } from "../middleware/auth.js";
import Research from "../models/Research.js";
import Schedule from "../models/Schedule.js";
import User from "../models/User.js";

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

  const schedules = await Schedule.find({ participants: req.user._id })
    .populate("research", "title")
    .populate("participants", "name email");

  res.json(schedules);
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

export default router;

