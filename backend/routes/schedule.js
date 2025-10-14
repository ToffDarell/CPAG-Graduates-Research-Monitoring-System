import express from "express";
import { checkAuth } from "../middleware/auth.js";
import Schedule from "../models/Schedule.js";

const router = express.Router();

/**
 * Chairperson: Create schedule
 */
router.post("/", checkAuth(["chairperson"]), async (req, res) => {
  try {
    const { research, student, adviser, panel, type, date, location } = req.body;
    const schedule = new Schedule({
      research,
      student,
      adviser,
      panel,
      chairperson: req.user._id,
      type,
      date,
      location
    });
    await schedule.save();
    res.status(201).json({ message: "Schedule created", schedule });
  } catch (err) {
    res.status(500).json({ message: "Error creating schedule", error: err.message });
  }
});

/**
 * All roles: View schedules
 */
router.get("/", checkAuth(["student", "adviser", "panel", "chairperson"]), async (req, res) => {
  try {
    const schedules = await Schedule.find()
      .populate("research", "title")
      .populate("student", "name email")
      .populate("adviser", "name email")
      .populate("panel", "name email")
      .populate("chairperson", "name email");
    res.json(schedules);
  } catch (err) {
    res.status(500).json({ message: "Error fetching schedules", error: err.message });
  }
});

/**
 * Chairperson: Update schedule
 */
router.put("/:id", checkAuth(["chairperson"]), async (req, res) => {
  try {
    const schedule = await Schedule.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!schedule) return res.status(404).json({ message: "Schedule not found" });
    res.json({ message: "Schedule updated", schedule });
  } catch (err) {
    res.status(500).json({ message: "Error updating schedule", error: err.message });
  }
});

/**
 * Chairperson: Delete schedule
 */
router.delete("/:id", checkAuth(["chairperson"]), async (req, res) => {
  try {
    const schedule = await Schedule.findByIdAndDelete(req.params.id);
    if (!schedule) return res.status(404).json({ message: "Schedule not found" });
    res.json({ message: "Schedule deleted" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting schedule", error: err.message });
  }
});

export default router;
