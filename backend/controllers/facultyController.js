import Research from "../models/Research.js";
import Feedback from "../models/Feedback.js";
import Schedule from "../models/Schedule.js";
import User from "../models/User.js";

// Get student submissions
export const getStudentSubmissions = async (req, res) => {
  try {
    const research = await Research.find({ 
      adviser: req.user.id,
      forms: { $exists: true, $not: {$size: 0} } // Only return research with forms
    })
    .populate("students", "name email")
    .sort({ updatedAt: -1 });
    
    res.json(research);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update thesis status
export const updateThesisStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, stage, progress } = req.body;
    
    const research = await Research.findByIdAndUpdate(
      id,
      { status, stage, progress },
      { new: true }
    ).populate("students", "name email");
    
    res.json({ message: "Thesis status updated successfully", research });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Approve/reject submission
export const approveRejectSubmission = async (req, res) => {
  try {
    const { researchId, fileId, action, message } = req.body;
    
    const research = await Research.findById(researchId);
    if (!research) {
      return res.status(404).json({ message: "Research not found" });
    }

    const file = research.files.id(fileId);
    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    file.status = action; // "approved" or "rejected"
    await research.save();

    // Create feedback record
    const feedback = new Feedback({
      research: researchId,
      student: research.students[0], // Assuming single student for now
      adviser: req.user.id,
      type: action === "approved" ? "approval" : "rejection",
      message,
    });

    await feedback.save();
    res.json({ message: `Submission ${action} successfully`, feedback });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Upload feedback
export const uploadFeedback = async (req, res) => {
  try {
    const { researchId, message, type } = req.body;
    
    const research = await Research.findById(researchId);
    if (!research) {
      return res.status(404).json({ message: "Research not found" });
    }

    const feedback = new Feedback({
      research: researchId,
      student: research.students[0],
      adviser: req.user.id,
      type: type || "feedback",
      message,
      file: req.file ? {
        filename: req.file.originalname,
        filepath: req.file.path,
      } : undefined,
    });

    await feedback.save();
    res.json({ message: "Feedback uploaded successfully", feedback });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get consultation schedules
export const getConsultationSchedules = async (req, res) => {
  try {
    const schedules = await Schedule.find({
      "participants.user": req.user.id,
      type: "consultation",
    })
      .populate("research", "title students")
      .populate("participants.user", "name email")
      .sort({ datetime: 1 });
    
    res.json(schedules);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get my students (modified to include research titles)
export const getMyStudents = async (req, res) => {
  try {
    console.log("Getting assigned students for faculty:", req.user.id);
    const research = await Research.find({ 
      adviser: req.user.id,
      status: { $ne: 'archived' } // Exclude archived research
    })
    .populate("students", "name email")
    .populate("adviser", "name email")
    .select("title students status stage progress updatedAt");
    
    console.log("Found research assignments:", research);
    res.json(research);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get detailed student information
export const getDetailedStudentInfo = async (req, res) => {
  try {
    const research = await Research.find({ adviser: req.user.id })
      .populate("students", "name email")
      .populate("adviser", "name email ")
      .select("title description status stage progress startDate endDate createdAt updatedAt");
    
    // Group research by student for better organization
    const studentDetails = research.reduce((acc, curr) => {
      curr.students.forEach(student => {
        if (!acc[student._id]) {
          acc[student._id] = {
            student: {
              id: student._id,
              name: student.name,
              email: student.email,
              
            },
            research: []
          };
        }
        acc[student._id].research.push({
          id: curr._id,
          title: curr.title,
          description: curr.description,
          status: curr.status,
          stage: curr.stage,
          progress: curr.progress,
          startDate: curr.startDate,
          endDate: curr.endDate,
          createdAt: curr.createdAt,
          updatedAt: curr.updatedAt
        });
      });
      return acc;
    }, {});

    res.json(Object.values(studentDetails));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

