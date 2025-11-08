import Panel from "../models/Panel.js";
import Activity from "../models/Activity.js";
import nodemailer from "nodemailer";
import Schedule from "../models/Schedule.js";
import Research from "../models/Research.js";
import User from "../models/User.js";
import Document from "../models/Document.js";
import crypto from "crypto";

// Get panel members
export const getPanelMembers = async (req, res) => {
  try {
    // Exclude archived panels by default (only show active panels)
    const panels = await Panel.find({ status: { $ne: 'archived' } })
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

    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "assign",
      entityType: "panel",
      entityId: panel._id,
      entityName: panel.name,
      description: "Updated panel membership",
      metadata: { researchId, memberCount: members?.length || 0 }
    });

    const populated = await Panel.findById(panel._id)
      .populate("research", "title students")
      .populate("members.faculty", "name email");

    // Update Research.panel field with assigned panel member IDs
    if (researchId) {
      const facultyIds = members
        .map(m => m.faculty)
        .filter(Boolean);
      
      await Research.findByIdAndUpdate(
        researchId,
        { panel: facultyIds },
        { new: true }
      );
    }

    res.json({ message: "Panel members assigned successfully", panel: populated });                                                                             
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create panel
export const createPanel = async (req, res) => {
  try {
    const { name, description, type, researchId, members } = req.body;

    if (!name || !type || !researchId || !Array.isArray(members) || members.length === 0) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const panel = new Panel({
      name,
      description: description || "",
      type,
      research: researchId,
      members,
      assignedBy: req.user.id,
      status: "pending",
    });

    await panel.save();

    const populated = await Panel.findById(panel._id)
      .populate("research", "title students")
      .populate("members.faculty", "name email");

    // Update Research.panel field with assigned panel member IDs
    if (researchId) {
      const facultyIds = members
        .map(m => m.faculty)
        .filter(Boolean);
      
      await Research.findByIdAndUpdate(
        researchId,
        { panel: facultyIds },
        { new: true }
      );
    }

    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "create",
      entityType: "panel",
      entityId: panel._id,
      entityName: name,
      description: `Created panel: ${name}`,
      metadata: { type, researchId, memberCount: members.length }
    });

    // Send email notifications to panelists
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const panelistEmails = populated.members
        .map(m => m.faculty?.email)
        .filter(Boolean);

      if (panelistEmails.length > 0) {
        const researchTitle = populated.research?.title || "Research";
        await transporter.sendMail({
          from: process.env.SMTP_FROM,
          to: panelistEmails.join(","),
          subject: `Panel Assignment: ${name}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #7C1D23;">You have been assigned as a panelist</h2>
              <p><strong>Panel:</strong> ${name}</p>
              <p><strong>Type:</strong> ${type.replace(/_/g, " ")}</p>
              <p><strong>Research:</strong> ${researchTitle}</p>
              <p>${description || ""}</p>
            </div>
          `,
        });

        await Activity.create({
          user: req.user.id,
          action: "send_email",
          entityType: "email",
          entityId: panel._id,
          entityName: name,
          description: `Sent panel assignment emails to ${panelistEmails.length} panelists`,
          metadata: { recipients: panelistEmails }
        });
      }
    } catch (emailErr) {
      // Do not fail creation on email error; return warning
      console.error("Panel email error:", emailErr.message);
    }

    res.status(201).json({ message: "Panel created successfully", panel: populated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update panel membership after creation
export const updatePanelMembers = async (req, res) => {
  try {
    const { id } = req.params;
    const { members } = req.body;

    if (!Array.isArray(members)) {
      return res.status(400).json({ message: "Members must be an array" });
    }

    const panel = await Panel.findByIdAndUpdate(
      id,
      { members, assignedBy: req.user.id },
      { new: true }
    )
      .populate("research", "title students")
      .populate("members.faculty", "name email");

    if (!panel) {
      return res.status(404).json({ message: "Panel not found" });
    }

    // Update Research.panel field with assigned panel member IDs
    if (panel.research) {
      const facultyIds = members
        .map(m => m.faculty?._id || m.faculty)
        .filter(Boolean);
      
      await Research.findByIdAndUpdate(
        panel.research._id || panel.research,
        { panel: facultyIds },
        { new: true }
      );
    }

    await Activity.create({
      user: req.user.id,
      action: "update",
      entityType: "panel",
      entityId: panel._id,
      entityName: panel.name,
      description: "Edited panel membership",
      metadata: { memberCount: members.length }
    });

    res.json({ message: "Panel membership updated", panel });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get eligible panelists
export const getAvailablePanelists = async (req, res) => {
  try {
    const panelists = await User.find({ role: "faculty adviser", isActive: true })
      .select("name email");
    
    res.json(panelists);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Remove panel member
export const removePanelMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { memberIdentifier } = req.body; // Can be faculty ID or email for external

    const panel = await Panel.findById(id);

    if (!panel) {
      return res.status(404).json({ message: "Panel not found" });
    }

    // Find and remove the member
    const memberIndex = panel.members.findIndex(m => {
      if (m.isExternal) {
        return m.email === memberIdentifier;
      } else {
        const facultyId = m.faculty?._id || m.faculty;
        return facultyId?.toString() === memberIdentifier || facultyId === memberIdentifier;
      }
    });

    if (memberIndex === -1) {
      return res.status(404).json({ message: "Panel member not found" });
    }

    const removedMember = panel.members[memberIndex];
    panel.members.splice(memberIndex, 1);
    await panel.save();

    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "remove",
      entityType: "panel",
      entityId: panel._id,
      entityName: panel.name,
      description: `Removed panel member from ${panel.name}`,
      metadata: {
        panelId: panel._id,
        panelName: panel.name,
        removedMember: removedMember.isExternal 
          ? { name: removedMember.name, email: removedMember.email }
          : { facultyId: removedMember.faculty }
      }
    });

    const populated = await Panel.findById(id)
      .populate("research", "title students")
      .populate("members.faculty", "name email");

    res.json({
      message: "Panel member removed successfully",
      panel: populated
    });
  } catch (error) {
    console.error("Remove panel member error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Update selected panel members
export const updateSelectedMembers = async (req, res) => {
  try {
    const { id } = req.params;
    const { selectedMemberIds } = req.body; // Array of member IDs (faculty IDs or emails for external) that should be selected                                                              

    if (!Array.isArray(selectedMemberIds)) {
      return res.status(400).json({ message: "selectedMemberIds must be an array" });                                                                           
    }

    const panel = await Panel.findById(id);

    if (!panel) {
      return res.status(404).json({ message: "Panel not found" });
    }

    // Track changes for audit log
    const previousSelected = panel.members
      .filter(m => m.isSelected)
      .map(m => m.isExternal ? m.email : (m.faculty?.toString() || m.faculty));
    const previousCount = previousSelected.length;

    // Update isSelected status for all members
    panel.members = panel.members.map(member => {
      let memberId;
      if (member.isExternal) {
        memberId = member.email;
      } else {
        memberId = member.faculty?.toString() || member.faculty;
      }
      return {
        ...member.toObject(),
        isSelected: selectedMemberIds.includes(memberId)
      };
    });

    await panel.save();

    const populated = await Panel.findById(panel._id)
      .populate("research", "title students")
      .populate("members.faculty", "name email");

    const newSelected = populated.members
      .filter(m => m.isSelected)
      .map(m => {
        if (m.isExternal) {
          return m.name || m.email || 'External Panelist';
        }
        return m.faculty?.name || (m.faculty ? m.faculty.toString() : 'Unknown');
      });
    const newCount = newSelected.length;

    // Update Research.panel field with selected panel member IDs
    if (panel.research) {
      const researchId = panel.research._id || panel.research;
      const selectedFacultyIds = populated.members
        .filter(m => m.isSelected && !m.isExternal) // Only include internal faculty
        .map(m => {
          if (m.faculty && m.faculty._id) {
            return m.faculty._id;
          }
          return m.faculty;
        })
        .filter(Boolean);

      await Research.findByIdAndUpdate(
        researchId,
        { panel: selectedFacultyIds },
        { new: true }
      );
    }

    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "update",
      entityType: "panel",
      entityId: panel._id,
      entityName: panel.name,
      description: `Updated selected panel members for ${panel.name}`,
      metadata: {
        previousSelectedCount: previousCount,
        newSelectedCount: newCount,
        selectedMembers: newSelected,
        previousMembers: panel.members
          .filter(m => {
            if (m.isExternal) {
              return previousSelected.includes(m.email);
            }
            const facultyId = m.faculty?.toString() || m.faculty;
            return previousSelected.includes(facultyId);
          })
          .map(m => {
            if (m.isExternal) {
              return m.name || m.email || 'External Panelist';
            }
            return m.faculty?.name || (m.faculty ? m.faculty.toString() : 'Unknown');
          })
      }
    });

    res.json({
      message: "Selected members updated successfully",
      panel: populated,
      selectedCount: newCount
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Remove panel (soft delete - marks as inactive)
export const removePanel = async (req, res) => {
  try {
    const { id } = req.params;

    const panel = await Panel.findById(id);

    if (!panel) {
      return res.status(404).json({ message: "Panel not found" });
    }

    // Mark panel as inactive instead of deleting (for audit trail)
    panel.status = 'archived';
    await panel.save();

    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "remove",
      entityType: "panel",
      entityId: panel._id,
      entityName: panel.name,
      description: `Removed panel: ${panel.name}`,
      metadata: {
        panelId: panel._id,
        panelName: panel.name,
        researchId: panel.research,
      }
    });

    res.json({
      message: "Panel removed successfully",
      panel: await Panel.findById(id).populate("research", "title students"),
    });
  } catch (error) {
    console.error("Remove panel error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Delete panel (permanent deletion)
export const deletePanel = async (req, res) => {
  try {
    const { id } = req.params;

    const panel = await Panel.findById(id);

    if (!panel) {
      return res.status(404).json({ message: "Panel not found" });
    }

    const panelName = panel.name;
    const panelId = panel._id;
    const researchId = panel.research;

    // Log activity before deletion
    await Activity.create({
      user: req.user.id,
      action: "delete",
      entityType: "panel",
      entityId: panelId,
      entityName: panelName,
      description: `Deleted panel: ${panelName}`,
      metadata: {
        panelId: panelId,
        panelName: panelName,
        researchId: researchId,
        deletedAt: new Date(),
      }
    });

    // Permanently delete the panel
    await Panel.findByIdAndDelete(id);

    res.json({
      message: "Panel deleted successfully",
      deletedPanelId: panelId,
    });
  } catch (error) {
    console.error("Delete panel error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get panel monitoring data
export const getPanelMonitoring = async (req, res) => {
  try {
    const { status, startDate, endDate } = req.query;
    
    // Build query
    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const panels = await Panel.find(query)
      .populate("research", "title students status stage progress")
      .populate("members.faculty", "name email")
      .populate("reviews.panelist", "name email")
      .populate("assignedBy", "name")
      .sort({ createdAt: -1 });

    // Calculate progress and alerts for each panel
    const panelsWithProgress = panels.map(panel => {
      const activeMembers = panel.members.filter(m => m.isSelected);
      const activeMemberIds = activeMembers.map(m => {
        if (m.isExternal) {
          return m.email; // Use email for external panelists
        }
        const facultyId = m.faculty?._id || m.faculty;
        return facultyId?.toString() || facultyId;
      }).filter(Boolean);
      
      // Calculate progress based on submitted reviews
      const submittedReviews = panel.reviews.filter(r => {
        if (r.isExternal) {
          return r.status === 'submitted' && activeMemberIds.includes(r.panelistEmail);
        }
        const panelistId = r.panelist?._id || r.panelist;
        return r.status === 'submitted' && activeMemberIds.includes(panelistId?.toString() || panelistId);
      });
      const progress = activeMembers.length > 0 
        ? Math.round((submittedReviews.length / activeMembers.length) * 100)
        : 0;

      // Check for overdue reviews
      const now = new Date();
      const overdueReviews = panel.reviews.filter(r => {
        let isActivePanelist = false;
        if (r.isExternal) {
          isActivePanelist = activeMemberIds.includes(r.panelistEmail);
        } else {
          const panelistId = r.panelist?._id || r.panelist;
          isActivePanelist = activeMemberIds.includes(panelistId?.toString() || panelistId);
        }
        if (!isActivePanelist) return false;
        if (r.status === 'submitted') return false;
        return r.dueDate && new Date(r.dueDate) < now;
      });

      // Check for missing reviews (active members without review entries)
      const reviewedIdentifiers = panel.reviews.map(r => {
        if (r.isExternal) {
          return r.panelistEmail;
        }
        const panelistId = r.panelist?._id || r.panelist;
        return panelistId?.toString() || panelistId;
      });
      const missingReviews = activeMembers.filter(m => {
        if (m.isExternal) {
          return !reviewedIdentifiers.includes(m.email);
        }
        const facultyId = m.faculty?._id || m.faculty;
        return !reviewedIdentifiers.includes(facultyId?.toString() || facultyId);
      });

      // Update panel progress
      panel.progress = progress;
      panel.save().catch(err => console.error('Error saving panel progress:', err));

      return {
        ...panel.toObject(),
        progress,
        overdueCount: overdueReviews.length,
        missingCount: missingReviews.length,
        hasAlerts: overdueReviews.length > 0 || missingReviews.length > 0,
        submittedReviewsCount: submittedReviews.length,
        totalActiveMembers: activeMembers.length,
      };
    });

    res.json(panelsWithProgress);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get panel details for monitoring
export const getPanelDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const panel = await Panel.findById(id)
      .populate("research", "title students abstract status stage progress")
      .populate("members.faculty", "name email")
      .populate("reviews.panelist", "name email")
      .populate("assignedBy", "name email");

    if (!panel) {
      return res.status(404).json({ message: "Panel not found" });
    }

    // Get related schedules
    const schedules = await Schedule.find({
      research: panel.research._id,
      type: { $in: ["proposal_defense", "final_defense"] }
    })
      .populate("participants.user", "name email")
      .sort({ datetime: 1 });

    // Calculate progress
    const activeMembers = panel.members.filter(m => m.isSelected);
    const activeMemberIds = activeMembers.map(m => {
      if (m.isExternal) {
        return m.email; // Use email for external panelists
      }
      const facultyId = m.faculty?._id || m.faculty;
      return facultyId?.toString() || facultyId;
    }).filter(Boolean);
    const submittedReviews = panel.reviews.filter(r => {
      if (r.isExternal) {
        return r.status === 'submitted' && activeMemberIds.includes(r.panelistEmail);
      }
      const panelistId = r.panelist?._id || r.panelist;
      return r.status === 'submitted' && activeMemberIds.includes(panelistId?.toString() || panelistId);
    });
    const progress = activeMembers.length > 0 
      ? Math.round((submittedReviews.length / activeMembers.length) * 100)
      : 0;

    // Get overdue and missing reviews
    const now = new Date();
    const overdueReviews = panel.reviews.filter(r => {
      let isActivePanelist = false;
      if (r.isExternal) {
        isActivePanelist = activeMemberIds.includes(r.panelistEmail);
      } else {
        const panelistId = r.panelist?._id || r.panelist;
        isActivePanelist = activeMemberIds.includes(panelistId?.toString() || panelistId);
      }
      if (!isActivePanelist) return false;
      if (r.status === 'submitted') return false;
      return r.dueDate && new Date(r.dueDate) < now;
    });

    const reviewedIdentifiers = panel.reviews.map(r => {
      if (r.isExternal) {
        return r.panelistEmail;
      }
      const panelistId = r.panelist?._id || r.panelist;
      return panelistId?.toString() || panelistId;
    });
    const missingReviews = activeMembers.filter(m => {
      if (m.isExternal) {
        return !reviewedIdentifiers.includes(m.email);
      }
      const facultyId = m.faculty?._id || m.faculty;
      return !reviewedIdentifiers.includes(facultyId?.toString() || facultyId);
    });

    res.json({
      panel,
      schedules,
      progress,
      overdueReviews,
      missingReviews,
      submittedReviews,
      activeMembers,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Download panel document
export const downloadPanelDocument = async (req, res) => {
  try {
    const { panelId, documentId } = req.params;
    const fs = await import('fs');

    const panel = await Panel.findById(panelId);

    if (!panel) {
      return res.status(404).json({ message: "Panel not found" });
    }

    const document = panel.documents.find(doc => doc._id.toString() === documentId);

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    const filePath = document.filepath;

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found on server" });
    }

    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "download",
      entityType: "panel",
      entityId: panel._id,
      entityName: panel.name,
      description: `Downloaded document "${document.title}" from panel ${panel.name}`,
      metadata: {
        documentTitle: document.title,
        documentId: documentId,
        filename: document.filename,
        fileSize: document.fileSize,
      }
    }).catch(err => console.error('Error logging activity:', err));

    // Set headers for download
    res.setHeader('Content-Disposition', `attachment; filename="${document.filename}"`);
    res.setHeader('Content-Type', document.mimeType);

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error("Download panel document error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get schedules
export const getSchedules = async (req, res) => {
  try {
    const schedules = await Schedule.find()
      .populate("research", "title students")
      .populate("participants.user", "name email")
      .populate("createdBy", "name email")
      .populate("panel", "name type")
      .populate("finalizedBy", "name email")
      .sort({ datetime: 1 });
    
    res.json(schedules);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get panel defense schedules (schedules with panel field)
export const getPanelDefenseSchedules = async (req, res) => {
  try {
    const { status, startDate, endDate } = req.query;
    
    const query = {
      panel: { $exists: true, $ne: null }, // Only schedules with panel field
    };

    if (status && status !== 'all') {
      query.status = status;
    }

    if (startDate || endDate) {
      query.datetime = {};
      if (startDate) {
        query.datetime.$gte = new Date(startDate);
      }
      if (endDate) {
        query.datetime.$lte = new Date(endDate + 'T23:59:59');
      }
    }

    const schedules = await Schedule.find(query)
      .populate("research", "title students")
      .populate("panel", "name type status")
      .populate("participants.user", "name email")
      .populate("createdBy", "name email")
      .populate("finalizedBy", "name email")
      .sort({ datetime: 1 });
    
    res.json(schedules);
  } catch (error) {
    console.error("Get panel defense schedules error:", error);
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
    
    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "create",
      entityType: "schedule",
      entityId: schedule._id,
      entityName: schedule.title || "Schedule",
      description: `Created schedule: ${schedule.title || 'Untitled'}`,
      metadata: {
        scheduleId: schedule._id,
        title: schedule.title,
        datetime: schedule.datetime,
        location: schedule.location,
        researchId: schedule.research,
      }
    });
    
    res.json({ message: "Schedule created successfully", schedule });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Update schedule
export const updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { datetime, duration, location, description, sendNotifications } = req.body;
    
    const schedule = await Schedule.findById(id)
      .populate("panel", "name type members research")
      .populate({
        path: "research",
        select: "title students adviser",
        populate: {
          path: "students",
          select: "name email"
        }
      })
      .populate("participants.user", "name email");
    
    if (!schedule) {
      return res.status(404).json({ message: "Schedule not found" });
    }

    const oldData = {
      datetime: schedule.datetime,
      duration: schedule.duration,
      location: schedule.location,
      description: schedule.description,
    };

    // Update schedule
    if (datetime) schedule.datetime = new Date(datetime);
    if (duration !== undefined) schedule.duration = duration;
    if (location !== undefined) schedule.location = location;
    if (description !== undefined) schedule.description = description;
    
    await schedule.save();

    // If it's a panel schedule, update panel meeting details
    if (schedule.panel && datetime) {
      schedule.panel.meetingDate = schedule.datetime;
      if (location) {
        schedule.panel.meetingLocation = location;
      }
      await schedule.panel.save();
    }

    // Send email notifications if requested and schedule has participants
    if (sendNotifications && schedule.participants && schedule.participants.length > 0) {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT,
          secure: false,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        const scheduleDateStr = schedule.datetime.toLocaleString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });
        const endTime = new Date(schedule.datetime.getTime() + schedule.duration * 60000).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        });

        // Collect participant emails
        const participantEmails = schedule.participants
          .map(p => p.user?.email)
          .filter(Boolean);

        // For panel defense schedules, ensure students are included
        if (schedule.panel && schedule.research?.students) {
          const students = Array.isArray(schedule.research.students) 
            ? schedule.research.students 
            : [schedule.research.students];
          for (const student of students) {
            if (student?.email && !participantEmails.includes(student.email)) {
              participantEmails.push(student.email);
            }
          }
        }

        // Add external panelist emails if it's a panel schedule
        if (schedule.panel) {
          const externalPanelists = schedule.panel.members
            .filter(m => m.isExternal && m.isSelected && m.email)
            .map(m => m.email);
          participantEmails.push(...externalPanelists);
        }

        const uniqueEmails = [...new Set(participantEmails)];

        if (uniqueEmails.length > 0) {
          const researchTitle = schedule.research?.title || schedule.panel?.research?.title || "Research";
          const panelName = schedule.panel?.name || schedule.title;

          await transporter.sendMail({
            from: process.env.SMTP_FROM,
            to: uniqueEmails.join(","),
            subject: `Schedule Updated: ${panelName}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #7C1D23; color: white; padding: 20px; border-radius: 5px 5px 0 0;">
                  <h2 style="margin: 0;">Schedule Updated</h2>
                </div>
                <div style="background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none;">
                  <p>Dear Participant,</p>
                  <p>The schedule for the following panel defense has been updated:</p>
                  
                  <div style="background-color: white; padding: 15px; margin: 20px 0; border-left: 4px solid #7C1D23;">
                    <p style="margin: 5px 0;"><strong>Panel Name:</strong> ${panelName}</p>
                    <p style="margin: 5px 0;"><strong>Research:</strong> ${researchTitle}</p>
                    <p style="margin: 5px 0;"><strong>Date & Time:</strong> ${scheduleDateStr}</p>
                    <p style="margin: 5px 0;"><strong>Duration:</strong> ${schedule.duration} minutes (until ${endTime})</p>
                    <p style="margin: 5px 0;"><strong>Location:</strong> ${schedule.location}</p>
                    ${schedule.description ? `<p style="margin: 5px 0;"><strong>Description:</strong> ${schedule.description}</p>` : ''}
                  </div>

                  ${datetime && oldData.datetime.getTime() !== schedule.datetime.getTime() ? 
                    `<p style="color: #d97706; font-weight: bold;">⚠️ Date/Time has been changed from ${oldData.datetime.toLocaleString()} to ${scheduleDateStr}</p>` : ''}
                  ${location && oldData.location !== schedule.location ? 
                    `<p style="color: #d97706; font-weight: bold;">⚠️ Location has been changed from "${oldData.location}" to "${schedule.location}"</p>` : ''}

                  <p>Please update your calendar with the new schedule details.</p>
                </div>
                <div style="background-color: #f0f0f0; padding: 15px; border-radius: 0 0 5px 5px; border: 1px solid #ddd; border-top: none;">
                  <p style="color: #999; font-size: 12px; margin: 0;">If you have any questions or concerns, please contact the Program Head.</p>
                </div>
              </div>
            `,
          });
        }
      } catch (emailErr) {
        console.error("Schedule update email error:", emailErr);
        // Don't fail the update if email fails
      }
    }
    
    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "update",
      entityType: "schedule",
      entityId: schedule._id,
      entityName: schedule.title || "Schedule",
      description: `Updated schedule: ${schedule.title || 'Untitled'}`,
      metadata: {
        scheduleId: schedule._id,
        title: schedule.title,
        datetime: schedule.datetime,
        location: schedule.location,
        changes: req.body,
        oldData,
      }
    });

    const populated = await Schedule.findById(schedule._id)
      .populate("research", "title students")
      .populate("panel", "name type")
      .populate("participants.user", "name email")
      .populate("finalizedBy", "name email");
    
    res.json({ message: "Schedule updated successfully", schedule: populated });
  } catch (error) {
    console.error("Update schedule error:", error);
    res.status(500).json({ message: error.message });
  }
};


// Delete schedule
export const deleteSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    
    const schedule = await Schedule.findById(id)
      .populate("panel", "name type")
      .populate("research", "title");
    
    if (!schedule) {
      return res.status(404).json({ message: "Schedule not found" });
    }
    
    const scheduleTitle = schedule.title || "Schedule";
    const scheduleId = schedule._id;

    // If it's a panel schedule, update panel status and clear meeting details
    if (schedule.panel) {
      schedule.panel.meetingDate = null;
      schedule.panel.meetingLocation = null;
      if (schedule.panel.status === 'scheduled') {
        schedule.panel.status = 'confirmed'; // Revert to confirmed if it was scheduled
      }
      await schedule.panel.save();
    }
    
    // Log activity before deletion
    await Activity.create({
      user: req.user.id,
      action: "delete",
      entityType: "schedule",
      entityId: scheduleId,
      entityName: scheduleTitle,
      description: `Deleted schedule: ${scheduleTitle}`,
      metadata: {
        scheduleId: scheduleId,
        title: scheduleTitle,
        datetime: schedule.datetime,
        location: schedule.location,
        panelId: schedule.panel?._id,
        panelName: schedule.panel?.name,
        deletedAt: new Date(),
      }
    });
    
    await Schedule.findByIdAndDelete(id);
    res.json({ message: "Schedule deleted successfully" });
  } catch (error) {
    console.error("Delete schedule error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Archive/Cancel panel defense schedule
export const archiveSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    
    const schedule = await Schedule.findById(id)
      .populate("panel", "name type members research")
      .populate({
        path: "research",
        select: "title students adviser",
        populate: {
          path: "students",
          select: "name email"
        }
      })
      .populate("participants.user", "name email");
    
    if (!schedule) {
      return res.status(404).json({ message: "Schedule not found" });
    }

    if (!schedule.panel) {
      return res.status(400).json({ message: "This schedule is not a panel defense schedule" });
    }

    const oldStatus = schedule.status;
    schedule.status = "cancelled";
    await schedule.save();

    // Update panel meeting details
    schedule.panel.meetingDate = null;
    schedule.panel.meetingLocation = null;
    if (schedule.panel.status === 'scheduled') {
      schedule.panel.status = 'confirmed'; // Revert to confirmed
    }
    await schedule.panel.save();

    // Send cancellation notifications
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      // Collect participant emails
      const participantEmails = schedule.participants
        .map(p => p.user?.email)
        .filter(Boolean);

      // For panel defense schedules, ensure students are included
      if (schedule.research?.students) {
        const students = Array.isArray(schedule.research.students) 
          ? schedule.research.students 
          : [schedule.research.students];
        for (const student of students) {
          if (student?.email && !participantEmails.includes(student.email)) {
            participantEmails.push(student.email);
          }
        }
      }

      // Add external panelist emails
      const externalPanelists = schedule.panel.members
        .filter(m => m.isExternal && m.isSelected && m.email)
        .map(m => m.email);
      participantEmails.push(...externalPanelists);

      const uniqueEmails = [...new Set(participantEmails)];

      if (uniqueEmails.length > 0) {
        const researchTitle = schedule.research?.title || schedule.panel.research?.title || "Research";
        const scheduleDateStr = schedule.datetime.toLocaleString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });

        await transporter.sendMail({
          from: process.env.SMTP_FROM,
          to: uniqueEmails.join(","),
          subject: `Schedule Cancelled: ${schedule.panel.name}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background-color: #dc2626; color: white; padding: 20px; border-radius: 5px 5px 0 0;">
                <h2 style="margin: 0;">Schedule Cancelled</h2>
              </div>
              <div style="background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none;">
                <p>Dear Participant,</p>
                <p>The following panel defense schedule has been cancelled:</p>
                
                <div style="background-color: white; padding: 15px; margin: 20px 0; border-left: 4px solid #dc2626;">
                  <p style="margin: 5px 0;"><strong>Panel Name:</strong> ${schedule.panel.name}</p>
                  <p style="margin: 5px 0;"><strong>Research:</strong> ${researchTitle}</p>
                  <p style="margin: 5px 0;"><strong>Original Date & Time:</strong> ${scheduleDateStr}</p>
                  <p style="margin: 5px 0;"><strong>Location:</strong> ${schedule.location}</p>
                </div>

                <p>Please remove this event from your calendar. A new schedule will be provided if the panel defense is rescheduled.</p>
                <p>If you have any questions, please contact the Program Head.</p>
              </div>
              <div style="background-color: #f0f0f0; padding: 15px; border-radius: 0 0 5px 5px; border: 1px solid #ddd; border-top: none;">
                <p style="color: #999; font-size: 12px; margin: 0;">This is an automated notification. Please do not reply to this email.</p>
              </div>
            </div>
          `,
        });
      }
    } catch (emailErr) {
      console.error("Schedule cancellation email error:", emailErr);
      // Don't fail the cancellation if email fails
    }

    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "archive",
      entityType: "schedule",
      entityId: schedule._id,
      entityName: schedule.title,
      description: `Cancelled/archived schedule: ${schedule.title}`,
      metadata: {
        scheduleId: schedule._id,
        title: schedule.title,
        panelId: schedule.panel._id,
        panelName: schedule.panel.name,
        oldStatus,
        newStatus: "cancelled",
        cancelledAt: new Date(),
      }
    });

    const populated = await Schedule.findById(schedule._id)
      .populate("research", "title students")
      .populate("panel", "name type")
      .populate("participants.user", "name email");

    res.json({ 
      message: "Schedule cancelled successfully. Participants have been notified.", 
      schedule: populated 
    });
  } catch (error) {
    console.error("Archive schedule error:", error);
    res.status(500).json({ message: error.message });
  }
};


// Delete research title
export const deleteResearchTitle = async (req, res) => {
  try {
    const { id } = req.params;

    const research = await Research.findById(id);
    
    if (!research) {
      return res.status(404).json({ message: "Research not found" });
    }

    const researchTitle = research.title;
    const researchId = research._id;

    // Log activity before deletion
    await Activity.create({
      user: req.user.id,
      action: "delete",
      entityType: "research",
      entityId: researchId,
      entityName: researchTitle,
      description: `Deleted research title: ${researchTitle}`,
      metadata: {
        researchId: researchId,
        title: researchTitle,
        status: research.status,
        deletedAt: new Date(),
      }
    });

    await Research.findByIdAndDelete(id);

    res.json({ message: "Research title deleted successfully" });
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
    
    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "upload",
      entityType: "document",
      entityId: document._id,
      entityName: document.title || "Form",
      description: `Uploaded form: ${document.title || 'Untitled'}`,
      metadata: {
        documentId: document._id,
        title: document.title,
        filename: document.filename,
        fileSize: document.fileSize,
        category: document.category,
      }
    });
    
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

    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "assign",
      entityType: "research",
      entityId: research._id,
      entityName: research.title,
      description: `Assigned adviser to research: ${research.title}`,
      metadata: {
        researchId: research._id,
        researchTitle: research.title,
        adviserId: adviserId,
        adviserName: research.adviser?.name || 'Unknown',
      }
    });

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

    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "remove",
      entityType: "research",
      entityId: research._id,
      entityName: research.title,
      description: `Removed adviser from research: ${research.title}`,
      metadata: {
        researchId: research._id,
        researchTitle: research.title,
      }
    });

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

    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "share",
      entityType: "research",
      entityId: research._id,
      entityName: research.title,
      description: `Shared research with Dean: ${research.title}`,
      metadata: {
        researchId: research._id,
        researchTitle: research.title,
        sharedAt: new Date(),
      }
    });

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

    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "archive",
      entityType: "research",
      entityId: research._id,
      entityName: research.title,
      description: `Archived research: ${research.title}`,
      metadata: {
        researchId: research._id,
        researchTitle: research.title,
        previousStatus: research.status,
        archivedAt: new Date(),
      }
    });

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

    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "create",
      entityType: "research",
      entityId: research._id,
      entityName: research.title,
      description: `Created research title: ${research.title}`,
      metadata: {
        researchId: research._id,
        title: research.title,
        studentCount: studentIds?.length || 0,
        status: research.status,
      }
    });

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

    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "update",
      entityType: "research",
      entityId: research._id,
      entityName: research.title,
      description: `Updated students for research: ${research.title}`,
      metadata: {
        researchId: research._id,
        researchTitle: research.title,
        studentCount: studentIds?.length || 0,
        studentIds: studentIds,
      }
    });

    res.json({ message: "Students added successfully", research });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Invite external panelist via email
export const invitePanelist = async (req, res) => {
  try {
    const { panelId, name, email, role, reviewDeadline } = req.body;

    if (!panelId || !name || !email || !role) {
      return res.status(400).json({ message: "Missing required fields: panelId, name, email, role" });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Validate institutional email domain
    const emailDomain = '@' + email.split('@')[1];
    if (emailDomain !== '@buksu.edu.ph') {
      return res.status(400).json({ 
        message: "Panelist must use @buksu.edu.ph email address" 
      });
    }

    const panel = await Panel.findById(panelId)
      .populate("research", "title students")
      .populate("assignedBy", "name email");

    if (!panel) {
      return res.status(404).json({ message: "Panel not found" });
    }

    // Check if email already exists in panel members
    const existingMember = panel.members.find(m => {
      if (m.isExternal) {
        return m.email === email;
      } else {
        const facultyEmail = m.faculty?.email || '';
        return facultyEmail === email;
      }
    });

    if (existingMember) {
      return res.status(400).json({ message: "This email is already assigned to this panel" });
    }

    // Generate invitation token
    const invitationToken = crypto.randomBytes(32).toString('hex');
    const invitationExpires = reviewDeadline 
      ? new Date(reviewDeadline) 
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days default

    // Add external panelist to members
    const newMember = {
      name,
      email,
      role,
      status: "invited",
      isSelected: true, // Auto-select invited panelists
      isExternal: true,
      invitationToken,
      invitationExpires,
      invitedAt: new Date(),
    };

    panel.members.push(newMember);
    await panel.save();

    // Send invitation email
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const reviewLink = `${frontendUrl}/panel-review/${invitationToken}`;

      const researchTitle = panel.research?.title || "Research";
      const deadlineText = reviewDeadline 
        ? new Date(reviewDeadline).toLocaleDateString() 
        : "To be determined";

      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: email,
        subject: `Panel Invitation: ${panel.name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #7C1D23; color: white; padding: 20px; border-radius: 5px 5px 0 0;">
              <h2 style="margin: 0;">You've been invited as a panelist</h2>
            </div>
            <div style="background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none;">
              <p>Dear <strong>${name}</strong>,</p>
              <p>You have been invited to serve as a <strong>${role.replace(/_/g, ' ')}</strong> panelist for the following evaluation:</p>
              
              <div style="background-color: white; padding: 15px; margin: 20px 0; border-left: 4px solid #7C1D23;">
                <p style="margin: 5px 0;"><strong>Panel Name:</strong> ${panel.name}</p>
                <p style="margin: 5px 0;"><strong>Research:</strong> ${researchTitle}</p>
                <p style="margin: 5px 0;"><strong>Panel Type:</strong> ${panel.type.replace(/_/g, ' ')}</p>
                <p style="margin: 5px 0;"><strong>Review Deadline:</strong> ${deadlineText}</p>
              </div>

              ${panel.description ? `<p style="margin: 15px 0;"><strong>Description:</strong> ${panel.description}</p>` : ''}

              <p>Please click the button below to access your review dashboard and submit your evaluation:</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${reviewLink}" 
                   style="background-color: #7C1D23; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                  Access Review Dashboard
                </a>
              </div>

              <p style="color: #666; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
              <p style="color: #7C1D23; font-size: 12px; word-break: break-all; background-color: #f0f0f0; padding: 10px; border-radius: 3px;">${reviewLink}</p>

              <p style="color: #666; font-size: 14px; margin-top: 30px;">This invitation link will expire on ${invitationExpires.toLocaleDateString()}.</p>
            </div>
            <div style="background-color: #f0f0f0; padding: 15px; border-radius: 0 0 5px 5px; border: 1px solid #ddd; border-top: none;">
              <p style="color: #999; font-size: 12px; margin: 0;">If you didn't expect this invitation, please ignore this email.</p>
            </div>
          </div>
        `,
      });

      await Activity.create({
        user: req.user.id,
        action: "invite",
        entityType: "panel",
        entityId: panel._id,
        entityName: panel.name,
        description: `Invited external panelist: ${name} (${email})`,
        metadata: { panelId, name, email, role, invitationToken }
      });

      res.json({ 
        message: "Invitation sent successfully", 
        panelist: { name, email, role },
        invitationToken 
      });
    } catch (emailErr) {
      console.error("Invitation email error:", emailErr);
      // Still save the panelist, but return warning
      res.status(201).json({ 
        message: "Panelist added but email failed to send", 
        warning: emailErr.message,
        panelist: { name, email, role }
      });
    }
  } catch (error) {
    console.error("Invite panelist error:", error);
    res.status(500).json({ message: error.message });
  }
};


// Get panel review by token (for external panelists)
export const getPanelReviewByToken = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ message: "Token is required" });
    }

    const panel = await Panel.findOne({
      "members.invitationToken": token,
      "members.isExternal": true
    })
      .populate("research", "title students abstract")
      .populate("members.faculty", "name email");

    if (!panel) {
      return res.status(404).json({ message: "Invalid or expired invitation token" });
    }

    // Find the specific member with this token
    const invitedMember = panel.members.find(m => 
      m.invitationToken === token && m.isExternal
    );

    if (!invitedMember) {
      return res.status(404).json({ message: "Invitation not found" });
    }

    // Check if token is expired
    if (invitedMember.invitationExpires && new Date(invitedMember.invitationExpires) < new Date()) {
      return res.status(400).json({ message: "This invitation has expired" });
    }

    // Check if member is selected
    if (!invitedMember.isSelected) {
      return res.status(403).json({ message: "You are not an active panelist for this panel" });
    }

    // Find existing review for this external panelist
    const existingReview = panel.reviews.find(r => 
      r.isExternal && r.panelistEmail === invitedMember.email
    );

    // Get active documents for this panel
    const activeDocuments = panel.documents
      .filter(doc => doc.isActive)
      .map(doc => ({
        _id: doc._id,
        title: doc.title,
        description: doc.description,
        filename: doc.filename,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        version: doc.version,
        uploadedAt: doc.uploadedAt,
      }));

    // Return panel info and review status
    res.json({
      panel: {
        _id: panel._id,
        name: panel.name,
        type: panel.type,
        description: panel.description,
        reviewDeadline: panel.reviewDeadline,
      },
      research: panel.research,
      panelist: {
        name: invitedMember.name,
        email: invitedMember.email,
        role: invitedMember.role,
      },
      review: existingReview || null,
      hasSubmittedReview: existingReview?.status === 'submitted' || false,
      documents: activeDocuments,
    });
  } catch (error) {
    console.error("Get panel review by token error:", error);
    res.status(500).json({ message: error.message });
  }
};


// Submit panel review by token (for external panelists)
export const submitPanelReviewByToken = async (req, res) => {
  try {
    const { token } = req.params;
    const { comments, recommendation } = req.body;

    if (!token) {
      return res.status(400).json({ message: "Token is required" });
    }

    if (!comments || !recommendation) {
      return res.status(400).json({ message: "Comments and recommendation are required" });
    }

    const panel = await Panel.findOne({
      "members.invitationToken": token,
      "members.isExternal": true
    });

    if (!panel) {
      return res.status(404).json({ message: "Invalid or expired invitation token" });
    }

    // Find the specific member with this token
    const invitedMember = panel.members.find(m => 
      m.invitationToken === token && m.isExternal
    );

    if (!invitedMember) {
      return res.status(404).json({ message: "Invitation not found" });
    }

    // Check if token is expired
    if (invitedMember.invitationExpires && new Date(invitedMember.invitationExpires) < new Date()) {
      return res.status(400).json({ message: "This invitation has expired" });
    }

    // Check if member is selected
    if (!invitedMember.isSelected) {
      return res.status(403).json({ message: "You are not an active panelist for this panel" });
    }

    // Find existing review or create new one
    const existingReviewIndex = panel.reviews.findIndex(r => 
      r.isExternal && r.panelistEmail === invitedMember.email
    );

    const reviewData = {
      panelistEmail: invitedMember.email,
      panelistName: invitedMember.name,
      comments: comments.trim(),
      recommendation: recommendation,
      status: 'submitted',
      submittedAt: new Date(),
      dueDate: panel.reviewDeadline || null,
      isExternal: true,
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

    // Update member status to confirmed
    invitedMember.status = 'confirmed';

    await panel.save();

    // Log activity (without user ID since it's external)
    await Activity.create({
      user: panel.assignedBy,
      action: "update",
      entityType: "panel",
      entityId: panel._id,
      entityName: panel.name,
      description: `External panelist ${invitedMember.name} submitted review`,
      metadata: {
        panelistEmail: invitedMember.email,
        panelistName: invitedMember.name,
        recommendation,
        panelProgress: panel.progress,
      }
    });

    const populated = await Panel.findById(panel._id)
      .populate("research", "title students");

    res.json({
      message: "Panel review submitted successfully",
      panel: populated,
      review: reviewData,
    });
  } catch (error) {
    console.error("Submit panel review by token error:", error);
    res.status(500).json({ message: error.message });
  }
};


// Upload document to panel
export const uploadPanelDocument = async (req, res) => {
  try {
    const { panelId } = req.params;
    const { title, description } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    if (!title) {
      return res.status(400).json({ message: "Document title is required" });
    }

    // Validate file type
    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ];
    if (!allowedMimes.includes(req.file.mimetype)) {
      return res.status(400).json({ message: "Only PDF and DOCX files are allowed" });
    }

    const panel = await Panel.findById(panelId)
      .populate("research", "title students")
      .populate("members.faculty", "name email")
      .populate("assignedBy", "name email");

    if (!panel) {
      return res.status(404).json({ message: "Panel not found" });
    }

    // Check if document with same title exists (for versioning)
    const existingDocIndex = panel.documents.findIndex(doc => 
      doc.title.toLowerCase() === title.toLowerCase() && doc.isActive
    );

    const newDocument = {
      title: title.trim(),
      description: description?.trim() || "",
      filename: req.file.originalname,
      filepath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedBy: req.user.id,
      version: 1,
      isActive: true,
      versions: [{
        version: 1,
        filename: req.file.originalname,
        filepath: req.file.path,
        fileSize: req.file.size,
        uploadedBy: req.user.id,
        uploadedAt: new Date(),
        changeDescription: "Initial upload",
      }],
      uploadedAt: new Date(),
    };

    if (existingDocIndex >= 0) {
      // Archive existing document and create new version
      const existingDoc = panel.documents[existingDocIndex];
      existingDoc.isActive = false;
      
      // Set version to next version number
      newDocument.version = existingDoc.version + 1;
      
      // Add current version to history
      newDocument.versions = [
        ...existingDoc.versions,
        {
          version: newDocument.version,
          filename: req.file.originalname,
          filepath: req.file.path,
          fileSize: req.file.size,
          uploadedBy: req.user.id,
          uploadedAt: new Date(),
          changeDescription: description?.trim() || "Document replaced",
        }
      ];
    }

    panel.documents.push(newDocument);
    await panel.save();

    // Send notification emails to panelists
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const activeMembers = panel.members.filter(m => m.isSelected);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const researchTitle = panel.research?.title || "Research";

      // Send emails to external panelists with their invitation links
      // Check for external members: either explicitly marked as external OR has email but no faculty reference
      const externalMembers = activeMembers.filter(m => {
        // Explicitly marked as external
        if (m.isExternal === true) return true;
        // Has email but no faculty reference (also external)
        // Check both the populated faculty object and the raw faculty ID
        const hasFaculty = m.faculty && (typeof m.faculty === 'object' ? m.faculty._id : m.faculty);
        if (m.email && !hasFaculty) return true;
        return false;
      });
      const externalEmails = new Set(); // Track external emails to exclude from internal list
      
      console.log(`[Document Upload] Total active members: ${activeMembers.length}`);
      console.log(`[Document Upload] External members found: ${externalMembers.length}`);
      activeMembers.forEach(m => {
        const hasFaculty = m.faculty && (typeof m.faculty === 'object' ? m.faculty._id : m.faculty);
        console.log(`[Document Upload] Member: ${m.name || 'Unknown'} (${m.email || 'no email'}), isExternal: ${m.isExternal}, hasFaculty: ${!!hasFaculty}, hasToken: ${!!m.invitationToken}`);
      });
      
      for (const member of externalMembers) {
        if (member.email) {
          externalEmails.add(member.email.toLowerCase());
          
          if (member.invitationToken) {
            const reviewLink = `${frontendUrl}/panel-review/${member.invitationToken}`;
            const deadlineText = panel.reviewDeadline 
              ? new Date(panel.reviewDeadline).toLocaleDateString() 
              : "To be determined";
            try {
              await transporter.sendMail({
                from: process.env.SMTP_FROM,
                to: member.email,
                subject: `New Document Available: ${title} - ${panel.name}`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background-color: #7C1D23; color: white; padding: 20px; border-radius: 5px 5px 0 0;">
                      <h2 style="margin: 0;">New Document Uploaded</h2>
                    </div>
                    <div style="background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none;">
                      <p>Dear <strong>${member.name || 'Panelist'}</strong>,</p>
                      <p>A new evaluation document has been uploaded for the panel you are assigned to:</p>
                      
                      <div style="background-color: white; padding: 15px; margin: 20px 0; border-left: 4px solid #7C1D23;">
                        <p style="margin: 5px 0;"><strong>Panel Name:</strong> ${panel.name}</p>
                        <p style="margin: 5px 0;"><strong>Research:</strong> ${researchTitle}</p>
                        <p style="margin: 5px 0;"><strong>Panel Type:</strong> ${panel.type?.replace(/_/g, ' ') || 'N/A'}</p>
                        <p style="margin: 5px 0;"><strong>Review Deadline:</strong> ${deadlineText}</p>
                        ${panel.description ? `<p style="margin: 5px 0;"><strong>Description:</strong> ${panel.description}</p>` : ''}
                        <p style="margin: 5px 0;"><strong>New Document:</strong> ${title}</p>
                        ${description ? `<p style="margin: 5px 0;"><strong>Document Description:</strong> ${description}</p>` : ''}
                      </div>

                      <p>Please click the button below to access your review dashboard and submit your evaluation:</p>
                      
                      <div style="text-align: center; margin: 30px 0;">
                        <a href="${reviewLink}" 
                           style="background-color: #7C1D23; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                          Access Review Dashboard
                        </a>
                      </div>

                      <p style="color: #666; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
                      <p style="color: #7C1D23; font-size: 12px; word-break: break-all; background-color: #f0f0f0; padding: 10px; border-radius: 3px;">${reviewLink}</p>

                      <p style="color: #666; font-size: 14px; margin-top: 30px;">This invitation link will expire on ${member.invitationExpires ? new Date(member.invitationExpires).toLocaleDateString() : 'N/A'}.</p>
                    </div>
                    <div style="background-color: #f0f0f0; padding: 15px; border-radius: 0 0 5px 5px; border: 1px solid #ddd; border-top: none;">
                      <p style="color: #999; font-size: 12px; margin: 0;">If you have any questions, please contact the Program Head.</p>
                    </div>
                  </div>
                `,
              });
            } catch (err) {
              console.error(`Failed to send email to external panelist ${member.email}:`, err);
            }
          } else {
            // Fallback: External panelist without token - send notification to contact Program Head
            try {
              await transporter.sendMail({
                from: process.env.SMTP_FROM,
                to: member.email,
                subject: `New Document Available: ${title} - ${panel.name}`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background-color: #7C1D23; color: white; padding: 20px; border-radius: 5px 5px 0 0;">
                      <h2 style="margin: 0;">New Evaluation Document Available</h2>
                    </div>
                    <div style="background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none;">
                      <p>Dear ${member.name || 'Panelist'},</p>
                      <p>A new evaluation document has been uploaded for the following panel:</p>
                      
                      <div style="background-color: white; padding: 15px; margin: 20px 0; border-left: 4px solid #7C1D23;">
                        <p style="margin: 5px 0;"><strong>Panel:</strong> ${panel.name}</p>
                        <p style="margin: 5px 0;"><strong>Research:</strong> ${researchTitle}</p>
                        <p style="margin: 5px 0;"><strong>Document:</strong> ${title}</p>
                        ${description ? `<p style="margin: 5px 0;"><strong>Description:</strong> ${description}</p>` : ''}
                      </div>

                      <p style="color: #d32f2f; font-weight: bold;">Please contact the Program Head to obtain your invitation link to access this document.</p>
                    </div>
                  </div>
                `,
              });
            } catch (err) {
              console.error(`Failed to send email to external panelist ${member.email}:`, err);
            }
          }
        }
      }

      // Send email to internal panelists (faculty) - exclude external panelists
      const internalMembers = activeMembers.filter(m => {
        // Must not be explicitly marked as external
        if (m.isExternal === true) return false;
        // Must have faculty reference with email (not external)
        const facultyEmail = m.faculty?.email || (typeof m.faculty === 'object' && m.faculty ? null : null);
        if (!facultyEmail) return false;
        // Must not have email in external emails set (additional check)
        if (externalEmails.has(facultyEmail.toLowerCase())) return false;
        return true;
      });
      const internalEmails = internalMembers.map(m => m.faculty?.email).filter(Boolean);
      console.log(`[Document Upload] Internal members found: ${internalMembers.length}`);
      console.log(`[Document Upload] Internal emails: ${internalEmails.join(', ')}`);
      console.log(`[Document Upload] External emails tracked: ${Array.from(externalEmails).join(', ')}`);
      if (internalEmails.length > 0) {
        await transporter.sendMail({
          from: process.env.SMTP_FROM,
          to: internalEmails.join(","),
          subject: `New Document Available: ${title} - ${panel.name}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background-color: #7C1D23; color: white; padding: 20px; border-radius: 5px 5px 0 0;">
                <h2 style="margin: 0;">New Evaluation Document Available</h2>
              </div>
              <div style="background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none;">
                <p>Dear Panelist,</p>
                <p>A new evaluation document has been uploaded for the following panel:</p>
                
                <div style="background-color: white; padding: 15px; margin: 20px 0; border-left: 4px solid #7C1D23;">
                  <p style="margin: 5px 0;"><strong>Panel:</strong> ${panel.name}</p>
                  <p style="margin: 5px 0;"><strong>Research:</strong> ${researchTitle}</p>
                  <p style="margin: 5px 0;"><strong>Document:</strong> ${title}</p>
                  ${description ? `<p style="margin: 5px 0;"><strong>Description:</strong> ${description}</p>` : ''}
                </div>

                <p>Please log in to your dashboard to access this document.</p>
              </div>
            </div>
          `,
        });
      }
    } catch (emailErr) {
      console.error("Document notification email error:", emailErr);
      // Don't fail the upload if email fails
    }

    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "upload",
      entityType: "panel",
      entityId: panel._id,
      entityName: panel.name,
      description: `Uploaded document "${title}" to panel ${panel.name}`,
      metadata: {
        documentTitle: title,
        filename: req.file.originalname,
        fileSize: req.file.size,
        version: newDocument.version,
        isReplacement: existingDocIndex >= 0,
      }
    });

    const populated = await Panel.findById(panel._id)
      .populate("documents.uploadedBy", "name email")
      .populate("documents.versions.uploadedBy", "name email");

    res.json({
      message: "Document uploaded successfully",
      document: populated.documents[populated.documents.length - 1],
      panel: populated,
    });
  } catch (error) {
    console.error("Upload panel document error:", error);
    res.status(500).json({ message: error.message });
  }
};


// Get panel documents
export const getPanelDocuments = async (req, res) => {
  try {
    const { panelId } = req.params;

    const panel = await Panel.findById(panelId)
      .populate("documents.uploadedBy", "name email")
      .populate("documents.versions.uploadedBy", "name email")
      .select("documents");

    if (!panel) {
      return res.status(404).json({ message: "Panel not found" });
    }

    // Return only active documents
    const activeDocuments = panel.documents.filter(doc => doc.isActive);

    res.json({ documents: activeDocuments });
  } catch (error) {
    console.error("Get panel documents error:", error);
    res.status(500).json({ message: error.message });
  }
};


// Remove panel document
export const removePanelDocument = async (req, res) => {
  try {
    const { panelId, documentId } = req.params;

    const panel = await Panel.findById(panelId);

    if (!panel) {
      return res.status(404).json({ message: "Panel not found" });
    }

    const documentIndex = panel.documents.findIndex(
      doc => doc._id.toString() === documentId
    );

    if (documentIndex === -1) {
      return res.status(404).json({ message: "Document not found" });
    }

    const document = panel.documents[documentIndex];

    // Mark as inactive instead of deleting (for audit trail)
    panel.documents[documentIndex].isActive = false;
    await panel.save();

    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "delete",
      entityType: "panel",
      entityId: panel._id,
      entityName: panel.name,
      description: `Removed document "${document.title}" from panel ${panel.name}`,
      metadata: {
        documentTitle: document.title,
        documentId: documentId,
      }
    });

    res.json({
      message: "Document removed successfully",
      panel: await Panel.findById(panelId).populate("documents.uploadedBy", "name email"),
    });
  } catch (error) {
    console.error("Remove panel document error:", error);
    res.status(500).json({ message: error.message });
  }
};


// Replace panel document (creates new version)
export const replacePanelDocument = async (req, res) => {
  try {
    const { panelId, documentId } = req.params;
    const { description } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Validate file type
    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ];
    if (!allowedMimes.includes(req.file.mimetype)) {
      return res.status(400).json({ message: "Only PDF and DOCX files are allowed" });
    }

    const panel = await Panel.findById(panelId)
      .populate("research", "title students")
      .populate("members.faculty", "name email");

    if (!panel) {
      return res.status(404).json({ message: "Panel not found" });
    }

    const documentIndex = panel.documents.findIndex(
      doc => doc._id.toString() === documentId && doc.isActive
    );

    if (documentIndex === -1) {
      return res.status(404).json({ message: "Document not found" });
    }

    const existingDoc = panel.documents[documentIndex];
    const newVersion = existingDoc.version + 1;

    // Archive current version
    existingDoc.isActive = false;

    // Create new version
    const newDocument = {
      title: existingDoc.title,
      description: description?.trim() || existingDoc.description,
      filename: req.file.originalname,
      filepath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedBy: req.user.id,
      version: newVersion,
      isActive: true,
      versions: [
        ...existingDoc.versions,
        {
          version: newVersion,
          filename: req.file.originalname,
          filepath: req.file.path,
          fileSize: req.file.size,
          uploadedBy: req.user.id,
          uploadedAt: new Date(),
          changeDescription: description?.trim() || "Document updated",
        }
      ],
      uploadedAt: new Date(),
    };

    panel.documents.push(newDocument);
    await panel.save();

    // Send notification emails to panelists
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const activeMembers = panel.members.filter(m => m.isSelected);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const researchTitle = panel.research?.title || "Research";

      // Send emails to external panelists with their invitation links
      // Check for external members: either explicitly marked as external OR has email but no faculty reference
      const externalMembers = activeMembers.filter(m => {
        // Explicitly marked as external
        if (m.isExternal === true) return true;
        // Has email but no faculty reference (also external)
        if (m.email && !m.faculty) return true;
        return false;
      });
      const externalEmails = new Set(); // Track external emails to exclude from internal list
      
      console.log(`[Document Replace] Total active members: ${activeMembers.length}`);
      console.log(`[Document Replace] External members found: ${externalMembers.length}`);
      externalMembers.forEach(m => {
        console.log(`[Document Replace] External member: ${m.name || 'Unknown'} (${m.email}), token: ${m.invitationToken ? 'Yes' : 'No'}, isExternal: ${m.isExternal}`);
      });
      
      for (const member of externalMembers) {
        if (member.email) {
          externalEmails.add(member.email.toLowerCase());
          
          if (member.invitationToken) {
            const reviewLink = `${frontendUrl}/panel-review/${member.invitationToken}`;
            const deadlineText = panel.reviewDeadline 
              ? new Date(panel.reviewDeadline).toLocaleDateString() 
              : "To be determined";
            try {
              await transporter.sendMail({
                from: process.env.SMTP_FROM,
                to: member.email,
                subject: `Document Updated: ${existingDoc.title} - ${panel.name}`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background-color: #7C1D23; color: white; padding: 20px; border-radius: 5px 5px 0 0;">
                      <h2 style="margin: 0;">Document Updated</h2>
                    </div>
                    <div style="background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none;">
                      <p>Dear <strong>${member.name || 'Panelist'}</strong>,</p>
                      <p>An evaluation document has been updated for the panel you are assigned to:</p>
                      
                      <div style="background-color: white; padding: 15px; margin: 20px 0; border-left: 4px solid #7C1D23;">
                        <p style="margin: 5px 0;"><strong>Panel Name:</strong> ${panel.name}</p>
                        <p style="margin: 5px 0;"><strong>Research:</strong> ${researchTitle}</p>
                        <p style="margin: 5px 0;"><strong>Panel Type:</strong> ${panel.type?.replace(/_/g, ' ') || 'N/A'}</p>
                        <p style="margin: 5px 0;"><strong>Review Deadline:</strong> ${deadlineText}</p>
                        ${panel.description ? `<p style="margin: 5px 0;"><strong>Description:</strong> ${panel.description}</p>` : ''}
                        <p style="margin: 5px 0;"><strong>Updated Document:</strong> ${existingDoc.title}</p>
                        <p style="margin: 5px 0;"><strong>Version:</strong> ${newVersion}</p>
                        ${description ? `<p style="margin: 5px 0;"><strong>Changes:</strong> ${description}</p>` : ''}
                      </div>

                      <p>Please click the button below to access your review dashboard and submit your evaluation:</p>
                      
                      <div style="text-align: center; margin: 30px 0;">
                        <a href="${reviewLink}" 
                           style="background-color: #7C1D23; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                          Access Review Dashboard
                        </a>
                      </div>

                      <p style="color: #666; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
                      <p style="color: #7C1D23; font-size: 12px; word-break: break-all; background-color: #f0f0f0; padding: 10px; border-radius: 3px;">${reviewLink}</p>

                      <p style="color: #666; font-size: 14px; margin-top: 30px;">This invitation link will expire on ${member.invitationExpires ? new Date(member.invitationExpires).toLocaleDateString() : 'N/A'}.</p>
                    </div>
                    <div style="background-color: #f0f0f0; padding: 15px; border-radius: 0 0 5px 5px; border: 1px solid #ddd; border-top: none;">
                      <p style="color: #999; font-size: 12px; margin: 0;">If you have any questions, please contact the Program Head.</p>
                    </div>
                  </div>
                `,
              });
            } catch (err) {
              console.error(`Failed to send email to external panelist ${member.email}:`, err);
            }
          } else {
            // Fallback: External panelist without token - send notification to contact Program Head
            try {
              await transporter.sendMail({
                from: process.env.SMTP_FROM,
                to: member.email,
                subject: `Document Updated: ${existingDoc.title} - ${panel.name}`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background-color: #7C1D23; color: white; padding: 20px; border-radius: 5px 5px 0 0;">
                      <h2 style="margin: 0;">Evaluation Document Updated</h2>
                    </div>
                    <div style="background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none;">
                      <p>Dear ${member.name || 'Panelist'},</p>
                      <p>The following evaluation document has been updated:</p>
                      
                      <div style="background-color: white; padding: 15px; margin: 20px 0; border-left: 4px solid #7C1D23;">
                        <p style="margin: 5px 0;"><strong>Panel:</strong> ${panel.name}</p>
                        <p style="margin: 5px 0;"><strong>Research:</strong> ${researchTitle}</p>
                        <p style="margin: 5px 0;"><strong>Document:</strong> ${existingDoc.title}</p>
                        <p style="margin: 5px 0;"><strong>Version:</strong> ${newVersion}</p>
                        ${description ? `<p style="margin: 5px 0;"><strong>Changes:</strong> ${description}</p>` : ''}
                      </div>

                      <p style="color: #d32f2f; font-weight: bold;">Please contact the Program Head to obtain your invitation link to access the updated document.</p>
                    </div>
                  </div>
                `,
              });
            } catch (err) {
              console.error(`Failed to send email to external panelist ${member.email}:`, err);
            }
          }
        }
      }

      // Send email to internal panelists (faculty) - exclude external panelists
      const internalMembers = activeMembers.filter(m => {
        // Must have faculty reference (not external)
        if (!m.faculty || !m.faculty.email) return false;
        // Must not be explicitly marked as external
        if (m.isExternal === true) return false;
        // Must not have email in external emails set (additional check)
        if (externalEmails.has(m.faculty.email.toLowerCase())) return false;
        return true;
      });
      const internalEmails = internalMembers.map(m => m.faculty.email).filter(Boolean);
      console.log(`[Document Replace] Internal members found: ${internalMembers.length}`);
      if (internalEmails.length > 0) {
        await transporter.sendMail({
          from: process.env.SMTP_FROM,
          to: internalEmails.join(","),
          subject: `Document Updated: ${existingDoc.title} - ${panel.name}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background-color: #7C1D23; color: white; padding: 20px; border-radius: 5px 5px 0 0;">
                <h2 style="margin: 0;">Evaluation Document Updated</h2>
              </div>
              <div style="background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none;">
                <p>Dear Panelist,</p>
                <p>The following evaluation document has been updated:</p>
                
                <div style="background-color: white; padding: 15px; margin: 20px 0; border-left: 4px solid #7C1D23;">
                  <p style="margin: 5px 0;"><strong>Panel:</strong> ${panel.name}</p>
                  <p style="margin: 5px 0;"><strong>Research:</strong> ${researchTitle}</p>
                  <p style="margin: 5px 0;"><strong>Document:</strong> ${existingDoc.title}</p>
                  <p style="margin: 5px 0;"><strong>Version:</strong> ${newVersion}</p>
                  ${description ? `<p style="margin: 5px 0;"><strong>Changes:</strong> ${description}</p>` : ''}
                </div>

                <p>Please log in to your dashboard to access the updated document.</p>
              </div>
            </div>
          `,
        });
      }
    } catch (emailErr) {
      console.error("Document update notification email error:", emailErr);
    }

    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "update",
      entityType: "panel",
      entityId: panel._id,
      entityName: panel.name,
      description: `Replaced document "${existingDoc.title}" (v${existingDoc.version} → v${newVersion}) in panel ${panel.name}`,
      metadata: {
        documentTitle: existingDoc.title,
        oldVersion: existingDoc.version,
        newVersion: newVersion,
        changeDescription: description,
      }
    });

    const populated = await Panel.findById(panel._id)
      .populate("documents.uploadedBy", "name email")
      .populate("documents.versions.uploadedBy", "name email");

    res.json({
      message: "Document replaced successfully",
      document: populated.documents[populated.documents.length - 1],
      panel: populated,
    });
  } catch (error) {
    console.error("Replace panel document error:", error);
    res.status(500).json({ message: error.message });
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

export const downloadPanelDocumentByToken = async (req, res) => {
  try {
    const { token, documentId } = req.params;
    const fs = await import('fs');

    if (!token || !documentId) {
      return res.status(400).json({ message: "Token and document ID are required" });
    }

    const panel = await Panel.findOne({
      "members.invitationToken": token,
      "members.isExternal": true
    });

    if (!panel) {
      return res.status(404).json({ message: "Invalid or expired invitation token" });
    }

    // Find the specific member with this token
    const invitedMember = panel.members.find(m => 
      m.invitationToken === token && m.isExternal
    );

    if (!invitedMember) {
      return res.status(404).json({ message: "Invitation not found" });
    }

    // Check if token is expired
    if (invitedMember.invitationExpires && new Date(invitedMember.invitationExpires) < new Date()) {
      return res.status(400).json({ message: "This invitation has expired" });
    }

    // Check if member is selected
    if (!invitedMember.isSelected) {
      return res.status(403).json({ message: "You are not an active panelist for this panel" });
    }

    // Find the document
    const document = panel.documents.find(doc => 
      doc._id.toString() === documentId && doc.isActive
    );

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    const filePath = document.filepath;

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found on server" });
    }

    // Log activity (without user ID since it's external)
    await Activity.create({
      user: panel.assignedBy,
      action: "download",
      entityType: "panel",
      entityId: panel._id,
      entityName: panel.name,
      description: `External panelist ${invitedMember.name} downloaded document "${document.title}"`,
      metadata: {
        panelistEmail: invitedMember.email,
        panelistName: invitedMember.name,
        documentTitle: document.title,
        documentId: documentId,
      }
    });

    // Set headers for download
    res.setHeader('Content-Disposition', `attachment; filename="${document.filename}"`);
    res.setHeader('Content-Type', document.mimeType);

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error("Download panel document by token error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Update panel status (mark as completed/archived)
export const updatePanelStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'completed' or 'archived'

    if (!['completed', 'archived'].includes(status)) {
      return res.status(400).json({ message: "Invalid status. Must be 'completed' or 'archived'" });
    }

    const panel = await Panel.findById(id);

    if (!panel) {
      return res.status(404).json({ message: "Panel not found" });
    }

    const oldStatus = panel.status;
    panel.status = status;
    await panel.save();

    // Log activity
    await Activity.create({
      user: req.user.id,
      action: status === 'completed' ? "update" : "archive",
      entityType: "panel",
      entityId: panel._id,
      entityName: panel.name,
      description: `Panel status changed from ${oldStatus} to ${status}`,
      metadata: {
        oldStatus,
        newStatus: status,
        panelId: panel._id,
        panelName: panel.name,
      }
    });

    const populated = await Panel.findById(id)
      .populate("research", "title students")
      .populate("members.faculty", "name email");

    res.json({
      message: `Panel marked as ${status} successfully`,
      panel: populated
    });
  } catch (error) {
    console.error("Update panel status error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get panel records for historical analysis (PROGRAM HEAD – 0006)
export const getPanelRecords = async (req, res) => {
  try {
    const { 
      status, 
      panelType, 
      startDate, 
      endDate, 
      researchId,
      minRecommendationRate 
    } = req.query;
    
    // Build query - only completed or archived panels
    const query = {
      status: { $in: ['completed', 'archived'] }
    };
    
    if (panelType && panelType !== 'all') {
      query.type = panelType;
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    if (researchId) {
      query.research = researchId;
    }

    const panels = await Panel.find(query)
      .populate("research", "title students")
      .populate("members.faculty", "name email")
      .populate("reviews.panelist", "name email")
      .populate("assignedBy", "name")
      .sort({ createdAt: -1 });

    // Calculate analytics for each panel
    const panelsWithAnalytics = panels.map(panel => {
      const activeMembers = panel.members.filter(m => m.isSelected);
      
      // Calculate recommendation distribution
      const submittedReviews = panel.reviews.filter(r => r.status === 'submitted');
      const recommendations = {
        approve: submittedReviews.filter(r => r.recommendation === 'approve').length,
        reject: submittedReviews.filter(r => r.recommendation === 'reject').length,
        revision: submittedReviews.filter(r => r.recommendation === 'revision').length,
        pending: submittedReviews.filter(r => r.recommendation === 'pending').length,
      };
      
      const totalRecommendations = recommendations.approve + recommendations.reject + recommendations.revision;
      const approvalRate = totalRecommendations > 0 
        ? (recommendations.approve / totalRecommendations * 100).toFixed(1)
        : 0;
      
      // Filter by recommendation rate if specified
      if (minRecommendationRate && parseFloat(approvalRate) < parseFloat(minRecommendationRate)) {
        return null;
      }

      // Get panelist roster
      const panelistRoster = activeMembers.map(m => ({
        name: m.isExternal ? m.name : (m.faculty?.name || 'Unknown'),
        email: m.isExternal ? m.email : (m.faculty?.email || ''),
        role: m.role,
        isExternal: m.isExternal
      }));

      // Calculate average "score" based on recommendations (approve=3, revision=2, reject=1)
      const scores = submittedReviews.map(r => {
        if (r.recommendation === 'approve') return 3;
        if (r.recommendation === 'revision') return 2;
        if (r.recommendation === 'reject') return 1;
        return 0;
      });
      const averageScore = scores.length > 0
        ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)
        : 0;

      return {
        ...panel.toObject(),
        dateConducted: panel.meetingDate || panel.createdAt,
        panelistRoster,
        recommendations,
        approvalRate: parseFloat(approvalRate),
        averageScore: parseFloat(averageScore),
        totalReviews: submittedReviews.length,
        totalPanelists: activeMembers.length,
      };
    }).filter(Boolean); // Remove null entries

    res.json(panelsWithAnalytics);
  } catch (error) {
    console.error("Get panel records error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get detailed panel record
export const getPanelRecordDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const panel = await Panel.findById(id)
      .populate("research", "title students abstract")
      .populate("members.faculty", "name email")
      .populate("reviews.panelist", "name email")
      .populate("assignedBy", "name email");

    if (!panel) {
      return res.status(404).json({ message: "Panel not found" });
    }

    // Calculate analytics
    const activeMembers = panel.members.filter(m => m.isSelected);
    const submittedReviews = panel.reviews.filter(r => r.status === 'submitted');
    
    const recommendations = {
      approve: submittedReviews.filter(r => r.recommendation === 'approve').length,
      reject: submittedReviews.filter(r => r.recommendation === 'reject').length,
      revision: submittedReviews.filter(r => r.recommendation === 'revision').length,
      pending: submittedReviews.filter(r => r.recommendation === 'pending').length,
    };
    
    const totalRecommendations = recommendations.approve + recommendations.reject + recommendations.revision;
    const approvalRate = totalRecommendations > 0 
      ? (recommendations.approve / totalRecommendations * 100).toFixed(1)
      : 0;

    // Calculate average score
    const scores = submittedReviews.map(r => {
      if (r.recommendation === 'approve') return 3;
      if (r.recommendation === 'revision') return 2;
      if (r.recommendation === 'reject') return 1;
      return 0;
    });
    const averageScore = scores.length > 0
      ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)
      : 0;

    res.json({
      panel,
      analytics: {
        recommendations,
        approvalRate: parseFloat(approvalRate),
        averageScore: parseFloat(averageScore),
        totalReviews: submittedReviews.length,
        totalPanelists: activeMembers.length,
      },
      panelistRoster: activeMembers.map(m => ({
        name: m.isExternal ? m.name : (m.faculty?.name || 'Unknown'),
        email: m.isExternal ? m.email : (m.faculty?.email || ''),
        role: m.role,
        isExternal: m.isExternal
      })),
      dateConducted: panel.meetingDate || panel.createdAt,
    });
  } catch (error) {
    console.error("Get panel record details error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Export panel records to CSV
export const exportPanelRecords = async (req, res) => {
  try {
    const { 
      status, 
      panelType, 
      startDate, 
      endDate,
      researchId,
      minRecommendationRate 
    } = req.query;
    
    // Build query (same as getPanelRecords)
    const query = {
      status: { $in: ['completed', 'archived'] }
    };
    
    if (panelType && panelType !== 'all') {
      query.type = panelType;
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    if (researchId) {
      query.research = researchId;
    }

    const panels = await Panel.find(query)
      .populate("research", "title students")
      .populate("members.faculty", "name email")
      .populate("reviews.panelist", "name email")
      .sort({ createdAt: -1 });

    // Generate CSV data
    const csvRows = [];
    csvRows.push([
      'Panel Name',
      'Research Title',
      'Panel Type',
      'Date Conducted',
      'Total Panelists',
      'Total Reviews',
      'Approval Rate (%)',
      'Average Score',
      'Approve',
      'Revision',
      'Reject',
      'Panelists'
    ].join(','));

    panels.forEach(panel => {
      const activeMembers = panel.members.filter(m => m.isSelected);
      const submittedReviews = panel.reviews.filter(r => r.status === 'submitted');
      
      const recommendations = {
        approve: submittedReviews.filter(r => r.recommendation === 'approve').length,
        reject: submittedReviews.filter(r => r.recommendation === 'reject').length,
        revision: submittedReviews.filter(r => r.recommendation === 'revision').length,
      };
      
      const totalRecommendations = recommendations.approve + recommendations.reject + recommendations.revision;
      const approvalRate = totalRecommendations > 0 
        ? (recommendations.approve / totalRecommendations * 100).toFixed(1)
        : 0;

      const scores = submittedReviews.map(r => {
        if (r.recommendation === 'approve') return 3;
        if (r.recommendation === 'revision') return 2;
        if (r.recommendation === 'reject') return 1;
        return 0;
      });
      const averageScore = scores.length > 0
        ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)
        : 0;

      // Filter by recommendation rate if specified
      if (minRecommendationRate && parseFloat(approvalRate) < parseFloat(minRecommendationRate)) {
        return;
      }

      const panelistNames = activeMembers.map(m => 
        m.isExternal ? m.name : (m.faculty?.name || 'Unknown')
      ).join('; ');

      const dateConducted = panel.meetingDate || panel.createdAt;

      csvRows.push([
        `"${panel.name}"`,
        `"${panel.research?.title || 'N/A'}"`,
        panel.type?.replace(/_/g, ' ') || 'N/A',
        new Date(dateConducted).toLocaleDateString(),
        activeMembers.length,
        submittedReviews.length,
        approvalRate,
        averageScore,
        recommendations.approve,
        recommendations.revision,
        recommendations.reject,
        `"${panelistNames}"`
      ].join(','));
    });

    const csvContent = csvRows.join('\n');
    const filename = `panel-records-${new Date().toISOString().split('T')[0]}.csv`;

    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "download",
      entityType: "panel",
      entityName: "Panel Records Export",
      description: `Exported panel records to CSV`,
      metadata: {
        filters: { status, panelType, startDate, endDate, researchId, minRecommendationRate },
        recordCount: panels.length,
        filename
      }
    }).catch(err => console.error('Error logging activity:', err));

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (error) {
    console.error("Export panel records error:", error);
    res.status(500).json({ message: error.message });
  }
};

// ==================== SCHEDULE FINALIZATION ====================

// Get schedules pending finalization
export const getSchedulesForFinalization = async (req, res) => {
  try {
    const { type, startDate, endDate } = req.query;

    // Build query - get consultation schedules with status "confirmed" or defense schedules with status "scheduled"
    const query = {
      $or: [
        { type: "consultation", status: "confirmed" },
        { type: { $in: ["proposal_defense", "final_defense"] }, status: "scheduled" }
      ]
    };

    if (type && type !== 'all') {
      if (type === 'consultation') {
        query.$or = [{ type: "consultation", status: "confirmed" }];
      } else {
        query.$or = [{ type, status: "scheduled" }];
      }
    }

    if (startDate || endDate) {
      query.datetime = {};
      if (startDate) query.datetime.$gte = new Date(startDate);
      if (endDate) query.datetime.$lte = new Date(endDate);
    }

    const schedules = await Schedule.find(query)
      .populate("research", "title students")
      .populate("participants.user", "name email")
      .populate("createdBy", "name email")
      .populate("panel", "name type")
      .sort({ datetime: 1 });

    res.json(schedules);
  } catch (error) {
    console.error("Get schedules for finalization error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Finalize a schedule
export const finalizeSchedule = async (req, res) => {
  try {
    const { scheduleId } = req.params;

    const schedule = await Schedule.findById(scheduleId)
      .populate({
        path: "research",
        select: "title students",
        populate: {
          path: "students",
          select: "name email"
        }
      })
      .populate("participants.user", "name email")
      .populate({
        path: "panel",
        select: "name type meetingDate meetingLocation",
        populate: {
          path: "members.faculty",
          select: "name email"
        }
      })
      .populate("createdBy", "name email");

    if (!schedule) {
      return res.status(404).json({ message: "Schedule not found" });
    }

    // Validate schedule can be finalized
    if (schedule.status === "finalized") {
      return res.status(400).json({ message: "Schedule is already finalized" });
    }

    if (schedule.status === "cancelled") {
      return res.status(400).json({ message: "Cannot finalize a cancelled schedule" });
    }

    if (schedule.type === "consultation" && schedule.status !== "confirmed") {
      return res.status(400).json({ message: "Consultation schedule must be confirmed before finalization" });
    }

    // Update schedule status
    const oldStatus = schedule.status;
    schedule.status = "finalized";
    schedule.finalizedBy = req.user.id;
    schedule.finalizedAt = new Date();

    // If this is a defense schedule linked to a panel, update panel meeting details
    if (schedule.panel) {
      const panel = await Panel.findById(schedule.panel._id || schedule.panel);
      if (panel) {
        panel.meetingDate = schedule.datetime;
        panel.meetingLocation = schedule.location;
        panel.status = "scheduled";
        await panel.save();
      }
    }

    await schedule.save();

    // Send email notifications to all participants
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const scheduleDate = new Date(schedule.datetime).toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
      const endTime = new Date(schedule.datetime.getTime() + schedule.duration * 60000).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });

      // Get participant emails
      const participantEmails = schedule.participants
        .map(p => p.user?.email || (typeof p.user === 'object' ? p.user.email : null))
        .filter(Boolean);

      // For panel defense schedules, ensure students are included
      if (schedule.panel && schedule.research?.students) {
        const students = Array.isArray(schedule.research.students) 
          ? schedule.research.students 
          : [schedule.research.students];
        for (const student of students) {
          if (student?.email && !participantEmails.includes(student.email)) {
            participantEmails.push(student.email);
          }
        }
      }

      // For panel defense schedules, include external panelists
      if (schedule.panel?.members) {
        const externalPanelists = schedule.panel.members
          .filter(m => m.isExternal && m.isSelected && m.email)
          .map(m => m.email);
        participantEmails.push(...externalPanelists);
      }

      // Remove duplicates
      const uniqueEmails = [...new Set(participantEmails)];

      const researchTitle = schedule.research?.title || "Research";
      const scheduleType = schedule.type === "consultation" ? "Consultation" : 
                          schedule.type === "proposal_defense" ? "Proposal Defense" : 
                          "Final Defense";

      if (uniqueEmails.length > 0) {
        await transporter.sendMail({
          from: process.env.SMTP_FROM,
          to: uniqueEmails.join(","),
          subject: `${scheduleType} Schedule Finalized: ${schedule.title}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background-color: #7C1D23; color: white; padding: 20px; border-radius: 5px 5px 0 0;">
                <h2 style="margin: 0;">${scheduleType} Schedule Finalized</h2>
              </div>
              <div style="background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none;">
                <p>Dear Participant,</p>
                <p>The following ${scheduleType.toLowerCase()} schedule has been finalized:</p>
                
                <div style="background-color: white; padding: 15px; margin: 20px 0; border-left: 4px solid #7C1D23;">
                  <p style="margin: 5px 0;"><strong>Title:</strong> ${schedule.title}</p>
                  ${schedule.research ? `<p style="margin: 5px 0;"><strong>Research:</strong> ${researchTitle}</p>` : ''}
                  <p style="margin: 5px 0;"><strong>Date & Time:</strong> ${scheduleDate}</p>
                  <p style="margin: 5px 0;"><strong>Duration:</strong> ${schedule.duration} minutes (until ${endTime})</p>
                  <p style="margin: 5px 0;"><strong>Location:</strong> ${schedule.location}</p>
                  ${schedule.description ? `<p style="margin: 5px 0;"><strong>Description:</strong> ${schedule.description}</p>` : ''}
                </div>

                <p>Please mark this date and time in your calendar. If you have any questions or need to reschedule, please contact the Program Head.</p>
              </div>
              <div style="background-color: #f0f0f0; padding: 15px; border-radius: 0 0 5px 5px; border: 1px solid #ddd; border-top: none;">
                <p style="color: #999; font-size: 12px; margin: 0;">This schedule has been finalized and confirmed.</p>
              </div>
            </div>
          `,
        });
      }
    } catch (emailErr) {
      console.error("Finalization email error:", emailErr);
      // Don't fail the finalization if email fails
    }

    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "update",
      entityType: "schedule",
      entityId: schedule._id,
      entityName: schedule.title,
      description: `Finalized ${schedule.type} schedule: ${schedule.title}`,
      metadata: {
        scheduleType: schedule.type,
        oldStatus,
        newStatus: "finalized",
        datetime: schedule.datetime,
        location: schedule.location,
        panelId: schedule.panel?._id || schedule.panel,
      }
    });

    const populated = await Schedule.findById(schedule._id)
      .populate("research", "title students")
      .populate("participants.user", "name email")
      .populate("panel", "name type")
      .populate("finalizedBy", "name email");

    res.json({
      message: "Schedule finalized successfully",
      schedule: populated,
    });
  } catch (error) {
    console.error("Finalize schedule error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Create and finalize panel defense schedule
export const createPanelSchedule = async (req, res) => {
  try {
    const { panelId } = req.params; // Get panelId from URL params
    const { datetime, duration, location, description } = req.body;

    if (!panelId || !datetime || !location) {
      return res.status(400).json({ message: "Panel ID, date/time, and location are required" });
    }

    const panel = await Panel.findById(panelId)
      .populate({
        path: "research",
        select: "title students adviser",
        populate: [
          { path: "students", select: "name email" },
          { path: "adviser", select: "name email" }
        ]
      })
      .populate("members.faculty", "name email")
      .populate("assignedBy", "name email");

    if (!panel) {
      return res.status(404).json({ message: "Panel not found" });
    }

    // Check if panel already has a schedule
    const existingSchedule = await Schedule.findOne({ panel: panelId });
    if (existingSchedule) {
      return res.status(400).json({ message: "Panel already has a schedule. Please update the existing schedule instead." });
    }

    // Validate datetime
    const scheduleDate = new Date(datetime);
    if (isNaN(scheduleDate.getTime())) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    if (scheduleDate < new Date()) {
      return res.status(400).json({ message: "Schedule date cannot be in the past" });
    }

    // Check for conflicts with panel members (but don't block creation - allow override)
    // Conflicts are checked on frontend, backend just logs them if they exist
    const conflictCheck = await checkScheduleConflictsHelper({
      datetime: scheduleDate,
      duration: duration || 120,
      location: location,
      participants: panel.members.filter(m => m.isSelected).map(m => ({
        userId: m.isExternal ? null : (m.faculty?._id || m.faculty),
        email: m.isExternal ? m.email : (m.faculty?.email || null),
      })),
    });

    // Log conflicts but don't block (frontend allows override)
    if (conflictCheck.hasConflicts) {
      console.warn("Schedule conflicts detected but proceeding:", conflictCheck.conflicts);
    }

    // Determine schedule type based on panel type
    let scheduleType = "proposal_defense";
    if (panel.type === "final_defense") {
      scheduleType = "final_defense";
    }

    // Create participants array
    const participants = [];
    
    // Add panel members
    const activeMembers = panel.members.filter(m => m.isSelected);
    for (const member of activeMembers) {
      if (!member.isExternal && member.faculty) {
        participants.push({
          user: member.faculty._id || member.faculty,
          role: member.role === "chair" ? "chair" : "panel_member",
          status: "confirmed",
        });
      }
    }

    // Add research students
    if (panel.research?.students) {
      const students = Array.isArray(panel.research.students) ? panel.research.students : [panel.research.students];
      for (const student of students) {
        participants.push({
          user: student._id || student,
          role: "student",
          status: "confirmed",
        });
      }
    }

    // Add adviser (if research has adviser)
    if (panel.research?.adviser) {
      participants.push({
        user: panel.research.adviser._id || panel.research.adviser,
        role: "adviser",
        status: "confirmed",
      });
    }

    // Create schedule
    const schedule = new Schedule({
      research: panel.research._id || panel.research,
      panel: panelId,
      type: scheduleType,
      title: `${panel.name} - ${panel.type.replace(/_/g, ' ')}`,
      description: description || panel.description || "",
      datetime: scheduleDate,
      duration: duration || 120, // Default 2 hours for defense
      location: location.trim(),
      participants,
      createdBy: req.user.id,
      status: "finalized", // Immediately finalized
      finalizedBy: req.user.id,
      finalizedAt: new Date(),
    });

    await schedule.save();

    // Update panel meeting details
    panel.meetingDate = scheduleDate;
    panel.meetingLocation = location.trim();
    panel.status = "scheduled";
    await panel.save();

    // Send email notifications
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const scheduleDateStr = scheduleDate.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
      const endTime = new Date(scheduleDate.getTime() + schedule.duration * 60000).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });

      // Collect all participant emails (internal panelists, students, adviser, and external panelists)
      const participantEmails = [];

      // Internal panelists
      for (const member of activeMembers) {
        if (!member.isExternal && member.faculty?.email) {
          participantEmails.push(member.faculty.email);
        }
      }

      // External panelists
      for (const member of activeMembers) {
        if (member.isExternal && member.email) {
          participantEmails.push(member.email);
        }
      }

      // Students
      if (panel.research?.students) {
        const students = Array.isArray(panel.research.students) ? panel.research.students : [panel.research.students];
        for (const student of students) {
          if (student.email) {
            participantEmails.push(student.email);
          }
        }
      }

      // Adviser
      if (panel.research?.adviser?.email) {
        participantEmails.push(panel.research.adviser.email);
      }

      // Remove duplicates
      const uniqueEmails = [...new Set(participantEmails)];

      if (uniqueEmails.length > 0) {
        const researchTitle = panel.research?.title || "Research";
        
        await transporter.sendMail({
          from: process.env.SMTP_FROM,
          to: uniqueEmails.join(","),
          subject: `Panel Defense Schedule Finalized: ${panel.name}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background-color: #7C1D23; color: white; padding: 20px; border-radius: 5px 5px 0 0;">
                <h2 style="margin: 0;">Panel Defense Schedule Finalized</h2>
              </div>
              <div style="background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none;">
                <p>Dear Participant,</p>
                <p>The schedule for the following panel defense has been finalized:</p>
                
                <div style="background-color: white; padding: 15px; margin: 20px 0; border-left: 4px solid #7C1D23;">
                  <p style="margin: 5px 0;"><strong>Panel Name:</strong> ${panel.name}</p>
                  <p style="margin: 5px 0;"><strong>Research:</strong> ${researchTitle}</p>
                  <p style="margin: 5px 0;"><strong>Panel Type:</strong> ${panel.type.replace(/_/g, ' ')}</p>
                  <p style="margin: 5px 0;"><strong>Date & Time:</strong> ${scheduleDateStr}</p>
                  <p style="margin: 5px 0;"><strong>Duration:</strong> ${schedule.duration} minutes (until ${endTime})</p>
                  <p style="margin: 5px 0;"><strong>Location:</strong> ${schedule.location}</p>
                  ${schedule.description ? `<p style="margin: 5px 0;"><strong>Description:</strong> ${schedule.description}</p>` : ''}
                </div>

                <p>Please mark this date and time in your calendar. All participants are expected to attend.</p>
                
                ${panel.reviewDeadline ? `<p><strong>Review Deadline:</strong> ${new Date(panel.reviewDeadline).toLocaleDateString()}</p>` : ''}
              </div>
              <div style="background-color: #f0f0f0; padding: 15px; border-radius: 0 0 5px 5px; border: 1px solid #ddd; border-top: none;">
                <p style="color: #999; font-size: 12px; margin: 0;">If you have any questions or concerns, please contact the Program Head.</p>
              </div>
            </div>
          `,
        });
      }
    } catch (emailErr) {
      console.error("Panel schedule email error:", emailErr);
      // Don't fail the creation if email fails
    }

    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "create",
      entityType: "schedule",
      entityId: schedule._id,
      entityName: schedule.title,
      description: `Created and finalized panel defense schedule: ${schedule.title}`,
      metadata: {
        panelId: panel._id,
        panelName: panel.name,
        scheduleType: schedule.type,
        datetime: schedule.datetime,
        location: schedule.location,
        duration: schedule.duration,
      }
    });

    const populated = await Schedule.findById(schedule._id)
      .populate("research", "title students")
      .populate("participants.user", "name email")
      .populate("panel", "name type")
      .populate("finalizedBy", "name email");

    res.json({
      message: "Panel schedule created and finalized successfully",
      schedule: populated,
      panel: panel,
    });
  } catch (error) {
    console.error("Create panel schedule error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Check schedule conflicts
export const checkScheduleConflicts = async (req, res) => {
  try {
    const { datetime, duration, location, participants } = req.body;

    if (!datetime) {
      return res.status(400).json({ message: "Date and time are required" });
    }

    const scheduleDate = new Date(datetime);
    if (isNaN(scheduleDate.getTime())) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    const scheduleDuration = duration || 60;
    const startTime = scheduleDate;
    const endTime = new Date(startTime.getTime() + scheduleDuration * 60000);

    const conflicts = [];

    // Check location conflicts (if location provided)
    if (location) {
      const locationConflicts = await Schedule.find({
        location: { $regex: new RegExp(location, 'i') },
        datetime: {
          $gte: new Date(startTime.getTime() - 30 * 60000), // 30 min buffer
          $lte: new Date(endTime.getTime() + 30 * 60000),
        },
        status: { $nin: ["cancelled", "completed"] },
        _id: { $ne: req.body.scheduleId } // Exclude current schedule if updating
      }).populate("participants.user", "name email");

      if (locationConflicts.length > 0) {
        conflicts.push({
          type: "location",
          message: `Location "${location}" is already booked during this time`,
          conflicts: locationConflicts.map(s => ({
            title: s.title,
            datetime: s.datetime,
            duration: s.duration,
          })),
        });
      }
    }

    // Check participant conflicts
    if (participants && Array.isArray(participants)) {
      const participantIds = participants
        .map(p => p.userId || (typeof p === 'object' ? p._id : p))
        .filter(Boolean);

      if (participantIds.length > 0) {
        const participantConflicts = await Schedule.find({
          "participants.user": { $in: participantIds },
          datetime: {
            $gte: new Date(startTime.getTime() - 30 * 60000),
            $lte: new Date(endTime.getTime() + 30 * 60000),
          },
          status: { $nin: ["cancelled", "completed"] },
          _id: { $ne: req.body.scheduleId }
        })
          .populate("participants.user", "name email")
          .populate("research", "title");

        if (participantConflicts.length > 0) {
          conflicts.push({
            type: "participant",
            message: "One or more participants have conflicting schedules",
            conflicts: participantConflicts.map(s => ({
              title: s.title,
              datetime: s.datetime,
              duration: s.duration,
              participants: s.participants.map(p => ({
                name: p.user?.name || 'Unknown',
                email: p.user?.email || '',
              })),
            })),
          });
        }
      }
    }

    res.json({
      hasConflicts: conflicts.length > 0,
      conflicts,
    });
  } catch (error) {
    console.error("Check schedule conflicts error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Helper function for conflict checking (used internally)
const checkScheduleConflictsHelper = async (scheduleData) => {
  const { datetime, duration, location, participants } = scheduleData;

  const scheduleDate = new Date(datetime);
  const scheduleDuration = duration || 60;
  const startTime = scheduleDate;
  const endTime = new Date(startTime.getTime() + scheduleDuration * 60000);

  const conflicts = [];

  // Check location conflicts
  if (location) {
    const locationConflicts = await Schedule.find({
      location: { $regex: new RegExp(location, 'i') },
      datetime: {
        $gte: new Date(startTime.getTime() - 30 * 60000),
        $lte: new Date(endTime.getTime() + 30 * 60000),
      },
      status: { $nin: ["cancelled", "completed"] },
    });

    if (locationConflicts.length > 0) {
      conflicts.push({
        type: "location",
        message: `Location "${location}" is already booked`,
        conflicts: locationConflicts.map(s => ({
          title: s.title,
          datetime: s.datetime,
        })),
      });
    }
  }

  // Check participant conflicts
  if (participants && Array.isArray(participants)) {
    const participantIds = participants
      .map(p => p.userId)
      .filter(Boolean);

    if (participantIds.length > 0) {
      const participantConflicts = await Schedule.find({
        "participants.user": { $in: participantIds },
        datetime: {
          $gte: new Date(startTime.getTime() - 30 * 60000),
          $lte: new Date(endTime.getTime() + 30 * 60000),
        },
        status: { $nin: ["cancelled", "completed"] },
      });

      if (participantConflicts.length > 0) {
        conflicts.push({
          type: "participant",
          message: "Participants have conflicting schedules",
          conflicts: participantConflicts.map(s => ({
            title: s.title,
            datetime: s.datetime,
          })),
        });
      }
    }
  }

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
  };
};
