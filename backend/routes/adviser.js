import express from "express";
import { protect, checkAuth } from "../middleware/auth.js";
import Research from "../models/Research.js";

const router = express.Router();

// -------------------- PROTECTION --------------------
router.use(protect, checkAuth(["adviser"])); 
// ✅ Every route below requires adviser role

// -------------------- FEEDBACK --------------------
// Adviser submits feedback on a research
router.post("/feedback", async (req, res) => {
  const { researchId, feedback } = req.body;

  try {
    const research = await Research.findByIdAndUpdate(
      researchId,
      {
        $push: {
          feedback: {
            user: req.user._id,
            text: feedback,
            role: "adviser",
            createdAt: new Date(),
          },
        },
      },
      { new: true }
    ).populate("student adviser panel");

    res.json({ message: "Feedback submitted by adviser", research });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// -------------------- REVIEW RESEARCH --------------------
// Adviser approves or rejects research submission
router.post("/review", async (req, res) => {
  const { researchId, status } = req.body;

  try {
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const research = await Research.findByIdAndUpdate(
      researchId,
      { status },
      { new: true }
    );

    res.json({ message: `Research ${status}`, research });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// -------------------- UPDATE STAGE --------------------
// Adviser moves research to a new stage (e.g., Proposal, Defense, Final)
router.post("/stage", async (req, res) => {
  const { researchId, stage } = req.body;

  try {
    const research = await Research.findByIdAndUpdate(
      researchId,
      { stage },
      { new: true }
    );

    res.json({ message: `Moved to Stage ${stage}`, research });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// -------------------- SCHEDULE CONSULTATION --------------------
router.post("/consultation", async (req, res) => {
  const { studentId, date, note } = req.body;

  try {
    const consultation = new Consultation({
      student: studentId,
      adviser: req.user._id,
      date,
      note,
    });
    await consultation.save();

    res.json({ message: "Consultation Scheduled", consultation });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// -------------------- VIEW CONSULTATION HISTORY --------------------
router.get("/consultations/:studentId", async (req, res) => {
  try {
    const consultations = await Consultation.find({
      student: req.params.studentId,
      adviser: req.user._id,
    }).populate("student adviser");

    res.json(consultations);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// -------------------- VIEW ASSIGNED RESEARCH --------------------
router.get("/my-research", async (req, res) => {
  try {
    const research = await Research.find({ adviser: req.user._id }).populate(
      "student adviser panel"
    );
    res.json(research);
  } catch (error) {
    res.status(500).json({ message: "Error fetching adviser research" });
  }
});

export default router;
