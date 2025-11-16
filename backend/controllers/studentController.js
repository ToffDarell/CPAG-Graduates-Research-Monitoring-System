import Research from "../models/Research.js";
import Feedback from "../models/Feedback.js";
import Schedule from "../models/Schedule.js";
import Document from "../models/Document.js";
import Activity from "../models/Activity.js";
import ComplianceForm from "../models/ComplianceForm.js";
import Panel from "../models/Panel.js";
import User from "../models/User.js";
import fs from "fs";
import path from "path";

// Helper function to send email notification
const sendNotificationEmail = async (to, subject, message, html) => {
  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.default.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text: message,
      html: html || message,
    });
  } catch (error) {
    console.error("Error sending notification email:", error);
    // Don't throw error, just log it
  }
};

// Upload compliance form
export const uploadComplianceForm = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const { researchId, formType } = req.body;
    
    if (!researchId) {
      return res.status(400).json({ message: "Research ID is required" });
    }
    
    if (!formType) {
      return res.status(400).json({ message: "Form type is required" });
    }

    const research = await Research.findById(researchId)
      .populate("adviser", "name email")
      .populate("students", "name email");
    
    if (!research) {
      return res.status(404).json({ message: "Research not found" });
    }

    // Check if student is part of this research
    const isStudent = research.students.some(s => s._id.toString() === req.user.id.toString());
    if (!isStudent) {
      return res.status(403).json({ message: "You are not authorized to upload forms for this research" });
    }

    // Find previous version of this form type for this student/research
    const previousForm = await ComplianceForm.findOne({
      student: req.user.id,
      research: researchId,
      formType: formType,
      isCurrent: true,
    });

    // Mark previous version as not current if it exists
    if (previousForm) {
      previousForm.isCurrent = false;
      await previousForm.save();
    }

    // Create new compliance form
    const complianceForm = new ComplianceForm({
      student: req.user.id,
      research: researchId,
      formType: formType,
      filename: req.file.originalname,
      filepath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      status: "pending",
      version: previousForm ? previousForm.version + 1 : 1,
      isCurrent: true,
      uploadedBy: req.user.id,
      previousVersion: previousForm ? previousForm._id : null,
    });

    await complianceForm.save();

    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "upload",
      entityType: "complianceForm",
      entityId: complianceForm._id,
      entityName: `Compliance Form: ${formType}`,
      description: `Uploaded compliance form: ${formType} (Version ${complianceForm.version})`,
      metadata: {
        complianceFormId: complianceForm._id,
        researchId: researchId,
        formType: formType,
        version: complianceForm.version,
        filename: req.file.originalname,
        fileSize: req.file.size,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Send notification to adviser
    if (research.adviser && research.adviser.email) {
      const studentName = req.user.name || "Student";
      const formTypeLabel = formType.charAt(0).toUpperCase() + formType.slice(1);
      await sendNotificationEmail(
        research.adviser.email,
        `New Compliance Form Uploaded: ${formTypeLabel}`,
        `${studentName} has uploaded a new ${formTypeLabel} compliance form for research: ${research.title}. Please review it.`,
        `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #7C1D23;">New Compliance Form Uploaded</h2>
            <p>Hello ${research.adviser.name},</p>
            <p><strong>${studentName}</strong> has uploaded a new <strong>${formTypeLabel}</strong> compliance form for research: <strong>${research.title}</strong>.</p>
            <p>Version: ${complianceForm.version}</p>
            <p>Please review the form in the system.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />
            <p style="color: #999; font-size: 12px;">This is an automated notification from the Masteral Archive and Monitoring System.</p>
          </div>
        `
      );
    }

    // Send notification to student
    const student = await User.findById(req.user.id);
    if (student && student.email) {
      await sendNotificationEmail(
        student.email,
        `Compliance Form Uploaded Successfully`,
        `Your ${formType} compliance form has been uploaded successfully and is pending review.`,
        `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #7C1D23;">Compliance Form Uploaded</h2>
            <p>Hello ${student.name},</p>
            <p>Your <strong>${formType}</strong> compliance form has been uploaded successfully.</p>
            <p>Version: ${complianceForm.version}</p>
            <p>Status: Pending Review</p>
            <p>Your adviser will review the form and you will be notified of the decision.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />
            <p style="color: #999; font-size: 12px;">This is an automated notification from the Masteral Archive and Monitoring System.</p>
          </div>
        `
      );
    }

    const populatedForm = await ComplianceForm.findById(complianceForm._id)
      .populate("student", "name email")
      .populate("research", "title")
      .populate("uploadedBy", "name");

    res.json({ 
      message: "Compliance form uploaded successfully", 
      complianceForm: populatedForm 
    });
  } catch (error) {
    console.error("Error uploading compliance form:", error);
    res.status(500).json({ message: error.message });
  }
};

// Upload compliance form from Google Drive
export const uploadComplianceFormFromDrive = async (req, res) => {
  try {
    console.log("Upload compliance form from Drive - Request received:", {
      driveFileId: req.body.driveFileId ? "present" : "missing",
      accessToken: req.body.accessToken ? "present" : "missing",
      researchId: req.body.researchId,
      formType: req.body.formType,
      userId: req.user.id
    });

    const { driveFileId, accessToken, researchId, formType } = req.body;

    if (!driveFileId || !accessToken) {
      console.error("Missing required fields:", { driveFileId: !!driveFileId, accessToken: !!accessToken });
      return res.status(400).json({ message: "Google Drive file ID and access token are required" });
    }

    if (!researchId) {
      return res.status(400).json({ message: "Research ID is required" });
    }

    if (!formType) {
      return res.status(400).json({ message: "Form type is required" });
    }

    // Import download function and stream utilities
    const { downloadFileFromDrive } = await import("../utils/googleDrive.js");
    const { pipeline } = await import("stream/promises");

    // Download file from Google Drive
    let stream, metadata;
    try {
      const result = await downloadFileFromDrive(driveFileId, accessToken);
      stream = result.stream;
      metadata = result.metadata;
    } catch (error) {
      console.error("Error downloading from Google Drive:", error);
      return res.status(400).json({ message: `Failed to download file from Google Drive: ${error.message}` });
    }

    console.log("Downloaded file metadata:", {
      name: metadata.name,
      mimeType: metadata.mimeType,
      size: metadata.size
    });

    // Validate file type - check MIME type and file extension
    const allowedMimeTypes = [
      'application/pdf', 
      'application/x-pdf',
      'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    const fileName = metadata.name || '';
    const fileExtension = fileName.split('.').pop()?.toLowerCase();
    const allowedExtensions = ['pdf', 'doc', 'docx'];
    
    // Check if MIME type is allowed
    const isValidMimeType = allowedMimeTypes.includes(metadata.mimeType);
    // Check if file extension is allowed
    const isValidExtension = fileExtension && allowedExtensions.includes(fileExtension);
    
    // Accept if either MIME type or extension is valid
    if (!isValidMimeType && !isValidExtension) {
      return res.status(400).json({ 
        message: `Invalid file type. Only PDF and DOCX files are allowed. Received: ${metadata.mimeType || 'unknown'} (${fileExtension || 'no extension'})` 
      });
    }

    // Validate file size (10MB limit) - Google Drive might not always provide size
    if (metadata.size && metadata.size > 10 * 1024 * 1024) {
      return res.status(400).json({ message: "File size exceeds 10MB limit" });
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Generate file path
    const cleanName = metadata.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filepath = path.join(uploadsDir, Date.now() + "-" + cleanName);

    // Save file to disk
    try {
      const writeStream = fs.createWriteStream(filepath);
      await pipeline(stream, writeStream);
      console.log("File saved successfully to:", filepath);
    } catch (error) {
      console.error("Error saving file to disk:", error);
      return res.status(500).json({ message: `Failed to save file: ${error.message}` });
    }

    // Verify research and authorization
    const research = await Research.findById(researchId)
      .populate("adviser", "name email")
      .populate("students", "name email");

    if (!research) {
      fs.unlinkSync(filepath); // Clean up file
      return res.status(404).json({ message: "Research not found" });
    }

    const isStudent = research.students.some(s => s._id.toString() === req.user.id.toString());
    if (!isStudent) {
      fs.unlinkSync(filepath); // Clean up file
      return res.status(403).json({ message: "You are not authorized to upload forms for this research" });
    }

    // Find previous version
    const previousForm = await ComplianceForm.findOne({
      student: req.user.id,
      research: researchId,
      formType: formType,
      isCurrent: true,
    });

    if (previousForm) {
      previousForm.isCurrent = false;
      await previousForm.save();
    }

    // Get file stats
    const stats = fs.statSync(filepath);

    // Create new compliance form
    const complianceForm = new ComplianceForm({
      student: req.user.id,
      research: researchId,
      formType: formType,
      filename: metadata.name,
      filepath: filepath,
      fileSize: stats.size,
      mimeType: metadata.mimeType,
      status: "pending",
      version: previousForm ? previousForm.version + 1 : 1,
      isCurrent: true,
      uploadedBy: req.user.id,
      previousVersion: previousForm ? previousForm._id : null,
    });

    await complianceForm.save();

    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "upload",
      entityType: "complianceForm",
      entityId: complianceForm._id,
      entityName: `Compliance Form: ${formType}`,
      description: `Uploaded compliance form from Google Drive: ${formType} (Version ${complianceForm.version})`,
      metadata: {
        complianceFormId: complianceForm._id,
        researchId: researchId,
        formType: formType,
        version: complianceForm.version,
        filename: metadata.name,
        fileSize: stats.size,
        source: "google_drive",
      },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    // Send notification to adviser
    if (research.adviser && research.adviser.email) {
      const studentName = req.user.name || "Student";
      const formTypeLabel = formType.charAt(0).toUpperCase() + formType.slice(1);
      await sendNotificationEmail(
        research.adviser.email,
        `New Compliance Form Uploaded: ${formTypeLabel}`,
        `${studentName} has uploaded a new ${formTypeLabel} compliance form for research: ${research.title}. Please review it.`,
        `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #7C1D23;">New Compliance Form Uploaded</h2>
            <p>Hello ${research.adviser.name},</p>
            <p><strong>${studentName}</strong> has uploaded a new <strong>${formTypeLabel}</strong> compliance form for research: <strong>${research.title}</strong>.</p>
            <p>Version: ${complianceForm.version}</p>
            <p>Source: Google Drive</p>
            <p>Please review the form in the system.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />
            <p style="color: #999; font-size: 12px;">This is an automated notification from the Masteral Archive and Monitoring System.</p>
          </div>
        `
      );
    }

    // Send notification to student
    const student = await User.findById(req.user.id);
    if (student && student.email) {
      await sendNotificationEmail(
        student.email,
        `Compliance Form Uploaded Successfully`,
        `Your ${formType} compliance form has been uploaded successfully from Google Drive and is pending review.`,
        `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #7C1D23;">Compliance Form Uploaded</h2>
            <p>Hello ${student.name},</p>
            <p>Your <strong>${formType}</strong> compliance form has been uploaded successfully from Google Drive.</p>
            <p>Version: ${complianceForm.version}</p>
            <p>Status: Pending Review</p>
            <p>Your adviser will review the form and you will be notified of the decision.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />
            <p style="color: #999; font-size: 12px;">This is an automated notification from the Masteral Archive and Monitoring System.</p>
          </div>
        `
      );
    }

    const populatedForm = await ComplianceForm.findById(complianceForm._id)
      .populate("student", "name email")
      .populate("research", "title")
      .populate("uploadedBy", "name");

    console.log("Compliance form uploaded successfully from Google Drive:", populatedForm._id);
    
    res.json({
      message: "Compliance form uploaded successfully from Google Drive",
      complianceForm: populatedForm,
    });
  } catch (error) {
    console.error("Error uploading compliance form from Google Drive:", error);
    console.error("Error stack:", error.stack);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      response: error.response?.data
    });
    
    const statusCode = error.response?.status || 500;
    const errorMessage = error.response?.data?.message || error.message || "Failed to upload compliance form from Google Drive";
    
    res.status(statusCode).json({ 
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Get all compliance forms for the student
export const getComplianceForms = async (req, res) => {
  try {
    const complianceForms = await ComplianceForm.find({
      student: req.user.id,
    })
      .populate("research", "title")
      .populate("reviewedBy", "name")
      .sort({ uploadedAt: -1 });

    res.json(complianceForms);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a specific compliance form with version history
export const getComplianceForm = async (req, res) => {
  try {
    const complianceForm = await ComplianceForm.findById(req.params.id)
      .populate("student", "name email")
      .populate("research", "title")
      .populate("reviewedBy", "name email")
      .populate("uploadedBy", "name");

    if (!complianceForm) {
      return res.status(404).json({ message: "Compliance form not found" });
    }

    // Check if student owns this form
    if (complianceForm.student._id.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Get version history
    const versionHistory = [];
    let currentVersion = complianceForm;
    while (currentVersion.previousVersion) {
      const prevVersion = await ComplianceForm.findById(currentVersion.previousVersion)
        .populate("reviewedBy", "name")
        .populate("uploadedBy", "name");
      if (prevVersion) {
        versionHistory.push(prevVersion);
        currentVersion = prevVersion;
      } else {
        break;
      }
    }

    res.json({
      complianceForm,
      versionHistory: versionHistory.reverse(),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Download compliance form
export const downloadComplianceForm = async (req, res) => {
  try {
    const complianceForm = await ComplianceForm.findById(req.params.id);

    if (!complianceForm) {
      return res.status(404).json({ message: "Compliance form not found" });
    }

    // Check if student owns this form
    if (complianceForm.student.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Construct file path
    let filePath;
    if (path.isAbsolute(complianceForm.filepath)) {
      filePath = complianceForm.filepath;
    } else {
      filePath = path.join(process.cwd(), complianceForm.filepath);
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found on server" });
    }

    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "download",
      entityType: "complianceForm",
      entityId: complianceForm._id,
      entityName: `Compliance Form: ${complianceForm.formType}`,
      description: `Downloaded compliance form: ${complianceForm.filename}`,
      metadata: {
        complianceFormId: complianceForm._id,
        researchId: complianceForm.research,
        formType: complianceForm.formType,
        version: complianceForm.version,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Send file
    res.download(filePath, complianceForm.filename);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// View compliance form (for inline viewing)
export const viewComplianceForm = async (req, res) => {
  try {
    const complianceForm = await ComplianceForm.findById(req.params.id);

    if (!complianceForm) {
      return res.status(404).json({ message: "Compliance form not found" });
    }

    // Check if student owns this form
    if (complianceForm.student.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Construct file path
    let filePath;
    if (path.isAbsolute(complianceForm.filepath)) {
      filePath = complianceForm.filepath;
    } else {
      filePath = path.join(process.cwd(), complianceForm.filepath);
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found on server" });
    }

    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "view",
      entityType: "complianceForm",
      entityId: complianceForm._id,
      entityName: `Compliance Form: ${complianceForm.formType}`,
      description: `Viewed compliance form: ${complianceForm.filename}`,
      metadata: {
        complianceFormId: complianceForm._id,
        researchId: complianceForm.research,
        formType: complianceForm.formType,
        version: complianceForm.version,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Send file for inline viewing
    res.setHeader('Content-Type', complianceForm.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${complianceForm.filename}"`);
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
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

    const { researchId, chapterType, chapterTitle } = req.body;
    
    if (!researchId) {
      return res.status(400).json({ message: "Research ID is required" });
    }
    
    const research = await Research.findById(researchId)
      .populate("adviser", "name email")
      .populate("students", "name email");
    
    if (!research) {
      return res.status(404).json({ message: "Research not found" });
    }

    // Check if student is part of this research
    const isStudent = research.students.some(s => s._id.toString() === req.user.id.toString());
    if (!isStudent) {
      return res.status(403).json({ message: "You are not authorized to upload chapters for this research" });
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

    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "upload",
      entityType: "research",
      entityId: research._id,
      entityName: research.title,
      description: `Uploaded chapter: ${chapterType}${chapterTitle ? ` - ${chapterTitle}` : ''}`,
      metadata: {
        researchId: research._id,
        chapterType: chapterType,
        chapterTitle: chapterTitle || null,
        filename: req.file.originalname,
        fileSize: req.file.size,
        source: "local",
      },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    // Send notification to adviser
    if (research.adviser && research.adviser.email) {
      const studentName = req.user.name || "Student";
      const chapterLabel = chapterType === "chapter1" ? "Chapter 1" : chapterType === "chapter2" ? "Chapter 2" : "Chapter 3";
      await sendNotificationEmail(
        research.adviser.email,
        `New Chapter Uploaded: ${chapterLabel}`,
        `${studentName} has uploaded a new ${chapterLabel}${chapterTitle ? `: ${chapterTitle}` : ''} for research: ${research.title}. Please review it.`,
        `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #7C1D23;">New Chapter Uploaded</h2>
            <p>Hello ${research.adviser.name},</p>
            <p><strong>${studentName}</strong> has uploaded a new <strong>${chapterLabel}</strong>${chapterTitle ? `: ${chapterTitle}` : ''} for research: <strong>${research.title}</strong>.</p>
            <p>Please review the chapter in the system.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />
            <p style="color: #999; font-size: 12px;">This is an automated notification from the Masteral Archive and Monitoring System.</p>
          </div>
        `
      );
    }

    res.json({ message: "Chapter uploaded successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Upload chapter from Google Drive
export const uploadChapterFromDrive = async (req, res) => {
  try {
    console.log("Upload chapter from Drive - Request received:", {
      driveFileId: req.body.driveFileId ? "present" : "missing",
      accessToken: req.body.accessToken ? "present" : "missing",
      researchId: req.body.researchId,
      chapterType: req.body.chapterType,
      chapterTitle: req.body.chapterTitle,
      userId: req.user.id
    });

    const { driveFileId, accessToken, researchId, chapterType, chapterTitle } = req.body;

    if (!driveFileId || !accessToken) {
      console.error("Missing required fields:", { driveFileId: !!driveFileId, accessToken: !!accessToken });
      return res.status(400).json({ message: "Google Drive file ID and access token are required" });
    }

    if (!researchId) {
      return res.status(400).json({ message: "Research ID is required" });
    }

    if (!chapterType) {
      return res.status(400).json({ message: "Chapter type is required" });
    }

    // Import download function and stream utilities
    const { downloadFileFromDrive } = await import("../utils/googleDrive.js");
    const { pipeline } = await import("stream/promises");

    // Download file from Google Drive
    let stream, metadata;
    try {
      const result = await downloadFileFromDrive(driveFileId, accessToken);
      stream = result.stream;
      metadata = result.metadata;
    } catch (error) {
      console.error("Error downloading from Google Drive:", error);
      return res.status(400).json({ message: `Failed to download file from Google Drive: ${error.message}` });
    }

    console.log("Downloaded file metadata:", {
      name: metadata.name,
      mimeType: metadata.mimeType,
      size: metadata.size
    });

    // Validate file type - check MIME type and file extension
    const allowedMimeTypes = [
      'application/pdf', 
      'application/x-pdf',
      'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    const fileName = metadata.name || '';
    const fileExtension = fileName.split('.').pop()?.toLowerCase();
    const allowedExtensions = ['pdf', 'doc', 'docx'];
    
    // Check if MIME type is allowed
    const isValidMimeType = allowedMimeTypes.includes(metadata.mimeType);
    // Check if file extension is allowed
    const isValidExtension = fileExtension && allowedExtensions.includes(fileExtension);
    
    // Accept if either MIME type or extension is valid
    if (!isValidMimeType && !isValidExtension) {
      return res.status(400).json({ 
        message: `Invalid file type. Only PDF and DOCX files are allowed. Received: ${metadata.mimeType || 'unknown'} (${fileExtension || 'no extension'})` 
      });
    }

    // Validate file size (10MB limit) - Google Drive might not always provide size
    if (metadata.size && metadata.size > 10 * 1024 * 1024) {
      return res.status(400).json({ message: "File size exceeds 10MB limit" });
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Generate file path
    const cleanName = metadata.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filepath = path.join(uploadsDir, Date.now() + "-" + cleanName);

    // Save file to disk
    try {
      const writeStream = fs.createWriteStream(filepath);
      await pipeline(stream, writeStream);
      console.log("File saved successfully to:", filepath);
    } catch (error) {
      console.error("Error saving file to disk:", error);
      return res.status(500).json({ message: `Failed to save file: ${error.message}` });
    }

    // Verify research and authorization
    const research = await Research.findById(researchId)
      .populate("adviser", "name email")
      .populate("students", "name email");

    if (!research) {
      fs.unlinkSync(filepath); // Clean up file
      return res.status(404).json({ message: "Research not found" });
    }

    const isStudent = research.students.some(s => s._id.toString() === req.user.id.toString());
    if (!isStudent) {
      fs.unlinkSync(filepath); // Clean up file
      return res.status(403).json({ message: "You are not authorized to upload chapters for this research" });
    }

    // Get file stats
    const stats = fs.statSync(filepath);

    // Add file to research
    research.forms.push({
      filename: metadata.name,
      filepath: filepath,
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

    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "upload",
      entityType: "research",
      entityId: research._id,
      entityName: research.title,
      description: `Uploaded chapter from Google Drive: ${chapterType}${chapterTitle ? ` - ${chapterTitle}` : ''}`,
      metadata: {
        researchId: research._id,
        chapterType: chapterType,
        chapterTitle: chapterTitle || null,
        filename: metadata.name,
        fileSize: stats.size,
        source: "google_drive",
        driveFileId: driveFileId,
      },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    // Send notification to adviser
    if (research.adviser && research.adviser.email) {
      const studentName = req.user.name || "Student";
      const chapterLabel = chapterType === "chapter1" ? "Chapter 1" : chapterType === "chapter2" ? "Chapter 2" : "Chapter 3";
      await sendNotificationEmail(
        research.adviser.email,
        `New Chapter Uploaded: ${chapterLabel}`,
        `${studentName} has uploaded a new ${chapterLabel}${chapterTitle ? `: ${chapterTitle}` : ''} from Google Drive for research: ${research.title}. Please review it.`,
        `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #7C1D23;">New Chapter Uploaded</h2>
            <p>Hello ${research.adviser.name},</p>
            <p><strong>${studentName}</strong> has uploaded a new <strong>${chapterLabel}</strong>${chapterTitle ? `: ${chapterTitle}` : ''} from Google Drive for research: <strong>${research.title}</strong>.</p>
            <p>Source: Google Drive</p>
            <p>Please review the chapter in the system.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />
            <p style="color: #999; font-size: 12px;">This is an automated notification from the Masteral Archive and Monitoring System.</p>
          </div>
        `
      );
    }

    // Send notification to student
    const student = await User.findById(req.user.id);
    if (student && student.email) {
      const chapterLabel = chapterType === "chapter1" ? "Chapter 1" : chapterType === "chapter2" ? "Chapter 2" : "Chapter 3";
      await sendNotificationEmail(
        student.email,
        `Chapter Uploaded Successfully`,
        `Your ${chapterLabel}${chapterTitle ? `: ${chapterTitle}` : ''} has been uploaded successfully from Google Drive and is pending review.`,
        `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #7C1D23;">Chapter Uploaded</h2>
            <p>Hello ${student.name},</p>
            <p>Your <strong>${chapterLabel}</strong>${chapterTitle ? `: ${chapterTitle}` : ''} has been uploaded successfully from Google Drive and is pending review.</p>
            <p>Your adviser will review it and provide feedback.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />
            <p style="color: #999; font-size: 12px;">This is an automated notification from the Masteral Archive and Monitoring System.</p>
          </div>
        `
      );
    }

    res.json({ message: "Chapter uploaded successfully from Google Drive" });
  } catch (error) {
    console.error("Error uploading chapter from Google Drive:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get chapter submissions
export const getChapterSubmissions = async (req, res) => {
  try {
    // Find research for the student
    const research = await Research.findOne({ students: req.user.id })
      .populate("adviser", "name email")
      .populate("students", "name email");

    if (!research) {
      return res.json({ chapters: [] });
    }

    // Get unique uploadedBy IDs from forms
    const uploadedByIds = [...new Set(
      research.forms
        .filter(form => form.uploadedBy)
        .map(form => form.uploadedBy.toString())
    )];

    // Populate uploadedBy users
    const uploadedByUsers = await User.find({ _id: { $in: uploadedByIds } })
      .select("name email");

    // Create a map for quick lookup
    const uploadedByMap = new Map(
      uploadedByUsers.map(user => [user._id.toString(), user])
    );

    // Group forms by chapter type (chapter1, chapter2, chapter3)
    const chapterTypes = ["chapter1", "chapter2", "chapter3"];
    const chapters = chapterTypes.map((chapterType) => {
      // Filter forms for this chapter type and sort by upload date (newest first)
      const chapterForms = research.forms
        .filter((form) => form.type === chapterType)
        .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

      // Map forms to submissions with version numbers (newest is version 1, older ones have higher versions)
      const submissions = chapterForms.map((form, index) => {
        const version = chapterForms.length - index; // Latest submission is version 1
        const uploadedBy = form.uploadedBy 
          ? uploadedByMap.get(form.uploadedBy.toString())
          : null;
        
        return {
          id: form._id.toString(),
          _id: form._id,
          version: version,
          filename: form.filename,
          filepath: form.filepath,
          status: form.status || "pending",
          uploadedAt: form.uploadedAt,
          uploadedBy: uploadedBy ? {
            _id: uploadedBy._id,
            name: uploadedBy.name,
            email: uploadedBy.email
          } : null,
          chapterTitle: form.chapterTitle || null, // May not exist in older records
          file: {
            filename: form.filename,
            filepath: form.filepath,
          },
        };
      });

      return {
        chapterType,
        submissions,
      };
    });

    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "view",
      entityType: "research",
      entityId: research._id,
      entityName: research.title,
      description: "Viewed chapter submissions",
      metadata: {
        researchId: research._id,
        chapterCount: chapters.length,
        totalSubmissions: chapters.reduce((acc, ch) => acc + ch.submissions.length, 0),
      },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    res.json({ chapters });
  } catch (error) {
    console.error("Error fetching chapter submissions:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get progress overview
export const getProgressOverview = async (req, res) => {
  try {
    // Find research for the student
    const research = await Research.findOne({ students: req.user.id })
      .populate("adviser", "name email")
      .populate("students", "name email");

    if (!research) {
      return res.json({
        hasResearch: false,
        percentage: 0,
        completedCount: 0,
        totalMilestones: 0,
        milestones: [],
        upcomingDeadlines: [],
        notifications: [],
        research: null,
      });
    }

    // Ensure forms array exists and is an array
    const forms = Array.isArray(research.forms) ? research.forms : [];

    // Calculate progress based on chapter submissions
    const chapterTypes = ["chapter1", "chapter2", "chapter3"];
    const chapterProgress = {
      chapter1: 25,
      chapter2: 50,
      chapter3: 75,
    };

    // Check which chapters have approved submissions
    const approvedChapters = chapterTypes.filter((chapterType) => {
      const chapterForms = forms.filter((form) => form && form.type === chapterType);
      return chapterForms.some((form) => form && form.status === "approved");
    });

    // Calculate percentage
    const completedChapters = approvedChapters.length;
    let percentage = research.progress || 0;
    if (completedChapters > 0 && approvedChapters.length > 0) {
      const lastApprovedChapter = approvedChapters[approvedChapters.length - 1];
      if (lastApprovedChapter && chapterProgress[lastApprovedChapter]) {
        percentage = Math.max(percentage, chapterProgress[lastApprovedChapter]);
      }
    }

    // Create milestones based on chapters
    const milestones = chapterTypes.map((chapterType, index) => {
      const chapterForms = forms.filter((form) => form && form.type === chapterType);
      const hasApproved = chapterForms.some((form) => form.status === "approved");
      const hasSubmission = chapterForms.length > 0;
      
      let status = "not-started";
      if (hasApproved) {
        status = "completed";
      } else if (hasSubmission) {
        status = "in-progress";
      }

      const chapterLabels = {
        chapter1: "Chapter 1 - Introduction",
        chapter2: "Chapter 2 - Literature Review",
        chapter3: "Chapter 3 - Methodology",
      };

      // Find the approved form for completedAt timestamp
      let completedAt = null;
      if (hasApproved) {
        const approvedForm = chapterForms.find((f) => f.status === "approved");
        completedAt = approvedForm?.uploadedAt ? new Date(approvedForm.uploadedAt) : null;
      }
      
      // Get the latest submission for startedAt timestamp
      let startedAt = null;
      if (hasSubmission && chapterForms.length > 0) {
        const latestForm = chapterForms[chapterForms.length - 1];
        startedAt = latestForm?.uploadedAt ? new Date(latestForm.uploadedAt) : null;
      }

      return {
        id: chapterType,
        title: chapterLabels[chapterType],
        description: `Submit and get approval for ${chapterLabels[chapterType]}`,
        status,
        type: "chapter",
        dueDate: null,
        completedAt: completedAt,
        startedAt: startedAt,
      };
    });

    // Get upcoming deadlines (empty for now, can be extended)
    const upcomingDeadlines = [];

    // Get notifications
    const notifications = [];
    if (research.status === "for-revision") {
      notifications.push({
        type: "revision-required",
        severity: "high",
        message: "Your research requires revisions. Please check feedback from your adviser.",
      });
    }

    // Log activity (wrap in try-catch to prevent activity logging from breaking the response)
    try {
      await Activity.create({
        user: req.user.id,
        action: "view",
        entityType: "progress-dashboard",
        entityName: "Student Progress Tracking",
        description: "Viewed thesis progress tracking dashboard",
        metadata: {
          milestoneCount: milestones.length,
          completedCount: approvedChapters.length,
          percentage,
        },
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.get("user-agent") || "Unknown",
      });
    } catch (activityError) {
      // Log the error but don't fail the request
      console.error("Error logging activity for progress overview:", activityError);
    }

    res.json({
      hasResearch: true,
      percentage,
      completedCount: approvedChapters.length,
      totalMilestones: milestones.length,
      milestones,
      upcomingDeadlines,
      notifications,
      research: {
        id: research._id,
        title: research.title,
        stage: research.stage,
        status: research.status,
        adviser: research.adviser || null,
      },
      updatedAt: new Date(),
    });
  } catch (error) {
    console.error("Error fetching progress overview:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get my schedules
export const getMySchedules = async (req, res) => {
  try {
    const { startDate, endDate, type } = req.query;
    
    // Build query - exclude cancelled schedules
    const query = {
      "participants.user": req.user.id,
      status: { $ne: "cancelled" },
    };

    // Add date filter if provided
    if (startDate || endDate) {
      query.datetime = {};
      if (startDate) {
        query.datetime.$gte = new Date(startDate);
      }
      if (endDate) {
        query.datetime.$lte = new Date(endDate);
      }
    }

    // Add type filter if provided
    if (type && type !== "all") {
      query.type = type;
    }

    console.log('[Student Schedules] Query:', JSON.stringify(query));
    
    const schedules = await Schedule.find(query)
      .populate("research", "title")
      .populate("participants.user", "name email")
      .populate("panel", "name type members")
      .populate({
        path: "panel",
        populate: {
          path: "members.faculty",
          select: "name email"
        }
      })
      .sort({ datetime: 1 });
    
    console.log(`[Student Schedules] Found ${schedules.length} schedules`);
    console.log('[Student Schedules] Statuses:', schedules.map(s => ({ id: s._id, title: s.title, status: s.status })));
    
    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "view",
      entityType: "schedule",
      entityName: "My Schedules",
      description: "Viewed thesis defense schedules",
      metadata: {
        count: schedules.length,
        filters: { startDate, endDate, type },
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    
    res.json(schedules);
  } catch (error) {
    console.error('[Student Schedules] Error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Export schedule to ICS format
export const exportScheduleICS = async (req, res) => {
  try {
    const scheduleId = req.params.id;
    
    const schedule = await Schedule.findById(scheduleId)
      .populate("research", "title")
      .populate("participants.user", "name email");

    if (!schedule) {
      return res.status(404).json({ message: "Schedule not found" });
    }

    // Check if user is a participant
    const isParticipant = schedule.participants.some(
      p => p.user._id.toString() === req.user.id.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Generate ICS file content
    const startTime = new Date(schedule.datetime);
    const endTime = new Date(startTime.getTime() + (schedule.duration || 60) * 60000);

    // Format dates for ICS (YYYYMMDDTHHMMSSZ)
    const formatICSDate = (date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Masteral Archive System//Defense Schedule//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:schedule-${scheduleId}@masteral-system.edu`,
      `DTSTAMP:${formatICSDate(new Date())}`,
      `DTSTART:${formatICSDate(startTime)}`,
      `DTEND:${formatICSDate(endTime)}`,
      `SUMMARY:${schedule.title}`,
      `DESCRIPTION:${(schedule.description || '').replace(/\n/g, '\\n')}`,
      `LOCATION:${schedule.location}`,
      'STATUS:CONFIRMED',
      'SEQUENCE:0',
      'BEGIN:VALARM',
      'TRIGGER:-PT24H',
      'ACTION:DISPLAY',
      'DESCRIPTION:Reminder: Defense session in 24 hours',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "download",
      entityType: "schedule",
      entityId: scheduleId,
      entityName: schedule.title,
      description: `Exported schedule to calendar: ${schedule.title}`,
      metadata: {
        scheduleType: schedule.type,
        datetime: schedule.datetime,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Set headers for ICS download
    const filename = `defense-${scheduleId}.ics`;
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(icsContent);
  } catch (error) {
    console.error("Error exporting schedule:", error);
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
    console.log("Fetching documents for graduate student...");
    
    const documents = await Document.find({
      isActive: true,
      accessibleTo: { $in: ["graduate student"] },
    })
      .populate("uploadedBy", "name")
      .sort({ createdAt: -1 });
    
    console.log(`Found ${documents.length} documents for graduate student`);
    console.log("Document accessibleTo values:", documents.map(d => ({ 
      title: d.title, 
      accessibleTo: d.accessibleTo 
    })));
    
    res.json(documents);
  } catch (error) {
    console.error("Error fetching student documents:", error);
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
