import express from "express";
import User from "../models/User.js";
import Research from "../models/Research.js";
import { protect, checkAuth } from "../middleware/auth.js"; // Fixed import
import nodemailer from "nodemailer";
import multer from "multer";
import path from "path";

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    if (extname) {
      return cb(null, true);
    }
    cb(new Error("Invalid file type!"));
  },
});

// Create transporter outside route handlers for reuse
const transporter = nodemailer.createTransport({
  // Configure your email service here
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// -------------------- AUTH PROTECTION --------------------
router.use(protect, checkAuth(["dean", "Dean"])); // Allow both case variations
// ✅ Every route below requires Admin/Dean role

// -------------------- MANAGE FACULTY ACCOUNTS --------------------
// Get all faculty
router.get("/faculty", async (req, res) => {
  try {
    const faculty = await User.find({ role: { $in: ["Faculty Adviser", "faculty adviser", "Program Head", "program head"] } }).select('-password');
    res.json(faculty);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Add faculty account
router.post("/faculty", async (req, res) => {
  const { name, email, role, password } = req.body;

  try {
    const user = new User({ name, email, role, password });
    await user.save();
    res.json({ message: "Faculty account created", user });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update faculty account
router.put("/faculty/:id", async (req, res) => {
  try {
    const updated = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.json({ message: "Faculty account updated", updated });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Remove faculty account
router.delete("/faculty/:id", async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "Faculty account removed" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// -------------------- VIEW RESEARCH RECORDS --------------------
router.get("/analytics", async (req, res) => {
  const total = await Research.countDocuments();
  const approved = await Research.countDocuments({ status: "approved" });
  const pending = await Research.countDocuments({ status: "pending" });
  const rejected = await Research.countDocuments({ status: "rejected" });
  const archived = await Research.countDocuments({ status: "archived" });

  res.json({ total, approved, pending, rejected, archived });
});

// View all research with details
router.get("/research", async (req, res) => {
  try {
    const research = await Research.find()
      .populate("students", "name email")
      .populate("adviser", "name email")
      .populate("panel")
      .sort({ createdAt: -1 });
    res.json(research);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// -------------------- ARCHIVE PROJECTS --------------------
router.put("/archive/:id", async (req, res) => {
  try {
    const research = await Research.findByIdAndUpdate(
      req.params.id,
      {
        status: "archived",
        archivedAt: new Date(),
        archivedBy: req.user.id,
      },
      { new: true }
    );
    if (!research) {
      return res.status(404).json({ message: "Research not found" });
    }
    res.json({ message: "Research archived successfully", research });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// -------------------- MONITORING & EVALUATION --------------------
router.get("/monitoring", async (req, res) => {
  try {
    const research = await Research.find()
      .populate("students", "name email")
      .populate("adviser", "name email")
      .sort({ updatedAt: -1 });

    // Also include feedback if Feedback model exists
    let feedback = [];
    try {
      const Feedback = (await import("../models/Feedback.js")).default;
      feedback = await Feedback.find()
        .populate("research", "title")
        .populate("student", "name")
        .populate("adviser", "name")
        .sort({ createdAt: -1 });
    } catch (feedbackError) {
      console.log("Feedback model not available");
    }

    res.json({ research, feedback });
  } catch (error) {
    res.status(500).json({ message: "Error fetching monitoring data" });
  }
});

// -------------------- PANEL ASSIGNMENTS --------------------
router.get("/panels", async (req, res) => {
  try {
    // Try to import Panel model
    const Panel = (await import("../models/Panel.js")).default;
    const panels = await Panel.find()
      .populate("research", "title students")
      .populate("members.faculty", "name email")
      .populate("assignedBy", "name")
      .sort({ createdAt: -1 });
    res.json(panels);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// -------------------- APPROVE & ASSIGN PANELS --------------------
router.put("/approve/:id", async (req, res) => {
  try {
    const research = await Research.findByIdAndUpdate(
      req.params.id,
      { status: "approved" },
      { new: true }
    );
    res.json({ message: "Research approved", research });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put("/assign-panel/:id", async (req, res) => {
  const { panelIds } = req.body; // array of faculty IDs
  try {
    const research = await Research.findByIdAndUpdate(
      req.params.id,
      { panel: panelIds },
      { new: true }
    ).populate("panel");
    res.json({ message: "Panel assigned", research });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// -------------------- DOCUMENT MANAGEMENT --------------------
router.post("/documents", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Try to import Document model
    const Document = (await import("../models/Document.js")).default;
    const document = new Document({
      title: req.body.title,
      description: req.body.description,
      category: req.body.category,
      filename: req.file.originalname,
      filepath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedBy: req.user.id,
      accessibleTo: req.body.accessibleTo ? JSON.parse(req.body.accessibleTo) : ["dean"],
    });

    await document.save();
    res.json({ message: "Document uploaded successfully", document });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/documents", async (req, res) => {
  try {
    // Try to import Document model
    const Document = (await import("../models/Document.js")).default;
    const documents = await Document.find({ isActive: true })
      .populate("uploadedBy", "name")
      .sort({ createdAt: -1 });
    res.json(documents);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Legacy upload route for backward compatibility
router.post("/upload", upload.single("file"), async (req, res) => {
  res.json({
    message: "Document uploaded successfully",
    file: req.file,
  });
});

// -------------------- SETTINGS --------------------
router.post("/settings", async (req, res) => {
  const { name, value } = req.body;
  const setting = await SystemSetting.findOneAndUpdate(
    { name },
    { value },
    { upsert: true, new: true }
  );
  res.json(setting);
});

router.get("/settings", async (req, res) => {
  const settings = await SystemSetting.find();
  res.json(settings);
});

// -------------------- LOGOUT --------------------
router.post("/logout", (req, res) => {
  // Just instruct client to clear token
  res.json({ message: "Logged out successfully" });
});

// -------------------- INVITE FACULTY (via email with token) --------------------
router.post("/invite-faculty", async (req, res) => {
  const { email, name, role } = req.body;

  try {
    // Validate institutional email domain
    const emailDomain = '@' + email.split('@')[1];
    
    if (emailDomain !== '@buksu.edu.ph') {
      return res.status(400).json({ 
        message: "Faculty must use @buksu.edu.ph email address" 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User with this email already exists" });
    }

    // Generate invitation token
    const crypto = await import('crypto');
    const invitationToken = crypto.default.randomBytes(32).toString('hex');
    const invitationExpires = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

    // Create user with invitation token (no password yet)
    const newUser = new User({
      name,
      email,
      role,
      invitationToken,
      invitationExpires,
      isActive: false,
      password: 'temporary' // Will be replaced when they register
    });
    await newUser.save();

    // Create invitation link
    const invitationLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/register?token=${invitationToken}`;

    // Send email notification
    console.log(`Attempting to send email to: ${email}`);
    console.log(`Using EMAIL_USER: ${process.env.EMAIL_USER}`);
    
    const emailResult = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Faculty Invitation - Masteral Archive and Monitoring System",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #7C1D23;">Wbselcome to Masteral Archive and Monitoring System</h2>
          <p>Hello <strong>${name}</strong>,</p>
          <p>You have been invited to join as a <strong>${role}</strong> in our system.</p>
          <p>Please click the button below to complete your registration and set your password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${invitationLink}" 
               style="background-color: #7C1D23; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Complete Registration
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">This invitation link will expire in 7 days.</p>
          <p style="color: #666; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="color: #7C1D23; font-size: 12px; word-break: break-all;">${invitationLink}</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />
          <p style="color: #999; font-size: 12px;">If you didn't expect this invitation, please ignore this email.</p>
        </div>
      `,
    });

    console.log(`Email sent successfully:`, emailResult.messageId);
    res.json({ message: `Invitation sent successfully to ${email}!`, user: { name, email, role } });
  } catch (error) {
    console.error("Invitation error:", error);
    res.status(400).json({ message: error.message || "Error sending invitation" });
  }
});

// Add error handling for email operations
router.post("/send-email", async (req, res) => {
  try {
    const { to, subject, text } = req.body;
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      text,
    });
    res.json({ message: "Email sent successfully" });
  } catch (error) {
    console.error("Email error:", error);
    res.status(500).json({ message: "Failed to send email" });
  }
});

export default router;
