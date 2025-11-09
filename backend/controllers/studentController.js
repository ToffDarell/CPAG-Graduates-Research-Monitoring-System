import Research from "../models/Research.js";
import Feedback from "../models/Feedback.js";
import Schedule from "../models/Schedule.js";
import Document from "../models/Document.js";
import Activity from "../models/Activity.js";
import fs from "fs";
import path from "path";

// Upload compliance form
export const uploadComplianceForm = async (req, res) => {
  try {
    console.log("Upload compliance form request:", req.body);
    console.log("Uploaded file:", req.file);
    
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const { researchId } = req.body;
    
    if (!researchId) {
      return res.status(400).json({ message: "Research ID is required" });
    }
    
    const research = await Research.findById(researchId);
    
    if (!research) {
      return res.status(404).json({ message: "Research not found" });
    }

    // Add file to research
    research.forms.push({
      filename: req.file.originalname,
      filepath: req.file.path,
      type: "compliance",
      status: "pending",
      uploadedBy: req.user.id,
      uploadedAt: new Date(),
    });

    await research.save();
    res.json({ message: "Compliance form uploaded successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Upload research chapter
export const uploadChapter = async (req, res) => {
  try {
    console.log("Upload chapter request:", req.body);
    console.log("Uploaded file:", req.file);
    
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const { researchId, chapterType } = req.body;
    
    if (!researchId) {
      return res.status(400).json({ message: "Research ID is required" });
    }
    
    const research = await Research.findById(researchId);
    
    if (!research) {
      return res.status(404).json({ message: "Research not found" });
    }

    // Add file to research
    research.forms.push({
      filename: req.file.originalname,
      filepath: req.file.path,
      type: chapterType, // "chapter1", "chapter2", "chapter3"
      status: "pending",
      uploadedBy: req.user.id,
      uploadedAt: new Date(),
    });

    // Update progress based on chapter
    const chapterProgress = {
      chapter1: 25,
      chapter2: 50,
      chapter3: 75,
    };

    if (chapterProgress[chapterType]) {
      research.progress = Math.max(research.progress, chapterProgress[chapterType]);
    }

    await research.save();
    res.json({ message: "Chapter uploaded successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get my schedules
export const getMySchedules = async (req, res) => {
  try {
    const schedules = await Schedule.find({
      "participants.user": req.user.id,
    })
      .populate("research", "title")
      .populate("participants.user", "name email")
      .sort({ datetime: 1 });
    
    res.json(schedules);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get adviser feedback
export const getAdviserFeedback = async (req, res) => {
  try {
    const feedback = await Feedback.find({
      student: req.user.id,
    })
      .populate("research", "title")
      .populate("adviser", "name")
      .sort({ createdAt: -1 });
    
    res.json(feedback);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get my research
export const getMyResearch = async (req, res) => {
  try {
    const research = await Research.find({
      students: req.user.id,
    })
      .populate("adviser", "name email")
      .sort({ updatedAt: -1 });
    
    res.json(research);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get available documents
export const getAvailableDocuments = async (req, res) => {
  try {
    const documents = await Document.find({
      isActive: true,
      accessibleTo: { $in: ["graduate student"] },
    })
      .populate("uploadedBy", "name")
      .sort({ createdAt: -1 });
    
    res.json(documents);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Download document
export const downloadDocument = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    
    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Check access
    const hasAccess = document.accessibleTo.includes("graduate student") || 
    document.uploadedBy.toString() === req.user.id;
    
    if (!hasAccess) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Construct file path
    let filePath;
    if (path.isAbsolute(document.filepath)) {
      filePath = document.filepath;
    } else {
      filePath = path.join(process.cwd(), 'uploads', path.basename(document.filepath));
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      const altPath = path.join(process.cwd(), document.filepath);
      if (fs.existsSync(altPath)) {
        filePath = altPath;
      } else {
        return res.status(404).json({ message: "File not found on server" });
      }
    }

    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "download",
      entityType: "document",
      entityId: document._id,
      entityName: document.title,
      description: `Downloaded document: ${document.title}`,
      metadata: { category: document.category, filename: document.filename }
    });

    // Send file
    res.download(filePath, document.filename);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// View document (for inline viewing)
export const viewDocument = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    
    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Check access
    const hasAccess = document.accessibleTo.includes("graduate student") || 
                      document.uploadedBy.toString() === req.user.id;
    
    if (!hasAccess) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Construct file path
    let filePath;
    if (path.isAbsolute(document.filepath)) {
      filePath = document.filepath;
    } else {
      filePath = path.join(process.cwd(), 'uploads', path.basename(document.filepath));
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      const altPath = path.join(process.cwd(), document.filepath);
      if (fs.existsSync(altPath)) {
        filePath = altPath;
      } else {
        return res.status(404).json({ message: "File not found on server" });
      }
    }

    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "view",
      entityType: "document",
      entityId: document._id,
      entityName: document.title,
      description: `Viewed document: ${document.title}`,
      metadata: { category: document.category }
    });

    // Send file for inline viewing
    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${document.filename}"`);
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
