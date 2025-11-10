import Research from "../models/Research.js";
import Feedback from "../models/Feedback.js";
import Schedule from "../models/Schedule.js";
import Document from "../models/Document.js";
import Activity from "../models/Activity.js";
import ComplianceForm from "../models/ComplianceForm.js";
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
