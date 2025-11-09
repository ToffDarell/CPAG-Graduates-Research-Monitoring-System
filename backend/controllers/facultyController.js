import Research from "../models/Research.js";
import Feedback from "../models/Feedback.js";
import Schedule from "../models/Schedule.js";
import User from "../models/User.js";
import Activity from "../models/Activity.js";
import Panel from "../models/Panel.js";
import Document from "../models/Document.js";
import fs from "fs";
import path from "path";
import { 
  createConsultationEvent, 
  updateCalendarEvent,
  deleteCalendarEvent 
} from "../utils/googleCalendar.js";

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

    // Create feedback record
    const feedback = new Feedback({
      research: researchId,
      student: research.students[0], // Assuming single student for now
      adviser: req.user.id,
      type: action === "approved" ? "approval" : "rejection",
      message,
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

// Delete feedback
export const deleteFeedback = async (req, res) => {
  try {
    const { feedbackId } = req.params;

    const feedback = await Feedback.findById(feedbackId)
      .populate("student", "name email")
      .populate("research", "title");

    if (!feedback) {
      return res.status(404).json({ message: "Feedback not found" });
    }

    // Verify authorization
    if (feedback.adviser.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized to delete this feedback" });
    }

    // Store details for logging
    const feedbackDetails = {
      id: feedback._id,
      studentName: feedback.student.name,
      researchTitle: feedback.research.title,
      filename: feedback.file?.filename,
      category: feedback.category,
      version: feedback.version
    };

    // Delete the feedback
    await Feedback.findByIdAndDelete(feedbackId);

    // Log the activity
    await Activity.create({
      user: req.user.id,
      action: "delete",
      entityType: "feedback",
      entityId: feedbackId,
      entityName: `Feedback for ${feedbackDetails.studentName}`,
      description: `Deleted feedback: ${feedbackDetails.filename || 'No file'}`,
      metadata: feedbackDetails
    });

    res.json({ message: "Feedback deleted successfully" });
  } catch (error) {
    console.error("Error deleting feedback:", error);
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
    const { title, description, datetime, duration, location, research, syncToCalendar } = req.body;

    // Validate required fields
    if (!datetime) {
      return res.status(400).json({ message: "Date and time are required" });
    }

    // Check for double-booking (prevent overlapping time slots)
    const startTime = new Date(datetime);
    
    // Validate that datetime is a valid date
    if (isNaN(startTime.getTime())) {
      return res.status(400).json({ message: "Invalid date format. Please select a valid date and time." });
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
      location,
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
    if (syncToCalendar !== false && user.calendarConnected && user.googleAccessToken) {
      try {
        if (user.googleTokenExpiry && user.googleTokenExpiry > new Date()) {
          const attendeeEmails = [];
          if (researchData && researchData.students) {
            attendeeEmails.push(...researchData.students.map(s => s.email));
          }

          calendarEvent = await createConsultationEvent({
            title: schedule.title,
            description: schedule.description,
            datetime: schedule.datetime,
            duration: schedule.duration,
            location: schedule.location,
            type: schedule.type,
            researchTitle: researchData?.title,
            attendeeEmails,
          }, user.googleAccessToken);

          schedule.googleCalendarEventId = calendarEvent.eventId;
          schedule.googleCalendarLink = calendarEvent.eventLink;
          schedule.googleMeetLink = calendarEvent.meetLink;
          schedule.calendarSynced = true;
        }
      } catch (calendarError) {
        console.error('Error syncing to Google Calendar:', calendarError);
      }
    }

    await schedule.save();

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

    const populatedSchedule = await Schedule.findById(schedule._id)
      .populate("participants.user", "name email")
      .populate("createdBy", "name email");

    res.status(201).json({ 
      message: calendarEvent 
        ? "Consultation slot created and synced to Google Calendar!" 
        : "Consultation slot created successfully.", 
      schedule: populatedSchedule,
      calendarSynced: schedule.calendarSynced,
      meetLink: schedule.googleMeetLink
    });
  } catch (error) {
    console.error("Error creating consultation slot:", error);
    res.status(500).json({ message: error.message });
  }
};

// Update consultation schedule status (approve/decline request)
export const updateConsultationStatus = async (req, res) => {
  try {
    const { scheduleId, action, participantId } = req.body; // action: "approve" or "decline"

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
      
      // Log the activity
      await Activity.create({
        user: req.user.id,
        action: "approve",
        entityType: "schedule",
        entityId: schedule._id,
        entityName: schedule.title,
        description: `Approved consultation request from ${studentParticipant.user.name}`,
        metadata: {
          studentId: studentParticipant.user._id,
          studentName: studentParticipant.user.name,
          datetime: schedule.datetime,
          location: schedule.location
        }
      });
    } else if (action === "decline") {
      studentParticipant.status = "declined";
      
      // Log the activity
      await Activity.create({
        user: req.user.id,
        action: "reject",
        entityType: "schedule",
        entityId: schedule._id,
        entityName: schedule.title,
        description: `Declined consultation request from ${studentParticipant.user.name}`,
        metadata: {
          studentId: studentParticipant.user._id,
          studentName: studentParticipant.user.name,
          datetime: schedule.datetime
        }
      });
    }

    await schedule.save();

    // TODO: Send notification to student (email/in-app notification)

    const updatedSchedule = await Schedule.findById(scheduleId)
      .populate("participants.user", "name email")
      .populate("research", "title")
      .populate("createdBy", "name email");

    res.json({ 
      message: `Consultation request ${action}d successfully.`, 
      schedule: updatedSchedule 
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

    // Check for double-booking if datetime is being changed
    if (datetime && new Date(datetime).getTime() !== new Date(schedule.datetime).getTime()) {
      const startTime = new Date(datetime);
      
      // Validate that datetime is a valid date
      if (isNaN(startTime.getTime())) {
        return res.status(400).json({ message: "Invalid date format. Please select a valid date and time." });
      }
      
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

    // Update the schedule
    if (title) schedule.title = title;
    if (description !== undefined) schedule.description = description;
    if (datetime) schedule.datetime = new Date(datetime);
    if (duration) schedule.duration = duration;
    if (location) schedule.location = location;

    await schedule.save();

    // Log the activity
    const changes = [];
    if (title && title !== oldValues.title) changes.push(`title: "${oldValues.title}" → "${title}"`);
    if (datetime && new Date(datetime).getTime() !== new Date(oldValues.datetime).getTime()) {
      changes.push(`datetime: "${new Date(oldValues.datetime).toLocaleString()}" → "${new Date(datetime).toLocaleString()}"`);
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

// Get panels assigned to the faculty member
export const getMyPanels = async (req, res) => {
  try {
    const userId = req.user.id.toString();
    
    // Find all panels first, then filter in code
    const allPanels = await Panel.find()
      .populate("research", "title students abstract")
      .populate("members.faculty", "name email")
      .populate("reviews.panelist", "name email")
      .populate("assignedBy", "name")
      .sort({ createdAt: -1 });

    // Filter to only show panels where user is selected as active panelist
    const myPanels = allPanels.filter(panel => {
      const myMember = panel.members.find(m => {
        const facultyId = m.faculty?._id || m.faculty;
        const facultyIdStr = facultyId?.toString() || facultyId;
        return facultyIdStr === userId && m.isSelected === true;
      });
      return myMember !== undefined;
    });

    // Calculate review status for each panel
    const panelsWithReviewStatus = myPanels.map(panel => {
      const myReview = panel.reviews.find(r => {
        const panelistId = r.panelist?._id || r.panelist;
        return (panelistId?.toString() || panelistId) === userId;
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
    const { panelId, comments, recommendation } = req.body;
    const userId = req.user.id.toString();

    if (!comments || !recommendation) {
      return res.status(400).json({ message: "Comments and recommendation are required" });
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
      const panelistId = r.panelist?._id || r.panelist;
      return (panelistId?.toString() || panelistId) === userId;
    });

    const reviewData = {
      panelist: req.user.id,
      comments: comments.trim(),
      recommendation: recommendation,
      status: 'submitted',
      submittedAt: new Date(),
      dueDate: panel.reviewDeadline || null,
    };

    if (existingReviewIndex >= 0) {
      // Update existing review
      panel.reviews[existingReviewIndex] = {
        ...panel.reviews[existingReviewIndex].toObject(),
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

    await panel.save();

    const populated = await Panel.findById(panel._id)
      .populate("research", "title students")
      .populate("members.faculty", "name email")
      .populate("reviews.panelist", "name email");

    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "update",
      entityType: "panel",
      entityId: panel._id,
      entityName: panel.name,
      description: `Submitted panel review for ${panel.name}`,
      metadata: {
        panelId: panel._id,
        recommendation,
        commentsLength: comments.length,
        panelProgress: panel.progress,
      }
    });

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

