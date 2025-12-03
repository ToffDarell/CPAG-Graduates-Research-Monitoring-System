import Panel from "../models/Panel.js";
import Activity from "../models/Activity.js";
import Export from "../models/Export.js";
import nodemailer from "nodemailer";
import Schedule from "../models/Schedule.js";
import Research from "../models/Research.js";
import User from "../models/User.js";
import Document from "../models/Document.js";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import { createConsultationEvent, deleteCalendarEvent } from "../utils/googleCalendar.js";
import { uploadFileToDrive } from "../utils/googleDrive.js";

const getPanelDriveFolderId = () => {
  return (
    process.env.GOOGLE_DRIVE_PANEL_DOCUMENTS_FOLDER_ID ||
    process.env.GOOGLE_DRIVE_PROGRAM_HEAD_FORMS_FOLDER_ID ||
    process.env.GOOGLE_DRIVE_DEFAULT_FOLDER_ID ||
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
  console.log('CREATE PANEL FUNCTION CALLED! ');
  try {
    const { name, description, type, researchId, members } = req.body;

    console.log('[CREATE PANEL] Request body:', { name, type, researchId, membersCount: members?.length });
    console.log('[CREATE PANEL] Members received:', JSON.stringify(members, null, 2));

    // Detailed validation
    const missingFields = [];
    if (!name) missingFields.push('name');
    if (!type) missingFields.push('type');
    if (!researchId) missingFields.push('researchId');
    if (!Array.isArray(members)) missingFields.push('members (must be array)');

    if (missingFields.length > 0) {
      const errorMsg = `Missing or invalid required fields: ${missingFields.join(', ')}`;
      console.log('[CREATE PANEL] Validation failed:', errorMsg);
      return res.status(400).json({ message: errorMsg });
    }

    // Note: Frontend validates that at least 2 panelists (internal + external combined) are required.
    // Internal members are sent in this request, external members are invited via separate endpoint.

    // Auto-activate all faculty members when creating a panel
    const activatedMembers = members.map(member => ({
      faculty: member.faculty,
      role: member.role,
      isSelected: true, // Auto-activate faculty members
      status: 'assigned' // Valid enum value from Panel schema
    }));

    console.log('[CREATE PANEL] Activated members:', JSON.stringify(activatedMembers, null, 2));

    const panel = new Panel({
      name,
      description: description || "",
      type,
      research: researchId,
      members: activatedMembers, // Use activated members
      assignedBy: req.user.id,
      status: "pending",
    });

    await panel.save();
    console.log('[CREATE PANEL] Panel saved with ID:', panel._id);
    console.log('[CREATE PANEL] Panel members after save:', JSON.stringify(panel.members, null, 2));

    const populated = await Panel.findById(panel._id)
      .populate({
        path: "research",
        select: "title students",
        populate: {
          path: "students",
          select: "name email"
        }
      })
      .populate("members.faculty", "name email");
    
    console.log('[CREATE PANEL] Populated panel members:', JSON.stringify(populated.members.map(m => ({
      faculty: m.faculty?._id || m.faculty,
      role: m.role,
      isSelected: m.isSelected,
      status: m.status
    })), null, 2));

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
        
        // Get student names
        const students = populated.research?.students || [];
        const studentNames = Array.isArray(students) 
          ? students.map(s => s?.name || (typeof s === 'object' ? s.name : 'Unknown')).filter(Boolean)
          : [];
        const studentNamesText = studentNames.length > 0 
          ? studentNames.join(", ") 
          : "Not specified";

        await transporter.sendMail({
          from: process.env.SMTP_FROM,
          to: panelistEmails.join(","),
          subject: `Panel Assignment: ${name}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background-color: #7C1D23; color: white; padding: 20px; border-radius: 5px 5px 0 0;">
                <h2 style="margin: 0; font-size: 24px;">You have been assigned as a panelist</h2>
              </div>
              <div style="background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none;">
                <p style="margin-top: 0;">Dear Panelist,</p>
                <p>You have been assigned to serve as a panelist for the following research panel:</p>
                
                <div style="background-color: white; padding: 15px; margin: 20px 0; border-left: 4px solid #7C1D23; border-radius: 4px;">
                  <p style="margin: 8px 0;"><strong style="color: #333;">Panel Name:</strong> <span style="color: #7C1D23;">${name}</span></p>
                  <p style="margin: 8px 0;"><strong style="color: #333;">Panel Type:</strong> ${type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</p>
                  <p style="margin: 8px 0;"><strong style="color: #333;">Research Title:</strong> ${researchTitle}</p>
                  <p style="margin: 8px 0;"><strong style="color: #333;">Student(s):</strong> ${studentNamesText}</p>
                  ${description ? `<p style="margin: 8px 0;"><strong style="color: #333;">Description:</strong> ${description}</p>` : ''}
                </div>

                <p style="margin-bottom: 0;">Please review the research materials and prepare for the panel evaluation. You will receive further notifications regarding the schedule and submission deadlines.</p>
              </div>
              <div style="background-color: #f0f0f0; padding: 15px; border-radius: 0 0 5px 5px; border: 1px solid #ddd; border-top: none;">
                <p style="color: #999; font-size: 12px; margin: 0;">If you have any questions or concerns, please contact the Program Head.</p>
              </div>
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

    // Get existing panel to compare members
    const existingPanel = await Panel.findById(id);
    if (!existingPanel) {
      return res.status(404).json({ message: "Panel not found" });
    }

    // Create a set of existing member faculty IDs for comparison
    const existingFacultyIds = new Set(
      existingPanel.members.map(m => {
        const fId = m.faculty?._id || m.faculty;
        return fId?.toString();
      }).filter(Boolean)
    );

    // Auto-activate newly added members (keep existing members' isSelected status)
    const updatedMembers = members.map(member => {
      const memberFacultyId = (member.faculty?._id || member.faculty)?.toString();
      
      // Find if this member already exists in the panel
      const existingMember = existingPanel.members.find(m => {
        const existingFacultyId = (m.faculty?._id || m.faculty)?.toString();
        return existingFacultyId === memberFacultyId;
      });

      // If it's a new member, auto-activate it; otherwise, preserve existing isSelected status
      if (existingMember) {
        return {
          ...member,
          isSelected: existingMember.isSelected // Preserve existing status
        };
      } else {
        return {
          ...member,
          isSelected: true // Auto-activate new members
        };
      }
    });

    const panel = await Panel.findByIdAndUpdate(
      id,
      { members: updatedMembers, assignedBy: req.user.id },
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
      metadata: { 
        memberCount: updatedMembers.length,
        activeCount: updatedMembers.filter(m => m.isSelected).length
      }
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
      status: { $ne: "cancelled" }, // Exclude cancelled schedules
    };

    // If a specific status is requested, override the default filter
    if (status && status !== 'all') {
      if (status === 'cancelled') {
        // Allow showing cancelled schedules if explicitly requested
        query.status = 'cancelled';
      } else {
        query.status = status;
      }
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

    console.log('[Get Panel Defense Schedules] Query:', JSON.stringify(query));

    const schedules = await Schedule.find(query)
      .populate("research", "title students")
      .populate("panel", "name type status")
      .populate("participants.user", "name email")
      .populate("createdBy", "name email")
      .populate("finalizedBy", "name email")
      .sort({ datetime: 1 });
    
    console.log(`[Get Panel Defense Schedules] Found ${schedules.length} schedules`);
    
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
        populate: [
          { path: "students", select: "name email" },
          { path: "adviser", select: "name email" }
        ]
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

        // Add adviser email if it's a panel defense schedule
        if (schedule.panel && schedule.research?.adviser?.email) {
          if (!participantEmails.includes(schedule.research.adviser.email)) {
            participantEmails.push(schedule.research.adviser.email);
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

    console.log(`[Delete Schedule] Permanently deleting schedule: ${scheduleId} - "${scheduleTitle}"`);

    // Delete Google Calendar event if it exists
    if (schedule.googleCalendarEventId) {
      try {
        const user = await User.findById(req.user.id);
        if (user?.googleAccessToken) {
          console.log(`[Delete Schedule] Deleting Google Calendar event: ${schedule.googleCalendarEventId}`);
          await deleteCalendarEvent(
            schedule.googleCalendarEventId,
            user.googleAccessToken,
            user.googleRefreshToken,
            user._id.toString()
          );
          console.log(`[Delete Schedule] Google Calendar event deleted successfully`);
        }
      } catch (calendarError) {
        console.error('[Delete Schedule] Error deleting Google Calendar event:', calendarError);
        // Don't fail the deletion if calendar deletion fails
      }
    }

    // If it's a panel schedule, update panel status and clear meeting details
    if (schedule.panel) {
      schedule.panel.meetingDate = null;
      schedule.panel.meetingLocation = null;
      if (schedule.panel.status === 'scheduled') {
        schedule.panel.status = 'confirmed'; // Revert to confirmed if it was scheduled
      }
      await schedule.panel.save();
    }

    // Send email notifications to all participants before deletion
    try {
      // Populate schedule with all necessary data for email
      const scheduleForEmail = await Schedule.findById(id)
        .populate("panel", "name type members research")
        .populate({
          path: "research",
          select: "title students adviser",
          populate: [
            { path: "students", select: "name email" },
            { path: "adviser", select: "name email" }
          ]
        })
        .populate("participants.user", "name email");

      if (scheduleForEmail) {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT,
          secure: false,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        const scheduleDateStr = scheduleForEmail.datetime.toLocaleString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });

        // Collect all participant emails (internal panelists, students, adviser, and external panelists)
        const participantEmails = [];

        // Internal panelists (from participants array)
        if (scheduleForEmail.participants) {
          scheduleForEmail.participants.forEach(p => {
            if (p.user?.email) {
              participantEmails.push(p.user.email);
            }
          });
        }

        // Students
        if (scheduleForEmail.research?.students) {
          const students = Array.isArray(scheduleForEmail.research.students) 
            ? scheduleForEmail.research.students 
            : [scheduleForEmail.research.students];
          students.forEach(student => {
            if (student?.email && !participantEmails.includes(student.email)) {
              participantEmails.push(student.email);
            }
          });
        }

        // Adviser
        if (scheduleForEmail.research?.adviser?.email) {
          if (!participantEmails.includes(scheduleForEmail.research.adviser.email)) {
            participantEmails.push(scheduleForEmail.research.adviser.email);
          }
        }

        // External panelists
        if (scheduleForEmail.panel?.members) {
          scheduleForEmail.panel.members
            .filter(m => m.isExternal && m.isSelected && m.email)
            .forEach(m => {
              if (!participantEmails.includes(m.email)) {
                participantEmails.push(m.email);
              }
            });
        }

        const uniqueEmails = [...new Set(participantEmails)];

        if (uniqueEmails.length > 0) {
          const researchTitle = scheduleForEmail.research?.title || "Research";
          const panelName = scheduleForEmail.panel?.name || scheduleForEmail.title;

          await transporter.sendMail({
            from: process.env.SMTP_FROM,
            to: uniqueEmails.join(","),
            subject: `Schedule Cancelled: ${panelName}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #dc2626; color: white; padding: 20px; border-radius: 5px 5px 0 0;">
                  <h2 style="margin: 0;">Schedule Cancelled</h2>
                </div>
                <div style="background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none;">
                  <p>Dear Participant,</p>
                  <p>The following panel defense schedule has been <strong>cancelled</strong>:</p>
                  
                  <div style="background-color: white; padding: 15px; margin: 20px 0; border-left: 4px solid #dc2626;">
                    <p style="margin: 5px 0;"><strong>Panel Name:</strong> ${panelName}</p>
                    <p style="margin: 5px 0;"><strong>Research:</strong> ${researchTitle}</p>
                    <p style="margin: 5px 0;"><strong>Original Date & Time:</strong> ${scheduleDateStr}</p>
                    <p style="margin: 5px 0;"><strong>Location:</strong> ${scheduleForEmail.location}</p>
                  </div>

                  <p style="color: #dc2626; font-weight: bold;">⚠️ This schedule has been cancelled and removed from the system.</p>
                  
                  <p>Please remove this event from your calendar. A new schedule will be provided if the panel defense is rescheduled.</p>
                  
                  <p>If you have any questions, please contact the Program Head.</p>
                </div>
                <div style="background-color: #f0f0f0; padding: 15px; border-radius: 0 0 5px 5px; border: 1px solid #ddd; border-top: none;">
                  <p style="color: #999; font-size: 12px; margin: 0;">This is an automated notification. Please do not reply to this email.</p>
                </div>
              </div>
            `,
          });

          console.log(`[Delete Schedule] Email notifications sent to ${uniqueEmails.length} participants`);
        }
      }
    } catch (emailErr) {
      console.error("[Delete Schedule] Email notification error:", emailErr);
      // Don't fail the deletion if email fails
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
    
    // Permanently delete the schedule from database
    const deleteResult = await Schedule.findByIdAndDelete(id);
    
    if (!deleteResult) {
      console.error(`[Delete Schedule] Failed to delete schedule ${scheduleId} - schedule not found`);
      return res.status(404).json({ message: "Schedule not found or already deleted" });
    }
    
    console.log(`[Delete Schedule] Schedule ${scheduleId} permanently deleted from database`);
    console.log(`[Delete Schedule] Deleted schedule details:`, {
      id: deleteResult._id.toString(),
      title: deleteResult.title,
      panelId: deleteResult.panel?.toString() || 'N/A'
    });
    
    // Verify deletion by checking if schedule still exists
    const verifyDelete = await Schedule.findById(id);
    if (verifyDelete) {
      console.error(`[Delete Schedule] WARNING: Schedule ${scheduleId} still exists after deletion attempt!`);
    } else {
      console.log(`[Delete Schedule] Verified: Schedule ${scheduleId} successfully removed from database`);
    }
    
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

    const oldStatus = schedule.status;
    console.log(`[Archive Schedule] Changing status from "${oldStatus}" to "cancelled" for schedule: ${schedule._id}`);
    schedule.status = "cancelled";
    await schedule.save();
    console.log(`[Archive Schedule] Schedule ${schedule._id} status updated to: ${schedule.status}`);

    // Update panel meeting details (if panel exists)
    if (schedule.panel) {
      schedule.panel.meetingDate = null;
      schedule.panel.meetingLocation = null;
      if (schedule.panel.status === 'scheduled') {
        schedule.panel.status = 'confirmed'; // Revert to confirmed
      }
      await schedule.panel.save();
    }

    // Send cancellation notifications (only if panel exists)
    if (schedule.panel) {
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
        panelId: schedule.panel?._id,
        panelName: schedule.panel?.name,
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
    const research = await Research.find({ status: { $ne: 'archived'}})
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

// Update research title and students
export const updateResearchTitle = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, studentIds } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: "Research title is required" });
    }

    const update = {
      title: title.trim(),
    };

    if (Array.isArray(studentIds)) {
      update.students = studentIds;
    }

    const research = await Research.findByIdAndUpdate(
      id,
      update,
      { new: true }
    )
      .populate("students", "name email")
      .populate("adviser", "name email");

    if (!research) {
      return res.status(404).json({ message: "Research not found" });
    }

    await Activity.create({
      user: req.user.id,
      action: "update",
      entityType: "research",
      entityId: research._id,
      entityName: research.title,
      description: `Updated research title and students: ${research.title}`,
      metadata: {
        researchId: research._id,
        title: research.title,
        studentCount: research.students?.length || 0,
        studentIds: research.students?.map(s => s._id) || [],
      }
    });

    res.json({ message: "Research updated successfully", research });
  } catch (error) {
    console.error("Error updating research title:", error);
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
      .populate({
        path: "research",
        select: "title students",
        populate: {
          path: "students",
          select: "name email"
        }
      })
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
      
      // Get student names
      const students = panel.research?.students || [];
      const studentNames = Array.isArray(students) 
        ? students.map(s => s?.name || (typeof s === 'object' ? s.name : 'Unknown')).filter(Boolean)
        : [];
      const studentNamesText = studentNames.length > 0 
        ? studentNames.join(", ") 
        : "Not specified";
      
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
              <h2 style="margin: 0; font-size: 24px;">You've been invited as a panelist</h2>
            </div>
            <div style="background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none;">
              <p style="margin-top: 0;">Dear <strong>${name}</strong>,</p>
              <p>You have been invited to serve as a <strong>${role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</strong> panelist for the following evaluation:</p>
              
              <div style="background-color: white; padding: 15px; margin: 20px 0; border-left: 4px solid #7C1D23; border-radius: 4px;">
                <p style="margin: 8px 0;"><strong style="color: #333;">Panel Name:</strong> <span style="color: #7C1D23;">${panel.name}</span></p>
                <p style="margin: 8px 0;"><strong style="color: #333;">Panel Type:</strong> ${panel.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                <p style="margin: 8px 0;"><strong style="color: #333;">Research Title:</strong> ${researchTitle}</p>
                <p style="margin: 8px 0;"><strong style="color: #333;">Student(s):</strong> ${studentNamesText}</p>
                <p style="margin: 8px 0;"><strong style="color: #333;">Review Deadline:</strong> ${deadlineText}</p>
              </div>

              ${panel.description ? `<p style="margin: 15px 0; padding: 10px; background-color: #f0f0f0; border-radius: 4px;"><strong style="color: #333;">Description:</strong> ${panel.description}</p>` : ''}

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

    // Log activity
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

    const uploader = await User.findById(req.user.id);
    if (!uploader || !uploader.driveAccessToken) {
      return res.status(400).json({
        message: "Please connect your Google Drive account before uploading panel documents.",
      });
    }

    const driveTokens = buildDriveTokens(uploader);
    const driveFolderId = getPanelDriveFolderId();
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
      await applyUpdatedDriveTokens(uploader, updatedTokens);
    } catch (driveError) {
      console.error("Error uploading panel document to Google Drive:", driveError);
      return res.status(500).json({
        message:
          "Failed to upload the document to Google Drive. Please reconnect your Drive account and try again.",
      });
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
      driveFileId: driveFileData?.id,
      driveFileLink: driveFileData?.webViewLink,
      driveFileName: driveFileData?.name,
      driveMimeType: driveFileData?.mimeType,
      driveFolderId: driveFolderId || null,
      storageLocation: driveFileData ? "local+google-drive" : "local",
      versions: [{
        version: 1,
        filename: req.file.originalname,
        filepath: req.file.path,
        fileSize: req.file.size,
        uploadedBy: req.user.id,
        uploadedAt: new Date(),
        changeDescription: "Initial upload",
        driveFileId: driveFileData?.id,
        driveFileLink: driveFileData?.webViewLink,
        driveFileName: driveFileData?.name,
        driveMimeType: driveFileData?.mimeType,
        driveFolderId: driveFolderId || null,
        storageLocation: driveFileData ? "local+google-drive" : "local",
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
          driveFileId: driveFileData?.id,
          driveFileLink: driveFileData?.webViewLink,
          driveFileName: driveFileData?.name,
          driveMimeType: driveFileData?.mimeType,
          driveFolderId: driveFolderId || null,
          storageLocation: driveFileData ? "local+google-drive" : "local",
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

    const uploader = await User.findById(req.user.id);
    if (!uploader || !uploader.driveAccessToken) {
      return res.status(400).json({
        message: "Please connect your Google Drive account before replacing panel documents.",
      });
    }

    const driveTokens = buildDriveTokens(uploader);
    const driveFolderId = getPanelDriveFolderId();
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
      await applyUpdatedDriveTokens(uploader, updatedTokens);
    } catch (driveError) {
      console.error("Error replacing panel document in Google Drive:", driveError);
      return res.status(500).json({
        message:
          "Failed to upload the updated document to Google Drive. Please reconnect your Drive account and try again.",
      });
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
      driveFileId: driveFileData?.id,
      driveFileLink: driveFileData?.webViewLink,
      driveFileName: driveFileData?.name,
      driveMimeType: driveFileData?.mimeType,
      driveFolderId: driveFolderId || null,
      storageLocation: driveFileData ? "local+google-drive" : "local",
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
          driveFileId: driveFileData?.id,
          driveFileLink: driveFileData?.webViewLink,
          driveFileName: driveFileData?.name,
          driveMimeType: driveFileData?.mimeType,
          driveFolderId: driveFolderId || null,
          storageLocation: driveFileData ? "local+google-drive" : "local",
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

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.max(parseInt(limit, 10) || 100, 1);

    let query = {};

    // Filter by action if provided
    if (action && action !== 'all') {
      query.action = action;
    }

    // Filter by entity type if provided
    if (entityType && entityType !== 'all') {
      query.entityType = entityType;
    }

    const allowedRoles = ["graduate student", "faculty adviser"];
    const allowedUserIds = await User.find({
      role: { $in: allowedRoles }
    }).distinct("_id");

    if (!allowedUserIds.length) {
      return res.json({
        activities: [],
        pagination: {
          total: 0,
          page: pageNumber,
          limit: limitNumber,
          pages: 0
        }
      });
    }

    query.user = { $in: allowedUserIds };

    const skip = (pageNumber - 1) * limitNumber;

    const activities = await Activity.find(query)
      .populate("user", "name email role")
      .sort({ createdAt: -1 })
      .limit(limitNumber)
      .skip(skip);

    const total = await Activity.countDocuments(query);

    res.json({
      activities,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        pages: Math.ceil(total / limitNumber)
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

    const allowedRoles = ["graduate student", "faculty adviser"];
    const allowedUserIds = await User.find({
      role: { $in: allowedRoles }
    }).distinct("_id");

    if (!allowedUserIds.length) {
      return res.json({
        total: 0,
        today: 0,
        thisWeek: 0,
        byAction: [],
        byEntityType: [],
        recentUsers: []
      });
    }

    const baseQuery = { user: { $in: allowedUserIds } };

    const stats = {
      total: await Activity.countDocuments(baseQuery),
      today: await Activity.countDocuments({
        ...baseQuery,
        createdAt: { $gte: today }
      }),
      thisWeek: await Activity.countDocuments({
        ...baseQuery,
        createdAt: { $gte: thisWeek }
      }),
      byAction: await Activity.aggregate([
        { $match: { ...baseQuery } },
        { $group: { _id: "$action", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      byEntityType: await Activity.aggregate([
        { $match: { ...baseQuery } },
        { $group: { _id: "$entityType", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      recentUsers: await Activity.aggregate([
        { $match: { ...baseQuery, createdAt: { $gte: thisWeek } } },
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

// Generate digital signature for panel export
const generatePanelDigitalSignature = (data) => {
  const signatureData = JSON.stringify({
    recordCount: data.recordCount || 0,
    timestamp: new Date().toISOString(),
    generatedBy: data.generatedBy || "Program Head"
  });
  
  const hash = crypto.createHash('sha256').update(signatureData).digest('hex');
  const shortHash = hash.substring(0, 16);
  const signature = `BGS - ${shortHash}`;
  console.log('[Digital Signature] Generated:', signature);
  return signature;
};

// Format date value
const formatDateValue = (value, withTime = false) => {
  if (!value) return "N/A";
  try {
    const options = withTime
      ? { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
      : { year: "numeric", month: "short", day: "numeric" };
    return new Date(value).toLocaleString("en-US", options);
  } catch {
    return value;
  }
};

// Add page numbers and signature to PDF
const addPageNumbers = (doc, digitalSignature) => {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    const pageNumber = i + 1;
    const totalPages = range.count;
    const pageNumberText = `Page ${pageNumber} of ${totalPages}`;
    
    const pageNumberY = doc.page.height - doc.page.margins.bottom - 20;
    doc.fontSize(9)
      .fillColor("#6B7280")
      .text(pageNumberText, doc.page.margins.left, pageNumberY, {
        align: "center",
        width: doc.page.width - (doc.page.margins.left + doc.page.margins.right)
      });
    
    if (digitalSignature) {
      const signatureX = doc.page.margins.left;
      const signatureY = doc.page.height - 15;
      doc.x = signatureX;
      doc.y = signatureY;
      doc.font('Helvetica')
        .fontSize(8)
        .fillColor("#000000")
        .text(digitalSignature);
    }
  }
};

// Helper function to escape HTML
const escapeHtml = (text) => {
  if (text == null) return "N/A";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

// Generate HTML template for panel records PDF
const generatePanelRecordsPdfHtmlTemplate = (panelData, { generatedBy, filtersSummary }) => {
  const digitalSignature = generatePanelDigitalSignature({
    recordCount: panelData.length,
    generatedBy
  });

  // Find and convert logo to base64
  let logoBase64 = "";
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const projectRoot = path.resolve(__dirname, '..', '..');
  const logoPaths = [
    path.join(projectRoot, 'frontend', 'public', 'logo.jpg'),
    path.join(projectRoot, 'frontend', 'public', 'logo.png'),
    path.join(projectRoot, 'public', 'logo.jpg'),
    path.join(projectRoot, 'public', 'logo.png'),
    path.join(projectRoot, 'backend', 'public', 'logo.jpg'),
    path.join(projectRoot, 'backend', 'public', 'logo.png'),
    path.join(process.cwd(), 'frontend', 'public', 'logo.jpg'),
    path.join(process.cwd(), 'frontend', 'public', 'logo.png')
  ];

  for (const logoPath of logoPaths) {
    if (fs.existsSync(logoPath)) {
      try {
        const logoBuffer = fs.readFileSync(logoPath);
        const logoExt = path.extname(logoPath).toLowerCase();
        const mimeType = logoExt === '.png' ? 'image/png' : 'image/jpeg';
        logoBase64 = `data:${mimeType};base64,${logoBuffer.toString('base64')}`;
        console.log('Logo found and converted to base64:', logoPath);
        break;
      } catch (logoError) {
        console.log('Error reading logo:', logoError.message);
      }
    }
  }

  // Generate table rows HTML
  const tableRows = panelData.map((panel, index) => {
    return `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(panel.panelName || "N/A")}</td>
        <td>${escapeHtml(panel.researchTitle || "N/A")}</td>
        <td>${escapeHtml(panel.panelType || "N/A")}</td>
        <td>${escapeHtml(panel.dateConducted || "N/A")}</td>
        <td>${escapeHtml(panel.totalPanelists || 0)}</td>
        <td>${escapeHtml(panel.totalReviews || 0)}</td>
        <td>${escapeHtml(panel.approvalRate || "0")}%</td>
        <td>${escapeHtml(panel.averageScore || "0")}</td>
        <td>${escapeHtml(panel.approve || 0)}</td>
        <td>${escapeHtml(panel.revision || 0)}</td>
        <td>${escapeHtml(panel.reject || 0)}</td>
        <td class="panelists-cell">${escapeHtml(panel.panelists || "N/A")}</td>
      </tr>
    `;
  }).join("");

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Panel Records Report</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    @page {
      size: A4 landscape;
      margin: 1cm;
    }

    body {
      font-family: 'Helvetica', 'Arial', sans-serif;
      font-size: 10px;
      color: #111827;
      line-height: 1.4;
      background: #ffffff;
    }

    .header {
      text-align: center;
      margin-bottom: 20px;
    }

    .logo-container {
      margin-bottom: 10px;
    }

    .logo-container img {
      width: 90px;
      height: 90px;
      object-fit: contain;
    }

    .university-name {
      font-size: 22px;
      font-weight: bold;
      color: #7C1D23;
      margin-bottom: 5px;
    }

    .university-address {
      font-size: 12px;
      color: #374151;
      margin-bottom: 3px;
    }

    .university-contact {
      font-size: 10px;
      color: #1E40AF;
      margin-bottom: 8px;
    }

    .college-name {
      font-size: 13px;
      color: #374151;
      margin-bottom: 10px;
    }

    .header-line {
      border-top: 2px solid #7C1D23;
      margin: 15px 0;
    }

    .report-title {
      font-size: 16px;
      font-weight: bold;
      color: #111827;
      text-align: center;
      margin: 15px 0;
    }

    .filters-box {
      background-color: #F9FAFB;
      border: 1px solid #E5E7EB;
      padding: 12px;
      margin-bottom: 20px;
      border-radius: 4px;
    }

    .filters-box p {
      margin: 4px 0;
      font-size: 10px;
      color: #374151;
    }

    .report {
      width: 100%;
      table-layout: fixed;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 9px;
    }

    .report colgroup col {
      width: 0;
    }

    .report col.c1 { width: 3%; }
    .report col.c2 { width: 11%; }
    .report col.c3 { width: 13%; }
    .report col.c4 { width: 10%; }
    .report col.c5 { width: 10%; }
    .report col.c6 { width: 6%; }
    .report col.c7 { width: 6%; }
    .report col.c8 { width: 7%; }
    .report col.c9 { width: 6%; }
    .report col.c10 { width: 6%; }
    .report col.c11 { width: 6%; }
    .report col.c12 { width: 6%; }
    .report col.c13 { width: 14%; }

    .report thead {
      display: table-header-group;
      background-color: #7C1D23;
      color: #ffffff;
    }

    .report thead th {
      padding: 8px 5px;
      text-align: left;
      font-weight: bold;
      font-size: 8px;
      border: 1px solid #5a1519;
      white-space: normal;
      word-wrap: break-word;
      overflow: visible;
      text-overflow: clip;
      line-height: 1.3;
    }

    .report tbody tr {
      page-break-inside: avoid;
      border-bottom: 1px solid #E5E7EB;
    }

    .report tbody tr:nth-child(even) {
      background-color: #F9FAFB;
    }

    .report tbody td {
      padding: 6px 4px;
      border: 1px solid #E5E7EB;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      vertical-align: top;
    }

    .report tbody td.panelists-cell {
      white-space: normal;
      word-wrap: break-word;
      overflow: visible;
      text-overflow: clip;
    }

    .report tbody tr:hover {
      background-color: #F3F4F6;
    }

    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px solid #E5E7EB;
      text-align: center;
      font-size: 8px;
      color: #6B7280;
    }

    .footer p {
      margin: 4px 0;
    }

    .footer .signature {
      margin-top: 10px;
      font-size: 8px;
      color: #000000;
      text-align: left;
    }

    @media print {
      .report thead {
        display: table-header-group;
      }
      .report tbody tr {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    ${logoBase64 ? `<div class="logo-container"><img src="${logoBase64}" alt="BUKSU Logo" /></div>` : ""}
    <div class="university-name">BUKIDNON STATE UNIVERSITY</div>
    <div class="university-address">Malaybalay City, Bukidnon 8700</div>
    <div class="university-contact">Tel (088) 813-5661 to 5663; TeleFax (088) 813-2717, www.buksu.edu.ph</div>
    <div class="college-name">College of Public Administration and Governance</div>
    <div class="header-line"></div>
  </div>

  <div class="report-title">PANEL RECORDS REPORT</div>

  <div class="filters-box">
    <p><strong>Generated by:</strong> ${escapeHtml(generatedBy || "Program Head")}</p>
    <p><strong>Date Generated:</strong> ${escapeHtml(formatDateValue(new Date(), true))}</p>
    <p><strong>Total Records:</strong> ${panelData.length}</p>
    ${filtersSummary ? `<p><strong>Applied Filters:</strong> ${escapeHtml(filtersSummary)}</p>` : ""}
  </div>

  <table class="report">
    <colgroup>
      <col class="c1">
      <col class="c2">
      <col class="c3">
      <col class="c4">
      <col class="c5">
      <col class="c6">
      <col class="c7">
      <col class="c8">
      <col class="c9">
      <col class="c10">
      <col class="c11">
      <col class="c12">
      <col class="c13">
    </colgroup>
    <thead>
      <tr>
        <th>#</th>
        <th>Panel Name</th>
        <th>Research Title</th>
        <th>Panel Type</th>
        <th>Date Conducted</th>
        <th># Panelists</th>
        <th># Reviews</th>
        <th>Approval %</th>
        <th>Avg Score</th>
        <th>Approve</th>
        <th>Revision</th>
        <th>Reject</th>
        <th>Panelists Names</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>

  <div class="footer">
    <p>This report is automatically generated by the Masteral Archive & Monitoring System.</p>
    <p>Bukidnon State University - College of Public Administration and Governance</p>
    <div class="signature">${escapeHtml(digitalSignature)}</div>
  </div>
</body>
</html>
  `;

  return html;
};

// Generate PDF buffer for panel records using HTML template
const generatePanelRecordsPdfBuffer = async (panelData, { generatedBy, filtersSummary }) => {
  // Generate HTML template
  const html = generatePanelRecordsPdfHtmlTemplate(panelData, { generatedBy, filtersSummary });

  // Try to use Puppeteer if available
  try {
    const puppeteer = await import("puppeteer").catch(() => null);
    if (puppeteer) {
      const browser = await puppeteer.default.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      const pdfBuffer = await page.pdf({
        format: "A4",
        landscape: true,
        margin: {
          top: "1cm",
          right: "1cm",
          bottom: "1cm",
          left: "1cm"
        },
        printBackground: true
      });
      await browser.close();
      return pdfBuffer;
    }
  } catch (puppeteerError) {
    console.log("Puppeteer not available, trying html-pdf:", puppeteerError.message);
  }

  // Fallback to html-pdf
  try {
    const pdf = await import("html-pdf").catch(() => null);
    if (pdf) {
      return new Promise((resolve, reject) => {
        pdf.create(html, {
          format: "A4",
          orientation: "landscape",
          border: {
            top: "1cm",
            right: "1cm",
            bottom: "1cm",
            left: "1cm"
          }
        }).toBuffer((err, buffer) => {
          if (err) reject(err);
          else resolve(buffer);
        });
      });
    }
  } catch (htmlPdfError) {
    console.log("html-pdf not available, falling back to PDFKit:", htmlPdfError.message);
  }

  // Final fallback to PDFKit (without CSS styling)
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Try to add logo
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const projectRoot = path.resolve(__dirname, '..', '..');
    const logoPaths = [
      path.join(projectRoot, 'frontend', 'public', 'logo.jpg'),
      path.join(projectRoot, 'frontend', 'public', 'logo.png'),
      path.join(projectRoot, 'public', 'logo.jpg'),
      path.join(projectRoot, 'public', 'logo.png'),
      path.join(projectRoot, 'backend', 'public', 'logo.jpg'),
      path.join(projectRoot, 'backend', 'public', 'logo.png'),
      path.join(process.cwd(), 'frontend', 'public', 'logo.jpg'),
      path.join(process.cwd(), 'frontend', 'public', 'logo.png')
    ];
    
    let logoAdded = false;
    const logoSize = 90;
    const logoY = 40;
    
    for (const logoPath of logoPaths) {
      if (fs.existsSync(logoPath)) {
        try {
          const logoX = (doc.page.width - logoSize) / 2;
          doc.image(logoPath, logoX, logoY, { width: logoSize, height: logoSize });
          doc.y = logoY + logoSize + 15;
          logoAdded = true;
          console.log('Logo added to PDF:', logoPath);
          break;
        } catch (logoError) {
          console.log('Error loading logo in PDF:', logoError.message);
        }
      }
    }
    
    if (!logoAdded) {
      doc.y = 50;
    }

    // University Header
    doc.font('Helvetica-Bold');
    doc.fontSize(22);
    doc.fillColor("#7C1D23");
    doc.text("BUKIDNON STATE UNIVERSITY", { align: "center" });
    doc.moveDown(0.2);
    
    doc.font('Helvetica');
    doc.fontSize(12);
    doc.fillColor("#374151");
    doc.text("Malaybalay City, Bukidnon 8700", { align: "center" });
    doc.moveDown(0.2);
    
    doc.fontSize(10);
    doc.fillColor("#1E40AF");
    doc.text("Tel (088) 813-5661 to 5663; TeleFax (088) 813-2717, www.buksu.edu.ph", { align: "center" });
    doc.moveDown(0.3);
    
    doc.font('Helvetica');
    doc.fontSize(13);
    doc.fillColor("#374151");
    doc.text("College of Public Administration and Governance", { align: "center" });
    doc.moveDown(0.5);
    
    doc.moveTo(doc.page.margins.left, doc.y)
       .lineTo(doc.page.width - doc.page.margins.right, doc.y)
       .strokeColor("#7C1D23")
       .lineWidth(2)
       .stroke();
    
    doc.moveDown(0.8);
    
    doc.font('Helvetica-Bold');
    doc.fontSize(16);
    doc.fillColor("#111827");
    doc.text("PANEL RECORDS REPORT", { align: "center" });
    doc.moveDown(0.5);
    
    // Report Details Box
    const boxY = doc.y;
    doc.rect(doc.page.margins.left, boxY, doc.page.width - (doc.page.margins.left + doc.page.margins.right), 50)
       .fillColor("#F9FAFB")
       .fill()
       .strokeColor("#E5E7EB")
       .lineWidth(1)
       .stroke();
    
    doc.y = boxY + 10;
    doc.fontSize(10).fillColor("#374151");
    doc.text(`Generated by: ${generatedBy || "Program Head"}`, doc.page.margins.left + 10);
    doc.moveDown(0.3);
    doc.text(`Date Generated: ${formatDateValue(new Date(), true)}`, doc.page.margins.left + 10);
    doc.moveDown(0.3);
    doc.text(`Total Records: ${panelData.length}`, doc.page.margins.left + 10);
    
    if (filtersSummary) {
      doc.moveDown(0.3);
      doc.text(`Applied Filters: ${filtersSummary}`, doc.page.margins.left + 10);
    }
    
    doc.y = boxY + 60;
    doc.moveDown(0.5);

    // Panel Records Section - Table format
    panelData.forEach((panel, index) => {
      if (doc.y >= doc.page.height - doc.page.margins.bottom - 120) {
        doc.addPage();
        doc.font('Helvetica-Bold');
        doc.fontSize(12);
        doc.fillColor("#7C1D23");
        doc.text("BUKIDNON STATE UNIVERSITY - Panel Records Report", { align: "center" });
        doc.moveDown(0.3);
        doc.moveTo(doc.page.margins.left, doc.y)
           .lineTo(doc.page.width - doc.page.margins.right, doc.y)
           .strokeColor("#7C1D23")
           .lineWidth(1)
           .stroke();
        doc.moveDown(0.5);
      }

      // Panel Title with background
      const titleY = doc.y;
      doc.rect(doc.page.margins.left, titleY, doc.page.width - (doc.page.margins.left + doc.page.margins.right), 25)
         .fillColor("#7C1D23")
         .fill();
      
      doc.fontSize(12).fillColor("#FFFFFF").text(`${index + 1}. ${panel.panelName || "Untitled Panel"}`, {
        x: doc.page.margins.left + 10,
        y: titleY + 7,
        width: doc.page.width - (doc.page.margins.left + doc.page.margins.right + 20)
      });
      
      doc.y = titleY + 30;
      doc.moveDown(0.2);

      // Panel Details Box
      const detailsY = doc.y;
      const detailsHeight = 120;
      
      doc.rect(doc.page.margins.left, detailsY, doc.page.width - (doc.page.margins.left + doc.page.margins.right), detailsHeight)
         .fillColor("#F9FAFB")
         .fill()
         .strokeColor("#E5E7EB")
         .lineWidth(0.5)
         .stroke();

      doc.y = detailsY + 8;
      doc.fontSize(9).fillColor("#6B7280");
      
      doc.text(`Research Title:`, { continued: true });
      doc.fontSize(9).fillColor("#111827").text(` ${panel.researchTitle || "N/A"}`);
      doc.moveDown(0.4);
      
      doc.fontSize(9).fillColor("#6B7280").text(`Panel Type:`, { continued: true });
      doc.fontSize(9).fillColor("#111827").text(` ${panel.panelType || "N/A"}`);
      doc.moveDown(0.4);
      
      doc.fontSize(9).fillColor("#6B7280").text(`Date Conducted:`, { continued: true });
      doc.fontSize(9).fillColor("#111827").text(` ${panel.dateConducted || "N/A"}`);
      doc.moveDown(0.4);
      
      doc.fontSize(9).fillColor("#6B7280").text(`Total Panelists:`, { continued: true });
      doc.fontSize(9).fillColor("#111827").text(` ${panel.totalPanelists || 0}`);
      doc.moveDown(0.4);
      
      doc.fontSize(9).fillColor("#6B7280").text(`Total Reviews:`, { continued: true });
      doc.fontSize(9).fillColor("#111827").text(` ${panel.totalReviews || 0}`);
      doc.moveDown(0.4);
      
      doc.fontSize(9).fillColor("#6B7280").text(`Approval Rate:`, { continued: true });
      doc.fontSize(9).fillColor("#111827").text(` ${panel.approvalRate || "0%"}%`);
      doc.moveDown(0.4);
      
      doc.fontSize(9).fillColor("#6B7280").text(`Average Score:`, { continued: true });
      doc.fontSize(9).fillColor("#111827").text(` ${panel.averageScore || "0"}`);
      doc.moveDown(0.4);
      
      doc.fontSize(9).fillColor("#6B7280").text(`Recommendations - Approve: ${panel.approve || 0}, Revision: ${panel.revision || 0}, Reject: ${panel.reject || 0}`);
      doc.moveDown(0.4);
      
      doc.fontSize(9).fillColor("#6B7280").text(`Panelists:`, { continued: true });
      doc.fontSize(9).fillColor("#111827").text(` ${panel.panelists || "N/A"}`);

      doc.y = detailsY + detailsHeight;
      doc.moveDown(0.5);
    });

    doc.moveDown(1);
    
    if (doc.y > doc.page.height - doc.page.margins.bottom - 80) {
      doc.addPage();
    }
    
    doc.moveTo(doc.page.margins.left, doc.y)
       .lineTo(doc.page.width - doc.page.margins.right, doc.y)
       .strokeColor("#E5E7EB")
       .lineWidth(1)
       .stroke();
    
    doc.moveDown(0.3);
    doc.fontSize(8).fillColor("#6B7280").text(
      "This report is automatically generated by the Masteral Archive & Monitoring System.",
      { align: "center" }
    );
    doc.moveDown(0.2);
    doc.fontSize(8).fillColor("#9CA3AF").text(
      "Bukidnon State University - College of Public Administration and Governance",
      { align: "center" }
    );
    doc.moveDown(0.3);

    addPageNumbers(doc, digitalSignature);
    doc.end();
  });
};

// Export panel records to PDF
const generatePanelRecordsExcelBuffer = async (panelData, { generatedBy, filtersSummary }) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = generatedBy || "Program Head";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Panel Records", {
    properties: { defaultRowHeight: 20 },
    pageSetup: { 
      fitToPage: true, 
      orientation: "landscape",
      margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 }
    }
  });

  // Define columns
  worksheet.columns = [
    { header: "#", key: "index", width: 5 },
    { header: "Panel Name", key: "panelName", width: 20 },
    { header: "Research Title", key: "researchTitle", width: 30 },
    { header: "Panel Type", key: "panelType", width: 15 },
    { header: "Date Conducted", key: "dateConducted", width: 18 },
    { header: "# Panelists", key: "totalPanelists", width: 12 },
    { header: "# Reviews", key: "totalReviews", width: 12 },
    { header: "Approval Rate", key: "approvalRate", width: 15 },
    { header: "Average Score", key: "averageScore", width: 15 },
    { header: "Approve", key: "approve", width: 10 },
    { header: "Revision", key: "revision", width: 10 },
    { header: "Reject", key: "reject", width: 10 },
    { header: "Panelists", key: "panelists", width: 50 }
  ];

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF7C1D23" }
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  headerRow.height = 30;

  // Add data rows
  panelData.forEach((panel, index) => {
    const row = worksheet.addRow({
      index: index + 1,
      panelName: panel.panelName || "N/A",
      researchTitle: panel.researchTitle || "N/A",
      panelType: panel.panelType || "N/A",
      dateConducted: panel.dateConducted || "N/A",
      totalPanelists: panel.totalPanelists || 0,
      totalReviews: panel.totalReviews || 0,
      approvalRate: `${panel.approvalRate || 0}%`,
      averageScore: panel.averageScore || 0,
      approve: panel.approve || 0,
      revision: panel.revision || 0,
      reject: panel.reject || 0,
      panelists: panel.panelists || "N/A"
    });

    // Alternate row colors
    if (index % 2 === 0) {
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF9FAFB" }
      };
    }

    row.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    row.height = 20;
  });

  // Auto-fit columns
  worksheet.columns.forEach(column => {
    if (column.width) {
      column.width = Math.min(column.width, 60);
    }
  });

  return await workbook.xlsx.writeBuffer();
};

export const exportPanelRecords = async (req, res) => {
  let tempDirPath = null;
  try {
    console.log('[Export] Starting panel records export');
    const { filters = {}, format = "pdf" } = req.body || {};
    const { 
      status, 
      panelType, 
      startDate, 
      endDate,
      researchId,
      minRecommendationRate 
    } = filters;
    
    // Build query
    const query = {
      status: { $in: ['completed', 'archived'] }
    };
    
    if (panelType && panelType !== 'all') {
      query.type = panelType;
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }
    
    if (researchId) {
      query.research = researchId;
    }

    const panels = await Panel.find(query)
      .populate("research", "title students")
      .populate("members.faculty", "name email")
      .populate("reviews.panelist", "name email")
      .sort({ createdAt: -1 });
    
    console.log(`[EXPORT] Found ${panels.length} panels to export`);

    // Fetch all schedules for these panels to get datetime and duration
    const panelIds = panels.map(p => p._id);
    const schedules = await Schedule.find({
      panel: { $in: panelIds },
      status: { $nin: ['cancelled', 'completed'] }
    }).select('panel datetime duration').lean();

    // Create a map of panel ID to schedule for quick lookup
    const scheduleMap = {};
    schedules.forEach(schedule => {
      // Handle both ObjectId and string panel references
      let panelId = null;
      if (schedule.panel) {
        if (typeof schedule.panel === 'object' && schedule.panel._id) {
          panelId = schedule.panel._id.toString();
        } else if (typeof schedule.panel === 'object') {
          panelId = schedule.panel.toString();
        } else {
          panelId = schedule.panel.toString();
        }
      }
      if (panelId) {
        scheduleMap[panelId] = schedule;
      }
    });
    
    console.log(`[EXPORT] Found ${schedules.length} schedules for ${panelIds.length} panels`);
    if (schedules.length > 0) {
      console.log(`[EXPORT] Sample schedule:`, {
        panel: schedules[0].panel,
        panelType: typeof schedules[0].panel,
        datetime: schedules[0].datetime,
        duration: schedules[0].duration
      });
    }

    // Process panel data
    const panelData = [];
    panels.forEach(panel => {
      // Include all members except those with declined status
      // This ensures active faculty members and external panelists are included
      // External panelists should be included regardless of status (except declined)
      const activeMembers = panel.members.filter(m => {
        // Always exclude declined members
        if (m.status === 'declined') return false;
        
        // Include external panelists if they have a name (they're selected/active)
        if (m.isExternal && m.name) return true;
        
        // Include internal faculty members (not declined)
        if (!m.isExternal) return true;
        
        return false;
      });
      
      // Debug logging to help identify issues
      if (activeMembers.length === 0 && panel.members.length > 0) {
        console.log(`[EXPORT] Panel ${panel.name} has ${panel.members.length} members but none are active:`, 
          panel.members.map(m => ({ 
            role: m.role, 
            status: m.status, 
            isSelected: m.isSelected,
            isExternal: m.isExternal,
            hasFaculty: !!m.faculty,
            facultyName: m.faculty?.name || m.name || 'N/A'
          }))
        );
      }
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

      // Find secretary member - ALWAYS include secretary if they exist and are not declined
      const secretaryMember = panel.members.find(m => 
        (m.role === 'secretary' || m.role?.toLowerCase() === 'secretary') && m.status !== 'declined'
      );
      
      // Ensure secretary is included in activeMembers if they exist and not already there
      if (secretaryMember) {
        const secretaryInActive = activeMembers.some(m => {
          if (m.role !== 'secretary' && m.role?.toLowerCase() !== 'secretary') return false;
          if (m.isExternal) {
            return m.name === secretaryMember.name;
          } else {
            // Compare by faculty ID or name
            const mFacultyId = m.faculty?._id?.toString() || m.faculty?.toString();
            const secFacultyId = secretaryMember.faculty?._id?.toString() || secretaryMember.faculty?.toString();
            return mFacultyId === secFacultyId;
          }
        });
        
        if (!secretaryInActive) {
          activeMembers.push(secretaryMember);
          console.log(`[EXPORT] Added secretary to activeMembers for panel "${panel.name}"`);
        }
      }
      
      // Build panelist names from active members
      // Include ALL active members: internal faculty, external panelists, secretary, members, etc.
      let panelistNames = activeMembers
        .map(m => {
          // Get name - check both isExternal and faculty population
          let name = 'Unknown';
          if (m.isExternal) {
            // External panelist - use their name directly
            name = m.name || 'Unknown External';
          } else {
            // Internal faculty - check if faculty is populated
            if (m.faculty && typeof m.faculty === 'object' && m.faculty.name) {
              name = m.faculty.name;
            } else if (m.faculty && typeof m.faculty === 'string') {
              // Faculty might be just an ID, try to get name from populated data
              name = 'Unknown Faculty';
            } else {
              name = 'Unknown';
            }
          }
          
          // Skip if name is still Unknown (data issue)
          if (name === 'Unknown' || name === 'Unknown External' || name === 'Unknown Faculty') {
            return null;
          }
          
          // Add role label for clarity in export
          // Include role labels for secretary, member, and external examiner
          if (m.role === 'secretary') {
            return `${name} (Secretary)`;
          } else if (m.role === 'member') {
            return `${name} (Member)`;
          } else if (m.role === 'external_examiner') {
            return `${name} (External Examiner)`;
          } else if (m.role === 'chair') {
            return `${name} (Chair)`;
          } else if (m.isExternal) {
            // External panelist in any role - label as External
            return `${name} (External)`;
          }
          return name;
        })
        .filter(name => name && name.trim()); // Remove any empty names and nulls
      
      // Explicitly add secretary if they exist and are not already in the list
      if (secretaryMember) {
        let secretaryName = null;
        
        if (secretaryMember.isExternal) {
          secretaryName = secretaryMember.name;
        } else {
          // For internal faculty, check if faculty is populated
          if (secretaryMember.faculty && typeof secretaryMember.faculty === 'object' && secretaryMember.faculty.name) {
            secretaryName = secretaryMember.faculty.name;
          } else if (secretaryMember.faculty && typeof secretaryMember.faculty === 'string') {
            // Faculty is just an ID - this shouldn't happen if populate worked, but handle it
            console.log(`[EXPORT] Warning: Secretary faculty not populated for panel "${panel.name}", faculty ID: ${secretaryMember.faculty}`);
          }
        }
        
        if (secretaryName && secretaryName !== 'Unknown' && secretaryName.trim()) {
          const secretaryLabel = `${secretaryName} (Secretary)`;
          
          // Check if secretary is already in the list (by name)
          const secretaryAlreadyIncluded = panelistNames.some(name => 
            name.includes(secretaryName) && name.includes('(Secretary)')
          );
          
          if (!secretaryAlreadyIncluded) {
            panelistNames.push(secretaryLabel);
            console.log(`[EXPORT] Added secretary "${secretaryName}" to panel "${panel.name}" panelists list`);
          } else {
            console.log(`[EXPORT] Secretary "${secretaryName}" already in panelists list for panel "${panel.name}"`);
          }
        } else {
          console.log(`[EXPORT] Warning: Secretary found for panel "${panel.name}" but name is missing or invalid:`, {
            isExternal: secretaryMember.isExternal,
            hasName: !!secretaryMember.name,
            name: secretaryMember.name,
            hasFaculty: !!secretaryMember.faculty,
            facultyType: typeof secretaryMember.faculty,
            facultyName: secretaryMember.faculty?.name,
            facultyId: secretaryMember.faculty?._id || secretaryMember.faculty
          });
        }
      } else {
        console.log(`[EXPORT] No secretary found for panel "${panel.name}". Total members: ${panel.members.length}`, 
          panel.members.map(m => ({ role: m.role, status: m.status, isExternal: m.isExternal }))
        );
      }
      
      // Join all panelist names, or use fallback if empty
      panelistNames = panelistNames.length > 0 
        ? panelistNames.join(', ') 
        : 'N/A';
      
      // Additional debug logging for secretary and panelists
      if (secretaryMember) {
        console.log(`[EXPORT] Panel "${panel.name}" - Secretary found:`, {
          isExternal: secretaryMember.isExternal,
          name: secretaryMember.isExternal ? secretaryMember.name : secretaryMember.faculty?.name,
          status: secretaryMember.status,
          inActiveMembers: activeMembers.some(m => m.role === 'secretary'),
          inPanelistNames: panelistNames.includes('(Secretary)'),
          finalPanelistNames: panelistNames
        });
      }
      
      // Additional debug logging if still N/A
      if (panelistNames === 'N/A' && panel.members.length > 0) {
        console.log(`[EXPORT] Panel "${panel.name}" panelists showing as N/A. Active members:`, activeMembers.length);
        console.log(`[EXPORT] All members:`, panel.members.map(m => ({
          role: m.role,
          status: m.status,
          isSelected: m.isSelected,
          isExternal: m.isExternal,
          facultyId: m.faculty?._id || m.faculty,
          facultyName: m.faculty?.name || m.name || 'N/A',
          hasFacultyPopulated: !!m.faculty && typeof m.faculty === 'object'
        })));
      }

      // Get schedule for this panel to get datetime and duration
      const panelId = panel._id.toString();
      const schedule = scheduleMap[panelId];
      
      let dateConducted = panel.meetingDate || panel.createdAt;
      let dateConductedFormatted = formatDateValue(dateConducted);
      
      // If schedule exists, format with time range
      if (schedule && schedule.datetime) {
        try {
          const startDate = new Date(schedule.datetime);
          if (!isNaN(startDate.getTime())) {
            const duration = schedule.duration || 120; // Default 120 minutes if not specified
            const endDate = new Date(startDate.getTime() + duration * 60000);
            
            // Format: "Dec 12, 2025, 10:30 AM - 12:30 PM"
            const datePart = startDate.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            });
            
            const startTimeStr = startDate.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            });
            
            const endTimeStr = endDate.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            });
            
            dateConductedFormatted = `${datePart}, ${startTimeStr} - ${endTimeStr}`;
            console.log(`[EXPORT] Panel "${panel.name}" - Formatted date with time range: ${dateConductedFormatted}`);
          }
        } catch (error) {
          console.error(`[EXPORT] Error formatting date for panel "${panel.name}":`, error);
        }
      } else {
        console.log(`[EXPORT] Panel "${panel.name}" - No schedule found. Panel ID: ${panelId}, Available schedule keys:`, Object.keys(scheduleMap));
      }

      panelData.push({
        panelName: panel.name || 'N/A',
        researchTitle: panel.research?.title || 'N/A',
        panelType: panel.type?.replace(/_/g, ' ') || 'N/A',
        dateConducted: dateConductedFormatted,
        totalPanelists: activeMembers.length,
        totalReviews: submittedReviews.length,
        approvalRate: approvalRate,
        averageScore: averageScore,
        approve: recommendations.approve,
        revision: recommendations.revision,
        reject: recommendations.reject,
        panelists: panelistNames
      });
    });

    const user = await User.findById(req.user.id);
    if (!user || !user.driveAccessToken) {
      return res.status(400).json({
        message: "Please connect your Google Drive account in Settings before exporting panel records."
      });
    }

    const generatedBy = user.name || user.email || "Program Head";
    const filtersSummary = Object.entries(filters || {})
      .filter(([, value]) => value && value !== "all" && value !== undefined && value !== null)
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ");

    if (!panelData || panelData.length === 0) {
      return res.status(400).json({ 
        message: "No panel records found matching the selected filters." 
      });
    }

    let fileBuffer;
    let mimeType;
    let extension;

    try {
      if (format === "excel" || format === "xlsx") {
        fileBuffer = await generatePanelRecordsExcelBuffer(panelData, {
          generatedBy,
          filtersSummary: filtersSummary || ""
        });
        mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        extension = "xlsx";
      } else {
        fileBuffer = await generatePanelRecordsPdfBuffer(panelData, {
          generatedBy,
          filtersSummary: filtersSummary || ""
        });
        mimeType = "application/pdf";
        extension = "pdf";
      }
    } catch (bufferError) {
      console.error("Error generating file buffer:", bufferError);
      throw new Error(`Failed to generate ${format === "excel" || format === "xlsx" ? "Excel" : "PDF"} file: ${bufferError.message}`);
    }

    tempDirPath = await fs.promises.mkdtemp(path.join(os.tmpdir(), "panel-export-"));
    const fileName = `panel-records-${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`;
    const tempFilePath = path.join(tempDirPath, fileName);
    await fs.promises.writeFile(tempFilePath, fileBuffer);

    const driveTokens = buildDriveTokens(user);
    if (!driveTokens?.access_token) {
      throw new Error("Unable to read Google Drive credentials. Please reconnect your Drive account.");
    }

    const reportsFolderId =
      process.env.GOOGLE_DRIVE_REPORTS_FOLDER_ID ||
      process.env.GOOGLE_DRIVE_PROGRAM_HEAD_REPORTS_FOLDER_ID ||
      getPanelDriveFolderId();

    if (!reportsFolderId) {
      throw new Error("Reports folder ID is not configured. Please set GOOGLE_DRIVE_REPORTS_FOLDER_ID.");
    }

    let driveFile;
    try {
      const { file, tokens: updatedTokens } = await uploadFileToDrive(
        tempFilePath,
        fileName,
        mimeType,
        driveTokens,
        { parentFolderId: reportsFolderId }
      );
      driveFile = file;
      await applyUpdatedDriveTokens(user, updatedTokens);
    } catch (driveError) {
      console.error("Failed to upload export to Google Drive:", driveError);
      throw new Error("Failed to upload export to Google Drive. Please reconnect your Drive account and try again.");
    }

    // Save export record to MongoDB
    let exportRecord = null;
    try {
      exportRecord = new Export({
        exportedBy: req.user.id,
        format: format === "excel" || format === "xlsx" ? "excel" : "pdf",
        recordCount: panelData.length,
        selectedFields: [],
        filters: {
          status: filters.status || undefined,
          panelType: filters.panelType || undefined,
          startDate: filters.startDate ? new Date(filters.startDate) : undefined,
          endDate: filters.endDate ? new Date(filters.endDate) : undefined,
          researchId: filters.researchId || undefined,
          minRecommendationRate: filters.minRecommendationRate || undefined,
        },
        driveFileId: driveFile?.id || undefined,
        driveFileLink: driveFile?.webViewLink || undefined,
        driveFileName: driveFile?.name || undefined,
        driveFolderId: reportsFolderId || undefined,
        fileName: fileName,
        fileSize: fileBuffer?.length || 0,
        mimeType: mimeType || undefined,
        status: "completed",
      });

      await exportRecord.save();
    } catch (saveError) {
      console.error("Error saving export record:", saveError);
    }

    await Activity.create({
      user: req.user.id,
      action: "export",
      entityType: "panel",
      entityName: "Panel Records Export",
      description: `Exported ${panelData.length} panel record(s) as PDF`,
      metadata: {
        format: format === "excel" || format === "xlsx" ? "excel" : "pdf",
        recordCount: panelData.length,
        filters: filtersSummary || null,
        driveFileId: driveFile?.id,
        exportId: exportRecord?._id || null
      }
    }).catch(err => console.error('Error logging activity:', err));

    // Clean up temp file
    try {
      await fs.promises.unlink(tempFilePath);
      await fs.promises.rmdir(tempDirPath);
    } catch (cleanupError) {
      console.error('Error cleaning up temp files:', cleanupError);
    }

    res.json({
      message: `Panel records exported as PDF and saved to your Google Drive Reports folder.`,
      format: "pdf",
      recordCount: panelData.length,
      driveFile,
      filters: filtersSummary || null,
      exportId: exportRecord?._id || null
    });
  } catch (error) {
    console.error("Error exporting panel records:", error);
    console.error("Error stack:", error.stack);
    
    if (tempDirPath) {
      try {
        await fs.promises.rmdir(tempDirPath, { recursive: true });
      } catch (cleanupError) {
        console.error('Error cleaning up temp directory:', cleanupError);
      }
    }

    // Save failed export record
    try {
      const failedExport = new Export({
        exportedBy: req.user.id,
        format: format === "excel" || format === "xlsx" ? "excel" : "pdf",
        recordCount: 0,
        selectedFields: [],
        filters: req.body?.filters || {},
        status: "failed",
        errorMessage: error.message,
        fileName: `failed-export-${new Date().toISOString().replace(/[:.]/g, "-")}`,
      });
      await failedExport.save();
    } catch (saveError) {
      console.error("Error saving failed export record:", saveError);
    }

    res.status(500).json({ message: error.message });
  }
};

// Export defense schedule to Excel
export const exportDefenseSchedule = async (req, res) => {
  let tempDirPath = null;
  try {
    console.log('[Export] Starting defense schedule export');
    const { filters = {} } = req.body || {};
    const { startDate, endDate, type } = filters;

    // Build query for finalized defense schedules
    const query = {
      type: { $in: ["proposal_defense", "final_defense"] },
      status: { $in: ["finalized", "confirmed", "scheduled"] }
    };

    if (startDate || endDate) {
      query.datetime = {};
      if (startDate) query.datetime.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.datetime.$lte = end;
      }
    }

    if (type && type !== 'all') {
      query.type = type;
    }

    const schedules = await Schedule.find(query)
      .populate("research", "title students")
      .populate({
        path: "research",
        populate: {
          path: "students",
          select: "name email"
        }
      })
      .populate({
        path: "research",
        populate: {
          path: "adviser",
          select: "name email"
        }
      })
      .populate({
        path: "panel",
        populate: {
          path: "members.faculty",
          select: "name email"
        }
      })
      .sort({ datetime: 1 }); // Sort by date/time

    if (!schedules || schedules.length === 0) {
      return res.status(400).json({ 
        message: "No defense schedules found matching the selected filters." 
      });
    }

    const user = await User.findById(req.user.id);
    if (!user || !user.driveAccessToken) {
      return res.status(400).json({
        message: "Please connect your Google Drive account in Settings before exporting defense schedules."
      });
    }

    const generatedBy = user.name || user.email || "Program Head";

    // Generate Excel buffer
    const workbook = new ExcelJS.Workbook();
    workbook.creator = generatedBy || "Program Head";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Defense Schedule", {
      properties: { defaultRowHeight: 20 },
      pageSetup: { 
        fitToPage: true, 
        orientation: "landscape",
        margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 }
      }
    });

    // Set column widths (without headers to avoid duplicate)
    worksheet.columns = [
      { key: "no", width: 8 },
      { key: "students", width: 40 },
      { key: "project", width: 50 },
      { key: "adviser", width: 25 },
      { key: "schedule", width: 20 },
      { key: "chair", width: 20 },
      { key: "member1", width: 20 },
      { key: "member2", width: 20 },
      { key: "secretary", width: 20 },
      { key: "externalExaminer", width: 25 }
    ];

    // Add logo
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const projectRoot = path.resolve(__dirname, '..', '..');
    const logoPaths = [
      path.join(projectRoot, 'frontend', 'public', 'logo.jpg'),
      path.join(projectRoot, 'frontend', 'public', 'logo.png'),
      path.join(projectRoot, 'public', 'logo.jpg'),
      path.join(projectRoot, 'public', 'logo.png'),
      path.join(projectRoot, 'backend', 'public', 'logo.jpg'),
      path.join(projectRoot, 'backend', 'public', 'logo.png'),
      path.join(process.cwd(), 'frontend', 'public', 'logo.jpg'),
      path.join(process.cwd(), 'frontend', 'public', 'logo.png')
    ];
    
    let logoRowOffset = 0;
    let logoAdded = false;
    const logoSize = 90;
    
    for (const logoPath of logoPaths) {
      if (fs.existsSync(logoPath)) {
        try {
          const ext = path.extname(logoPath).substring(1).toLowerCase();
          if (!['jpg', 'jpeg', 'png', 'gif'].includes(ext)) {
            continue;
          }
          
          const imageId = workbook.addImage({
            filename: logoPath,
            extension: ext
          });
          
          // Merge all 10 columns in the first row to create a centered container
          worksheet.mergeCells(1, 1, 1, 10);
          const logoCell = worksheet.getCell(1, 1);
          logoCell.alignment = { horizontal: 'center', vertical: 'middle' };
          
          // Center the logo: With 9 columns (0-8), center is at column 4
          // Logo spans approximately 2 columns visually, so start at column 3.5 to center it
          // ExcelJS supports fractional column positions for precise centering
          const centerCol = 3.5;
          
          worksheet.addImage(imageId, {
            tl: { col: centerCol, row: 0 },
            ext: { width: logoSize, height: logoSize }
          });
          
          worksheet.getRow(1).height = logoSize + 15;
          logoRowOffset = 1;
          logoAdded = true;
          console.log(`Logo added to Excel:`, logoPath);
          break;
        } catch (logoError) {
          console.log('Error loading logo in Excel:', logoError.message);
        }
      }
    }

    // University Header
    const headerStartRow = 1 + logoRowOffset;
    worksheet.mergeCells(headerStartRow, 1, headerStartRow, 10);
    const headerCell = worksheet.getCell(headerStartRow, 1);
    headerCell.value = "BUKIDNON STATE UNIVERSITY";
    headerCell.font = { name: 'Arial', size: 20, bold: true, color: { argb: "FF7C1D23" } };
    headerCell.alignment = { vertical: "middle", horizontal: "center" };
    headerCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF9FAFB' }
    };
    worksheet.getRow(headerStartRow).height = 25;

    const locationRow = headerStartRow + 1;
    worksheet.mergeCells(locationRow, 1, locationRow, 10);
    const locationCell = worksheet.getCell(locationRow, 1);
    locationCell.value = "Malaybalay City, Bukidnon 8700";
    locationCell.font = { name: 'Arial', size: 11, color: { argb: "FF374151" } };
    locationCell.alignment = { vertical: "middle", horizontal: "center" };
    locationCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF9FAFB' }
    };
    worksheet.getRow(locationRow).height = 18;

    const contactRow = locationRow + 1;
    worksheet.mergeCells(contactRow, 1, contactRow, 10);
    const contactCell = worksheet.getCell(contactRow, 1);
    contactCell.value = "Tel (088) 813-5661 to 5663; TeleFax (088) 813-2717, www.buksu.edu.ph";
    contactCell.font = { name: 'Arial', size: 10, color: { argb: "FF1E40AF" }, underline: true };
    contactCell.alignment = { vertical: "middle", horizontal: "center" };
    contactCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF9FAFB' }
    };
    worksheet.getRow(contactRow).height = 18;

    const collegeRow = contactRow + 1;
    worksheet.mergeCells(collegeRow, 1, collegeRow, 10);
    const collegeCell = worksheet.getCell(collegeRow, 1);
    collegeCell.value = "College of Public Administration and Governance";
    collegeCell.font = { name: 'Arial', size: 13, color: { argb: "FF374151" } };
    collegeCell.alignment = { vertical: "middle", horizontal: "center" };
    collegeCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF9FAFB' }
    };
    worksheet.getRow(collegeRow).height = 22;

    const dividerRow = collegeRow + 1;
    worksheet.mergeCells(dividerRow, 1, dividerRow, 10);
    const dividerCell = worksheet.getCell(dividerRow, 1);
    dividerCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF7C1D23' }
    };
    worksheet.getRow(dividerRow).height = 3;

    const reportTitleRow = dividerRow + 1;
    worksheet.mergeCells(reportTitleRow, 1, reportTitleRow, 10);
    const reportTitleCell = worksheet.getCell(reportTitleRow, 1);
    reportTitleCell.value = "DEFENSE SCHEDULE";
    reportTitleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: "FF111827" } };
    reportTitleCell.alignment = { vertical: "middle", horizontal: "center" };
    worksheet.getRow(reportTitleRow).height = 25;

    const dataStartRow = reportTitleRow + 2;
    const headerRow = dataStartRow;

    // Add header row
    worksheet.getRow(headerRow).values = [
      "No.",
      "Name of Student",
      "Approved Research Project",
      "Adviser",
      "Schedule",
      "Panel Chair",
      "Panel Member",
      "Panel Member",
      "Secretary",
      "External Examiner"
    ];

    // Style header row
    worksheet.getRow(headerRow).eachCell((cell) => {
      cell.font = { name: 'Arial', size: 12, bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF7C1D23' }
      };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF5a1519' } },
        left: { style: 'medium', color: { argb: 'FF5a1519' } },
        bottom: { style: 'medium', color: { argb: 'FF5a1519' } },
        right: { style: 'medium', color: { argb: 'FF5a1519' } }
      };
    });
    worksheet.getRow(headerRow).height = 30;

    // Add data rows
    schedules.forEach((schedule, index) => {
      const row = dataStartRow + 1 + index;
      const students = schedule.research?.students || [];
      const studentNames = students.map(s => s.name || s).join(", ") || "N/A";
      const projectTitle = schedule.research?.title || "N/A";
      const adviser = schedule.research?.adviser?.name || "N/A";
      const scheduleDate = schedule.datetime ? new Date(schedule.datetime).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      }) : "N/A";
      
      const panelMembers = schedule.panel?.members?.filter(m => m.isSelected) || [];
      
      // Extract panel members by role
      const chair = panelMembers.find(m => m.role === 'chair');
      const secretary = panelMembers.find(m => m.role === 'secretary');
      const externalExaminer = panelMembers.find(m => m.role === 'external_examiner');
      // Members are those with role 'member' or 'panel_member' (excluding chair, secretary, external_examiner)
      const members = panelMembers.filter(m => 
        (m.role === 'member' || m.role === 'panel_member') && 
        m.role !== 'chair' && 
        m.role !== 'secretary' && 
        m.role !== 'external_examiner'
      );
      
      // Get names
      const chairName = chair ? (chair.isExternal ? chair.name : (chair.faculty?.name || "N/A")) : "N/A";
      const secretaryName = secretary ? (secretary.isExternal ? secretary.name : (secretary.faculty?.name || "N/A")) : "N/A";
      const externalExaminerName = externalExaminer ? (externalExaminer.isExternal ? externalExaminer.name : (externalExaminer.faculty?.name || "N/A")) : "N/A";
      
      // Get member names (only regular members, NOT external examiner - it has its own column)
      let member1 = "N/A";
      let member2 = "N/A";
      
      if (members.length > 0) {
        const m1 = members[0];
        member1 = m1.isExternal ? m1.name : (m1.faculty?.name || "N/A");
      }
      if (members.length > 1) {
        const m2 = members[1];
        member2 = m2.isExternal ? m2.name : (m2.faculty?.name || "N/A");
      }
      
      console.log(`[EXPORT DEFENSE] Schedule ${index + 1} - Panel members:`, {
        chair: chairName,
        secretary: secretaryName,
        externalExaminer: externalExaminerName,
        regularMembers: members.length,
        member1,
        member2
      });

      worksheet.getRow(row).values = [
        index + 1,
        studentNames,
        projectTitle,
        adviser,
        scheduleDate,
        chairName,
        member1,
        member2,
        secretaryName,
        externalExaminerName
      ];

      // Style data row
      worksheet.getRow(row).eachCell((cell) => {
        cell.font = { name: 'Arial', size: 11 };
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        };
        if (row % 2 === 0) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF9FAFB' }
          };
        }
      });
      worksheet.getRow(row).height = 25;
    });

    // Generate Excel buffer
    const excelBuffer = await workbook.xlsx.writeBuffer();

    tempDirPath = await fs.promises.mkdtemp(path.join(os.tmpdir(), "defense-schedule-export-"));
    const fileName = `defense-schedule-${new Date().toISOString().replace(/[:.]/g, "-")}.xlsx`;
    const tempFilePath = path.join(tempDirPath, fileName);
    await fs.promises.writeFile(tempFilePath, excelBuffer);

    const driveTokens = buildDriveTokens(user);
    if (!driveTokens?.access_token) {
      throw new Error("Unable to read Google Drive credentials. Please reconnect your Drive account.");
    }

    const reportsFolderId =
      process.env.GOOGLE_DRIVE_REPORTS_FOLDER_ID ||
      process.env.GOOGLE_DRIVE_PROGRAM_HEAD_REPORTS_FOLDER_ID ||
      getPanelDriveFolderId();

    if (!reportsFolderId) {
      throw new Error("Reports folder ID is not configured. Please set GOOGLE_DRIVE_REPORTS_FOLDER_ID.");
    }

    let driveFile;
    try {
      const { file, tokens: updatedTokens } = await uploadFileToDrive(
        tempFilePath,
        fileName,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        driveTokens,
        { parentFolderId: reportsFolderId }
      );
      driveFile = file;
      await applyUpdatedDriveTokens(user, updatedTokens);
    } catch (driveError) {
      console.error("Failed to upload export to Google Drive:", driveError);
      throw new Error("Failed to upload export to Google Drive. Please reconnect your Drive account and try again.");
    }

    // Save export record
    let exportRecord = null;
    try {
      exportRecord = new Export({
        exportedBy: req.user.id,
        format: "xlsx",
        recordCount: schedules.length,
        selectedFields: [],
        filters: {
          startDate: filters.startDate ? new Date(filters.startDate) : undefined,
          endDate: filters.endDate ? new Date(filters.endDate) : undefined,
          type: filters.type || undefined,
        },
        driveFileId: driveFile?.id || undefined,
        driveFileLink: driveFile?.webViewLink || undefined,
        driveFileName: driveFile?.name || undefined,
        driveFolderId: reportsFolderId || undefined,
        fileName: fileName,
        fileSize: excelBuffer?.length || 0,
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        status: "completed",
      });
      await exportRecord.save();
    } catch (saveError) {
      console.error("Error saving export record:", saveError);
    }

    await Activity.create({
      user: req.user.id,
      action: "export",
      entityType: "schedule",
      entityName: "Defense Schedule Export",
      description: `Exported ${schedules.length} defense schedule(s) as XLSX`,
      metadata: {
        format: "xlsx",
        recordCount: schedules.length,
        driveFileId: driveFile?.id,
        exportId: exportRecord?._id || null
      }
    }).catch(err => console.error('Error logging activity:', err));

    // Clean up temp file
    try {
      await fs.promises.unlink(tempFilePath);
      await fs.promises.rmdir(tempDirPath);
    } catch (cleanupError) {
      console.error('Error cleaning up temp files:', cleanupError);
    }

    res.json({
      message: `Defense schedule exported as XLSX and saved to your Google Drive Reports folder.`,
      format: "xlsx",
      recordCount: schedules.length,
      driveFile,
      exportId: exportRecord?._id || null
    });
  } catch (error) {
    console.error("Error exporting defense schedule:", error);
    console.error("Error stack:", error.stack);
    
    if (tempDirPath) {
      try {
        await fs.promises.rmdir(tempDirPath, { recursive: true });
      } catch (cleanupError) {
        console.error('Error cleaning up temp directory:', cleanupError);
      }
    }

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

    // Sync to Google Calendar if user has connected calendar and event doesn't exist yet
    let calendarEvent = null;
    if (!schedule.googleCalendarEventId) {
      const user = await User.findById(req.user.id);
      console.log('[FINALIZE SCHEDULE] Checking Google Calendar connection:', {
        userId: req.user.id,
        calendarConnected: user?.calendarConnected,
        hasAccessToken: !!user?.googleAccessToken,
        hasRefreshToken: !!user?.googleRefreshToken,
        tokenExpiry: user?.googleTokenExpiry
      });

      if (user?.calendarConnected && user?.googleAccessToken && user?.googleRefreshToken) {
        try {
          console.log('[FINALIZE SCHEDULE] Creating Google Calendar event for schedule:', schedule.title);
          console.log('[FINALIZE SCHEDULE] Schedule data:', {
            title: schedule.title,
            datetime: schedule.datetime,
            duration: schedule.duration,
            location: schedule.location,
            type: schedule.type,
            attendeeCount: uniqueEmails.length
          });

          // Create Google Calendar event (token refresh will happen automatically if needed)
          calendarEvent = await createConsultationEvent(
            {
              title: schedule.title,
              description: schedule.description || `${scheduleType} for ${researchTitle}`,
              datetime: schedule.datetime,
              duration: schedule.duration,
              location: schedule.location,
              type: schedule.type,
              researchTitle: researchTitle,
              attendeeEmails: uniqueEmails,
            },
            user.googleAccessToken,
            user.googleRefreshToken,
            user._id.toString()
          );

          console.log('[FINALIZE SCHEDULE] Google Calendar event created successfully:', {
            eventId: calendarEvent.eventId,
            eventLink: calendarEvent.eventLink,
            meetLink: calendarEvent.meetLink
          });

          schedule.googleCalendarEventId = calendarEvent.eventId;
          schedule.googleCalendarLink = calendarEvent.eventLink;
          schedule.googleMeetLink = calendarEvent.meetLink;
          schedule.calendarSynced = true;
          await schedule.save();
          
          console.log('[FINALIZE SCHEDULE] Schedule updated with calendar sync status: true');
        } catch (calendarError) {
          console.error('[FINALIZE SCHEDULE] Error syncing to Google Calendar:', calendarError);
          console.error('[FINALIZE SCHEDULE] Error details:', {
            message: calendarError.message,
            code: calendarError.code,
            response: calendarError.response?.data,
            status: calendarError.response?.status,
            statusText: calendarError.response?.statusText,
            stack: calendarError.stack
          });
          // Don't fail finalization if calendar sync fails
          console.log('[FINALIZE SCHEDULE] Continuing without Google Calendar sync');
        }
      } else {
        console.log('[FINALIZE SCHEDULE] Google Calendar not connected or missing tokens:', {
          calendarConnected: user?.calendarConnected,
          hasAccessToken: !!user?.googleAccessToken,
          hasRefreshToken: !!user?.googleRefreshToken
        });
      }
    } else {
      console.log('[FINALIZE SCHEDULE] Schedule already has Google Calendar event:', schedule.googleCalendarEventId);
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

    console.log('[CREATE PANEL SCHEDULE] Request received:', {
      panelId,
      hasDatetime: !!datetime,
      hasLocation: !!location,
      hasDuration: !!duration
    });

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
    
    console.log('[CREATE PANEL SCHEDULE] Panel loaded:', {
      panelId: panel?._id,
      panelName: panel?.name,
      hasResearch: !!panel?.research,
      membersCount: panel?.members?.length,
      activeMembersCount: panel?.members?.filter(m => m.isSelected)?.length,
      externalMembersCount: panel?.members?.filter(m => m.isSelected && m.isExternal)?.length
    });

    if (!panel) {
      return res.status(404).json({ message: "Panel not found" });
    }

    // Check if panel already has an ACTIVE schedule (exclude cancelled and completed)
    // First, get ALL schedules for this panel to see what exists
    const allSchedulesForPanel = await Schedule.find({ panel: panelId }).select('_id status title datetime');
    console.log('[CREATE PANEL SCHEDULE] Checking schedules for panel:', panelId);
    console.log('[CREATE PANEL SCHEDULE] All schedules found:', JSON.stringify(allSchedulesForPanel.map(s => ({
      id: s._id.toString(),
      status: s.status,
      title: s.title,
      datetime: s.datetime
    })), null, 2));
    
    // Filter out cancelled and completed schedules
    const activeSchedules = allSchedulesForPanel.filter(s => 
      s.status !== 'cancelled' && s.status !== 'completed'
    );
    
    console.log('[CREATE PANEL SCHEDULE] Active schedules (not cancelled/completed):', activeSchedules.length);
    
    if (activeSchedules.length > 0) {
      const existingSchedule = activeSchedules[0];
      console.log('[CREATE PANEL SCHEDULE] BLOCKING - Found active schedule:', {
        id: existingSchedule._id.toString(),
        status: existingSchedule.status,
        title: existingSchedule.title
      });
      return res.status(400).json({ 
        message: `Panel already has an active schedule (status: "${existingSchedule.status}"). Please delete the existing schedule first to create a new one.` 
      });
    }
    
    // If we get here, either no schedules exist, or all are cancelled/completed
    if (allSchedulesForPanel.length > 0) {
      console.log('[CREATE PANEL SCHEDULE] ALLOWING - All existing schedules are cancelled/completed');
    } else {
      console.log('[CREATE PANEL SCHEDULE] ALLOWING - No existing schedules found');
    }

    // Validate datetime
    const scheduleDate = new Date(datetime);
    if (isNaN(scheduleDate.getTime())) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    if (scheduleDate < new Date()) {
      return res.status(400).json({ message: "Schedule date cannot be in the past" });
    }

    // Determine schedule type based on panel type (before conflict check)
    let scheduleType = "proposal_defense"; // Default
    if (panel.type === "final_defense") {
      scheduleType = "final_defense";
    } else if (panel.type === "proposal_defense") {
      scheduleType = "proposal_defense";
    }

    // Check for conflicts with panel members (but don't block creation - allow override)
    // Conflicts are checked on frontend, backend just logs them if they exist
    // Only check conflicts with schedules of the same type (exclude consultation schedules)
    try {
      const participantData = panel.members.filter(m => m.isSelected).map(m => {
        if (m.isExternal) {
          return {
            userId: null,
            email: m.email || null,
          };
        } else {
          // For internal members, safely get faculty ID and email
          const facultyId = m.faculty?._id || m.faculty;
          const facultyEmail = m.faculty?.email || null;
          return {
            userId: facultyId ? (facultyId._id || facultyId) : null,
            email: facultyEmail,
          };
        }
      }).filter(p => p.userId || p.email); // Only include participants with at least an ID or email
      
      const conflictCheck = await checkScheduleConflictsHelper({
        datetime: scheduleDate,
        duration: duration || 120,
        location: location,
        participants: participantData,
        type: scheduleType, // Pass type to exclude consultation schedules
      });

      // Log conflicts but don't block (frontend allows override)
      if (conflictCheck.hasConflicts) {
        console.warn("Schedule conflicts detected but proceeding:", conflictCheck.conflicts);
      }
    } catch (conflictError) {
      console.error('[CREATE PANEL SCHEDULE] Error checking conflicts (non-blocking):', conflictError);
      // Don't block schedule creation if conflict check fails
    }

    // Create participants array
    const participants = [];
    
    // Add panel members (only internal faculty - external panelists don't have User IDs)
    const activeMembers = panel.members.filter(m => m.isSelected);
    console.log('[CREATE PANEL SCHEDULE] Processing active members:', {
      total: activeMembers.length,
      internal: activeMembers.filter(m => !m.isExternal).length,
      external: activeMembers.filter(m => m.isExternal).length
    });
    
    for (const member of activeMembers) {
      if (!member.isExternal) {
        // Internal faculty member
        const facultyId = member.faculty?._id || member.faculty;
        if (facultyId) {
          participants.push({
            user: facultyId._id || facultyId,
            role: member.role === "chair" ? "chair" : member.role === "secretary" ? "secretary" : "panel_member",
            status: "confirmed",
          });
          console.log(`[CREATE PANEL SCHEDULE] Added internal panelist: ${member.faculty?.name || 'Unknown'} (${member.role})`);
        } else {
          console.warn(`[CREATE PANEL SCHEDULE] Skipping member with no faculty ID:`, {
            role: member.role,
            isExternal: member.isExternal,
            hasFaculty: !!member.faculty
          });
        }
      } else {
        // External panelist - don't add to participants array (they don't have User IDs)
        console.log(`[CREATE PANEL SCHEDULE] Skipping external panelist in participants array: ${member.name} (${member.email})`);
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
    console.log('[CREATE PANEL SCHEDULE] Creating schedule with participants:', {
      participantsCount: participants.length,
      participants: participants.map(p => ({
        userId: p.user?.toString() || p.user,
        role: p.role
      }))
    });
    
    const schedule = new Schedule({
      research: panel.research?._id || panel.research || null,
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

    try {
      await schedule.save();
      console.log('[CREATE PANEL SCHEDULE] Schedule saved successfully:', schedule._id);
    } catch (saveError) {
      console.error('[CREATE PANEL SCHEDULE] Error saving schedule:', saveError);
      console.error('[CREATE PANEL SCHEDULE] Schedule data:', {
        research: schedule.research,
        panel: schedule.panel,
        participantsCount: schedule.participants?.length,
        participants: schedule.participants
      });
      throw new Error(`Failed to save schedule: ${saveError.message}`);
    }

    // Update panel meeting details
    panel.meetingDate = scheduleDate;
    panel.meetingLocation = location.trim();
    panel.status = "scheduled";
    await panel.save();

    // Collect all participant emails (internal panelists, students, adviser, and external panelists)
    // This needs to be done BEFORE email sending and Google Calendar sync so it's accessible to both
    const participantEmails = [];

    // Internal panelists
    for (const member of activeMembers) {
      if (!member.isExternal && member.faculty?.email) {
        participantEmails.push(member.faculty.email);
        console.log(`[CREATE PANEL SCHEDULE] Added panelist email: ${member.faculty.email} (${member.faculty.name})`);
      }
    }

    // External panelists
    for (const member of activeMembers) {
      if (member.isExternal && member.email) {
        participantEmails.push(member.email);
        console.log(`[CREATE PANEL SCHEDULE] Added external panelist email: ${member.email} (${member.name})`);
      }
    }

    // Students
    if (panel.research?.students) {
      const students = Array.isArray(panel.research.students) ? panel.research.students : [panel.research.students];
      for (const student of students) {
        if (student.email) {
          participantEmails.push(student.email);
          console.log(`[CREATE PANEL SCHEDULE] Added student email: ${student.email} (${student.name})`);
        }
      }
    }

    // Adviser
    if (panel.research?.adviser?.email) {
      participantEmails.push(panel.research.adviser.email);
      console.log(`[CREATE PANEL SCHEDULE] Added adviser email: ${panel.research.adviser.email} (${panel.research.adviser.name})`);
    }

    // Remove duplicates
    const uniqueEmails = [...new Set(participantEmails)];
    console.log(`[CREATE PANEL SCHEDULE] Total unique participant emails collected: ${uniqueEmails.length}`, uniqueEmails);

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

    // Sync to Google Calendar if user has connected calendar
    let calendarEvent = null;
    const user = await User.findById(req.user.id);
    console.log('[CREATE PANEL SCHEDULE] Checking Google Calendar connection:', {
      userId: req.user.id,
      calendarConnected: user?.calendarConnected,
      hasAccessToken: !!user?.googleAccessToken,
      hasRefreshToken: !!user?.googleRefreshToken,
      tokenExpiry: user?.googleTokenExpiry
    });

    if (user?.calendarConnected && user?.googleAccessToken && user?.googleRefreshToken) {
      try {
        console.log('[CREATE PANEL SCHEDULE] Creating Google Calendar event for schedule:', schedule.title);
        console.log('[CREATE PANEL SCHEDULE] Schedule data:', {
          title: schedule.title,
          datetime: schedule.datetime,
          duration: schedule.duration,
          location: schedule.location,
          type: schedule.type,
          attendeeCount: uniqueEmails.length
        });

        const researchTitle = panel.research?.title || "Research";
        const scheduleTypeLabel = scheduleType === "proposal_defense" ? "Proposal Defense" : "Final Defense";

        // Create Google Calendar event (token refresh will happen automatically if needed)
        // All participants (students, panel members, adviser) will be added as attendees
        // Google Calendar will automatically send invitations to all attendees
        // The event will appear in their calendars once they accept the invitation
        console.log('[CREATE PANEL SCHEDULE] Creating Google Calendar event with attendees:', {
          attendeeCount: uniqueEmails.length,
          attendees: uniqueEmails,
          note: 'All attendees will receive Google Calendar invitations automatically'
        });

        calendarEvent = await createConsultationEvent(
          {
            title: schedule.title,
            description: schedule.description || `${scheduleTypeLabel} for ${researchTitle}`,
            datetime: schedule.datetime,
            duration: schedule.duration,
            location: schedule.location,
            type: schedule.type,
            researchTitle: researchTitle,
            attendeeEmails: uniqueEmails, // All participants will be added as attendees
          },
          user.googleAccessToken,
          user.googleRefreshToken,
          user._id.toString()
        );

        console.log('[CREATE PANEL SCHEDULE] ✅ Google Calendar event created successfully:', {
          eventId: calendarEvent.eventId,
          eventLink: calendarEvent.eventLink,
          meetLink: calendarEvent.meetLink,
          attendeeCount: uniqueEmails.length,
          note: 'All participants have been added as attendees and will receive calendar invitations'
        });

        // Update schedule with Google Calendar event details
        schedule.googleCalendarEventId = calendarEvent.eventId;
        schedule.googleCalendarLink = calendarEvent.eventLink;
        schedule.googleMeetLink = calendarEvent.meetLink;
        schedule.calendarSynced = true;
        await schedule.save();
        
        console.log('[CREATE PANEL SCHEDULE] Schedule updated with calendar sync status: true');
      } catch (calendarError) {
        console.error('[CREATE PANEL SCHEDULE] Error syncing to Google Calendar:', calendarError);
        console.error('[CREATE PANEL SCHEDULE] Error details:', {
          message: calendarError.message,
          code: calendarError.code,
          response: calendarError.response?.data,
          status: calendarError.response?.status,
          statusText: calendarError.response?.statusText,
          stack: calendarError.stack
        });
        // Don't fail creation if calendar sync fails - schedule is still created
        console.log('[CREATE PANEL SCHEDULE] Continuing without Google Calendar sync');
      }
    } else {
      console.log('[CREATE PANEL SCHEDULE] Google Calendar not connected or missing tokens:', {
        calendarConnected: user?.calendarConnected,
        hasAccessToken: !!user?.googleAccessToken,
        hasRefreshToken: !!user?.googleRefreshToken
      });
    }

    // Log activity
    await Activity.create({
      user: req.user.id,
      action: "create",
      entityType: "schedule",
      entityId: schedule._id,
      entityName: schedule.title,
      description: `Created and finalized panel defense schedule: ${schedule.title}${calendarEvent ? ' (synced to Google Calendar)' : ''}`,
      metadata: {
        panelId: panel._id,
        panelName: panel.name,
        scheduleType: schedule.type,
        datetime: schedule.datetime,
        location: schedule.location,
        duration: schedule.duration,
        calendarSynced: schedule.calendarSynced,
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
    const { datetime, duration, location, participants, type } = req.body;

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

    // Build base query - only check schedules of the same type
    // Consultation schedules don't conflict with defense schedules and vice versa
    const baseQuery = {
      status: { $in: ["scheduled", "confirmed", "finalized"] }, // Only check active schedules
      _id: { $ne: req.body.scheduleId } // Exclude current schedule if updating
    };

    // If type is specified, only check conflicts with schedules of the same type
    if (type) {
      baseQuery.type = type;
      console.log(`[Check Conflicts] Filtering by schedule type: ${type} (consultation schedules will be excluded)`);
    }

    // Check location conflicts (if location provided)
    if (location) {
      const locationConflicts = await Schedule.find({
        ...baseQuery,
        location: { $regex: new RegExp(location, 'i') },
        datetime: {
          $gte: new Date(startTime.getTime() - 30 * 60000), // 30 min buffer
          $lte: new Date(endTime.getTime() + 30 * 60000),
        },
      }).populate("participants.user", "name email");

      if (locationConflicts.length > 0) {
        console.log(`[Check Conflicts] Found ${locationConflicts.length} location conflict(s):`, 
          locationConflicts.map(s => ({ id: s._id, title: s.title, status: s.status, datetime: s.datetime }))
        );
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

      console.log(`[Check Conflicts] Checking conflicts for participants:`, participantIds);
      console.log(`[Check Conflicts] Schedule time range:`, {
        start: new Date(startTime.getTime() - 30 * 60000),
        end: new Date(endTime.getTime() + 30 * 60000),
        requestedStart: startTime,
        requestedEnd: endTime
      });

      if (participantIds.length > 0) {
        // First, let's check ALL schedules for these participants (for debugging)
        const allSchedulesForParticipants = await Schedule.find({
          "participants.user": { $in: participantIds }
        })
          .select("_id title status datetime participants")
          .populate("participants.user", "name email");
        
        console.log(`[Check Conflicts] ALL schedules for these participants (any status):`, 
          allSchedulesForParticipants.map(s => ({ 
            id: s._id.toString(), 
            title: s.title, 
            status: s.status, 
            datetime: s.datetime,
            participantCount: s.participants.length
          }))
        );

        // Now check only active schedules of the same type
        const participantConflictsQuery = {
          "participants.user": { $in: participantIds },
          datetime: {
            $gte: new Date(startTime.getTime() - 30 * 60000),
            $lte: new Date(endTime.getTime() + 30 * 60000),
          },
          ...baseQuery
        };

        const participantConflicts = await Schedule.find(participantConflictsQuery)
          .populate("participants.user", "name email")
          .populate("research", "title");

        console.log(`[Check Conflicts] Active schedules matching time range:`, 
          participantConflicts.map(s => ({ 
            id: s._id.toString(), 
            title: s.title, 
            status: s.status, 
            datetime: s.datetime,
            participants: s.participants.map(p => ({
              userId: p.user?._id?.toString() || 'N/A',
              name: p.user?.name || 'Unknown',
              email: p.user?.email || ''
            }))
          }))
        );

        if (participantConflicts.length > 0) {
          console.log(`[Check Conflicts] Found ${participantConflicts.length} participant conflict(s):`, 
            participantConflicts.map(s => ({ 
              id: s._id.toString(), 
              title: s.title, 
              status: s.status, 
              datetime: s.datetime,
              participants: s.participants.map(p => p.user?.name || 'Unknown')
            }))
          );
          conflicts.push({
            type: "participant",
            message: "One or more participants have conflicting schedules",
            conflicts: participantConflicts.map(s => ({
              id: s._id.toString(),
              title: s.title,
              datetime: s.datetime,
              duration: s.duration,
              status: s.status,
              participants: s.participants.map(p => ({
                name: p.user?.name || 'Unknown',
                email: p.user?.email || '',
              })),
            })),
          });
        } else {
          console.log(`[Check Conflicts] No active schedule conflicts found for participants`);
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
  const { datetime, duration, location, participants, type } = scheduleData;

  const scheduleDate = new Date(datetime);
  const scheduleDuration = duration || 60;
  const startTime = scheduleDate;
  const endTime = new Date(startTime.getTime() + scheduleDuration * 60000);

  const conflicts = [];

  // Build base query - only check schedules of the same type
  const baseQuery = {
    status: { $in: ["scheduled", "confirmed", "finalized"] }, // Only check active schedules
  };

  // If type is specified, only check conflicts with schedules of the same type
  if (type) {
    baseQuery.type = type;
  }

  // Check location conflicts
  if (location) {
    const locationConflicts = await Schedule.find({
      ...baseQuery,
      location: { $regex: new RegExp(location, 'i') },
      datetime: {
        $gte: new Date(startTime.getTime() - 30 * 60000),
        $lte: new Date(endTime.getTime() + 30 * 60000),
      },
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
        ...baseQuery,
        "participants.user": { $in: participantIds },
        datetime: {
          $gte: new Date(startTime.getTime() - 30 * 60000),
          $lte: new Date(endTime.getTime() + 30 * 60000),
        },
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

// Get available documents for program head
export const getAvailableDocuments = async (req, res) => {
  try {
    const documents = await Document.find({
      isActive: true,
      accessibleTo: { $in: ["program head"] },
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
    const hasAccess = document.accessibleTo.includes("program head") || 
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
    const hasAccess = document.accessibleTo.includes("program head") || 
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
