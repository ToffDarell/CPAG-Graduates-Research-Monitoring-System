import Research from "../models/Research.js";
import Feedback from "../models/Feedback.js";
import FeedbackComment from "../models/FeedbackComment.js";
import Schedule from "../models/Schedule.js";
import User from "../models/User.js";
import Activity from "../models/Activity.js";
import Panel from "../models/Panel.js";
import Document from "../models/Document.js";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { 
  createConsultationEvent, 
  updateCalendarEvent,
  deleteCalendarEvent 
} from "../utils/googleCalendar.js";
import { downloadFileFromDrive } from "../utils/googleDrive.js";

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

    const oldResearch = await Research.findById(id);
    if(!oldResearch) {
      return res.status(404).json({ message: "Research not found" });
    }
    
    const research = await Research.findByIdAndUpdate(
      id,
      { status, stage, progress },
      { new: true }
    ).populate("students", "name email");

     // Log the activity
     await Activity.create({
      user: req.user.id,
      action: "update",
      entityType: "research",
      entityId: research._id,
      entityName: research.title,
      description: `Updated research status from "${oldResearch.status}" to "${status}"`,
      metadata: {
        oldStatus: oldResearch.status,
        newStatus: status,
        stage,
        progress,
        studentNames: research.students.map(s => s.name).join(", ")
      }
    });
    
    res.json({ message: "Research status updated successfully", research });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Approve/reject submission
export const approveRejectSubmission = async (req, res) => {
  try {
    const { researchId, fileId, action, message } = req.body;
    const research = await Research.findById(researchId)
      .populate("students", "name email");
    if (!research) {
      return res.status(404).json({ message: "Research not found" });
    }

    // Fix: Use forms instead of files
    const form = research.forms.id(fileId);
    if (!form) {
      return res.status(404).json({ message: "Submission not found" });
    }

    // Store old status for logging
    const oldStatus = form.status;
    
    form.status = action; // "approved" or "rejected"
    await research.save();

    // Prepare file information from form
    let fileInfo = null;
  console.log('[APPROVE SUBMISSION] Form file info:', {
    hasFilepath: !!form.filepath,
    filepath: form.filepath,
    filename: form.filename,
    formType: form.type
  });
  
    if (form.filepath) {
      // Get file stats if file exists
      let filesize = null;
      try {
        const filePath = path.isAbsolute(form.filepath) 
          ? form.filepath 
          : path.join(process.cwd(), form.filepath);
        console.log('[APPROVE SUBMISSION] Checking file at:', filePath);
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          filesize = stats.size;
          console.log('[APPROVE SUBMISSION] File found, size:', filesize);
        } else {
          console.log('[APPROVE SUBMISSION] File not found at path:', filePath);
        }
      } catch (error) {
        console.error('[APPROVE SUBMISSION] Error getting file stats:', error);
      }

      // Try to determine mimetype from filename
      let mimetype = null;
      if (form.filename) {
        const ext = path.extname(form.filename).toLowerCase();
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

      fileInfo = {
        filename: form.filename || 'document',
        filepath: form.filepath,
        filesize: filesize,
        mimetype: mimetype,
        uploadedAt: form.uploadedAt || new Date()
      };
      console.log('[APPROVE SUBMISSION] File info prepared:', fileInfo);
    } else {
      console.log('[APPROVE SUBMISSION] WARNING: Form has no filepath!');
    }

    // Create feedback record
    const feedback = new Feedback({
      research: researchId,
      student: research.students[0], // Assuming single student for now
      adviser: req.user.id,
      type: action === "approved" ? "approval" : "rejection",
      message,
      file: fileInfo, // Attach the file information from the form
      category: action === "approved" ? "approval" : "revision_request",
      createdBy: req.user.id // Track who created the feedback (Faculty Adviser)
    });

    await feedback.save();

    // Log the activity for auditing
    await Activity.create({
      user: req.user.id,
      action: action === "approved" ? "approve" : "reject",
      entityType: "document",
      entityId: researchId,
      entityName: form.filename || research.title,
      description: `${action === "approved" ? "Approved" : "Rejected"} submission for "${research.title}" - ${form.filename}`,
      metadata: {
        researchTitle: research.title,
        formId: fileId,
        formType: form.type,
        filename: form.filename,
        oldStatus,
        newStatus: action,
        rejectionReason: action === "rejected" ? message : undefined,
        studentNames: research.students.map(s => s.name).join(", "),
        submissionDate: form.uploadedAt
      }
    });

    // Get adviser name for email
    const adviserName = req.user.name || "Your Adviser";
    const formTypeLabel = form.type ? form.type.charAt(0).toUpperCase() + form.type.slice(1) : "Document";

    // Send email notifications to all students
    if (research.students && research.students.length > 0) {
      for (const student of research.students) {
        if (student.email) {
          try {
            if (action === "approved") {
              // Approval email
              await sendNotificationEmail(
                student.email,
                `Submission Approved: ${form.filename || formTypeLabel}`,
                `Your ${formTypeLabel} submission for "${research.title}" has been approved by ${adviserName}.`,
                `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #7C1D23;">Submission Approved</h2>
                    <p>Hello ${student.name},</p>
                    <p>Great news! Your <strong>${formTypeLabel}</strong> submission has been <strong style="color: #22c55e;">approved</strong> by ${adviserName}.</p>
                    <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                      <p style="margin: 5px 0;"><strong>Research Title:</strong> ${research.title}</p>
                      <p style="margin: 5px 0;"><strong>Document:</strong> ${form.filename || formTypeLabel}</p>
                      <p style="margin: 5px 0;"><strong>Submission Type:</strong> ${formTypeLabel}</p>
                      <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: #22c55e; font-weight: bold;">Approved</span></p>
                    </div>
                    <p>You can view the details in your student dashboard.</p>
                    <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />
                    <p style="color: #999; font-size: 12px;">This is an automated notification from the Masteral Archive and Monitoring System.</p>
                  </div>
                `
              );
            } else {
              // Rejection email with reason
              const rejectionReasonSection = message 
                ? `
                  <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px;">
                    <p style="margin: 0; font-weight: bold; color: #991b1b; margin-bottom: 10px;">Rejection Reason:</p>
                    <p style="margin: 0; color: #333;">${message}</p>
                  </div>
                `
                : '';

              await sendNotificationEmail(
                student.email,
                `Submission Rejected: ${form.filename || formTypeLabel}`,
                `Your ${formTypeLabel} submission for "${research.title}" has been rejected by ${adviserName}.${message ? ` Reason: ${message}` : ''}`,
                `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #7C1D23;">Submission Rejected</h2>
                    <p>Hello ${student.name},</p>
                    <p>Your <strong>${formTypeLabel}</strong> submission has been <strong style="color: #ef4444;">rejected</strong> by ${adviserName}.</p>
                    <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                      <p style="margin: 5px 0;"><strong>Research Title:</strong> ${research.title}</p>
                      <p style="margin: 5px 0;"><strong>Document:</strong> ${form.filename || formTypeLabel}</p>
                      <p style="margin: 5px 0;"><strong>Submission Type:</strong> ${formTypeLabel}</p>
                      <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: #ef4444; font-weight: bold;">Rejected</span></p>
                    </div>
                    ${rejectionReasonSection}
                    <p>Please review the feedback and make the necessary revisions. You can resubmit the document after addressing the concerns.</p>
                    <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />
                    <p style="color: #999; font-size: 12px;">This is an automated notification from the Masteral Archive and Monitoring System.</p>
                  </div>
                `
              );
            }
          } catch (emailError) {
            console.error(`Error sending email to ${student.email}:`, emailError);
            // Don't fail the request if email fails
          }
        }
      }
    }

    // Prepare appropriate success message
    const successMessage = action === "approved" 
      ? "Submission has been approved successfully."
      : "Submission has been rejected. Reason recorded.";
    
    res.json({ 
      message: successMessage, 
      feedback,
      research 
    });
  } catch (error) {
    console.error("Error in approveRejectSubmission:", error);
    res.status(500).json({ message: error.message });
  }
};

// View chapter submission file (faculty can view student submissions)
export const viewChapterSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;

    const research = await Research.findOne({
      "forms._id": submissionId,
      adviser: req.user._id, // Faculty must be the adviser
    })
      .populate("students", "name email");

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
        studentName: research.students?.[0]?.name || "Unknown"
      },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    // Set headers for inline viewing
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(submission.filename)}"`);
    
    // Read file as buffer and send (better for arraybuffer requests)
    const fileBuffer = fs.readFileSync(filePath);
    res.send(fileBuffer);
  } catch (error) {
    console.error("Error viewing chapter submission:", error);
    res.status(500).json({ message: error.message });
  }
};

// Delete chapter submission (faculty can delete any submission, including approved ones)
export const deleteChapterSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;
    console.log('[DELETE SUBMISSION] Request received:', { submissionId, userId: req.user._id });
    
    if (!submissionId) {
      return res.status(400).json({ message: "Submission ID is required" });
    }

    const research = await Research.findOne({
      "forms._id": submissionId,
      adviser: req.user._id, // Faculty must be the adviser
    })
      .populate("students", "name email");
    
    console.log('[DELETE SUBMISSION] Research found:', research ? 'Yes' : 'No');

    if (!research) {
      return res.status(404).json({ message: "Submission not found or you do not have access to it." });
    }

    const submission = research.forms.id(submissionId);
    if (!submission) {
      return res.status(404).json({ message: "Submission not found." });
    }

    // Store submission info for logging before deletion
    const submissionInfo = {
      filename: submission.filename,
      type: submission.type,
      version: submission.version,
      status: submission.status,
      partName: submission.partName,
      studentName: research.students?.[0]?.name || "Unknown"
    };

    const filePath = submission.filepath;

    // Remove the submission from the forms array
    research.forms.pull(submissionId);
    await research.save();

    // Delete local file if it exists
    if (filePath) {
      try {
        const fullPath = path.isAbsolute(filePath) 
          ? filePath 
          : path.join(process.cwd(), filePath);
        if (fs.existsSync(fullPath)) {
          fs.unlink(fullPath, (err) => {
            if (err) {
              console.warn("Unable to delete local file for submission:", err.message);
            }
          });
        }
      } catch (error) {
        console.warn("Error deleting local file:", error.message);
      }
    }

    // Log the activity
    await Activity.create({
      user: req.user.id,
      action: "delete",
      entityType: "research",
      entityId: research._id,
      entityName: research.title,
      description: `Deleted ${submissionInfo.type || "chapter"} submission (Version ${submissionInfo.version || "n/a"})${submissionInfo.partName ? ` - ${submissionInfo.partName}` : ""} from student ${submissionInfo.studentName}`,
      metadata: {
        researchId: research._id,
        submissionId,
        chapterType: submissionInfo.type,
        filename: submissionInfo.filename,
        status: submissionInfo.status,
        version: submissionInfo.version,
        partName: submissionInfo.partName,
        studentName: submissionInfo.studentName
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

// Upload feedback
export const uploadFeedback = async (req, res) => {
  try {
    const { researchId, studentId, message, type, category } = req.body;
    
    // Validate research
    const research = await Research.findById(researchId)
      .populate("students", "name email");
    if (!research) {
      return res.status(404).json({ message: "Research not found" });
    }

    // Verify student belongs to this research
    const student = studentId || research.students[0]?._id;
    if (!student) {
      return res.status(400).json({ message: "Student not specified" });
    }

    // File validation
    if (req.file) {
      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
      const ALLOWED_TYPES = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/jpg',
        'image/png'
      ];

      // Check file size
      if (req.file.size > MAX_FILE_SIZE) {
        return res.status(400).json({ 
          message: "File size exceeds 10MB limit" 
        });
      }

      // Check file type
      if (!ALLOWED_TYPES.includes(req.file.mimetype)) {
        return res.status(400).json({ 
          message: "Unsupported file format. Allowed: PDF, Word documents (.doc, .docx), Images (.jpg, .png)" 
        });
      }
    }

    // Get version number (count existing feedback for same research + student)
    const existingCount = await Feedback.countDocuments({
      research: researchId,
      student: student
    });

    const feedback = new Feedback({
      research: researchId,
      student: student,
      adviser: req.user.id,
      type: type || "feedback",
      category: category || "general",
      message,
      version: existingCount + 1,
      createdBy: req.user.id, // Track who created the feedback (Faculty Adviser)
      file: req.file ? {
        filename: req.file.originalname,
        filepath: req.file.path,
        filesize: req.file.size,
        mimetype: req.file.mimetype,
        uploadedAt: new Date()
      } : undefined,
    });

    await feedback.save();

    // Log the activity
    await Activity.create({
      user: req.user.id,
      action: "upload",
      entityType: "feedback",
      entityId: feedback._id,
      entityName: `Feedback for ${research.students.find(s => s._id.toString() === student.toString())?.name || 'Student'}`,
      description: `Uploaded feedback document: ${req.file?.originalname || 'No file'}`,
      metadata: {
        researchId,
        researchTitle: research.title,
        studentId: student,
        studentName: research.students.find(s => s._id.toString() === student.toString())?.name,
        category: category || "general",
        hasFile: !!req.file,
        filename: req.file?.originalname,
        filesize: req.file?.size,
        version: existingCount + 1
      }
    });

    // Populate feedback for response and email
    const populatedFeedback = await Feedback.findById(feedback._id)
      .populate("student", "name email")
      .populate("adviser", "name email")
      .populate("research", "title");

    // TODO: Send email notification to student

    res.status(201).json({ 
      message: "Feedback uploaded successfully. Student will be notified.",
      feedback: populatedFeedback 
    });
  } catch (error) {
    console.error("Error uploading feedback:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get all feedback (for adviser)
export const getAllFeedback = async (req, res) => {
  try {
    const feedback = await Feedback.find({ adviser: req.user.id })
      .populate("student", "name email")
      .populate("research", "title")
      .populate("adviser", "name email")
      .populate("createdBy", "name email role")
      .sort({ createdAt: -1 });

    res.json(feedback);
  } catch (error) {
    console.error("Error fetching feedback:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get feedback for specific research
export const getFeedbackByResearch = async (req, res) => {
  try {
    const { researchId } = req.params;

    const feedback = await Feedback.find({ 
      research: researchId,
      adviser: req.user.id 
    })
      .populate("student", "name email")
      .populate("research", "title")
      .populate("adviser", "name email")
      .sort({ createdAt: -1 });

    res.json(feedback);
  } catch (error) {
    console.error("Error fetching feedback:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get Dean remarks for specific research (for faculty advisers)
export const getDeanRemarks = async (req, res) => {
  try {
    const { researchId } = req.params;

    // Verify that the research belongs to this faculty adviser
    const research = await Research.findById(researchId);
    if (!research) {
      return res.status(404).json({ message: "Research not found" });
    }

    if (research.adviser.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized access to this research" });
    }

    // Find all users with role "dean"
    const deanUsers = await User.find({ role: "dean" }).select("_id");
    const deanIds = deanUsers.map(dean => dean._id);

    // Get feedback created by Dean for this research
    const deanRemarks = await Feedback.find({
      research: researchId,
      createdBy: { $in: deanIds }
    })
      .populate("student", "name email")
      .populate("research", "title")
      .populate("adviser", "name email")
      .populate("createdBy", "name email role")
      .sort({ createdAt: -1 });

    res.json(deanRemarks);
  } catch (error) {
    console.error("Error fetching Dean remarks:", error);
    res.status(500).json({ message: error.message });
  }
};

// Download feedback file
export const downloadFeedbackFile = async (req, res) => {
  try {
    const { feedbackId } = req.params;

    const feedback = await Feedback.findById(feedbackId);
    if (!feedback) {
      return res.status(404).json({ message: "Feedback not found" });
    }

    // Verify authorization
    if (feedback.adviser.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    if (!feedback.file || !feedback.file.filepath) {
      return res.status(404).json({ message: "No file attached to this feedback" });
    }

    // Send file
    res.download(feedback.file.filepath, feedback.file.filename);
  } catch (error) {
    console.error("Error downloading feedback file:", error);
    res.status(500).json({ message: error.message });
  }
};

// View feedback file (for inline viewing)
export const viewFeedbackFile = async (req, res) => {
  try {
    const { feedbackId } = req.params;
    console.log('[VIEW FEEDBACK FILE] Request received:', {
      feedbackId,
      method: req.method,
      path: req.path,
      originalUrl: req.originalUrl,
      userId: req.user?.id,
      userRole: req.user?.role
    });

    // Validate feedbackId format
    if (!feedbackId || feedbackId.length !== 24) {
      console.log('[VIEW FEEDBACK FILE] Invalid feedbackId format:', feedbackId);
      return res.status(400).json({ message: "Invalid feedback ID format" });
    }

    // First check authorization without populating
    const feedback = await Feedback.findById(feedbackId);
    
    if (!feedback) {
      console.log('[VIEW FEEDBACK FILE] Feedback not found:', feedbackId);
      return res.status(404).json({ message: "Feedback not found" });
    }

    console.log('[VIEW FEEDBACK FILE] Feedback found:', {
      feedbackId: feedback._id.toString(),
      adviserId: feedback.adviser?.toString(),
      hasFile: !!feedback.file,
      filepath: feedback.file?.filepath
    });

    // Verify authorization
    const feedbackAdviserId = feedback.adviser.toString();
    const currentUserId = req.user.id.toString();

    if (feedbackAdviserId !== currentUserId) {
      console.log('[VIEW FEEDBACK FILE] Authorization failed:', {
        feedbackAdviserId,
        currentUserId
      });
      return res.status(403).json({ 
        message: "Unauthorized access. You can only view feedback that you created." 
      });
    }

    console.log('[VIEW FEEDBACK FILE] Authorization passed');

    // Now populate for response
    await feedback.populate('student', 'name email');
    await feedback.populate('adviser', 'name email');
    await feedback.populate('research', 'forms');

    // If feedback doesn't have a file, try to get it from the research form
    if (!feedback.file || !feedback.file.filepath) {
      console.log('[VIEW FEEDBACK FILE] No file attached to feedback, checking research forms...');
      
      // Try to find the file from research forms
      if (feedback.research && feedback.research.forms && feedback.research.forms.length > 0) {
        // Find the most recent form with a file
        const formWithFile = feedback.research.forms
          .filter(f => f.filepath)
          .sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0))[0];
        
        if (formWithFile) {
          console.log('[VIEW FEEDBACK FILE] Found file in research form:', formWithFile.filename);
          
          // Get file stats
          let filesize = null;
          let mimetype = null;
          
          try {
            const filePath = path.isAbsolute(formWithFile.filepath) 
              ? formWithFile.filepath 
              : path.join(process.cwd(), formWithFile.filepath);
            
            if (fs.existsSync(filePath)) {
              const stats = fs.statSync(filePath);
              filesize = stats.size;
              
              // Determine mimetype from extension
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
              
              // Use the form's file
              feedback.file = {
                filename: formWithFile.filename || 'document',
                filepath: formWithFile.filepath,
                filesize: filesize,
                mimetype: mimetype,
                uploadedAt: formWithFile.uploadedAt || new Date()
              };
              
              console.log('[VIEW FEEDBACK FILE] Using file from research form:', feedback.file);
            } else {
              console.log('[VIEW FEEDBACK FILE] File from form not found on disk:', filePath);
            }
          } catch (error) {
            console.error('[VIEW FEEDBACK FILE] Error accessing form file:', error);
          }
        }
      }
      
      // If still no file, return error
      if (!feedback.file || !feedback.file.filepath) {
        console.log('[VIEW FEEDBACK FILE] No file found in feedback or research forms');
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

    console.log('[VIEW FEEDBACK FILE] Checking file at path:', filePath);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.log('[VIEW FEEDBACK FILE] File not found at path:', filePath);
      return res.status(404).json({ message: "File not found on server" });
    }

    console.log('[VIEW FEEDBACK FILE] File found, sending response');

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

// Get comments for a feedback
export const getFeedbackComments = async (req, res) => {
  try {
    const { feedbackId } = req.params;

    const feedback = await Feedback.findById(feedbackId);
    if (!feedback) {
      return res.status(404).json({ message: "Feedback not found" });
    }

    // Verify authorization
    if (feedback.adviser.toString() !== req.user.id) {
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

// Add comment to feedback
export const addFeedbackComment = async (req, res) => {
  try {
    const { feedbackId } = req.params;
    const { comment, position, pageNumber, selectedText, highlightColor } = req.body;

    const feedback = await Feedback.findById(feedbackId);
    if (!feedback) {
      return res.status(404).json({ message: "Feedback not found" });
    }

    // Verify authorization
    if (feedback.adviser.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    const feedbackComment = new FeedbackComment({
      feedback: feedbackId,
      createdBy: req.user.id,
      comment,
      position: {
        ...position,
        pageNumber: pageNumber || null,
        selectedText: selectedText || ''
      },
      highlightColor: highlightColor || "#ffeb3b"
    });

    await feedbackComment.save();

    const populatedComment = await FeedbackComment.findById(feedbackComment._id)
      .populate('createdBy', 'name email');

    res.status(201).json({
      message: "Comment added successfully",
      comment: populatedComment
    });
  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).json({ message: error.message });
  }
};

// Update comment (resolve/edit)
export const updateFeedbackComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { comment, resolved } = req.body;

    const feedbackComment = await FeedbackComment.findById(commentId)
      .populate('feedback');
    
    if (!feedbackComment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    // Verify authorization
    if (feedbackComment.feedback.adviser.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    if (comment !== undefined) {
      feedbackComment.comment = comment;
    }

    if (resolved !== undefined) {
      feedbackComment.resolved = resolved;
      if (resolved) {
        feedbackComment.resolvedAt = new Date();
        feedbackComment.resolvedBy = req.user.id;
      } else {
        feedbackComment.resolvedAt = null;
        feedbackComment.resolvedBy = null;
      }
    }

    await feedbackComment.save();

    const populatedComment = await FeedbackComment.findById(feedbackComment._id)
      .populate('createdBy', 'name email')
      .populate('resolvedBy', 'name');

    res.json({
      message: "Comment updated successfully",
      comment: populatedComment
    });
  } catch (error) {
    console.error("Error updating comment:", error);
    res.status(500).json({ message: error.message });
  }
};

// Delete comment
export const deleteFeedbackComment = async (req, res) => {
  try {
    const { commentId } = req.params;

    const feedbackComment = await FeedbackComment.findById(commentId)
      .populate('feedback');
    
    if (!feedbackComment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    // Verify authorization
    if (feedbackComment.feedback.adviser.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    await FeedbackComment.findByIdAndDelete(commentId);

    res.json({ message: "Comment deleted successfully" });
  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(500).json({ message: error.message });
  }
};

// Delete feedback
export const deleteFeedback = async (req, res) => {
  try {
    const { feedbackId } = req.params;

    // Validate ID format (avoid cast errors causing 500)
    if (!mongoose.Types.ObjectId.isValid(feedbackId)) {
      return res.status(400).json({ message: "Invalid feedback ID format." });
    }

    const feedback = await Feedback.findById(feedbackId)
      .populate("student", "name email")
      .populate("research", "title adviser")
      .populate("createdBy", "name email role");

    if (!feedback) {
      return res.status(404).json({ message: "Feedback not found" });
    }

    // Prevent deletion of feedback created by Dean
    if (feedback.createdBy && feedback.createdBy.role === 'dean') {
      return res.status(403).json({ message: "Cannot delete feedback created by Dean" });
    }

    // Verify authorization (only the adviser who created it can delete)
    if (!feedback.adviser || feedback.adviser.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized to delete this feedback" });
    }

    // Store details for logging (defensive: handle missing populated refs)
    const feedbackDetails = {
      id: feedback._id,
      studentId: feedback.student?._id,
      studentName: feedback.student?.name || "Unknown student",
      researchId: feedback.research?._id,
      researchTitle: feedback.research?.title || "Unknown research",
      filename: feedback.file?.filename || null,
      category: feedback.category || null,
      version: feedback.version || 1,
      createdAt: feedback.createdAt,
      adviserId: feedback.adviser,
    };

    // Delete the feedback
    await Feedback.findByIdAndDelete(feedbackId);

    // Log the activity (don't let logging failure break delete)
    try {
      await Activity.create({
        user: req.user.id,
        action: "delete",
        entityType: "feedback",
        entityId: feedbackId,
        entityName: `Feedback for ${feedbackDetails.studentName}`,
        description: `Deleted feedback: ${feedbackDetails.filename || "No file attached"}`,
        metadata: feedbackDetails,
      });
    } catch (logError) {
      console.error("Error logging feedback delete activity:", logError);
    }

    res.json({ message: "Feedback deleted successfully" });
  } catch (error) {
    console.error("Error deleting feedback:", error);
    res.status(500).json({ message: "Failed to delete feedback. Please try again." });
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
      .populate("createdBy", "name email")
      .sort({ datetime: 1 });
    
    res.json(schedules);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create consultation slot (Faculty Adviser)
export const createConsultationSlot = async (req, res) => {
  try {
    const { title, description, datetime, duration, location, research, syncToCalendar, consultationType } = req.body;

    console.log('[CREATE CONSULTATION] Received request:', {
      title,
      description,
      datetime,
      datetimeType: typeof datetime,
      duration,
      location,
      research,
      syncToCalendar,
      bodyKeys: Object.keys(req.body)
    });

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

    // Parse datetime as Manila time (since the system is for Philippine users)
    // The datetime from frontend should be treated as Manila local time and converted to UTC for storage
    let startTime;
    
    if (typeof datetime === 'string') {
      // If it's an ISO string with timezone (Z or +/-), parse directly
      if (datetime.includes('Z') || datetime.match(/[+-]\d{2}:\d{2}$/)) {
        startTime = new Date(datetime);
      } else if (datetime.includes('T') && !datetime.includes('Z') && !datetime.includes('+')) {
        // This is datetime-local format (YYYY-MM-DDTHH:mm) - treat as Manila time
        // Parse as Manila timezone explicitly and convert to UTC
        // Example: "2025-11-29T03:00" should be interpreted as 3:00 AM Manila time = 2025-11-28 19:00 UTC
        const [datePart, timePart] = datetime.split('T');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hour, minute] = timePart.split(':').map(Number);
        
        // Create a date object treating the input as Manila time (UTC+8)
        // We'll create it as UTC first, then subtract 8 hours to get the correct UTC time
        // Create date string in ISO format with Manila timezone offset
        const manilaTimeString = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${hour.toString().padStart(2, '0')}:${(minute || 0).toString().padStart(2, '0')}:00+08:00`;
        startTime = new Date(manilaTimeString);
        
        // Fallback if above doesn't work: manually calculate UTC
        if (isNaN(startTime.getTime())) {
          // Manila is UTC+8, so subtract 8 hours (8 * 60 * 60 * 1000 ms) to get UTC
          const manilaDate = new Date(Date.UTC(year, month - 1, day, hour, minute || 0, 0, 0));
          const manilaOffsetMs = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
          startTime = new Date(manilaDate.getTime() - manilaOffsetMs);
        }
        
        console.log('[CREATE CONSULTATION] Datetime parsing:', {
          input: datetime,
          parsedAsManila: `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${hour.toString().padStart(2, '0')}:${(minute || 0).toString().padStart(2, '0')}:00 (Manila UTC+8)`,
          utcEquivalent: startTime.toISOString(),
          manilaEquivalent: startTime.toLocaleString('en-US', { 
            timeZone: 'Asia/Manila', 
            hour12: false,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          })
        });
      } else {
        startTime = new Date(datetime);
      }
    } else {
      // Already a Date object
      startTime = new Date(datetime);
    }
    
    // Validate that datetime is a valid date
    if (isNaN(startTime.getTime())) {
      console.error('[CREATE CONSULTATION] Invalid datetime received:', {
        input: datetime,
        inputType: typeof datetime,
        parsedStartTime: startTime
      });
      return res.status(400).json({ 
        message: "Invalid date format. Please select a valid date and time.",
        received: datetime
      });
    }
    
    const endTime = new Date(startTime.getTime() + (duration || 60) * 60000);

    const overlappingSchedules = await Schedule.find({
      "participants.user": req.user.id,
      "participants.role": "adviser",
      datetime: {
        $gte: new Date(startTime.getTime() - 60 * 60000), // 1 hour before
        $lte: new Date(endTime.getTime() + 60 * 60000) // 1 hour after
      },
      status: { $ne: "cancelled" }
    });

    if (overlappingSchedules.length > 0) {
      return res.status(400).json({ 
        message: "Time slot conflicts with existing schedule. Please choose a different time." 
      });
    }

    // Create the consultation slot
    const schedule = new Schedule({
      research: research || null,
      type: "consultation",
      title: title || "Consultation Slot",
      description: description || "Available for consultation",
      datetime: startTime,
      duration: duration || 60,
      location: consultationType === "online" ? "Online" : location,
      consultationType: consultationType || "face-to-face",
      participants: [
        {
          user: req.user.id,
          role: "adviser",
          status: "confirmed"
        }
      ],
      createdBy: req.user.id,
      status: "scheduled"
    });

    // Get user's calendar connection status
    const user = await User.findById(req.user.id);
    let researchData = null;
    if (research) {
      researchData = await Research.findById(research)
        .populate("students", "name email");
    }

    // Sync to Google Calendar if enabled and user has connected calendar
    let calendarEvent = null;
    let calendarError = null;
    console.log('[CREATE CONSULTATION SLOT] Checking Google Calendar connection:', {
      userId: req.user.id,
      syncToCalendar: syncToCalendar !== false,
      calendarConnected: user?.calendarConnected,
      hasAccessToken: !!user?.googleAccessToken,
      hasRefreshToken: !!user?.googleRefreshToken,
      tokenExpiry: user?.googleTokenExpiry,
      tokenExpired: user?.googleTokenExpiry ? user.googleTokenExpiry < new Date() : 'unknown'
    });

    if (syncToCalendar !== false && user?.calendarConnected && user?.googleAccessToken && user?.googleRefreshToken) {
      try {
        console.log('[CREATE CONSULTATION SLOT] Creating Google Calendar event for consultation:', schedule.title);
        
        // Collect attendee emails
        const attendeeEmails = [];
        if (researchData && researchData.students) {
          attendeeEmails.push(...researchData.students.map(s => s.email));
        }

        console.log('[CREATE CONSULTATION SLOT] Schedule data:', {
          title: schedule.title,
          datetime: schedule.datetime,
          datetimeISO: schedule.datetime?.toISOString(),
          duration: schedule.duration,
          location: schedule.location,
          type: schedule.type,
          researchTitle: researchData?.title,
          attendeeCount: attendeeEmails.length
        });

        // Create Google Calendar event (token refresh will happen automatically if needed)
        calendarEvent = await createConsultationEvent(
          {
            title: schedule.title,
            description: schedule.description,
            datetime: schedule.datetime,
            duration: schedule.duration,
            location: schedule.location,
            type: schedule.type,
            researchTitle: researchData?.title,
            attendeeEmails,
          },
          user.googleAccessToken,
          user.googleRefreshToken,
          user._id.toString()
        );

        console.log('[CREATE CONSULTATION SLOT] Google Calendar event created successfully:', {
          eventId: calendarEvent.eventId,
          eventLink: calendarEvent.eventLink,
          meetLink: calendarEvent.meetLink
        });

        // ✅ SUCCESS: Google Calendar event added
        console.log('✅ [SUCCESS] Consultation added to Google Calendar:', {
          scheduleId: schedule._id,
          scheduleTitle: schedule.title,
          googleCalendarEventId: calendarEvent.eventId,
          googleCalendarLink: calendarEvent.eventLink,
          googleMeetLink: calendarEvent.meetLink,
          datetime: schedule.datetime
        });

        // Update schedule with Google Calendar event details
        schedule.googleCalendarEventId = calendarEvent.eventId;
        schedule.googleCalendarLink = calendarEvent.eventLink;
        schedule.googleMeetLink = calendarEvent.meetLink;
        schedule.calendarSynced = true;
        
        console.log('[CREATE CONSULTATION SLOT] Schedule updated with calendar sync status: true');
      } catch (error) {
        calendarError = error;
        console.error('[CREATE CONSULTATION SLOT] Error syncing to Google Calendar:', error);
        console.error('[CREATE CONSULTATION SLOT] Error details:', {
          message: error.message,
          code: error.code,
          response: error.response?.data,
          status: error.response?.status,
          statusText: error.response?.statusText,
          stack: error.stack
        });
        // Don't fail creation if calendar sync fails - schedule is still created
        // But we'll inform the user about the sync failure
        schedule.calendarSynced = false;
        console.log('[CREATE CONSULTATION SLOT] Continuing without Google Calendar sync');
      }
    } else {
      const skipReason = !user?.calendarConnected ? 'Calendar not connected' : 
                        !user?.googleAccessToken ? 'No access token' : 
                        !user?.googleRefreshToken ? 'No refresh token - user needs to reconnect calendar' : 
                        'syncToCalendar is false';
      console.log('[CREATE CONSULTATION SLOT] Google Calendar sync skipped:', {
        syncToCalendar: syncToCalendar !== false,
        calendarConnected: user?.calendarConnected,
        hasAccessToken: !!user?.googleAccessToken,
        hasRefreshToken: !!user?.googleRefreshToken,
        reason: skipReason
      });
      schedule.calendarSynced = false;
    }

    // If consultation type is "online" and no Meet link was created via calendar sync, create one manually
    if (schedule.consultationType === "online" && !schedule.googleMeetLink && user?.calendarConnected && user?.googleAccessToken && user?.googleRefreshToken) {
      try {
        console.log('[CREATE CONSULTATION SLOT] Creating Google Meet link for online consultation');
        
        // Collect attendee emails
        const attendeeEmails = [];
        if (researchData && researchData.students) {
          attendeeEmails.push(...researchData.students.map(s => s.email));
        }

        // Create a minimal calendar event just to get the Meet link
        calendarEvent = await createConsultationEvent(
          {
            title: schedule.title,
            description: schedule.description,
            datetime: schedule.datetime,
            duration: schedule.duration,
            location: "Online",
            type: schedule.type,
            researchTitle: researchData?.title,
            attendeeEmails,
          },
          user.googleAccessToken,
          user.googleRefreshToken,
          user._id.toString()
        );

        if (calendarEvent.meetLink) {
          schedule.googleMeetLink = calendarEvent.meetLink;
          schedule.googleCalendarEventId = calendarEvent.eventId;
          schedule.googleCalendarLink = calendarEvent.eventLink;
          schedule.calendarSynced = true;
          console.log('[CREATE CONSULTATION SLOT] Google Meet link created:', calendarEvent.meetLink);
        }
      } catch (error) {
        console.error('[CREATE CONSULTATION SLOT] Error creating Google Meet link:', error);
        // Continue without Meet link
      }
    }

    await schedule.save();

    // ✅ SUCCESS: Consultation schedule created
    console.log('✅ [SUCCESS] Consultation schedule created successfully:', {
      scheduleId: schedule._id,
      title: schedule.title,
      datetime: schedule.datetime,
      duration: schedule.duration,
      location: schedule.location,
      createdBy: req.user.id,
      calendarSynced: schedule.calendarSynced,
      googleCalendarEventId: schedule.googleCalendarEventId || null,
      googleMeetLink: schedule.googleMeetLink || null
    });

    // Log the activity
    await Activity.create({
      user: req.user.id,
      action: "create",
      entityType: "schedule",
      entityId: schedule._id,
      entityName: schedule.title,
      description: `Created consultation slot: ${schedule.title}${calendarEvent ? ' (synced to Google Calendar)' : ''}`,
      metadata: {
        datetime: schedule.datetime,
        duration: schedule.duration,
        location: schedule.location,
        type: "consultation",
        calendarSynced: schedule.calendarSynced,
        googleMeetLink: schedule.googleMeetLink
      }
    });

    // Send email notification to students associated with the research
    if (researchData && researchData.students && researchData.students.length > 0) {
      const adviserName = req.user.name || "Your Adviser";
      const formattedDate = new Date(schedule.datetime).toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Send email to each student
      for (const student of researchData.students) {
        if (student.email) {
          await sendNotificationEmail(
            student.email,
            `New Consultation Slot Available: ${schedule.title}`,
            `${adviserName} has created a new consultation slot available for booking.`,
            `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #7C1D23;">New Consultation Slot Available</h2>
                <p>Hello ${student.name},</p>
                <p><strong>${adviserName}</strong> has created a new consultation slot that is now available for booking.</p>
                <div style="background-color: #f0f9ff; padding: 15px; margin: 20px 0; border-left: 4px solid #2563eb; border-radius: 4px;">
                  <p style="margin: 8px 0;"><strong style="color: #333;">Consultation Title:</strong> ${schedule.title}</p>
                  <p style="margin: 8px 0;"><strong style="color: #333;">Date & Time:</strong> ${formattedDate}</p>
                  <p style="margin: 8px 0;"><strong style="color: #333;">Duration:</strong> ${schedule.duration || 60} minutes</p>
                  <p style="margin: 8px 0;"><strong style="color: #333;">Location:</strong> ${schedule.location}</p>
                ${schedule.description ? `<p style="margin: 8px 0;"><strong style="color: #333;">Description:</strong> ${schedule.description}</p>` : ''}
                ${schedule.consultationType === "online" && schedule.googleMeetLink ? `<p style="margin: 8px 0;"><strong style="color: #333;">Virtual Meeting:</strong> <a href="${schedule.googleMeetLink}" style="color: #2563eb; text-decoration: none;">${schedule.googleMeetLink}</a></p>` : ''}
                </div>
                <p>You can request this consultation slot from your dashboard. Log in to view and request available consultation slots.</p>
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />
                <p style="color: #999; font-size: 12px;">This is an automated notification from the Masteral Archive and Monitoring System.</p>
              </div>
            `
          );
        }
      }
    } else if (!research) {
      // If no specific research, find all students with this adviser
      const allResearchWithAdviser = await Research.find({ adviser: req.user.id })
        .populate("students", "name email");
      
      const allStudents = new Set();
      allResearchWithAdviser.forEach(r => {
        if (r.students) {
          r.students.forEach(s => allStudents.add(s._id.toString()));
        }
      });

      const uniqueStudents = Array.from(allStudents).map(id => 
        allResearchWithAdviser
          .flatMap(r => r.students || [])
          .find(s => s._id.toString() === id)
      ).filter(Boolean);

      if (uniqueStudents.length > 0) {
        const adviserName = req.user.name || "Your Adviser";
        const formattedDate = new Date(schedule.datetime).toLocaleString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        for (const student of uniqueStudents) {
          if (student.email) {
            await sendNotificationEmail(
              student.email,
              `New Consultation Slot Available: ${schedule.title}`,
              `${adviserName} has created a new consultation slot available for booking.`,
              `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #7C1D23;">New Consultation Slot Available</h2>
                  <p>Hello ${student.name},</p>
                  <p><strong>${adviserName}</strong> has created a new consultation slot that is now available for booking.</p>
                  <div style="background-color: #f0f9ff; padding: 15px; margin: 20px 0; border-left: 4px solid #2563eb; border-radius: 4px;">
                    <p style="margin: 8px 0;"><strong style="color: #333;">Consultation Title:</strong> ${schedule.title}</p>
                    <p style="margin: 8px 0;"><strong style="color: #333;">Date & Time:</strong> ${formattedDate}</p>
                    <p style="margin: 8px 0;"><strong style="color: #333;">Duration:</strong> ${schedule.duration || 60} minutes</p>
                    <p style="margin: 8px 0;"><strong style="color: #333;">Location:</strong> ${schedule.location}</p>
                ${schedule.description ? `<p style="margin: 8px 0;"><strong style="color: #333;">Description:</strong> ${schedule.description}</p>` : ''}
                ${schedule.consultationType === "online" && schedule.googleMeetLink ? `<p style="margin: 8px 0;"><strong style="color: #333;">Virtual Meeting:</strong> <a href="${schedule.googleMeetLink}" style="color: #2563eb; text-decoration: none;">${schedule.googleMeetLink}</a></p>` : ''}
                  </div>
                  <p>You can request this consultation slot from your dashboard. Log in to view and request available consultation slots.</p>
                  <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />
                  <p style="color: #999; font-size: 12px;">This is an automated notification from the Masteral Archive and Monitoring System.</p>
                </div>
              `
            );
          }
        }
      }
    }

    const populatedSchedule = await Schedule.findById(schedule._id)
      .populate("participants.user", "name email")
      .populate("createdBy", "name email");

    // Prepare response message
    let message = "Consultation slot created successfully.";
    if (calendarEvent) {
      message = "Consultation slot created and synced to Google Calendar!";
    } else if (calendarError) {
      message = `Consultation slot created, but Google Calendar sync failed: ${calendarError.message}. Please check your calendar connection.`;
    } else if (syncToCalendar !== false && !user?.calendarConnected) {
      message = "Consultation slot created. Connect Google Calendar to enable automatic sync.";
    }

    res.status(201).json({ 
      message,
      schedule: populatedSchedule,
      calendarSynced: schedule.calendarSynced,
      meetLink: schedule.googleMeetLink,
      calendarError: calendarError ? {
        message: calendarError.message,
        code: calendarError.code
      } : null
    });
  } catch (error) {
    console.error("Error creating consultation slot:", error);
    res.status(500).json({ message: error.message });
  }
};

// Update consultation schedule status (approve/decline request)
export const updateConsultationStatus = async (req, res) => {
  try {
    const { scheduleId, action, participantId, rejectionReason } = req.body; // action: "approve" or "decline"

    const schedule = await Schedule.findById(scheduleId)
      .populate("participants.user", "name email")
      .populate("research", "title");

    if (!schedule) {
      return res.status(404).json({ message: "Schedule not found" });
    }

    // Verify the requester is the adviser
    const adviserParticipant = schedule.participants.find(
      p => p.user._id.toString() === req.user.id && p.role === "adviser"
    );

    if (!adviserParticipant) {
      return res.status(403).json({ message: "Only the adviser can approve/decline consultation requests" });
    }

    // Find the student participant
    const studentParticipant = schedule.participants.find(
      p => p.user._id.toString() === participantId && p.role === "student"
    );

    if (!studentParticipant) {
      return res.status(404).json({ message: "Student participant not found" });
    }

    if (action === "approve") {
      studentParticipant.status = "confirmed";
      schedule.status = "confirmed";
      
      // Sync to Google Calendar if adviser has calendar connected
      const adviser = await User.findById(req.user.id);
      let calendarEvent = null;
      
      if (adviser?.calendarConnected && adviser?.googleAccessToken && adviser?.googleRefreshToken) {
        try {
          console.log('[APPROVE CONSULTATION] Syncing to Google Calendar');
          
          // Collect attendee emails
          const attendeeEmails = [];
          if (studentParticipant.user?.email) {
            attendeeEmails.push(studentParticipant.user.email);
          }
          if (adviser.email) {
            attendeeEmails.push(adviser.email);
          }

          // Create Google Calendar event
          const { createConsultationEvent } = await import("../utils/googleCalendar.js");
          
          calendarEvent = await createConsultationEvent(
            {
              title: schedule.title,
              description: schedule.description || `Consultation with ${studentParticipant.user.name}`,
              datetime: schedule.datetime,
              duration: schedule.duration || 60,
              location: schedule.location,
              type: schedule.type,
              researchTitle: schedule.research?.title,
              attendeeEmails,
            },
            adviser.googleAccessToken,
            adviser.googleRefreshToken,
            adviser._id.toString()
          );

          // Update schedule with Google Calendar event details
          if (calendarEvent.eventId) {
            schedule.googleCalendarEventId = calendarEvent.eventId;
            // Use the eventLink from calendarEvent, or construct it if not available
            if (calendarEvent.eventLink) {
              schedule.googleCalendarLink = calendarEvent.eventLink;
            } else {
              // Construct calendar link from event ID using proper base64url encoding
              const { constructCalendarLink } = await import("../utils/googleCalendar.js");
              schedule.googleCalendarLink = constructCalendarLink(calendarEvent.eventId);
            }
            schedule.calendarSynced = true;
            
            // If consultation is online or Meet link was created, save it
            if (calendarEvent.meetLink) {
              schedule.googleMeetLink = calendarEvent.meetLink;
            } else if (schedule.consultationType === "online" && !schedule.googleMeetLink) {
              // If online but no Meet link, try to get it from the event
              console.log('[APPROVE CONSULTATION] Online consultation - Meet link should be in calendar event');
            }
            
            console.log('[APPROVE CONSULTATION] Successfully synced to Google Calendar:', {
              eventId: calendarEvent.eventId,
              eventLink: schedule.googleCalendarLink,
              meetLink: calendarEvent.meetLink
            });
          }
        } catch (error) {
          console.error('[APPROVE CONSULTATION] Error syncing to Google Calendar:', error);
          // Don't fail the approval if calendar sync fails
          schedule.calendarSynced = false;
        }
      } else {
        console.log('[APPROVE CONSULTATION] Google Calendar not connected, skipping sync');
        schedule.calendarSynced = false;
      }
      
      // Log the activity
      await Activity.create({
        user: req.user.id,
        action: "approve",
        entityType: "schedule",
        entityId: schedule._id,
        entityName: schedule.title,
        description: `Approved consultation request from ${studentParticipant.user.name}${calendarEvent ? ' (synced to Google Calendar)' : ''}`,
        metadata: {
          studentId: studentParticipant.user._id,
          studentName: studentParticipant.user.name,
          datetime: schedule.datetime,
          location: schedule.location,
          calendarSynced: schedule.calendarSynced,
          googleMeetLink: schedule.googleMeetLink
        }
      });

      // Save schedule first to ensure calendar sync data is persisted
      await schedule.save();
      
      // Fetch updated schedule with calendar info
      const scheduleWithCalendar = await Schedule.findById(scheduleId);

      // Send email notification to student about approval
      if (studentParticipant.user && studentParticipant.user.email) {
        const adviserName = req.user.name || "Your Adviser";
        const formattedDate = new Date(schedule.datetime).toLocaleString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        await sendNotificationEmail(
          studentParticipant.user.email,
          `Consultation Request Approved: ${schedule.title}`,
          `Your consultation request has been approved by ${adviserName}.`,
          `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #7C1D23;">Consultation Request Approved</h2>
              <p>Hello ${studentParticipant.user.name},</p>
              <p>Great news! Your consultation request has been <strong style="color: #22c55e;">approved</strong> by ${adviserName}.</p>
              <div style="background-color: #f0fdf4; padding: 15px; margin: 20px 0; border-left: 4px solid #22c55e; border-radius: 4px;">
                <p style="margin: 8px 0;"><strong style="color: #333;">Consultation Title:</strong> ${schedule.title}</p>
                <p style="margin: 8px 0;"><strong style="color: #333;">Date & Time:</strong> ${formattedDate}</p>
                <p style="margin: 8px 0;"><strong style="color: #333;">Duration:</strong> ${schedule.duration || 60} minutes</p>
                <p style="margin: 8px 0;"><strong style="color: #333;">Location:</strong> ${schedule.location}</p>
                ${schedule.description ? `<p style="margin: 8px 0;"><strong style="color: #333;">Description:</strong> ${schedule.description}</p>` : ''}
                ${scheduleWithCalendar?.consultationType === "online" && scheduleWithCalendar?.googleMeetLink ? `<p style="margin: 8px 0;"><strong style="color: #333;">Virtual Meeting:</strong> <a href="${scheduleWithCalendar.googleMeetLink}" style="color: #2563eb; text-decoration: none;">${scheduleWithCalendar.googleMeetLink}</a></p>` : ''}
                ${scheduleWithCalendar?.googleCalendarLink ? `<p style="margin: 8px 0;"><strong style="color: #333;">Calendar Event:</strong> <a href="${scheduleWithCalendar.googleCalendarLink}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: none;">View in Google Calendar</a></p>` : ''}
                ${scheduleWithCalendar?.googleCalendarEventId && !scheduleWithCalendar?.googleCalendarLink ? `<p style="margin: 8px 0;"><strong style="color: #333;">Calendar Event ID:</strong> ${scheduleWithCalendar.googleCalendarEventId}</p>` : ''}
              </div>
              ${scheduleWithCalendar?.calendarSynced ? '<p>This consultation has been added to your adviser\'s Google Calendar. Please mark this date and time in your calendar. We look forward to meeting with you!</p>' : '<p>Please mark this date and time in your calendar. We look forward to meeting with you!</p>'}
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />
              <p style="color: #999; font-size: 12px;">This is an automated notification from the Masteral Archive and Monitoring System.</p>
            </div>
          `
        );
      }
    } else if (action === "decline") {
      studentParticipant.status = "declined";
      
      // Store rejection reason if provided
      if (rejectionReason) {
        schedule.rejectionReason = rejectionReason;
      }
      
      // Log the activity
      await Activity.create({
        user: req.user.id,
        action: "reject",
        entityType: "schedule",
        entityId: schedule._id,
        entityName: schedule.title,
        description: `Declined consultation request from ${studentParticipant.user.name}${rejectionReason ? ` - Reason: ${rejectionReason}` : ''}`,
        metadata: {
          studentId: studentParticipant.user._id,
          studentName: studentParticipant.user.name,
          datetime: schedule.datetime,
          rejectionReason: rejectionReason || null
        }
      });

      // Send email notification to student about decline
      if (studentParticipant.user && studentParticipant.user.email) {
        const adviserName = req.user.name || "Your Adviser";
        const formattedDate = new Date(schedule.datetime).toLocaleString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        // Build rejection reason section for email
        const rejectionReasonSection = schedule.rejectionReason 
          ? `
              <div style="background-color: #fff7ed; padding: 15px; margin: 20px 0; border-left: 4px solid #f59e0b; border-radius: 4px;">
                <p style="margin: 0 0 8px 0;"><strong style="color: #333;">Reason for Decline:</strong></p>
                <p style="margin: 0; color: #333;">${schedule.rejectionReason}</p>
              </div>
            `
          : '';

        await sendNotificationEmail(
          studentParticipant.user.email,
          `Consultation Request Declined: ${schedule.title}`,
          `Your consultation request for ${formattedDate} has been declined by ${adviserName}.${schedule.rejectionReason ? ` Reason: ${schedule.rejectionReason}` : ''}`,
          `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #7C1D23;">Consultation Request Declined</h2>
              <p>Hello ${studentParticipant.user.name},</p>
              <p>Your consultation request has been <strong style="color: #dc2626;">declined</strong> by ${adviserName}.</p>
              <div style="background-color: #fef2f2; padding: 15px; margin: 20px 0; border-left: 4px solid #dc2626; border-radius: 4px;">
                <p style="margin: 8px 0;"><strong style="color: #333;">Consultation Title:</strong> ${schedule.title}</p>
                <p style="margin: 8px 0;"><strong style="color: #333;">Requested Date & Time:</strong> ${formattedDate}</p>
                <p style="margin: 8px 0;"><strong style="color: #333;">Location:</strong> ${schedule.location}</p>
                ${schedule.consultationType ? `<p style="margin: 8px 0;"><strong style="color: #333;">Consultation Type:</strong> ${schedule.consultationType === "online" ? "Online" : "Face-to-Face"}</p>` : ''}
              </div>
              ${rejectionReasonSection}
              <p>You may request a different consultation slot that better fits your adviser's schedule.</p>
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />
              <p style="color: #999; font-size: 12px;">This is an automated notification from the Masteral Archive and Monitoring System.</p>
            </div>
          `
        );
      }
    }

    // Save schedule (if not already saved in approve action)
    if (action !== "approve") {
      await schedule.save();
    }

    // Fetch updated schedule with all populated fields for response
    const updatedSchedule = await Schedule.findById(scheduleId)
      .populate("participants.user", "name email")
      .populate("research", "title")
      .populate("createdBy", "name email");

    // Prepare response message
    let responseMessage = `Consultation request ${action}d successfully.`;
    if (action === "approve" && updatedSchedule.calendarSynced) {
      responseMessage += " The consultation has been added to Google Calendar.";
    }

    res.json({ 
      message: responseMessage, 
      schedule: updatedSchedule,
      calendarSynced: action === "approve" ? updatedSchedule.calendarSynced : undefined,
      googleMeetLink: action === "approve" ? updatedSchedule.googleMeetLink : undefined
    });
  } catch (error) {
    console.error("Error updating consultation status:", error);
    res.status(500).json({ message: error.message });
  }
};

// Cancel consultation
export const cancelConsultation = async (req, res) => {
  try {
    const { scheduleId, reason } = req.body;

    const schedule = await Schedule.findById(scheduleId)
      .populate("participants.user", "name email");

    if (!schedule) {
      return res.status(404).json({ message: "Schedule not found" });
    }

    // Verify the requester is a participant
    const participant = schedule.participants.find(
      p => p.user._id.toString() === req.user.id
    );

    if (!participant) {
      return res.status(403).json({ message: "You are not authorized to cancel this consultation" });
    }

    schedule.status = "cancelled";
    await schedule.save();

    // Log the activity
    await Activity.create({
      user: req.user.id,
      action: "delete",
      entityType: "schedule",
      entityId: schedule._id,
      entityName: schedule.title,
      description: `Cancelled consultation: ${schedule.title}`,
      metadata: {
        datetime: schedule.datetime,
        reason: reason || "No reason provided",
        cancelledBy: participant.role
      }
    });

    // TODO: Notify other participants about cancellation

    res.json({ message: "Consultation cancelled successfully." });
  } catch (error) {
    console.error("Error cancelling consultation:", error);
    res.status(500).json({ message: error.message });
  }
};

// Edit/Update consultation slot (Faculty Adviser)
export const updateConsultationSlot = async (req, res) => {
  try {
    const { scheduleId, title, description, datetime, duration, location } = req.body;

    const schedule = await Schedule.findById(scheduleId)
      .populate("participants.user", "name email");

    if (!schedule) {
      return res.status(404).json({ message: "Schedule not found" });
    }

    // Verify the requester is the adviser who created it
    const adviserParticipant = schedule.participants.find(
      p => p.user._id.toString() === req.user.id && p.role === "adviser"
    );

    if (!adviserParticipant) {
      return res.status(403).json({ message: "Only the adviser who created this slot can edit it" });
    }

    // Store old values for logging
    const oldValues = {
      title: schedule.title,
      datetime: schedule.datetime,
      duration: schedule.duration,
      location: schedule.location,
      description: schedule.description
    };

    // Parse datetime as Manila time if provided (same logic as create)
    let startTime;
    if (datetime) {
      // Parse datetime as Manila time
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
        return res.status(400).json({ message: "Invalid date format. Please select a valid date and time." });
      }
      
      // Check for double-booking if datetime is being changed
      if (startTime.getTime() !== new Date(schedule.datetime).getTime()) {
        const endTime = new Date(startTime.getTime() + (duration || schedule.duration) * 60000);

        const overlappingSchedules = await Schedule.find({
          _id: { $ne: scheduleId }, // Exclude current schedule
          "participants.user": req.user.id,
          "participants.role": "adviser",
          datetime: {
            $gte: new Date(startTime.getTime() - 60 * 60000),
            $lte: new Date(endTime.getTime() + 60 * 60000)
          },
          status: { $ne: "cancelled" }
        });

        if (overlappingSchedules.length > 0) {
          return res.status(400).json({ 
            message: "Time slot conflicts with existing schedule. Please choose a different time." 
          });
        }
      }
    }

    // Update the schedule
    if (title) schedule.title = title;
    if (description !== undefined) schedule.description = description;
    if (datetime) {
      // Use the parsed startTime that was already calculated
      schedule.datetime = startTime;
    }
    if (duration) schedule.duration = duration;
    if (location) schedule.location = location;

    await schedule.save();

    // Log the activity
    const changes = [];
    if (title && title !== oldValues.title) changes.push(`title: "${oldValues.title}" → "${title}"`);
    if (datetime && startTime && startTime.getTime() !== new Date(oldValues.datetime).getTime()) {
      changes.push(`datetime: "${new Date(oldValues.datetime).toLocaleString()}" → "${startTime.toLocaleString()}"`);
    }
    if (duration && duration !== oldValues.duration) changes.push(`duration: ${oldValues.duration} → ${duration} minutes`);
    if (location && location !== oldValues.location) changes.push(`location: "${oldValues.location}" → "${location}"`);

    await Activity.create({
      user: req.user.id,
      action: "update",
      entityType: "schedule",
      entityId: schedule._id,
      entityName: schedule.title,
      description: `Updated consultation slot: ${schedule.title}`,
      metadata: {
        oldValues,
        newValues: {
          title: schedule.title,
          datetime: schedule.datetime,
          duration: schedule.duration,
          location: schedule.location,
          description: schedule.description
        },
        changes: changes.join(", "),
        affectedStudents: schedule.participants
          .filter(p => p.role === "student")
          .map(p => ({ id: p.user._id, name: p.user.name }))
      }
    });

    // TODO: Send notification to students about schedule change

    const updatedSchedule = await Schedule.findById(scheduleId)
      .populate("participants.user", "name email")
      .populate("createdBy", "name email");

    res.json({ 
      message: "Consultation slot updated successfully.", 
      schedule: updatedSchedule 
    });
  } catch (error) {
    console.error("Error updating consultation slot:", error);
    res.status(500).json({ message: error.message });
  }
};

// Delete consultation slot (Faculty Adviser)
export const deleteConsultationSlot = async (req, res) => {
  try {
    const { scheduleId } = req.params;

    const schedule = await Schedule.findById(scheduleId)
      .populate("participants.user", "name email");

    if (!schedule) {
      return res.status(404).json({ message: "Schedule not found" });
    }

    // Verify the requester is the adviser who created it
    const adviserParticipant = schedule.participants.find(
      p => p.user._id.toString() === req.user.id && p.role === "adviser"
    );

    if (!adviserParticipant) {
      return res.status(403).json({ message: "Only the adviser who created this slot can delete it" });
    }

    // Get affected students before deletion
    const affectedStudents = schedule.participants
      .filter(p => p.role === "student")
      .map(p => ({ id: p.user._id, name: p.user.name, email: p.user.email }));

    // Store schedule details for logging
    const scheduleDetails = {
      title: schedule.title,
      datetime: schedule.datetime,
      location: schedule.location,
      duration: schedule.duration,
      affectedStudents
    };

    // Delete the schedule permanently
    await Schedule.findByIdAndDelete(scheduleId);

    // Log the activity
    await Activity.create({
      user: req.user.id,
      action: "delete",
      entityType: "schedule",
      entityId: scheduleId,
      entityName: scheduleDetails.title,
      description: `Deleted consultation slot: ${scheduleDetails.title}`,
      metadata: {
        ...scheduleDetails,
        deletedAt: new Date(),
        affectedStudentCount: affectedStudents.length
      }
    });

    // TODO: Send automatic cancellation notifications to affected students

    res.json({ 
      message: "Consultation slot deleted successfully.", 
      affectedStudents: affectedStudents.length 
    });
  } catch (error) {
    console.error("Error deleting consultation slot:", error);
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

// Get panels assigned to the faculty member OR panels for their students' research
export const getMyPanels = async (req, res) => {
  try {
    const userId = req.user.id.toString();
    
    // Find all panels first, then filter in code
    const allPanels = await Panel.find()
      .populate("research", "title students abstract adviser")
      .populate("members.faculty", "name email")
      .populate("reviews.panelist", "name email")
      .populate("assignedBy", "name")
      .sort({ createdAt: -1 });

    // Filter to show panels where:
    // 1. Research still exists (not deleted)
    // 2. User is selected as active panelist, OR
    // 3. User is the adviser of the research (so they can see all reviews including external)
    const myPanels = allPanels.filter(panel => {
      // Skip panels where research has been deleted
      if (!panel.research) {
        return false;
      }
      
      // Check if user is a panelist
      const myMember = panel.members.find(m => {
        const facultyId = m.faculty?._id || m.faculty;
        const facultyIdStr = facultyId?.toString() || facultyId;
        return facultyIdStr === userId && m.isSelected === true;
      });
      
      // Check if user is the adviser of the research
      const researchAdviserId = panel.research?.adviser?._id || panel.research?.adviser;
      const researchAdviserIdStr = researchAdviserId?.toString() || researchAdviserId;
      const isAdviser = researchAdviserIdStr === userId;
      
      return myMember !== undefined || isAdviser;
    });

    // Calculate review status for each panel
    const panelsWithReviewStatus = myPanels.map(panel => {
      const myReview = panel.reviews.find(r => {
        // For internal reviews, check by panelist ID
        if (!r.isExternal && r.panelist) {
          const panelistId = r.panelist?._id || r.panelist;
          return (panelistId?.toString() || panelistId) === userId;
        }
        // For external reviews, they won't match the logged-in user
        return false;
      });

      return {
        ...panel.toObject(),
        myReview: myReview || null,
        hasSubmittedReview: myReview?.status === 'submitted' || false,
        reviewStatus: myReview?.status || 'pending',
        reviewDueDate: myReview?.dueDate || panel.reviewDeadline,
      };
    });

    res.json(panelsWithReviewStatus);
  } catch (error) {
    console.error('Error fetching panels:', error);
    res.status(500).json({ message: error.message });
  }
};

// Submit panel review
export const submitPanelReview = async (req, res) => {
  try {
    const { panelId } = req.params; // Get panelId from URL parameter
    const { comments, recommendation } = req.body; // Get comments and recommendation from body
    const userId = req.user.id.toString();

    if (!comments || !comments.trim()) {
      return res.status(400).json({ message: "Comments are required" });
    }

    if (!recommendation) {
      return res.status(400).json({ message: "Recommendation is required" });
    }

    // Validate recommendation enum values
    const validRecommendations = ["approve", "reject", "revision", "pending"];
    if (!validRecommendations.includes(recommendation)) {
      return res.status(400).json({ 
        message: `Invalid recommendation. Must be one of: ${validRecommendations.join(", ")}` 
      });
    }

    if (!panelId) {
      return res.status(400).json({ message: "Panel ID is required" });
    }

    const panel = await Panel.findById(panelId);

    if (!panel) {
      return res.status(404).json({ message: "Panel not found" });
    }

    // Verify user is an active panelist
    const myMember = panel.members.find(m => {
      const facultyId = m.faculty?._id || m.faculty;
      return (facultyId?.toString() || facultyId) === userId && m.isSelected;
    });

    if (!myMember) {
      return res.status(403).json({ message: "You are not an active panelist for this panel" });
    }

    // Find existing review or create new one
    const existingReviewIndex = panel.reviews.findIndex(r => {
      if (r.isExternal) return false; // External reviews won't match internal panelist
      const panelistId = r.panelist?._id || r.panelist;
      return (panelistId?.toString() || panelistId) === userId;
    });

    const reviewData = {
      panelist: req.user.id,
      comments: comments?.trim() || '',
      recommendation: recommendation,
      status: 'submitted',
      submittedAt: new Date(),
      dueDate: panel.reviewDeadline || null,
      isExternal: false, // Internal review
    };

    if (existingReviewIndex >= 0) {
      // Update existing review
      const existingReview = panel.reviews[existingReviewIndex];
      panel.reviews[existingReviewIndex] = {
        ...existingReview.toObject ? existingReview.toObject() : existingReview,
        ...reviewData,
      };
    } else {
      // Create new review
      panel.reviews.push(reviewData);
    }

    // Update panel progress
    const activeMembers = panel.members.filter(m => m.isSelected);
    const submittedReviews = panel.reviews.filter(r => r.status === 'submitted');
    panel.progress = activeMembers.length > 0
      ? Math.round((submittedReviews.length / activeMembers.length) * 100)
      : 0;

    // Update panel status if all reviews are submitted
    if (panel.progress === 100 && panel.status !== 'completed') {
      panel.status = 'in_progress';
    }

    // Fix members array to ensure data integrity before saving
    // This handles cases where members might have missing required fields
    let membersModified = false;
    for (let i = 0; i < panel.members.length; i++) {
      const member = panel.members[i];
      
      // If member is marked as external but missing name/email, or vice versa
      if (member.isExternal === true) {
        // External member must have name and email
        if (!member.name || !member.email) {
          console.warn(`Fixing external member at index ${i}: missing name or email`);
          // If they have faculty, convert to internal member
          if (member.faculty) {
            member.isExternal = false;
            membersModified = true;
          } else {
            // Can't fix - this is a data integrity issue
            console.error(`Invalid external member at index ${i}: missing both name/email and faculty`);
          }
        }
      } else {
        // Internal member must have faculty
        if (!member.faculty) {
          console.warn(`Fixing internal member at index ${i}: missing faculty`);
          // If they have name and email, convert to external member
          if (member.name && member.email) {
            member.isExternal = true;
            membersModified = true;
          } else {
            // Can't fix - this is a data integrity issue
            console.error(`Invalid internal member at index ${i}: missing both faculty and name/email`);
            // Mark as external with placeholder data to prevent validation error
            // This is a workaround for corrupted data
            member.isExternal = true;
            member.name = member.name || 'Unknown Panelist';
            member.email = member.email || 'unknown@buksu.edu.ph';
            membersModified = true;
          }
        }
      }
    }

    // Mark members array as modified if we made changes
    if (membersModified) {
      panel.markModified('members');
    }

    // Save the panel
    try {
      await panel.save();
    } catch (saveError) {
      // If validation still fails, provide detailed error information
      if (saveError.name === 'ValidationError') {
        console.error('Panel validation error details:', {
          message: saveError.message,
          errors: saveError.errors,
          members: panel.members.map((m, idx) => ({
            index: idx,
            isExternal: m.isExternal,
            hasFaculty: !!m.faculty,
            facultyId: m.faculty?.toString() || m.faculty,
            hasName: !!m.name,
            hasEmail: !!m.email,
            name: m.name,
            email: m.email
          }))
        });
        return res.status(400).json({ 
          message: "Panel data validation failed. The panel has invalid member data. Please contact administrator.",
          error: saveError.message 
        });
      }
      throw saveError; // Re-throw if it's not a validation error
    }

    // Populate panel data (handle case where research might be deleted)
    let populated;
    try {
      populated = await Panel.findById(panel._id)
        .populate("research", "title students")
        .populate("members.faculty", "name email")
        .populate("reviews.panelist", "name email");
    } catch (populateError) {
      console.error('Error populating panel data:', populateError);
      // If populate fails, use the saved panel without population
      populated = panel;
    }

    // Log activity (wrap in try-catch to prevent activity logging from breaking the request)
    try {
      await Activity.create({
        user: req.user.id,
        action: "update",
        entityType: "panel",
        entityId: panel._id,
        entityName: panel.name || "Panel",
        description: `Submitted panel review for ${panel.name || "panel"}`,
        metadata: {
          panelId: panel._id,
          recommendation,
          commentsLength: comments?.length || 0,
          panelProgress: panel.progress || 0,
        }
      });
    } catch (activityError) {
      // Log the error but don't fail the request
      console.error('Error logging activity for panel review:', activityError);
    }

    res.json({
      message: "Panel review submitted successfully",
      panel: populated,
      review: reviewData,
    });
  } catch (error) {
    console.error('Error submitting panel review:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get available documents for faculty adviser
export const getAvailableDocuments = async (req, res) => {
  try {
    const documents = await Document.find({
      isActive: true,
      accessibleTo: { $in: ["faculty adviser"] },
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
    const hasAccess = document.accessibleTo.includes("faculty adviser") || 
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
    const hasAccess = document.accessibleTo.includes("faculty adviser") || 
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


