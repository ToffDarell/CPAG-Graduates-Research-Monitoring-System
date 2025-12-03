import Research from "../models/Research.js";
import Feedback from "../models/Feedback.js";
import FeedbackComment from "../models/FeedbackComment.js";
import Schedule from "../models/Schedule.js";
import Document from "../models/Document.js";
import Activity from "../models/Activity.js";
import ComplianceForm from "../models/ComplianceForm.js";
import Panel from "../models/Panel.js";
import User from "../models/User.js";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import { uploadFileToDrive } from "../utils/googleDrive.js";

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

// JWT Token Generator
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

const getChapterDriveFolderId = (chapterType) => {
  if (!chapterType) return process.env.GOOGLE_DRIVE_CHAPTERS_FOLDER_ID || null;
  const envKey = `GOOGLE_DRIVE_${chapterType.toUpperCase()}_FOLDER_ID`;
  return (
    process.env[envKey] ||
    process.env.GOOGLE_DRIVE_CHAPTERS_FOLDER_ID ||
    null
  );
};

// ========== Login ==========
export const login = async (req, res) => {
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
};

const getComplianceDriveFolderId = (formType) => {
  if (!formType) return process.env.GOOGLE_DRIVE_COMPLIANCE_FOLDER_ID || null;
  const envKey = `GOOGLE_DRIVE_COMPLIANCE_${formType.toUpperCase()}_FOLDER_ID`;
  return (
    process.env[envKey] ||
    process.env.GOOGLE_DRIVE_COMPLIANCE_FOLDER_ID ||
    null
  );
};

const buildDriveTokens = (user) => {
  if (!user) return null;
  return {
    access_token: user.driveAccessToken,
    refresh_token: user.driveRefreshToken,
    expiry_date: user.driveTokenExpiry ? user.driveTokenExpiry.getTime() : undefined,
  };
};

const applyUpdatedDriveTokens = async (user, credentials) => {
  if (!user || !credentials) return;
  const updates = {};
  if (credentials.access_token && credentials.access_token !== user.driveAccessToken) {
    updates.driveAccessToken = credentials.access_token;
  }
  if (credentials.refresh_token && credentials.refresh_token !== user.driveRefreshToken) {
    updates.driveRefreshToken = credentials.refresh_token;
  }
  if (credentials.expiry_date) {
    updates.driveTokenExpiry = new Date(credentials.expiry_date);
  }
  if (Object.keys(updates).length) {
    await User.findByIdAndUpdate(user._id, updates, { new: false });
    Object.assign(user, updates);
  }
};

const isInvalidGrantError = (error) => {
  if (!error) return false;
  const errorCode = error.code || error.status || error?.response?.status;
  const bodyError = error?.response?.data?.error;
  const description = error?.response?.data?.error_description || error.message;
  return (
    bodyError === "invalid_grant" ||
    (description && description.toLowerCase().includes("token has been expired or revoked")) ||
    (errorCode === 400 && error?.message?.toLowerCase().includes("invalid_grant"))
  );
};

const clearDriveTokens = async (userId) => {
  if (!userId) return;
  await User.findByIdAndUpdate(userId, {
    $unset: {
      driveAccessToken: "",
      driveRefreshToken: "",
      driveTokenExpiry: "",
    },
  });
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

    const studentUser = await User.findById(req.user.id);
    if (!studentUser || !studentUser.driveAccessToken) {
      return res.status(400).json({ message: "Please connect your Google Drive account before uploading compliance forms." });
    }

    const driveFolderId = getComplianceDriveFolderId(formType);
    const driveTokens = buildDriveTokens(studentUser);
    if (!driveTokens?.access_token) {
      return res.status(400).json({ message: "Google Drive access token missing. Please reconnect your Drive account." });
    }

    let driveFileData = null;
    try {
      const { file: driveFile, tokens: updatedTokens } = await uploadFileToDrive(
        req.file.path,
        req.file.originalname,
        req.file.mimetype,
        driveTokens,
        { parentFolderId: driveFolderId }
      );
      driveFileData = driveFile;
      await applyUpdatedDriveTokens(studentUser, updatedTokens);
    } catch (driveError) {
      console.error("Error uploading compliance form to Google Drive:", driveError);
      if (isInvalidGrantError(driveError)) {
        await clearDriveTokens(req.user.id);
        return res.status(401).json({
          message: "Your Google Drive connection has expired or was revoked. Please reconnect your Drive account and try again.",
        });
      }
      return res.status(500).json({
        message: "Failed to upload the compliance form to Google Drive. Please reconnect your Drive account and try again.",
      });
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
      driveFileId: driveFileData?.id,
      driveFileLink: driveFileData?.webViewLink,
      driveFileName: driveFileData?.name,
      driveMimeType: driveFileData?.mimeType,
      driveFolderId: driveFolderId || null,
      storageLocation: driveFileData ? "local+google-drive" : "local",
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
        driveFileId: driveFileData?.id,
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

    const studentUser = await User.findById(req.user.id);
    if (!studentUser || !studentUser.driveAccessToken) {
      return res.status(400).json({
        message: "Please connect your Google Drive account before uploading compliance forms.",
      });
    }

    const driveFolderId = getComplianceDriveFolderId(formType);
    const driveTokens = buildDriveTokens(studentUser);
    if (!driveTokens?.access_token) {
      return res.status(400).json({
        message: "Google Drive access token missing. Please reconnect your Drive account.",
      });
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

    // Upload (or copy) the file into the designated Google Drive folder
    let driveFileData = null;
    try {
      const { file: driveFile, tokens: updatedTokens } = await uploadFileToDrive(
        filepath,
        metadata.name,
        metadata.mimeType,
        driveTokens,
        { parentFolderId: driveFolderId }
      );
      driveFileData = driveFile;
      await applyUpdatedDriveTokens(studentUser, updatedTokens);
    } catch (driveError) {
      console.error("Error saving compliance form to Google Drive folder:", driveError);
      if (isInvalidGrantError(driveError)) {
        await clearDriveTokens(req.user.id);
        return res.status(401).json({
          message: "Your Google Drive connection has expired or was revoked. Please reconnect your Drive account and try again.",
        });
      }
      return res.status(500).json({
        message:
          "Failed to store the compliance form in Google Drive. Please reconnect your Drive account and try again.",
      });
    }

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
      driveFileId: driveFileData?.id,
      driveFileLink: driveFileData?.webViewLink || metadata.webViewLink || null,
      driveFileName: driveFileData?.name || metadata.name,
      driveMimeType: driveFileData?.mimeType || metadata.mimeType,
      driveFolderId: driveFolderId || null,
      storageLocation: driveFileData ? "local+google-drive" : "local",
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
        driveFileId: driveFileData?.id,
        driveFileLink: driveFileData?.webViewLink || metadata.webViewLink || null,
        driveFolderId: driveFolderId || null,
        copiedFromDriveFileId: driveFileId,
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

// Get Google Drive connection status for the current student
export const getDriveStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "driveConnected driveAccessToken driveRefreshToken driveTokenExpiry email name"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const hasAccessToken = Boolean(user.driveAccessToken);
    const hasRefreshToken = Boolean(user.driveRefreshToken);
    const tokenExpiresAt = user.driveTokenExpiry || null;
    const connected = Boolean(user.driveConnected && hasAccessToken);
    const needsReconnect =
      connected && tokenExpiresAt ? tokenExpiresAt.getTime() < Date.now() : false;

    res.json({
      connected,
      driveConnected: user.driveConnected,
      hasAccessToken,
      hasRefreshToken,
      tokenExpiresAt,
      needsReconnect,
      email: user.email,
    });
  } catch (error) {
    console.error("Error fetching drive status:", error);
    res.status(500).json({ message: error.message });
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

    // Determine MIME type - default to application/pdf if missing or for PDF files
    let mimeType = complianceForm.mimeType || 'application/pdf';
    if (!mimeType || mimeType === 'application/octet-stream') {
      // Try to infer from filename
      const ext = path.extname(complianceForm.filename).toLowerCase();
      if (ext === '.pdf') {
        mimeType = 'application/pdf';
      } else if (ext === '.doc' || ext === '.docx') {
        mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      } else if (ext === '.xls' || ext === '.xlsx') {
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      }
    }

    // Send file for inline viewing
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(complianceForm.filename)}"`);
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

    const { researchId, chapterType, chapterTitle, partName } = req.body;
    
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

    const studentUser = await User.findById(req.user.id);
    if (!studentUser || !studentUser.driveAccessToken) {
      return res.status(400).json({ message: "Please connect your Google Drive account before uploading chapters." });
    }

    const driveFolderId = getChapterDriveFolderId(chapterType);
    const driveTokens = buildDriveTokens(studentUser);
    if (!driveTokens?.access_token) {
      return res.status(400).json({ message: "Google Drive access token missing. Please reconnect your Drive account." });
    }

    let driveFileData = null;
    try {
      const { file: driveFile, tokens: updatedTokens } = await uploadFileToDrive(
        req.file.path,
        req.file.originalname,
        req.file.mimetype,
        driveTokens,
        { parentFolderId: driveFolderId }
      );
      driveFileData = driveFile;
      await applyUpdatedDriveTokens(studentUser, updatedTokens);
    } catch (driveError) {
      console.error("Error uploading chapter to Google Drive:", driveError);
      return res.status(500).json({
        message: "Failed to upload the chapter to Google Drive. Please reconnect your Drive account and try again.",
      });
    }

    // Calculate version number based on existing submissions for this chapter + partName combination
    // Normalize partName: null/empty string means full chapter, otherwise use trimmed partName
    const normalizedPartName = partName && partName.trim() ? partName.trim() : null;
    
    // Find existing submissions for this chapter + partName combination
    const existingSubmissions = research.forms.filter(form => {
      const formPartName = form.partName || null;
      return form.type === chapterType && 
             ((formPartName === null && normalizedPartName === null) || 
              (formPartName && normalizedPartName && formPartName.toLowerCase() === normalizedPartName.toLowerCase()));
    });

    // Calculate next version number
    const maxVersion = existingSubmissions.length > 0
      ? Math.max(...existingSubmissions.map(f => f.version || 1))
      : 0;
    const nextVersion = maxVersion + 1;

    // Add file to research
    research.forms.push({
      filename: req.file.originalname,
      filepath: req.file.path,
      type: chapterType, // "chapter1", "chapter2", "chapter3"
      partName: normalizedPartName, // null for full chapter, string for specific part
      version: nextVersion,
      status: "pending",
      uploadedBy: req.user.id,
      uploadedAt: new Date(),
      driveFileId: driveFileData?.id,
      driveFileLink: driveFileData?.webViewLink,
      driveFileName: driveFileData?.name,
      driveMimeType: driveFileData?.mimeType,
      driveFolderId: driveFolderId || null,
      storageLocation: driveFileData ? "local+google-drive" : "local",
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
      description: `Uploaded chapter: ${chapterType}${normalizedPartName ? ` - ${normalizedPartName}` : ''}${chapterTitle ? ` (${chapterTitle})` : ''} - Version ${nextVersion}`,
      metadata: {
        researchId: research._id,
        chapterType: chapterType,
        chapterTitle: chapterTitle || null,
        partName: normalizedPartName,
        version: nextVersion,
        filename: req.file.originalname,
        fileSize: req.file.size,
        source: "local+google-drive",
        driveFileId: driveFileData?.id,
        driveFileLink: driveFileData?.webViewLink,
      },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    // Send notification to adviser
    if (research.adviser && research.adviser.email) {
      const studentName = req.user.name || "Student";
      const chapterLabel = chapterType === "chapter1" ? "Chapter 1" : chapterType === "chapter2" ? "Chapter 2" : "Chapter 3";
      const partLabel = normalizedPartName ? ` - ${normalizedPartName} (v${nextVersion})` : '';
      await sendNotificationEmail(
        research.adviser.email,
        `New Chapter Uploaded: ${chapterLabel}${partLabel}`,
        `${studentName} has uploaded a new ${chapterLabel}${partLabel}${chapterTitle ? `: ${chapterTitle}` : ''} for research: ${research.title}. Please review it.`,
        `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #7C1D23;">New Chapter Uploaded</h2>
            <p>Hello ${research.adviser.name},</p>
            <p><strong>${studentName}</strong> has uploaded a new <strong>${chapterLabel}${partLabel}</strong>${chapterTitle ? `: ${chapterTitle}` : ''} for research: <strong>${research.title}</strong>.</p>
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

// View chapter submission file
export const viewChapterSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;

    const research = await Research.findOne({
      "forms._id": submissionId,
      students: req.user.id,
    });

    if (!research) {
      return res.status(404).json({ message: "Submission not found or you do not have access to it." });
    }

    const submission = research.forms.id(submissionId);
    if (!submission) {
      return res.status(404).json({ message: "Submission not found." });
    }

    // Determine MIME type
    let mimeType = submission.driveMimeType || 'application/pdf';
    if (!mimeType || mimeType === 'application/octet-stream') {
      const ext = path.extname(submission.filename).toLowerCase();
      const mimeTypes = {
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      };
      mimeType = mimeTypes[ext] || 'application/pdf';
    }

    // If file is in Google Drive, download and serve it
    if (submission.driveFileId && (submission.storageLocation === "google-drive" || submission.storageLocation === "local+google-drive")) {
      try {
        // Get user's Google Drive tokens
        const user = await User.findById(req.user.id).select('driveAccessToken driveRefreshToken driveTokenExpiry');
        
        if (!user || !user.driveAccessToken) {
          return res.status(400).json({ message: "Google Drive access token not found. Please reconnect your Drive account." });
        }

        const { downloadFileFromDrive } = await import("../utils/googleDrive.js");
        const result = await downloadFileFromDrive(submission.driveFileId, user.driveAccessToken);
        
        // Convert stream to buffer
        const chunks = [];
        for await (const chunk of result.stream) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        
        // Determine MIME type from metadata
        const fileMimeType = result.metadata.mimeType || mimeType;
        
        // Set appropriate headers for viewing (inline)
        res.setHeader('Content-Type', fileMimeType);
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(submission.filename || result.metadata.name || 'document')}"`);
        res.send(buffer);
        return;
      } catch (error) {
        console.error("Error downloading from Google Drive for viewing:", error);
        // Fall back to local file if available
        if (submission.filepath) {
          const localPath = path.isAbsolute(submission.filepath) 
            ? submission.filepath 
            : path.join(process.cwd(), submission.filepath);
          if (fs.existsSync(localPath)) {
            // Continue to local file serving below
          } else {
            return res.status(500).json({ message: `Failed to retrieve file from Google Drive: ${error.message}` });
          }
        } else {
          return res.status(500).json({ message: `Failed to retrieve file from Google Drive: ${error.message}` });
        }
      }
    }

    // Serve local file
    let filePath;
    if (path.isAbsolute(submission.filepath)) {
      filePath = submission.filepath;
    } else {
      filePath = path.join(process.cwd(), submission.filepath);
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found on server" });
    }

    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "view",
      entityType: "research",
      entityId: research._id,
      entityName: research.title,
      description: `Viewed chapter submission: ${submission.filename}`,
      metadata: {
        researchId: research._id,
        submissionId,
        chapterType: submission.type,
        filename: submission.filename,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Send file for inline viewing
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(submission.filename)}"`);
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error("Error viewing chapter submission:", error);
    res.status(500).json({ message: error.message });
  }
};

// Download chapter submission file
export const downloadChapterSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;

    const research = await Research.findOne({
      "forms._id": submissionId,
      students: req.user.id,
    });

    if (!research) {
      return res.status(404).json({ message: "Submission not found or you do not have access to it." });
    }

    const submission = research.forms.id(submissionId);
    if (!submission) {
      return res.status(404).json({ message: "Submission not found." });
    }

    // If file is in Google Drive, redirect to Drive link
    if (submission.driveFileLink && (submission.storageLocation === "google-drive" || submission.storageLocation === "local+google-drive")) {
      return res.redirect(submission.driveFileLink);
    }

    // Otherwise, serve local file
    let filePath;
    if (path.isAbsolute(submission.filepath)) {
      filePath = submission.filepath;
    } else {
      filePath = path.join(process.cwd(), submission.filepath);
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found on server" });
    }

    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "download",
      entityType: "research",
      entityId: research._id,
      entityName: research.title,
      description: `Downloaded chapter submission: ${submission.filename}`,
      metadata: {
        researchId: research._id,
        submissionId,
        chapterType: submission.type,
        filename: submission.filename,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Send file for download
    res.download(filePath, submission.filename);
  } catch (error) {
    console.error("Error downloading chapter submission:", error);
    res.status(500).json({ message: error.message });
  }
};

export const deleteChapterSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;
    if (!submissionId) {
      return res.status(400).json({ message: "Submission ID is required" });
    }

    const research = await Research.findOne({
      "forms._id": submissionId,
      students: req.user._id,
    });

    if (!research) {
      return res.status(404).json({ message: "Submission not found or you do not have access to it." });
    }

    const submission = research.forms.id(submissionId);
    if (!submission) {
      return res.status(404).json({ message: "Submission not found." });
    }

    if (submission.uploadedBy?.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: "You can only delete submissions that you uploaded." });
    }

    if (submission.status === "approved") {
      return res.status(400).json({ message: "Approved submissions cannot be deleted." });
    }

    const filePath = submission.filepath;

    research.forms.pull(submissionId);
    await research.save();

    if (filePath && fs.existsSync(filePath)) {
      fs.unlink(filePath, (err) => {
        if (err) {
          console.warn("Unable to delete local file for submission:", err.message);
        }
      });
    }

    await Activity.create({
      user: req.user.id,
      action: "delete",
      entityType: "research",
      entityId: research._id,
      entityName: research.title,
      description: `Deleted ${submission.type || "chapter"} submission (version ${submission.version || "n/a"})`,
      metadata: {
        researchId: research._id,
        submissionId,
        chapterType: submission.type,
        filename: submission.filename,
        status: submission.status,
      },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    res.json({ message: "Submission deleted successfully." });
  } catch (error) {
    console.error("Error deleting chapter submission:", error);
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

    const { driveFileId, accessToken, researchId, chapterType, chapterTitle, partName } = req.body;

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

    const studentUser = await User.findById(req.user.id);
    if (!studentUser || !studentUser.driveAccessToken) {
      return res.status(400).json({
        message: "Please connect your Google Drive account before uploading chapters.",
      });
    }

    const driveFolderId = getChapterDriveFolderId(chapterType);
    const driveTokens = buildDriveTokens(studentUser);
    if (!driveTokens?.access_token) {
      return res.status(400).json({
        message: "Google Drive access token missing. Please reconnect your Drive account.",
      });
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

    // Upload (or copy) the file into the designated Google Drive folder
    let driveFileData = null;
    try {
      const { file: driveFile, tokens: updatedTokens } = await uploadFileToDrive(
        filepath,
        metadata.name,
        metadata.mimeType,
        driveTokens,
        { parentFolderId: driveFolderId }
      );
      driveFileData = driveFile;
      await applyUpdatedDriveTokens(studentUser, updatedTokens);
    } catch (driveError) {
      console.error("Error saving chapter to Google Drive folder:", driveError);
      return res.status(500).json({
        message: "Failed to store the chapter in Google Drive. Please reconnect your Drive account and try again.",
      });
    }

    // Calculate version number based on existing submissions for this chapter + partName combination
    // Normalize partName: null/empty string means full chapter, otherwise use trimmed partName
    const normalizedPartName = partName && partName.trim() ? partName.trim() : null;
    
    // Find existing submissions for this chapter + partName combination
    const existingSubmissions = research.forms.filter(form => {
      const formPartName = form.partName || null;
      return form.type === chapterType && 
             ((formPartName === null && normalizedPartName === null) || 
              (formPartName && normalizedPartName && formPartName.toLowerCase() === normalizedPartName.toLowerCase()));
    });

    // Calculate next version number
    const maxVersion = existingSubmissions.length > 0
      ? Math.max(...existingSubmissions.map(f => f.version || 1))
      : 0;
    const nextVersion = maxVersion + 1;

    // Prepare new form object
    // Ensure uploadedBy is a proper ObjectId (Mongoose will handle conversion, but be explicit)
    const uploadedById = typeof req.user.id === 'string' 
      ? new mongoose.Types.ObjectId(req.user.id)
      : req.user.id;
    
    const newForm = {
      filename: metadata.name,
      filepath: filepath,
      type: chapterType, // "chapter1", "chapter2", "chapter3"
      partName: normalizedPartName, // null for full chapter, string for specific part
      version: nextVersion,
      status: "pending",
      uploadedBy: uploadedById,
      uploadedAt: new Date(),
      driveFileId: driveFileData?.id,
      driveFileLink: driveFileData?.webViewLink || metadata.webViewLink || null,
      driveFileName: driveFileData?.name || metadata.name,
      driveMimeType: driveFileData?.mimeType || metadata.mimeType,
      driveFolderId: driveFolderId || null,
      storageLocation: driveFileData ? "local+google-drive" : "local",
    };

    // Calculate progress update
    const chapterProgress = {
      chapter1: 25,
      chapter2: 50,
      chapter3: 75,
    };
    const newProgress = chapterProgress[chapterType] 
      ? Math.max(research.progress || 0, chapterProgress[chapterType])
      : research.progress || 0;

    // Use findByIdAndUpdate with $push for atomic operation
    // This is more reliable than modifying a populated document and saving
    try {
      const updateData = {
        $push: { forms: newForm }
      };
      
      // Update progress if needed
      if (newProgress !== (research.progress || 0)) {
        updateData.$set = { progress: newProgress };
      }

      console.log("Updating research with form:", {
        researchId: researchId,
        updateData: {
          $push: { forms: { ...newForm, uploadedBy: req.user.id.toString() } },
          ...(updateData.$set ? { $set: updateData.$set } : {})
        }
      });

      const savedResearch = await Research.findByIdAndUpdate(
        researchId,
        updateData,
        { new: true, runValidators: true }
      );

      if (!savedResearch) {
        throw new Error("Research not found after update");
      }

      console.log("Research updated successfully. Forms count:", savedResearch.forms.length);

      // Get the newly added form (should be the last one)
      const savedForm = savedResearch.forms[savedResearch.forms.length - 1];
      
      if (!savedForm || !savedForm._id) {
        throw new Error("Form was not saved to database properly - no _id assigned");
      }

      console.log("Form saved successfully with ID:", savedForm._id.toString(), {
        filename: savedForm.filename,
        type: savedForm.type,
        status: savedForm.status
      });

      // Verify it's actually in the database by querying again
      const verifyResearch = await Research.findById(researchId);
      const verifyForm = verifyResearch.forms.find(
        f => f._id && f._id.toString() === savedForm._id.toString()
      );
      
      if (!verifyForm) {
        console.error("WARNING: Form not found in database after save!");
        throw new Error("Form was not persisted to database");
      }

      console.log("Form verified in database:", verifyForm._id.toString());
    } catch (saveError) {
      console.error("Error saving research to database:", saveError);
      console.error("Save error details:", {
        message: saveError.message,
        stack: saveError.stack,
        name: saveError.name
      });
      // Clean up file if save fails
      if (fs.existsSync(filepath)) {
        try {
          fs.unlinkSync(filepath);
        } catch (cleanupError) {
          console.error("Error cleaning up file:", cleanupError);
        }
      }
      return res.status(500).json({ 
        message: `Failed to save chapter to database: ${saveError.message}`,
        error: process.env.NODE_ENV === 'development' ? saveError.stack : undefined
      });
    }

    // Reload research with populated fields for notifications
    const savedResearch = await Research.findById(researchId)
      .populate("adviser", "name email")
      .populate("students", "name email");
    const savedForm = savedResearch.forms[savedResearch.forms.length - 1];

    // Log activity - don't let this fail the request
    try {
      await Activity.create({
        user: req.user.id,
        action: "upload",
        entityType: "research",
        entityId: research._id,
        entityName: research.title,
        description: `Uploaded chapter from Google Drive: ${chapterType}${normalizedPartName ? ` - ${normalizedPartName}` : ''}${chapterTitle ? ` (${chapterTitle})` : ''} - Version ${nextVersion}`,
        metadata: {
          researchId: research._id,
          chapterType: chapterType,
          chapterTitle: chapterTitle || null,
          partName: normalizedPartName,
          version: nextVersion,
          filename: metadata.name,
          fileSize: stats.size,
          source: "google_drive",
          driveFileId: driveFileData?.id,
          driveFileLink: driveFileData?.webViewLink || metadata.webViewLink || null,
          driveFolderId: driveFolderId || null,
          copiedFromDriveFileId: driveFileId,
          formId: savedForm._id.toString(),
        },
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.get("user-agent") || "Unknown",
      });
    } catch (activityError) {
      console.error("Error logging activity (non-critical):", activityError);
      // Don't fail the request if activity logging fails
    }

    // Send notification to adviser - don't let this fail the request
    try {
      if (research.adviser && research.adviser.email) {
        const studentName = req.user.name || "Student";
        const chapterLabel = chapterType === "chapter1" ? "Chapter 1" : chapterType === "chapter2" ? "Chapter 2" : "Chapter 3";
        const partLabel = normalizedPartName ? ` - ${normalizedPartName} (v${nextVersion})` : '';
        await sendNotificationEmail(
          research.adviser.email,
          `New Chapter Uploaded: ${chapterLabel}${partLabel}`,
          `${studentName} has uploaded a new ${chapterLabel}${partLabel}${chapterTitle ? `: ${chapterTitle}` : ''} from Google Drive for research: ${research.title}. Please review it.`,
          `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #7C1D23;">New Chapter Uploaded</h2>
              <p>Hello ${research.adviser.name},</p>
              <p><strong>${studentName}</strong> has uploaded a new <strong>${chapterLabel}${partLabel}</strong>${chapterTitle ? `: ${chapterTitle}` : ''} from Google Drive for research: <strong>${research.title}</strong>.</p>
              <p>Source: Google Drive</p>
              <p>Please review the chapter in the system.</p>
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />
              <p style="color: #999; font-size: 12px;">This is an automated notification from the Masteral Archive and Monitoring System.</p>
            </div>
          `
        );
      }
    } catch (emailError) {
      console.error("Error sending notification email (non-critical):", emailError);
      // Don't fail the request if email fails
    }

    // Send notification to student - don't let this fail the request
    try {
      const student = await User.findById(req.user.id);
      if (student && student.email) {
        const chapterLabel = chapterType === "chapter1" ? "Chapter 1" : chapterType === "chapter2" ? "Chapter 2" : "Chapter 3";
        const partLabel = normalizedPartName ? ` - ${normalizedPartName} (v${nextVersion})` : '';
        await sendNotificationEmail(
          student.email,
          `Chapter Uploaded Successfully`,
          `Your ${chapterLabel}${partLabel}${chapterTitle ? `: ${chapterTitle}` : ''} has been uploaded successfully from Google Drive and is pending review.`,
          `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #7C1D23;">Chapter Uploaded</h2>
              <p>Hello ${student.name},</p>
              <p>Your <strong>${chapterLabel}${partLabel}</strong>${chapterTitle ? `: ${chapterTitle}` : ''} has been uploaded successfully from Google Drive and is pending review.</p>
              <p>Your adviser will review it and provide feedback.</p>
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />
              <p style="color: #999; font-size: 12px;">This is an automated notification from the Masteral Archive and Monitoring System.</p>
            </div>
          `
        );
      }
    } catch (emailError) {
      console.error("Error sending student notification email (non-critical):", emailError);
      // Don't fail the request if email fails
    }

    // Return success response with the saved form data
    res.json({ 
      message: "Chapter uploaded successfully from Google Drive",
      form: {
        id: savedForm._id,
        filename: savedForm.filename,
        filepath: savedForm.filepath,
        type: savedForm.type,
        status: savedForm.status,
        uploadedAt: savedForm.uploadedAt
      },
      research: {
        id: savedResearch._id,
        title: savedResearch.title,
        progress: savedResearch.progress
      }
    });
  } catch (error) {
    console.error("Error uploading chapter from Google Drive:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get chapter submissions with optional filtering and search
export const getChapterSubmissions = async (req, res) => {
  try {
    // Extract query parameters for filtering
    const { 
      chapter, 
      partName, 
      status, 
      startDate, 
      endDate, 
      search 
    } = req.query;

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

    // Helper function to filter submissions based on query parameters
    const filterSubmission = (form) => {
      // Filter by chapter
      if (chapter && form.type !== chapter) {
        return false;
      }

      // Filter by part name (case-insensitive partial match)
      if (partName) {
        const formPartName = form.partName || null;
        if (!formPartName || !formPartName.toLowerCase().includes(partName.toLowerCase())) {
          return false;
        }
      }

      // Filter by status
      if (status && form.status !== status) {
        return false;
      }

      // Filter by date range
      if (startDate || endDate) {
        const uploadDate = new Date(form.uploadedAt);
        if (startDate && uploadDate < new Date(startDate)) {
          return false;
        }
        if (endDate && uploadDate > new Date(endDate)) {
          return false;
        }
      }

      // Search across filename, partName, and chapterTitle (case-insensitive)
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesFilename = form.filename && form.filename.toLowerCase().includes(searchLower);
        const matchesPartName = form.partName && form.partName.toLowerCase().includes(searchLower);
        const matchesChapterTitle = form.chapterTitle && form.chapterTitle.toLowerCase().includes(searchLower);
        
        if (!matchesFilename && !matchesPartName && !matchesChapterTitle) {
          return false;
        }
      }

      return true;
    };

    // Group forms by chapter type (chapter1, chapter2, chapter3)
    const chapterTypes = ["chapter1", "chapter2", "chapter3"];
    const chapters = chapterTypes.map((chapterType) => {
      // Filter forms for this chapter type
      let chapterForms = research.forms
        .filter((form) => form.type === chapterType);

      console.log(`[getChapterSubmissions] ${chapterType} - Found ${chapterForms.length} forms before filtering`);

      // Apply additional filters
      chapterForms = chapterForms.filter(filterSubmission);

      console.log(`[getChapterSubmissions] ${chapterType} - Found ${chapterForms.length} forms after filtering`);

      // For older submissions without version, calculate version based on upload order
      // Group by partName and assign versions BEFORE sorting
      const versionMap = new Map();
      chapterForms.forEach((form) => {
        const partKey = form.partName || null;
        if (!versionMap.has(partKey)) {
          versionMap.set(partKey, []);
        }
        versionMap.get(partKey).push(form);
      });
      
      // Sort each group by upload date (oldest first) and assign versions if missing
      versionMap.forEach((forms, partKey) => {
        forms.sort((a, b) => new Date(a.uploadedAt) - new Date(b.uploadedAt)); // Oldest first
        forms.forEach((form, index) => {
          // If version is not set or is default 1, calculate it based on order
          // Oldest = version 1, newest = highest version
          if (!form.version || (form.version === 1 && forms.length > 1 && index > 0)) {
            form.version = index + 1;
          }
        });
      });

      // Now sort by upload date (newest first) - show all versions
      chapterForms.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
      
      console.log(`[getChapterSubmissions] ${chapterType} - Returning ${chapterForms.length} submissions:`, 
        chapterForms.map(f => ({
          id: f._id.toString(),
          version: f.version || 1,
          partName: f.partName || null,
          filename: f.filename,
          uploadedAt: f.uploadedAt
        }))
      );

      // Map forms to submissions with part names and versions
      const submissions = chapterForms.map((form) => {
        const uploadedBy = form.uploadedBy 
          ? uploadedByMap.get(form.uploadedBy.toString())
          : null;
        
        return {
          id: form._id.toString(),
          _id: form._id,
          version: form.version || 1, // Use stored version number or calculated
          partName: form.partName || null, // null means full chapter
          filename: form.filename,
          filepath: form.filepath,
          status: form.status || "pending",
          feedback: form.feedback || null,
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
          driveFileId: form.driveFileId || null,
          driveFileLink: form.driveFileLink || null,
          driveFileName: form.driveFileName || null,
          driveMimeType: form.driveMimeType || null,
          storageLocation: form.storageLocation || "local",
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
      'PRODID:-//Defense Schedule System//EN',
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
    
    // Get comment counts for each feedback
    const feedbackWithComments = await Promise.all(
      feedback.map(async (item) => {
        const commentCount = await FeedbackComment.countDocuments({ 
          feedback: item._id,
          resolved: false 
        });
        const totalComments = await FeedbackComment.countDocuments({ 
          feedback: item._id 
        });
        return {
          ...item.toObject(),
          commentCount,
          totalComments
        };
      })
    );
    
    res.json(feedbackWithComments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// View feedback file (for students)
export const viewFeedbackFile = async (req, res) => {
  try {
    const { feedbackId } = req.params;

    const feedback = await Feedback.findById(feedbackId);
    if (!feedback) {
      return res.status(404).json({ message: "Feedback not found" });
    }

    // Verify authorization - student can only view their own feedback
    if (feedback.student.toString() !== req.user.id.toString()) {
      return res.status(403).json({ 
        message: "Unauthorized access. You can only view feedback that is for you." 
      });
    }

    // Populate for response
    await feedback.populate('student', 'name email');
    await feedback.populate('adviser', 'name email');
    await feedback.populate('research', 'forms');

    // If feedback doesn't have a file, try to get it from the research form
    if (!feedback.file || !feedback.file.filepath) {
      // Try to find the file from research forms
      if (feedback.research && feedback.research.forms && feedback.research.forms.length > 0) {
        const formWithFile = feedback.research.forms
          .filter(f => f.filepath)
          .sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0))[0];
        
        if (formWithFile) {
          let filesize = null;
          let mimetype = null;
          
          try {
            const filePath = path.isAbsolute(formWithFile.filepath) 
              ? formWithFile.filepath 
              : path.join(process.cwd(), formWithFile.filepath);
            
            if (fs.existsSync(filePath)) {
              const stats = fs.statSync(filePath);
              filesize = stats.size;
              
              if (formWithFile.filename) {
                const ext = path.extname(formWithFile.filename).toLowerCase();
                const mimeTypes = {
                  '.pdf': 'application/pdf',
                  '.doc': 'application/msword',
                  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                  '.jpg': 'image/jpeg',
                  '.jpeg': 'image/jpeg',
                  '.png': 'image/png',
                };
                mimetype = mimeTypes[ext] || 'application/octet-stream';
              }
              
              feedback.file = {
                filename: formWithFile.filename || 'document',
                filepath: formWithFile.filepath,
                filesize: filesize,
                mimetype: mimetype,
                uploadedAt: formWithFile.uploadedAt || new Date()
              };
            }
          } catch (error) {
            console.error('[STUDENT VIEW FEEDBACK] Error accessing form file:', error);
          }
        }
      }
      
      if (!feedback.file || !feedback.file.filepath) {
        return res.status(404).json({ message: "No file attached to this feedback" });
      }
    }

    // Construct file path
    let filePath;
    if (path.isAbsolute(feedback.file.filepath)) {
      filePath = feedback.file.filepath;
    } else {
      filePath = path.join(process.cwd(), feedback.file.filepath);
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found on server" });
    }

    // Send file for inline viewing
    res.setHeader('Content-Type', feedback.file.mimetype);
    res.setHeader('Content-Disposition', `inline; filename="${feedback.file.filename}"`);
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error("Error viewing feedback file:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get feedback comments (for students)
export const getFeedbackComments = async (req, res) => {
  try {
    const { feedbackId } = req.params;

    const feedback = await Feedback.findById(feedbackId);
    if (!feedback) {
      return res.status(404).json({ message: "Feedback not found" });
    }

    // Verify authorization - student can only view comments on their own feedback
    if (feedback.student.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    const comments = await FeedbackComment.find({ feedback: feedbackId })
      .populate('createdBy', 'name email')
      .populate('resolvedBy', 'name')
      .sort({ createdAt: -1 });

    res.json(comments);
  } catch (error) {
    console.error("Error fetching comments:", error);
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

// Get available consultation slots from adviser
export const getAvailableSlots = async (req, res) => {
  console.log('========================================');
  console.log('[GET AVAILABLE SLOTS] FUNCTION CALLED');
  console.log('[GET AVAILABLE SLOTS] Timestamp:', new Date().toISOString());
  console.log('[GET AVAILABLE SLOTS] User:', {
    id: req.user?._id?.toString(),
    name: req.user?.name,
    role: req.user?.role,
    email: req.user?.email
  });
  console.log('========================================');
  
  try {
    // Role check is already handled by middleware, but double-check for safety
    if (req.user.role !== "graduate student") {
      console.log('[GET AVAILABLE SLOTS] Role check failed - not a graduate student');
      return res.status(403).json({ message: "Only graduate students can view available slots." });
    }
    
    console.log('[GET AVAILABLE SLOTS] Role check passed - proceeding...');

    // Find student's research to get their adviser
    let research = await Research.findOne({ students: req.user._id });
    
    console.log('[GET AVAILABLE SLOTS] Raw research document:', {
      found: !!research,
      researchId: research?._id?.toString(),
      researchTitle: research?.title,
      adviserField: research?.adviser,
      adviserFieldType: typeof research?.adviser,
      adviserIsObjectId: research?.adviser ? research.adviser.constructor?.name : 'null'
    });

    if (!research) {
      console.log('========================================');
      console.log('[GET AVAILABLE SLOTS] No research found');
      console.log('[GET AVAILABLE SLOTS] Student ID:', req.user._id.toString());
      console.log('========================================');
      return res.json({ message: "You don't have a research assigned yet.", slots: [] });
    }

    // Populate adviser if it exists
    if (research.adviser) {
      await research.populate("adviser", "name email");
      console.log('[GET AVAILABLE SLOTS] After populate:', {
        hasAdviser: !!research.adviser,
        adviserId: research.adviser?._id?.toString(),
        adviserName: research.adviser?.name,
        adviserEmail: research.adviser?.email
      });
    }

    if (!research.adviser) {
      console.log('========================================');
      console.log('[GET AVAILABLE SLOTS] Research found but no adviser assigned');
      console.log('[GET AVAILABLE SLOTS] Research ID:', research._id.toString());
      console.log('[GET AVAILABLE SLOTS] Research Title:', research.title);
      console.log('[GET AVAILABLE SLOTS] Adviser field value:', research.adviser);
      console.log('[GET AVAILABLE SLOTS] Please ask Program Head to assign an adviser');
      console.log('========================================');
      return res.json({ message: "You don't have an assigned adviser yet. Please contact the Program Head.", slots: [] });
    }
    
    console.log('[GET AVAILABLE SLOTS] Research and adviser found', {
      researchId: research._id.toString(),
      researchTitle: research.title,
      adviserId: research.adviser._id.toString(),
      adviserName: research.adviser.name,
      adviserEmail: research.adviser.email
    });

    // Find available consultation slots (no student assigned yet or status is 'scheduled')
    // Query slots where the adviser is either:
    // 1. In the participants array with role "adviser", OR
    // 2. The creator of the slot (createdBy)
    const adviserId = research.adviser._id;
    
    const now = new Date();
    console.log('[GET AVAILABLE SLOTS] Query parameters', {
      adviserId: adviserId.toString(),
      adviserIdType: typeof adviserId,
      now: now.toISOString(),
      nowTimestamp: now.getTime()
    });
    
    // First, try to find slots where adviser is in participants
    const slotsByParticipant = await Schedule.find({
      type: "consultation",
      datetime: { $gte: now },
      status: "scheduled",
      "participants.user": adviserId,
      "participants.role": "adviser"
    })
      .populate("participants.user", "name email")
      .populate("createdBy", "name email")
      .sort({ datetime: 1 });
    
    console.log('[GET AVAILABLE SLOTS] Slots by participant', {
      count: slotsByParticipant.length,
      slots: slotsByParticipant.map(s => ({
        id: s._id.toString(),
        title: s.title,
        datetime: s.datetime,
        status: s.status,
        createdBy: s.createdBy?._id?.toString(),
        participants: s.participants.map(p => ({
          userId: p.user?._id?.toString(),
          role: p.role
        }))
      }))
    });
    
    // Also find slots where adviser is the creator
    const slotsByCreator = await Schedule.find({
      type: "consultation",
      datetime: { $gte: now },
      status: "scheduled",
      createdBy: adviserId
    })
      .populate("participants.user", "name email")
      .populate("createdBy", "name email")
      .sort({ datetime: 1 });
    
    console.log('[GET AVAILABLE SLOTS] Slots by creator', {
      count: slotsByCreator.length,
      slots: slotsByCreator.map(s => ({
        id: s._id.toString(),
        title: s.title,
        datetime: s.datetime,
        status: s.status,
        createdBy: s.createdBy?._id?.toString(),
        participants: s.participants.map(p => ({
          userId: p.user?._id?.toString(),
          role: p.role
        }))
      }))
    });
    
    // Combine both results, removing duplicates
    const slotIds = new Set();
    const allAdviserSlots = [];
    
    for (const slot of slotsByParticipant) {
      if (!slotIds.has(slot._id.toString())) {
        slotIds.add(slot._id.toString());
        allAdviserSlots.push(slot);
      }
    }
    
    for (const slot of slotsByCreator) {
      if (!slotIds.has(slot._id.toString())) {
        slotIds.add(slot._id.toString());
        allAdviserSlots.push(slot);
      }
    }

    // Filter to only include slots that don't have a student participant yet
    const availableSlots = allAdviserSlots.filter(slot => {
      const hasStudent = slot.participants.some(p => 
        p.role === "student" && (p.status === "invited" || p.status === "confirmed")
      );
      return !hasStudent;
    });

    // Debug logging to help diagnose issues
    console.log('[GET AVAILABLE SLOTS]', {
      studentId: req.user._id.toString(),
      studentName: req.user.name,
      adviserId: adviserId.toString(),
      adviserName: research.adviser.name,
      adviserEmail: research.adviser.email,
      slotsByParticipant: slotsByParticipant.length,
      slotsByCreator: slotsByCreator.length,
      totalSlotsFound: allAdviserSlots.length,
      availableSlotsCount: availableSlots.length,
      slotDetails: allAdviserSlots.map(s => ({
        id: s._id.toString(),
        title: s.title,
        datetime: s.datetime,
        status: s.status,
        createdBy: s.createdBy?._id?.toString(),
        createdByName: s.createdBy?.name,
        participants: s.participants.map(p => ({
          userId: p.user?._id?.toString(),
          userName: p.user?.name,
          role: p.role,
          status: p.status
        })),
        hasStudent: s.participants.some(p => p.role === "student")
      }))
    });
    
    // Additional debug: Check all consultation slots for this adviser (without filters)
    const allConsultationSlotsByCreator = await Schedule.find({
      type: "consultation",
      createdBy: adviserId
    })
      .populate("participants.user", "name email")
      .populate("createdBy", "name email")
      .sort({ datetime: 1 });
    
    const allConsultationSlotsByParticipant = await Schedule.find({
      type: "consultation",
      "participants.user": adviserId
    })
      .populate("participants.user", "name email")
      .populate("createdBy", "name email")
      .sort({ datetime: 1 });
    
    console.log('[GET AVAILABLE SLOTS - ALL CONSULTATIONS BY CREATOR]', {
      adviserId: adviserId.toString(),
      totalSlots: allConsultationSlotsByCreator.length,
      slots: allConsultationSlotsByCreator.map(s => ({
        id: s._id.toString(),
        title: s.title,
        datetime: s.datetime,
        datetimeISO: s.datetime.toISOString(),
        status: s.status,
        isFuture: new Date(s.datetime) >= now,
        createdBy: s.createdBy?._id?.toString(),
        createdByMatch: s.createdBy?._id?.toString() === adviserId.toString(),
        participants: s.participants.map(p => ({
          userId: p.user?._id?.toString(),
          role: p.role,
          userMatch: p.user?._id?.toString() === adviserId.toString()
        }))
      }))
    });
    
    console.log('[GET AVAILABLE SLOTS - ALL CONSULTATIONS BY PARTICIPANT]', {
      adviserId: adviserId.toString(),
      totalSlots: allConsultationSlotsByParticipant.length,
      slots: allConsultationSlotsByParticipant.map(s => ({
        id: s._id.toString(),
        title: s.title,
        datetime: s.datetime,
        status: s.status,
        isFuture: new Date(s.datetime) >= now,
        participants: s.participants.map(p => ({
          userId: p.user?._id?.toString(),
          role: p.role,
          userMatch: p.user?._id?.toString() === adviserId.toString()
        }))
      }))
    });

    console.log('[GET AVAILABLE SLOTS] ====== RETURNING RESPONSE ======');
    console.log('[GET AVAILABLE SLOTS] Final result:', {
      adviserName: research.adviser.name,
      adviserEmail: research.adviser.email,
      slotsCount: availableSlots.length,
      slots: availableSlots.map(s => ({
        id: s._id.toString(),
        title: s.title,
        datetime: s.datetime
      }))
    });
    
    res.json({ adviser: research.adviser, slots: availableSlots });
  } catch (error) {
    console.error('[GET AVAILABLE SLOTS] ====== ERROR ======');
    console.error("Error fetching available slots:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({ message: error.message });
  }
};

// Request consultation
export const requestConsultation = async (req, res) => {
  try {
    // Role check is already handled by middleware, but double-check for safety
    if (req.user.role !== "graduate student") {
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

    // Get the updated schedule with populated fields for notification
    const updatedSchedule = await Schedule.findById(scheduleId)
      .populate("participants.user", "name email")
      .populate("createdBy", "name email")
      .populate("research", "title");

    // Find the adviser from the schedule (either from participants or createdBy)
    const adviser = updatedSchedule.participants?.find(p => p.role === "adviser")?.user || updatedSchedule.createdBy;
    
    // Send email notification to adviser
    if (adviser && adviser.email) {
      const studentName = req.user.name || "Student";
      const studentEmail = req.user.email || "";
      const formattedDate = new Date(updatedSchedule.datetime).toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      await sendNotificationEmail(
        adviser.email,
        `New Consultation Request from ${studentName}`,
        `${studentName} has requested a consultation for ${formattedDate}. Please review and approve or decline the request in your dashboard.`,
        `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #7C1D23;">New Consultation Request</h2>
            <p>Hello ${adviser.name},</p>
            <p><strong>${studentName}</strong> (${studentEmail}) has requested a consultation with you.</p>
            <div style="background-color: #f9f9f9; padding: 15px; margin: 20px 0; border-left: 4px solid #7C1D23; border-radius: 4px;">
              <p style="margin: 8px 0;"><strong style="color: #333;">Consultation Title:</strong> ${updatedSchedule.title}</p>
              <p style="margin: 8px 0;"><strong style="color: #333;">Date & Time:</strong> ${formattedDate}</p>
              <p style="margin: 8px 0;"><strong style="color: #333;">Duration:</strong> ${updatedSchedule.duration || 60} minutes</p>
              <p style="margin: 8px 0;"><strong style="color: #333;">Location:</strong> ${updatedSchedule.location}</p>
              ${updatedSchedule.description ? `<p style="margin: 8px 0;"><strong style="color: #333;">Description:</strong> ${updatedSchedule.description}</p>` : ''}
              ${message ? `<p style="margin: 8px 0;"><strong style="color: #333;">Student Message:</strong> ${message}</p>` : ''}
            </div>
            <p>Please log in to your dashboard to approve or decline this consultation request.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />
            <p style="color: #999; font-size: 12px;">This is an automated notification from the Masteral Archive and Monitoring System.</p>
          </div>
        `
      );
    }

    // Log activity
    try {
      await Activity.create({
        user: req.user._id,
        action: "request",
        entityType: "schedule",
        entityId: updatedSchedule._id,
        entityName: updatedSchedule.title,
        description: `Requested consultation: ${updatedSchedule.title}`,
        metadata: {
          scheduleId: updatedSchedule._id,
          scheduleType: "consultation",
          datetime: updatedSchedule.datetime,
          adviserId: adviser?._id?.toString(),
          adviserName: adviser?.name
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });
    } catch (activityError) {
      console.error("Error logging activity for consultation request:", activityError);
      // Don't fail the request if activity logging fails
    }

    res.json({ 
      message: "Consultation request submitted successfully. Your adviser will review it soon.", 
      schedule: updatedSchedule 
    });
  } catch (error) {
    console.error("Error requesting consultation:", error);
    res.status(500).json({ message: error.message });
  }
};

// Create custom consultation request (Student creates their own consultation request)
export const createCustomConsultationRequest = async (req, res) => {
  console.log('========================================');
  console.log('[CREATE CUSTOM CONSULTATION REQUEST] Function called');
  console.log('[CREATE CUSTOM CONSULTATION REQUEST] Timestamp:', new Date().toISOString());
  console.log('[CREATE CUSTOM CONSULTATION REQUEST] User:', {
    id: req.user?._id?.toString(),
    name: req.user?.name,
    role: req.user?.role,
    email: req.user?.email
  });
  console.log('[CREATE CUSTOM CONSULTATION REQUEST] Request body:', req.body);
  console.log('========================================');
  
  try {
    // Role check is already handled by middleware, but double-check for safety
    if (req.user.role !== "graduate student") {
      console.log('[CREATE CUSTOM CONSULTATION REQUEST] Role check failed - not a graduate student');
      return res.status(403).json({ message: "Only graduate students can create consultation requests." });
    }
    
    console.log('[CREATE CUSTOM CONSULTATION REQUEST] Role check passed - proceeding...');

    const { title, description, datetime, duration, location, message, consultationType } = req.body;

    // Validate required fields
    if (!title || !title.trim()) {
      return res.status(400).json({ message: "Title is required" });
    }
    
    if (!location || !location.trim()) {
      return res.status(400).json({ message: "Location is required" });
    }
    
    if (!datetime) {
      return res.status(400).json({ message: "Date and time are required" });
    }

    // Find student's research to get their adviser
    const research = await Research.findOne({ students: req.user._id })
      .populate("adviser", "name email");

    if (!research || !research.adviser) {
      return res.status(400).json({ 
        message: "You don't have an assigned adviser yet. Please contact the Program Head to assign an adviser." 
      });
    }

    // Parse datetime
    let startTime;
    if (typeof datetime === 'string') {
      if (datetime.includes('Z') || datetime.match(/[+-]\d{2}:\d{2}$/)) {
        startTime = new Date(datetime);
      } else if (datetime.includes('T') && !datetime.includes('Z') && !datetime.includes('+')) {
        const [datePart, timePart] = datetime.split('T');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hour, minute] = timePart.split(':').map(Number);
        const manilaTimeString = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${hour.toString().padStart(2, '0')}:${(minute || 0).toString().padStart(2, '0')}:00+08:00`;
        startTime = new Date(manilaTimeString);
        if (isNaN(startTime.getTime())) {
          const manilaDate = new Date(Date.UTC(year, month - 1, day, hour, minute || 0, 0, 0));
          const manilaOffsetMs = 8 * 60 * 60 * 1000;
          startTime = new Date(manilaDate.getTime() - manilaOffsetMs);
        }
      } else {
        startTime = new Date(datetime);
      }
    } else {
      startTime = new Date(datetime);
    }

    // Validate that datetime is a valid date
    if (isNaN(startTime.getTime())) {
      return res.status(400).json({ 
        message: "Invalid date format. Please select a valid date and time." 
      });
    }

    // Check if datetime is in the past
    if (new Date(startTime) < new Date()) {
      return res.status(400).json({ message: "Cannot create consultation requests for past dates." });
    }

    // Create the consultation request schedule
    const schedule = new Schedule({
      research: research._id,
      type: "consultation",
      title: title.trim(),
      description: description || (message ? `Student message: ${message}` : "Custom consultation request from student"),
      datetime: startTime,
      duration: duration || 60,
      location: consultationType === "online" ? "Online" : location.trim(),
      consultationType: consultationType || "face-to-face",
      participants: [
        {
          user: research.adviser._id,
          role: "adviser",
          status: "invited" // Adviser needs to approve
        },
        {
          user: req.user._id,
          role: "student",
          status: "invited" // Student is requesting
        }
      ],
      createdBy: req.user._id,
      status: "scheduled" // Will change to "confirmed" when adviser approves
    });

    // If consultation type is "online", try to create Google Meet link if adviser has calendar connected
    if (schedule.consultationType === "online") {
      try {
        const adviser = await User.findById(research.adviser._id);
        if (adviser?.calendarConnected && adviser?.googleAccessToken && adviser?.googleRefreshToken) {
          const { createConsultationEvent } = await import("../utils/googleCalendar.js");
          
          const attendeeEmails = [req.user.email, research.adviser.email].filter(Boolean);
          
          const calendarEvent = await createConsultationEvent(
            {
              title: schedule.title,
              description: schedule.description,
              datetime: schedule.datetime,
              duration: schedule.duration,
              location: "Online",
              type: schedule.type,
              researchTitle: research.title,
              attendeeEmails,
            },
            adviser.googleAccessToken,
            adviser.googleRefreshToken,
            adviser._id.toString()
          );

          if (calendarEvent.meetLink) {
            schedule.googleMeetLink = calendarEvent.meetLink;
            schedule.googleCalendarEventId = calendarEvent.eventId;
            schedule.googleCalendarLink = calendarEvent.eventLink;
            schedule.calendarSynced = true;
            console.log('[CREATE CUSTOM REQUEST] Google Meet link created:', calendarEvent.meetLink);
          }
        }
      } catch (error) {
        console.error('[CREATE CUSTOM REQUEST] Error creating Google Meet link:', error);
        // Continue without Meet link - adviser can add it later
      }
    }

    await schedule.save();

    // Send email notification to adviser
    const studentName = req.user.name || "Student";
    const studentEmail = req.user.email || "";
    const formattedDate = new Date(schedule.datetime).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    await sendNotificationEmail(
      research.adviser.email,
      `New Custom Consultation Request from ${studentName}`,
      `${studentName} has created a custom consultation request for ${formattedDate}. Please review and approve or decline the request in your dashboard.`,
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #7C1D23;">New Custom Consultation Request</h2>
          <p>Hello ${research.adviser.name},</p>
          <p><strong>${studentName}</strong> (${studentEmail}) has created a custom consultation request with their preferred date and time.</p>
          <div style="background-color: #f9f9f9; padding: 15px; margin: 20px 0; border-left: 4px solid #7C1D23; border-radius: 4px;">
            <p style="margin: 8px 0;"><strong style="color: #333;">Consultation Title:</strong> ${schedule.title}</p>
            <p style="margin: 8px 0;"><strong style="color: #333;">Requested Date & Time:</strong> ${formattedDate}</p>
            <p style="margin: 8px 0;"><strong style="color: #333;">Duration:</strong> ${schedule.duration || 60} minutes</p>
            <p style="margin: 8px 0;"><strong style="color: #333;">Location:</strong> ${schedule.location}</p>
            ${schedule.description ? `<p style="margin: 8px 0;"><strong style="color: #333;">Description:</strong> ${schedule.description}</p>` : ''}
            ${message ? `<p style="margin: 8px 0;"><strong style="color: #333;">Student Message:</strong> ${message}</p>` : ''}
          </div>
          <p><strong>Note:</strong> This is a custom request created by the student. Please review the requested time and approve or decline it in your dashboard.</p>
          <p>Please log in to your dashboard to approve or decline this consultation request.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />
          <p style="color: #999; font-size: 12px;">This is an automated notification from the Masteral Archive and Monitoring System.</p>
        </div>
      `
    );

    // Log activity
    try {
      await Activity.create({
        user: req.user._id,
        action: "create",
        entityType: "schedule",
        entityId: schedule._id,
        entityName: schedule.title,
        description: `Created custom consultation request: ${schedule.title}`,
        metadata: {
          scheduleId: schedule._id,
          scheduleType: "consultation",
          datetime: schedule.datetime,
          adviserId: research.adviser._id.toString(),
          adviserName: research.adviser.name,
          isCustomRequest: true
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });
    } catch (activityError) {
      console.error("Error logging activity for custom consultation request:", activityError);
    }

    const updatedSchedule = await Schedule.findById(schedule._id)
      .populate("participants.user", "name email")
      .populate("createdBy", "name email")
      .populate("research", "title");

    res.status(201).json({ 
      message: "Custom consultation request created successfully. Your adviser will review it soon.", 
      schedule: updatedSchedule 
    });
  } catch (error) {
    console.error("Error creating custom consultation request:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get completed thesis for student
export const getCompletedThesis = async (req, res) => {
  try {
    const { semester, academicYear, search } = req.query;
    
    // Build query for completed research
    const query = {
      students: req.user.id,
      status: "completed"
    };
    
    // Apply filters (only add if provided)
    // Note: semester and academicYear may not exist in all Research documents
    // MongoDB will handle this gracefully - documents without these fields won't match
    if (semester) {
      query.semester = semester;
    }
    if (academicYear) {
      query.academicYear = academicYear;
    }
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { abstract: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Fetch completed research
    const completedResearch = await Research.find(query)
      .populate("adviser", "name email")
      .populate("students", "name email")
      .populate("panel", "name email")
      .sort({ updatedAt: -1 });
    
    // Transform data to match frontend expectations
    const thesisList = completedResearch.map(research => {
      // Find the latest approved form to get submission date
      const approvedForms = research.forms.filter(f => f.status === 'approved');
      const latestForm = approvedForms.length > 0 
        ? approvedForms.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0]
        : null;
      
      return {
        _id: research._id,
        title: research.title,
        abstract: research.abstract || '',
        status: research.status,
        stage: research.stage,
        progress: research.progress,
        semester: research.semester || null,
        academicYear: research.academicYear || null,
        evaluationStatus: research.evaluationStatus || null,
        finalGrade: research.finalGrade || null,
        submissionDate: latestForm?.uploadedAt || research.createdAt,
        finalizedDate: research.updatedAt,
        adviser: research.adviser ? {
          _id: research.adviser._id,
          name: research.adviser.name,
          email: research.adviser.email
        } : null,
        students: research.students.map(s => ({
          _id: s._id,
          name: s.name,
          email: s.email
        })),
        panel: research.panel ? research.panel.map(p => ({
          _id: p._id,
          name: p.name,
          email: p.email
        })) : [],
        createdAt: research.createdAt,
        updatedAt: research.updatedAt
      };
    });
    
    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "view",
      entityType: "research",
      entityName: "Completed Thesis",
      description: "Viewed completed thesis list",
      metadata: {
        count: thesisList.length,
        filters: { semester, academicYear, search }
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    
    res.json(thesisList);
  } catch (error) {
    console.error('Error fetching completed thesis:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get panel feedback for a specific completed thesis
export const getPanelFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the research and verify the student has access
    const research = await Research.findOne({
      _id: id,
      students: req.user.id,
      status: "completed"
    })
      .populate("adviser", "name email")
      .populate("panel", "name email");
    
    if (!research) {
      return res.status(404).json({ message: "Thesis not found or access denied" });
    }
    
    // Find panel associated with this research
    const panel = await Panel.findOne({ research: id })
      .populate("members.faculty", "name email")
      .populate("reviews.panelist", "name email");
    
    // Get feedback from panel reviews
    const feedback = panel ? (panel.reviews || []).map(review => ({
      panelist: review.panelist ? {
        _id: review.panelist._id,
        name: review.panelist.name,
        email: review.panelist.email
      } : null,
      evaluation: review.evaluation || null,
      recommendation: review.recommendation || null,
      comments: review.comments || '',
      submittedAt: review.submittedAt || null,
      grade: review.grade || null
    })) : [];
    
    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "view",
      entityType: "research",
      entityId: research._id,
      entityName: research.title,
      description: "Viewed panel feedback for completed thesis",
      metadata: {
        researchId: research._id,
        panelId: panel?._id || null,
        feedbackCount: feedback.length
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    
    res.json({
      panel: panel ? {
        _id: panel._id,
        name: panel.name,
        type: panel.type,
        status: panel.status,
        members: panel.members.map(m => ({
          faculty: m.faculty ? {
            _id: m.faculty._id,
            name: m.faculty.name,
            email: m.faculty.email
          } : null,
          name: m.name || null,
          email: m.email || null,
          role: m.role,
          isExternal: m.isExternal || false
        })),
        meetingDate: panel.meetingDate,
        meetingLocation: panel.meetingLocation
      } : null,
      feedback: feedback
    });
  } catch (error) {
    console.error('Error fetching panel feedback:', error);
    res.status(500).json({ message: error.message });
  }
};
