import Panel from "../models/Panel.js";
import Schedule from "../models/Schedule.js";
import Research from "../models/Research.js";
import User from "../models/User.js";
import Document from "../models/Document.js";

// Get panel members
export const getPanelMembers = async (req, res) => {
  try {
    const panels = await Panel.find()
      .populate("research", "title students")
      .populate("members.faculty", "name email")
      .sort({ createdAt: -1 });
    res.json(panels);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Assign panel members
export const assignPanelMembers = async (req, res) => {
  try {
    const { researchId, members } = req.body;

    // Check if panel already exists
    let panel = await Panel.findOne({ research: researchId });
    
    if (panel) {
      panel.members = members;
      panel.assignedBy = req.user.id;
    } else {
      panel = new Panel({
        research: researchId,
        members,
        assignedBy: req.user.id,
      });
    }

    await panel.save();
    res.json({ message: "Panel members assigned successfully", panel });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get schedules
export const getSchedules = async (req, res) => {
  try {
    const schedules = await Schedule.find()
      .populate("research", "title students")
      .populate("participants.user", "name email")
      .populate("createdBy", "name")
      .sort({ datetime: 1 });
    res.json(schedules);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create schedule
export const createSchedule = async (req, res) => {
  try {
    const schedule = new Schedule({
      ...req.body,
      createdBy: req.user.id,
    });
    await schedule.save();
    res.json({ message: "Schedule created successfully", schedule });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update schedule
export const updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const schedule = await Schedule.findByIdAndUpdate(id, req.body, { new: true });
    res.json({ message: "Schedule updated successfully", schedule });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete schedule
export const deleteSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    await Schedule.findByIdAndDelete(id);
    res.json({ message: "Schedule deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get process monitoring data
export const getProcessMonitoring = async (req, res) => {
  try {
    const research = await Research.find()
      .populate("students", "name email")
      .populate("adviser", "name email")
      .sort({ updatedAt: -1 });

    const schedules = await Schedule.find()
      .populate("research", "title")
      .sort({ datetime: 1 });

    const stats = {
      total: research.length,
      completed: research.filter(r => r.status === "completed").length,
      inProgress: research.filter(r => r.status === "in-progress").length,
      pending: research.filter(r => r.status === "pending").length,
    };

    res.json({ research, schedules, stats });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Upload form
export const uploadForm = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const document = new Document({
      title: req.body.title,
      description: req.body.description,
      category: "form",
      filename: req.file.originalname,
      filepath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedBy: req.user.id,
      accessibleTo: ["dean", "program head", "faculty adviser"],
    });

    await document.save();
    res.json({ message: "Form uploaded successfully", document });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get research records
export const getResearchRecords = async (req, res) => {
  try {
    const research = await Research.find()
      .populate("students", "name email")
      .populate("adviser", "name email")
      .sort({ createdAt: -1 });
    res.json(research);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get available faculty advisers
export const getAvailableAdvisers = async (req, res) => {
  try {
    const advisers = await User.find({
      role: "faculty adviser",
      isActive: true,
    }).select("name email");
    res.json(advisers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Assign faculty adviser to research
export const assignAdviser = async (req, res) => {
  try {
    const { researchId, adviserId } = req.body;

    const research = await Research.findByIdAndUpdate(
      researchId,
      { adviser: adviserId },
      { new: true }
    )
      .populate("students", "name email")
      .populate("adviser", "name email");

    if (!research) {
      return res.status(404).json({ message: "Research not found" });
    }

    res.json({ message: "Adviser assigned successfully", research });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Remove faculty adviser from research
export const removeAdviser = async (req, res) => {
  try {
    const { researchId } = req.body;

    const research = await Research.findByIdAndUpdate(
      researchId,
      { adviser: null },
      { new: true }
    )
      .populate("students", "name email")
      .populate("adviser", "name email");

    if (!research) {
      return res.status(404).json({ message: "Research not found" });
    }

    res.json({ message: "Adviser removed successfully", research });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Share research record with Dean
export const shareWithDean = async (req, res) => {
  try {
    const { researchId } = req.body;

    const research = await Research.findByIdAndUpdate(
      researchId,
      { 
        sharedWithDean: true,
        sharedAt: new Date(),
        sharedBy: req.user.id
      },
      { new: true }
    )
      .populate("students", "name email")
      .populate("adviser", "name email");

    if (!research) {
      return res.status(404).json({ message: "Research not found" });
    }

    res.json({ message: "Research shared with Dean successfully", research });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Archive research
export const archiveResearch = async (req, res) => {
  try {
    const { id } = req.params;

    const research = await Research.findByIdAndUpdate(
      id,
      { 
        status: "archived",
        archivedAt: new Date(),
        archivedBy: req.user.id
      },
      { new: true }
    )
      .populate("students", "name email")
      .populate("adviser", "name email");

    if (!research) {
      return res.status(404).json({ message: "Research not found" });
    }

    res.json({ message: "Research archived successfully", research });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create new research title with students
export const createResearchTitle = async (req, res) => {
  try {
    const { title, studentIds } = req.body;

    const research = new Research({
      title,
      students: studentIds,
      status: 'pending'
    });

    await research.save();

    const populatedResearch = await Research.findById(research._id)
      .populate("students", "name email")
      .populate("adviser", "name email");

    res.status(201).json({ message: "Research title created successfully", research: populatedResearch });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all students
export const getStudents = async (req, res) => {
  try {
    const students = await User.find({
      role: "graduate student"  // Exact match with database role
    }).select("name email");
    
    // Add debugging logs
    console.log("Found graduate students:", students);
    res.json(students);
  } catch (error) {
    console.error("Error fetching students:", error);
    res.status(500).json({ message: error.message });
  }
};

// Add students to research
export const addStudentsToResearch = async (req, res) => {
  try {
    const { researchId, studentIds } = req.body;

    const research = await Research.findByIdAndUpdate(
      researchId,
      { $set: { students: studentIds } },
      { new: true }
    )
      .populate("students", "name email")
      .populate("adviser", "name email");

    if (!research) {
      return res.status(404).json({ message: "Research not found" });
    }

    res.json({ message: "Students added successfully", research });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

