import Research from "../models/Research.js";
import User from "../models/User.js";
import Document from "../models/Document.js";
import Panel from "../models/Panel.js";
import Feedback from "../models/Feedback.js";
import Activity from "../models/Activity.js";
import mongoose from "mongoose";
import nodemailer from "nodemailer";

//Helper function to log activity
const logActivity = async (userId, action, entityType, entityId, entityName, description, metadata = {}, req = null) => {
  try {
    console.log('📝 Logging activity:', { action, entityType, entityName, userId });
    
    const activity = await Activity.create({
      user: userId,
      action,
      entityType,
      entityId: entityId || null,
      entityName,
      description,
      metadata,
      ipAddress: req?.ip || null,
      userAgent: req?.headers?.['user-agent'] || null
    });
    
    console.log('✅ Activity logged successfully:', activity._id);
  } catch (error) {
    console.error('❌ Error logging activity:', error);
    console.error('Error details:', {
      userId,
      action,
      entityType,
      entityId,
      entityName,
      errorMessage: error.message,
      errorStack: error.stack
    });
  }
};

// Get faculty list
export const getFaculty = async (req, res) => {
  try {
    const faculty = await User.find({
      role: { $in: ["faculty adviser", "program head"] },
    }).select("-password");
    res.json(faculty);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add remarks/feedback for research
export const addResearchRemarks = async (req, res) => {
  try {
    const { researchId } = req.params;
    const { message, type = 'dean_feedback' } = req.body;
    
    const research = await Research.findById(researchId);
    if (!research) {
      return res.status(404).json({ message: "Research not found" });
    }
    
    // Create feedback record
    const feedback = new Feedback({
      research: researchId,
      student: research.students[0], // Assuming single student
      adviser: research.adviser,
      type: type,
      message: message,
      status: 'pending'
    });
    
    await feedback.save();
    
    // Update research with dean feedback flag
    research.sharedWithDean = true;
    research.sharedAt = new Date();
    research.sharedBy = req.user.id;
    await research.save();

    await logActivity(req.user.id, 'add_research_remarks', 'feedback', feedback._id, feedback.title, 
    `Added remarks for research: ${research.title}`, { researchId: researchId }, req);
    
    res.json({ message: "Remarks added successfully", feedback });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get research feedback
export const getResearchFeedback = async (req, res) => {
  try {
    const { researchId } = req.params;
    
    const feedback = await Feedback.find({ research: researchId })
      .populate("student", "name")
      .populate("adviser", "name")
      .sort({ createdAt: -1 });
    
    await logActivity(req.user.id, 'get_research_feedback', 'feedback', researchId, research.title, `Fetched feedback for research: ${research.title}`, { researchId: researchId }, req);
    res.json(feedback);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const toggleFacultyActivation = async (req, res) => {
  try {
    const { id } = req.params;
    const faculty = await User.findById(id);

    if (!faculty) {
      return res.status(404).json({ message: "Faculty member not found" });
    }

    faculty.isActive = !faculty.isActive;
    await faculty.save();

    await logActivity(
      req.user.id,
      faculty.isActive ? 'activate' : 'deactivate',
      'user',
      id,
      faculty.name,
      `${faculty.isActive ? 'Activated' : 'Deactivated'} faculty: ${faculty.name}`,
      { role: faculty.role, email: faculty.email },
      req
    );

    res.json({ message: `Faculty member status updated ${faculty.isActive ? 'activated' : 'deactivated'} sucessfully`,
    faculty: {
      _id: faculty._id,
      name: faculty.name,
      email: faculty.email,
      role: faculty.role,
      isActive: faculty.isActive
    }
  });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete faculty member
export const deleteFaculty = async (req, res) => {
  try {
    const { id } = req.params;
    const faculty = await User.findById(id);
    
    if (!faculty) {
      return res.status(404).json({ message: "Faculty not found" });
    }

    const facultyName = faculty.name;
    await User.findByIdAndDelete(id);

    await logActivity(
      req.user.id,
      'delete',
      'user',
      id,
      facultyName,
      `Deleted faculty: ${facultyName}`,
      { role: faculty.role, email: faculty.email },
      req
    );

    res.json({ message: "Faculty deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get analytics
export const getAnalytics = async (req, res) => {
  const total = await Research.countDocuments();
  const approved = await Research.countDocuments({ status: "approved" });
  const pending = await Research.countDocuments({ status: "pending" });
  const rejected = await Research.countDocuments({ status: "rejected" });
  const archived = await Research.countDocuments({ status: "archived" });

  res.json({ total, approved, pending, rejected, archived });
};

// Get research records
export const getResearchRecords = async (req, res) => {
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
};

// Archive or Unarchive research project
export const archiveResearch = async (req, res) => {
  try {
    console.log(' Archive research called:', req.params.id);
    console.log('User:', req.user?.id, req.user?.name);
    
    const research = await Research.findById(req.params.id);
    
    if (!research) {
      console.log(' Research not found');
      return res.status(404).json({ message: "Research not found" });
    }

    console.log('📊 Research found:', research.title, 'Current status:', research.status);

    // Toggle archive status
    const newStatus = research.status === 'archived' ? 'approved' : 'archived';
    const updateData = {
      status: newStatus
    };

    if (newStatus === 'archived') {
      updateData.archivedAt = new Date();
      updateData.archivedBy = req.user.id;
    } else {
      // Unarchiving
      updateData.archivedAt = null;
      updateData.archivedBy = null;
    }

    const updatedResearch = await Research.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    console.log('💾 Research updated, now logging activity...');
    
    await logActivity(
      req.user.id,
      newStatus === 'archived' ? 'archive' : 'restore',
      'research',
      req.params.id,
      research.title,
      `${newStatus === 'archived' ? 'Archived' : 'Restored'} research: ${research.title}`,
      { previousStatus: research.status },
      req
    );

    console.log('✅ Archive research completed');

    res.json({ 
      message: `Research ${newStatus === 'archived' ? 'archived' : 'unarchived'} successfully`, 
      research: updatedResearch 
    });
  } catch (error) {
    console.error('❌ Error in archiveResearch:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get monitoring and evaluation data
export const getMonitoringData = async (req, res) => {
  try {
    const { search, status, department } = req.query;
    
    // Build query object
    let query = {};
    
    // Search functionality
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { 'adviser.name': { $regex: search, $options: 'i' } },
        { 'students.name': { $regex: search, $options: 'i' } }
      ];
    }
    
    // Status filter
    if (status && status !== 'all') {
      query.status = status;
    }
    
    // Department filter (if you have department field)
    if (department && department !== 'all') {
      query.department = department;
    }

    const research = await Research.find(query)
      .populate("students", "name email department")
      .populate("adviser", "name email department")
      .sort({ updatedAt: -1 });

    // Include feedback
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
};

// Get panel assignments
export const getPanelAssignments = async (req, res) => {
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
};

// Get archived documents
export const getArchivedDocuments = async (req, res) => {
  try {
    const Document = (await import("../models/Document.js")).default;
    const documents = await Document.find({ isActive: false })
      .populate("uploadedBy", "name")
      .sort({ createdAt: -1 });
    res.json(documents);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Restore archived document
export const restoreDocument = async (req, res) => {
  try {
    const Document = (await import("../models/Document.js")).default;
    const document = await Document.findById(req.params.id);
    
    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Check if user is dean
    if (req.user.role !== 'dean') {
      return res.status(403).json({ message: "Only dean can restore documents" });
    }

    // Restore the document
    document.isActive = true;
    await document.save();

    await logActivity(
      req.user.id,
      'restore',
      'document',
      document._id,
      document.title,
      `Restored document: ${document.title}`,
      { category: document.category },
      req
    );

    res.json({ message: "Document restored successfully", document });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Upload document
export const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    console.log('Uploaded file details:', {
      originalname: req.file.originalname,
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    // Check if file actually exists
    const fs = await import('fs');
    if (!fs.existsSync(req.file.path)) {
      console.error('File was not saved properly:', req.file.path);
      return res.status(500).json({ message: "File was not saved properly" });
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
    console.log('Document saved successfully:', document._id);
    
    // Log activity
    await logActivity(
      req.user.id,
      'upload',
      'document',
      document._id,
      document.title,
      `Uploaded document: ${document.title}`,
      { category: document.category, fileSize: document.fileSize },
      req
    );
    
    res.json({ message: "Document uploaded successfully", document });
  } catch (error) {
    console.error('Document upload error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: error.message || 'Error uploading document',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

//Download document
export const downloadDocument = async (req, res) => {
  try {
    const Document = (await import("../models/Document.js")).default;
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    const isUploader = document.uploadedBy.toString() === req.user.id;
    const hasRoleAccess = document.accessibleTo.includes(req.user.role);


    // Check if user has access to this document
    if (!isUploader && !hasRoleAccess) {
      return res.status(403).json({ message: "You are not authorized to download this document" });
    }

    const fs = await import('fs');
    const path = await import('path');

    // Construct the correct file path
    let filePath;
    if (path.isAbsolute(document.filepath)) {
      filePath = document.filepath;
    } else {
      filePath = path.join(process.cwd(), 'backend', 'uploads', path.basename(document.filepath));
    }
    
    console.log('Looking for file at:', filePath); // Debug log
    console.log('Original filepath:', document.filepath); // Debug log

    // Log activity before sending file
    await logActivity(
      req.user.id,
      'download',
      'document',
      document._id,
      document.title,
      `Downloaded document: ${document.title}`,
      { category: document.category, filename: document.filename },
      req
    );

    if (!fs.existsSync(filePath)) {
      // Try alternative path
      const altPath = path.join(process.cwd(), document.filepath);
      console.log('Trying alternative path:', altPath);
      
      if (fs.existsSync(altPath)) {
        res.setHeader('Content-Disposition', `attachment; filename="${document.filename}"`);
        res.setHeader('Content-Type', document.mimeType);
        const fileStream = fs.createReadStream(altPath);
        fileStream.pipe(res);
        return;
      }
      
      return res.status(404).json({ message: "File not found on server" });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${document.filename}"`);
    res.setHeader('Content-Type', document.mimeType);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Delete document
export const deleteDocument = async (req, res) => {
  try {
    const Document = (await import("../models/Document.js")).default;
    const document = await Document.findById(req.params.id);
    
    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Check if user is the uploader or dean
    if (document.uploadedBy.toString() !== req.user.id && req.user.role !== 'dean') {
      return res.status(403).json({ message: "Access denied" });
    }

    // Before deletion
await Activity.create({
  user: req.user.id,
  action: 'delete',
  entityType: 'document',
  entityId: document._id,
  entityName: document.title,
  description: `Permanently deleted document: ${document.title}`
});

    // Delete file from filesystem
    const fs = await import('fs');
    if (fs.existsSync(document.filepath)) {
      fs.unlinkSync(document.filepath);
    }

    await Document.findByIdAndDelete(req.params.id);
    res.json({ message: "Document deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
  
};

// Archive document (soft delete)
export const archiveDocument = async (req, res) => {
  try {
    console.log(' Archive document request:', req.params.id);
    console.log('User role:', req.user?.role);
    console.log('User ID:', req.user?.id);
    
    const Document = (await import("../models/Document.js")).default;
    const document = await Document.findById(req.params.id);
    
    if (!document) {
      console.log(' Document not found:', req.params.id);
      return res.status(404).json({ message: "Document not found" });
    }

    console.log(' Document found:', document.title);
    console.log('Document uploadedBy:', document.uploadedBy);

    // Check if user is the uploader or dean
    if (document.uploadedBy.toString() !== req.user.id && req.user.role !== 'dean') {
      console.log(' Access denied - not uploader or dean');
      return res.status(403).json({ message: "Access denied" });
    }

    // Archive the document by setting isActive to false
    document.isActive = false;
    await document.save();
    
    console.log(' Document archived, now logging activity...');

    await logActivity(
      req.user.id,
      'archive',
      'document',
      document._id,
      document.title,
      `Archived document: ${document.title}`,
      { category: document.category },
      req
    );

    console.log(' Document archived successfully:', document._id);
    res.json({ message: "Document archived successfully" });
  } catch (error) {
    console.error('Archive document error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ message: error.message });
  }

  // After archive
await Activity.create({
  user: req.user.id,
  action: 'archive',
  entityType: 'document',
  entityId: document._id,
  entityName: document.title,
  description: `Archived document: ${document.title}`
});
};


// Get documents
export const getDocuments = async (req, res) => {
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
};

// View document (for inline viewing)
export const viewDocument = async (req, res) => {
  try {
    const Document = (await import("../models/Document.js")).default;
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Check if user has access to this document
    const isUploader = document.uploadedBy.toString() === req.user.id;
    const hasRoleAccess = document.accessibleTo.includes(req.user.role);

    if (!isUploader && !hasRoleAccess) {
      return res.status(403).json({message: "You are not authorized to view this document"});
    }
    const fs = await import('fs');
    const path = await import('path');

    // Construct the correct file path
    let filePath;
    if (path.isAbsolute(document.filepath)) {
      filePath = document.filepath;
    } else {
      filePath = path.join(process.cwd(), 'backend', 'uploads', path.basename(document.filepath));
    }
    
    console.log('Looking for file at:', filePath);

    // Log activity before viewing
    await logActivity(
      req.user.id,
      'view',
      'document',
      document._id,
      document.title,
      `Viewed document: ${document.title}`,
      { category: document.category },
      req
    );

    if (!fs.existsSync(filePath)) {
      // Try alternative path
      const altPath = path.join(process.cwd(), document.filepath);
      console.log('Trying alternative path:', altPath);
      
      if (fs.existsSync(altPath)) {
        res.setHeader('Content-Type', document.mimeType);
        res.setHeader('Content-Disposition', `inline; filename="${document.filename}"`);
        const fileStream = fs.createReadStream(altPath);
        fileStream.pipe(res);
        return;
      }
      
      return res.status(404).json({ message: "File not found on server" });
    }

    // Set headers for inline viewing
    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${document.filename}"`);
    
    // For PDFs, add additional headers for better browser support
    if (document.mimeType === 'application/pdf') {
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    }

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('View document error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Update faculty member
export const updateFaculty = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    
    // Remove password from update if not provided (to avoid validation errors)
    if (!updateData.password) {
      delete updateData.password;
    }

    if (updateData.name) {
      const existingUser = await User.findOne({ 
        name: { $regex: new RegExp(`^${updateData.name}$`, 'i') },
        _id: { $ne: id } 
      });
      
      if (existingUser) {
        return res.status(400).json({ 
          message: "A faculty member with this name already exists. Please use a different name." 
        });
      }
    }
    
    // Check if email is being changed and if it already exists
    if (updateData.email) {
      const existingUser = await User.findOne({ 
        email: { $regex: new RegExp(`^${updateData.email}$`, 'i') },
        _id: { $ne: id } 
      });
      
      if (existingUser) {
        return res.status(400).json({ 
          message: "A faculty member with this email already exists. Please use a different email." 
        });
      }
    }
    
    const updated = await User.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true
    }).select('-password');
    
    if (!updated) {
      return res.status(404).json({ message: "Faculty member not found" });
    }
    
    await logActivity(
      req.user.id,
      'update',
      'user',
      id,
      updated.name,
      `Updated faculty profile: ${updated.name}`,
      { updatedFields: Object.keys(updateData) },
      req
    );
    
    res.json({ message: "Faculty account updated successfully", updated });
  } catch (error) {
    console.error('Update faculty error:', error);
    
    // Handle specific validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        message: "Validation error", 
        errors: errors 
      });
    }
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const fieldName = field === 'email' ? 'email' : 'name'; // Determine which field caused the conflict
      return res.status(400).json({ 
        message: `A faculty member with this ${fieldName} already exists. Please use a different ${fieldName}.` 
      });
    }
    
    res.status(500).json({ 
      message: "Error updating faculty", 
      error: error.message 
    });
  }
};

// Create faculty account
export const createFaculty = async (req, res) => {
  const { name, email, role, password } = req.body;

  try {
    const user = new User({ name, email, role, password });
    await user.save();
    
    await logActivity(
      req.user.id,
      'create',
      'user',
      user._id,
      user.name,
      `Created faculty account: ${user.name}`,
      { role: user.role, email: user.email },
      req
    );
    
    res.json({ message: "Faculty account created", user });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Approve research
export const approveResearch = async (req, res) => {
  try {
    const research = await Research.findByIdAndUpdate(
      req.params.id,
      { status: "approved" },
      { new: true }
    );
    
    await logActivity(
      req.user.id,
      'approve',
      'research',
      req.params.id,
      research.title,
      `Approved research: ${research.title}`,
      { previousStatus: 'pending' },
      req
    );
    
    res.json({ message: "Research approved", research });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Assign panel
export const assignPanel = async (req, res) => {
  const { panelIds } = req.body; // array of faculty IDs
  try {
    const research = await Research.findByIdAndUpdate(
      req.params.id,
      { panel: panelIds },
      { new: true }
    ).populate("panel");
    
    await logActivity(
      req.user.id,
      'assign',
      'panel',
      req.params.id,
      research.title,
      `Assigned panel to research: ${research.title}`,
      { panelCount: panelIds.length },
      req
    );
    
    res.json({ message: "Panel assigned", research });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Legacy upload
export const legacyUpload = async (req, res) => {
  res.json({
    message: "Document uploaded successfully",
    file: req.file,
  });
};

// Update settings
export const updateSettings = async (req, res) => {
  const { name, value } = req.body;
  const setting = await SystemSetting.findOneAndUpdate(
    { name },
    { value },
    { upsert: true, new: true }
  );
  res.json(setting);
};

// Get settings
export const getSettings = async (req, res) => {
  const settings = await SystemSetting.find();
  res.json(settings);
};

// Logout
export const logout = (req, res) => {
  // Just instruct client to clear token
  res.json({ message: "Logged out successfully" });
};

// Send email
export const sendEmail = async (req, res) => {
  try {
    const { to, subject, text } = req.body;
    // Create transporter for email
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      text,
    });
    res.json({ message: "Email sent successfully" });
  } catch (error) {
    console.error("Email error:", error);
    res.status(500).json({ message: "Failed to send email" });
  }
};

// Invite faculty member
export const inviteFaculty = async (req, res) => {
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
    console.log(`Using EMAIL_USER: ${process.env.SMTP_FROM}`);
    
    // Create transporter for email
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.default.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    
    const emailResult = await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: "Faculty Invitation - CPAG Masteral Research Archive and Monitoring System",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #7C1D23;">Welcome to CPAG Masteral Research Archive and Monitoring System</h2>
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
    
    await logActivity(
      req.user.id,
      'invite',
      'user',
      user._id,
      name,
      `Invited faculty: ${name} (${role})`,
      { email, role },
      req
    );
    
    res.json({ message: `Invitation sent successfully to ${email}!`, user: { name, email, role } });
  } catch (error) {
    console.error("Invitation error:", error);
    res.status(400).json({ message: error.message || "Error sending invitation" });
  }
};

// Get activity logs
export const getActivityLogs = async (req, res) => {
  try {
    const { action, entityType, limit = 100, page = 1 } = req.query;
    
    let query = {};
    
    // Filter by action if provided
    if (action && action !== 'all') {
      query.action = action;
    }
    
    // Filter by entity type if provided
    if (entityType && entityType !== 'all') {
      query.entityType = entityType;
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const activities = await Activity.find(query)
      .populate("user", "name email role")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);
    
    const total = await Activity.countDocuments(query);
    
    res.json({
      activities,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get activity statistics
export const getActivityStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const thisWeek = new Date();
    thisWeek.setDate(thisWeek.getDate() - 7);
    
    const stats = {
      total: await Activity.countDocuments(),
      today: await Activity.countDocuments({ createdAt: { $gte: today } }),
      thisWeek: await Activity.countDocuments({ createdAt: { $gte: thisWeek } }),
      byAction: await Activity.aggregate([
        { $group: { _id: "$action", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      byEntityType: await Activity.aggregate([
        { $group: { _id: "$entityType", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      recentUsers: await Activity.aggregate([
        { $match: { createdAt: { $gte: thisWeek } } },
        { $group: { _id: "$user", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "userInfo" } },
        { $unwind: "$userInfo" },
        { $project: { user: "$userInfo.name", count: 1 } }
      ])
    };
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};