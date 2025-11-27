import Research from "../models/Research.js";
import User from "../models/User.js";
import Document from "../models/Document.js";
import Panel from "../models/Panel.js";
import Feedback from "../models/Feedback.js";
import Activity from "../models/Activity.js";
import Export from "../models/Export.js";
import mongoose from "mongoose";
import nodemailer from "nodemailer";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { uploadFileToDrive } from "../utils/googleDrive.js";
import { withTransaction, checkVersion, updateWithMVCC } from "../utils/mvcc.js";
const getDeanDriveFolderId = (category) => {
  if (category) {
    const envKey = `GOOGLE_DRIVE_DEAN_${category.toUpperCase()}_FOLDER_ID`;
    if (process.env[envKey]) {
      return process.env[envKey];
    }
  }
  return (
    process.env.GOOGLE_DRIVE_DEAN_DOCUMENTS_FOLDER_ID ||
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

//Helper function to log activity
const logActivity = async (userId, action, entityType, entityId, entityName, description, metadata = {}, req = null) => {
  try {
    console.log(' Logging activity:', { action, entityType, entityName, userId });
    
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
    
    console.log(' Activity logged successfully:', activity._id);
  } catch (error) {
    console.error('Error logging activity:', error);
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

const FIELD_LABELS = {
  title: "Research Title",
  students: "Students",
  adviser: "Adviser",
  status: "Status",
  stage: "Current Stage",
  progress: "Progress (%)",
  academicYear: "Academic Year",
  panelMembers: "Panel Members",
  submissionsPerStage: "Submissions per Stage",
  totalSubmissions: "Total Submissions",
  createdAt: "Created Date",
  updatedAt: "Last Updated"
};

const DEFAULT_EXPORT_FIELDS = [
  "title",
  "students",
  "adviser",
  "status",
  "stage",
  "progress",
  "panelMembers",
  "submissionsPerStage",
  "totalSubmissions",
  "createdAt",
  "updatedAt"
];

const STAGE_LABELS = {
  proposal: "Proposal",
  chapter1: "Chapter 1 - Introduction",
  chapter2: "Chapter 2 - Literature Review",
  chapter3: "Chapter 3 - Methodology",
  defense: "Defense",
  final: "Final Submission"
};

const sanitizeSelectedFields = (fields = []) => {
  const allowedFields = Object.keys(FIELD_LABELS);
  const normalized = Array.isArray(fields) && fields.length
    ? fields.filter((field) => allowedFields.includes(field))
    : [...DEFAULT_EXPORT_FIELDS];

  if (!normalized.includes("title")) {
    normalized.unshift("title");
  }

  return Array.from(new Set(normalized));
};

const buildResearchFilterQuery = (filters = {}) => {
  const query = {};
  if (filters.status && filters.status !== "all") {
    query.status = filters.status;
  }
  if (filters.stage && filters.stage !== "all") {
    query.stage = filters.stage;
  }
  if (filters.adviserId && mongoose.Types.ObjectId.isValid(filters.adviserId)) {
    query.adviser = filters.adviserId;
  }

  if ((filters.startDate && !isNaN(new Date(filters.startDate))) ||
      (filters.endDate && !isNaN(new Date(filters.endDate)))) {
    query.createdAt = {};
    if (filters.startDate) {
      query.createdAt.$gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }

  if (filters.academicYear && filters.academicYear !== "all") {
    const year = Number(filters.academicYear);
    if (!Number.isNaN(year)) {
      const startOfYear = new Date(year, 0, 1);
      const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);
      query.createdAt = query.createdAt || {};
      query.createdAt.$gte = query.createdAt.$gte && query.createdAt.$gte > startOfYear ? query.createdAt.$gte : startOfYear;
      query.createdAt.$lte = query.createdAt.$lte && query.createdAt.$lte < endOfYear ? query.createdAt.$lte : endOfYear;
    }
  }

  return query;
};

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

const formatFieldValue = (row, field) => {
  switch (field) {
    case "title":
      return row.title || "Untitled Research";
    case "students":
      return row.students?.length
        ? row.students.map((student) => `${student.name}${student.email ? ` (${student.email})` : ""}`).join(", ")
        : "N/A";
    case "adviser":
      return row.adviser
        ? `${row.adviser.name || "N/A"}${row.adviser.email ? ` (${row.adviser.email})` : ""}`
        : "N/A";
    case "status":
      return row.status ? row.status.toUpperCase() : "N/A";
    case "stage":
      return STAGE_LABELS[row.stage] || row.stage || "N/A";
    case "progress":
      return `${row.progress ?? 0}%`;
    case "panelMembers":
      return row.panelMembers?.length
        ? row.panelMembers
            .map((member) => `${member.name || "N/A"}${member.role ? ` - ${member.role}` : ""}${member.isExternal ? " (External)" : ""}`)
            .join(", ")
        : "No panel assigned";
    case "submissionsPerStage":
      return row.submissionsPerStage && Object.keys(row.submissionsPerStage).length
        ? Object.entries(row.submissionsPerStage)
            .map(([stage, count]) => `${STAGE_LABELS[stage] || stage}: ${count}`)
            .join(", ")
        : "No submissions yet";
    case "totalSubmissions":
      return row.totalSubmissions || 0;
    case "createdAt":
      return formatDateValue(row.createdAt);
    case "updatedAt":
      return formatDateValue(row.updatedAt, true);
    case "academicYear":
      return row.academicYear || "N/A";
    default:
      return row[field] ?? "N/A";
  }
};

const addPageNumbers = (doc) => {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    const pageNumber = i + 1;
    const totalPages = range.count;
    const pageNumberText = `Page ${pageNumber} of ${totalPages}`;
    
    // Position at bottom center of page, with proper margin
    const yPosition = doc.page.height - doc.page.margins.bottom - 20;
    doc.fontSize(9)
      .fillColor("#6B7280")
      .text(pageNumberText, doc.page.margins.left, yPosition, {
        align: "center",
        width: doc.page.width - (doc.page.margins.left + doc.page.margins.right)
      });
  }
};

const generatePdfBuffer = async (rows, { selectedFields, generatedBy, filtersSummary }) => new Promise((resolve, reject) => {
  const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
  const chunks = [];

  doc.on("data", (chunk) => chunks.push(chunk));
  doc.on("end", () => resolve(Buffer.concat(chunks)));
  doc.on("error", reject);

  // Try to add logo if it exists
  // Get the project root (go up from backend/controllers to project root)
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
    // Also try from process.cwd() in case server runs from project root
    path.join(process.cwd(), 'frontend', 'public', 'logo.jpg'),
    path.join(process.cwd(), 'frontend', 'public', 'logo.png')
  ];
  
  let logoAdded = false;
  for (const logoPath of logoPaths) {
    if (fs.existsSync(logoPath)) {
      try {
        const logoWidth = 70;
        const logoHeight = 70;
        const logoX = (doc.page.width - logoWidth) / 2;
        doc.image(logoPath, logoX, 50, { width: logoWidth, height: logoHeight });
        doc.y = 50 + logoHeight + 20; // Position after logo
        logoAdded = true;
        console.log('Logo added to PDF:', logoPath);
        break;
      } catch (logoError) {
        console.log('Error loading logo in PDF:', logoError.message);
      }
    }
  }
  
  if (!logoAdded) {
    doc.y = 50; // Start position if no logo
  }

  // University Header - Ensure font is set
  doc.font('Helvetica-Bold');
  doc.fontSize(20);
  doc.fillColor("#7C1D23");
  doc.text("BUKIDNON STATE UNIVERSITY", { align: "center" });
  doc.moveDown(0.3);
  
  doc.font('Helvetica');
  doc.fontSize(14);
  doc.fillColor("#374151");
  doc.text("College of Public Administration and Governance", { align: "center" });
  doc.moveDown(0.5);
  
  // Horizontal line
  doc.moveTo(doc.page.margins.left, doc.y)
     .lineTo(doc.page.width - doc.page.margins.right, doc.y)
     .strokeColor("#7C1D23")
     .lineWidth(2)
     .stroke();
  
  doc.moveDown(0.8);
  
  // Report Title
  doc.font('Helvetica-Bold');
  doc.fontSize(16);
  doc.fillColor("#111827");
  doc.text("RESEARCH RECORDS REPORT", { align: "center" });
  doc.moveDown(0.5);
  
  // Report Details Box
  const boxY = doc.y;
  doc.rect(doc.page.margins.left, boxY, doc.page.width - (doc.page.margins.left + doc.page.margins.right), 60)
     .fillColor("#F9FAFB")
     .fill()
     .strokeColor("#E5E7EB")
     .lineWidth(1)
     .stroke();
  
  doc.y = boxY + 10;
  doc.fontSize(10).fillColor("#374151");
  doc.text(`Generated by: ${generatedBy || "Dean"}`, doc.page.margins.left + 10);
  doc.moveDown(0.3);
  doc.text(`Date Generated: ${formatDateValue(new Date(), true)}`, doc.page.margins.left + 10);
  doc.moveDown(0.3);
  doc.text(`Total Records: ${rows.length}`, doc.page.margins.left + 10);
  
  if (filtersSummary) {
    doc.moveDown(0.3);
    doc.text(`Applied Filters: ${filtersSummary}`, doc.page.margins.left + 10);
  }
  
  doc.y = boxY + 70;
  doc.moveDown(0.5);

  // Research Records Section
  rows.forEach((row, index) => {
    // Check if we need a new page
    if (doc.y >= doc.page.height - doc.page.margins.bottom - 120) {
      doc.addPage();
      // Add header on new page
      doc.font('Helvetica-Bold');
      doc.fontSize(12);
      doc.fillColor("#7C1D23");
      doc.text("BUKIDNON STATE UNIVERSITY - Research Records Report", { align: "center" });
      doc.moveDown(0.3);
      doc.moveTo(doc.page.margins.left, doc.y)
         .lineTo(doc.page.width - doc.page.margins.right, doc.y)
         .strokeColor("#7C1D23")
         .lineWidth(1)
         .stroke();
      doc.moveDown(0.5);
    }

    // Research Title with background
    const titleY = doc.y;
    doc.rect(doc.page.margins.left, titleY, doc.page.width - (doc.page.margins.left + doc.page.margins.right), 25)
       .fillColor("#7C1D23")
       .fill();
    
    doc.fontSize(12).fillColor("#FFFFFF").text(`${index + 1}. ${row.title || "Untitled Research"}`, {
      x: doc.page.margins.left + 10,
      y: titleY + 7,
      width: doc.page.width - (doc.page.margins.left + doc.page.margins.right + 20)
    });
    
    doc.y = titleY + 30;
    doc.moveDown(0.2);

    // Research Details Box
    const detailsY = doc.y;
    const fieldCount = selectedFields.filter(f => f !== "title").length;
    const detailsHeight = fieldCount * 15 + 10;
    
    doc.rect(doc.page.margins.left, detailsY, doc.page.width - (doc.page.margins.left + doc.page.margins.right), detailsHeight)
       .fillColor("#F9FAFB")
       .fill()
       .strokeColor("#E5E7EB")
       .lineWidth(0.5)
       .stroke();

    doc.y = detailsY + 8;
    selectedFields
      .filter((field) => field !== "title")
      .forEach((field) => {
        const label = FIELD_LABELS[field];
        const value = formatFieldValue(row, field);
        doc.fontSize(9).fillColor("#6B7280").text(`${label}:`, { continued: true });
        doc.fontSize(9).fillColor("#111827").text(` ${value || "N/A"}`);
        doc.moveDown(0.4);
      });

    doc.y = detailsY + detailsHeight;
    doc.moveDown(0.5);
  });

  doc.moveDown(1);
  
  // Footer
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
  doc.fontSize(8).fillColor("#9CA3AF").text(
    "Bukidnon State University - College of Public Administration and Governance",
    { align: "center" }
  );

  addPageNumbers(doc);
  doc.end();
});

const generateExcelBuffer = async (rows, { selectedFields, generatedBy, filtersSummary }) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = generatedBy || "Dean";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Research Records", {
    properties: { defaultRowHeight: 20 },
    pageSetup: { 
      fitToPage: true, 
      orientation: "landscape",
      margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 }
    }
  });

  // Set column structure first (needed for proper logo centering)
  worksheet.columns = selectedFields.map((field) => ({
    header: FIELD_LABELS[field],
    key: field,
    width: Math.max(FIELD_LABELS[field].length + 8, 25),
    style: { alignment: { vertical: "middle", wrapText: true } }
  }));

  // Try to add logo - PROPERLY CENTERED
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
  const logoSize = 80;
  
  for (const logoPath of logoPaths) {
    if (fs.existsSync(logoPath)) {
      try {
        const imageId = workbook.addImage({
          filename: logoPath,
          extension: path.extname(logoPath).substring(1).toLowerCase()
        });
        
        // Properly center the logo: calculate center column
        // Logo spans 2 columns, so start at (totalColumns - 2) / 2
        const totalCols = selectedFields.length;
        const logoColSpan = 2; // Logo spans 2 columns
        const startCol = Math.max(0, Math.floor((totalCols - logoColSpan) / 2));
        
        // Add logo centered in row 1
        worksheet.addImage(imageId, {
          tl: { col: startCol, row: 0 },
          ext: { width: logoSize, height: logoSize }
        });
        
        worksheet.getRow(1).height = logoSize + 10; // Make row tall enough for logo
        logoRowOffset = 1;
        logoAdded = true;
        console.log(`Logo added to Excel (centered at column ${startCol} of ${totalCols}):`, logoPath);
        break;
      } catch (logoError) {
        console.log('Error loading logo in Excel:', logoError.message);
      }
    }
  }

  // University Header - Start after logo row
  const headerStartRow = 1 + logoRowOffset;
  worksheet.mergeCells(headerStartRow, 1, headerStartRow, selectedFields.length);
  const headerCell = worksheet.getCell(`A${headerStartRow}`);
  headerCell.value = "BUKIDNON STATE UNIVERSITY";
  headerCell.font = { size: 18, bold: true, color: { argb: "FF7C1D23" } };
  headerCell.alignment = { vertical: "middle", horizontal: "center" };
  headerCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF9FAFB' }
  };
  worksheet.getRow(headerStartRow).height = 28;

  const collegeRow = headerStartRow + 1;
  worksheet.mergeCells(collegeRow, 1, collegeRow, selectedFields.length);
  const collegeCell = worksheet.getCell(`A${collegeRow}`);
  collegeCell.value = "College of Public Administration and Governance";
  collegeCell.font = { size: 14, color: { argb: "FF374151" } };
  collegeCell.alignment = { vertical: "middle", horizontal: "center" };
  collegeCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF9FAFB' }
  };
  worksheet.getRow(collegeRow).height = 22;

  // Divider line (using border on next row)
  const dividerRow = collegeRow + 1;
  worksheet.mergeCells(dividerRow, 1, dividerRow, selectedFields.length);
  const dividerCell = worksheet.getCell(`A${dividerRow}`);
  dividerCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF7C1D23' }
  };
  worksheet.getRow(dividerRow).height = 3;

  const reportTitleRow = dividerRow + 1;
  worksheet.mergeCells(reportTitleRow, 1, reportTitleRow, selectedFields.length);
  const titleCell = worksheet.getCell(`A${reportTitleRow}`);
  titleCell.value = "RESEARCH RECORDS REPORT";
  titleCell.font = { size: 16, bold: true, color: { argb: "FF111827" } };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  worksheet.getRow(reportTitleRow).height = 24;

  // Report Details Box
  const detailsRow = reportTitleRow + 1;
  worksheet.mergeCells(detailsRow, 1, detailsRow, selectedFields.length);
  const detailsCell = worksheet.getCell(`A${detailsRow}`);
  detailsCell.value = `Generated by: ${generatedBy || "Dean"} | Date Generated: ${formatDateValue(new Date(), true)} | Total Records: ${rows.length}`;
  detailsCell.font = { size: 10, color: { argb: "FF6B7280" } };
  detailsCell.alignment = { vertical: "middle", horizontal: "center" };
  detailsCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF3F4F6' }
  };
  detailsCell.border = {
    top: { style: "thin", color: { argb: "FFE5E7EB" } },
    bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
    left: { style: "thin", color: { argb: "FFE5E7EB" } },
    right: { style: "thin", color: { argb: "FFE5E7EB" } }
  };
  worksheet.getRow(detailsRow).height = 20;

  let filterRow = null;
  if (filtersSummary) {
    filterRow = detailsRow + 1;
    worksheet.mergeCells(filterRow, 1, filterRow, selectedFields.length);
    const filterCell = worksheet.getCell(`A${filterRow}`);
    filterCell.value = `Applied Filters: ${filtersSummary}`;
    filterCell.font = { size: 9, italic: true, color: { argb: "FF9CA3AF" } };
    filterCell.alignment = { vertical: "middle", horizontal: "center" };
    filterCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF3F4F6' }
    };
    filterCell.border = {
      top: { style: "thin", color: { argb: "FFE5E7EB" } },
      bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
      left: { style: "thin", color: { argb: "FFE5E7EB" } },
      right: { style: "thin", color: { argb: "FFE5E7EB" } }
    };
    worksheet.getRow(filterRow).height = 18;
  }

  // Empty row for spacing
  const spacingRow = filterRow ? filterRow + 1 : detailsRow + 1;
  worksheet.getRow(spacingRow).height = 5;

  // Determine header row number
  const headerRowNum = spacingRow + 1;

  // Style header row
  const headerRow = worksheet.getRow(headerRowNum);
  headerRow.font = { 
    bold: true, 
    size: 11,
    color: { argb: "FFFFFFFF" } 
  };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF7C1D23' }
  };
  headerRow.alignment = { 
    horizontal: "center", 
    vertical: "middle",
    wrapText: true
  };
  headerRow.height = 28;
  headerRow.border = {
    top: { style: "medium", color: { argb: "FF7C1D23" } },
    bottom: { style: "medium", color: { argb: "FF7C1D23" } },
    left: { style: "thin", color: { argb: "FFFFFFFF" } },
    right: { style: "thin", color: { argb: "FFFFFFFF" } }
  };

  // Style each header cell individually for better borders
  selectedFields.forEach((field, colIndex) => {
    const cell = worksheet.getCell(headerRowNum, colIndex + 1);
    cell.border = {
      top: { style: "medium", color: { argb: "FF7C1D23" } },
      bottom: { style: "medium", color: { argb: "FF7C1D23" } },
      left: { style: "thin", color: { argb: "FFFFFFFF" } },
      right: { style: "thin", color: { argb: "FFFFFFFF" } }
    };
  });

  // Add data rows
  rows.forEach((row, index) => {
    const record = {};
    selectedFields.forEach((field) => {
      record[field] = formatFieldValue(row, field);
    });
    const dataRow = worksheet.addRow(record);
    
    // Alternate row colors for better readability
    if (index % 2 === 0) {
      dataRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFFFF' }
      };
    } else {
      dataRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF9FAFB' }
      };
    }
    
    dataRow.alignment = { 
      vertical: "middle",
      wrapText: true,
      horizontal: "left"
    };
    dataRow.height = 22;
    
    // Add borders to each cell
    selectedFields.forEach((field, colIndex) => {
      const cell = dataRow.getCell(colIndex + 1);
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } }
      };
    });
  });

  // Apply auto filter
  worksheet.autoFilter = {
    from: { row: headerRowNum, column: 1 },
    to: { row: headerRowNum + rows.length, column: selectedFields.length }
  };

  // Freeze header row for better scrolling
  worksheet.views = [{
    state: 'frozen',
    ySplit: headerRowNum,
    activeCell: `A${headerRowNum + 1}`,
    showGridLines: true
  }];

  return workbook.xlsx.writeBuffer();
};

const buildPanelMap = async (researchDocs) => {
  const ids = researchDocs.map((doc) => doc._id);
  if (!ids.length) return new Map();

  const panels = await Panel.find({ research: { $in: ids } })
    .populate("members.faculty", "name email");

  const panelMap = new Map();
  panels.forEach((panel) => {
    panelMap.set(panel.research.toString(), panel);
  });
  return panelMap;
};

const transformResearchForExport = (researchDoc, panelDoc) => {
  const formCounts = (researchDoc.forms || []).reduce((acc, form) => {
    const type = form.type || "other";
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const panelMembers = panelDoc
    ? panelDoc.members
        .filter((member) => member.isSelected !== false)
        .map((member) => ({
          name: member.isExternal ? member.name : member.faculty?.name,
          email: member.isExternal ? member.email : member.faculty?.email,
          role: member.role,
          isExternal: member.isExternal
        }))
    : [];

  return {
    id: researchDoc._id.toString(),
    title: researchDoc.title,
    status: researchDoc.status,
    stage: researchDoc.stage,
    progress: researchDoc.progress ?? 0,
    adviser: researchDoc.adviser ? { name: researchDoc.adviser.name, email: researchDoc.adviser.email } : null,
    students: (researchDoc.students || []).map((student) => ({ name: student.name, email: student.email })),
    panelMembers,
    submissionsPerStage: formCounts,
    totalSubmissions: researchDoc.forms?.length || 0,
    createdAt: researchDoc.createdAt,
    updatedAt: researchDoc.updatedAt,
    academicYear: researchDoc.createdAt ? new Date(researchDoc.createdAt).getFullYear() : "N/A"
  };
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
    const { message, type = 'feedback' } = req.body;
    
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

    await logActivity(req.user.id, 'add_remark', 'research', researchId, research.title, 
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
      .populate("panel", "name email")
      .sort({ createdAt: -1 });
    
    // Fetch Panel data to include external panelists
    const Panel = (await import("../models/Panel.js")).default;
    const researchWithPanels = await Promise.all(
      research.map(async (r) => {
        const researchObj = r.toObject();
        
        // Find the Panel document for this research
        const panelDoc = await Panel.findOne({ research: r._id })
          .populate("members.faculty", "name email");
        
        if (panelDoc) {
          // Combine faculty and external panelists
          researchObj.panelMembers = panelDoc.members
            .filter(m => m.isSelected) // Only include selected members
            .map(m => {
              if (m.isExternal) {
                return {
                  name: m.name,
                  email: m.email,
                  role: m.role,
                  isExternal: true
                };
              } else {
                return {
                  name: m.faculty?.name || 'N/A',
                  email: m.faculty?.email || 'N/A',
                  role: m.role,
                  isExternal: false
                };
              }
            });
        } else {
          researchObj.panelMembers = [];
        }
        
        return researchObj;
      })
    );
    
    res.json(researchWithPanels);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const exportResearchRecords = async (req, res) => {
  let tempDirPath = null;
  try {
    console.log('[Export] Starting export - Format:', req.body?.format || 'pdf');
    const { format = "pdf", filters = {}, fields = [] } = req.body || {};
    const normalizedFormat = typeof format === "string" ? format.toLowerCase() : "pdf";
    if (!["pdf", "xlsx"].includes(normalizedFormat)) {
      return res.status(400).json({ message: "Invalid export format. Supported formats: pdf, xlsx." });
    }

    if (filters.startDate && filters.endDate && new Date(filters.startDate) > new Date(filters.endDate)) {
      return res.status(400).json({ message: "Start date cannot be later than end date." });
    }

    const selectedFields = sanitizeSelectedFields(fields);
    const query = buildResearchFilterQuery(filters);

    if (filters.adviserEmail && !query.adviser) {
      const adviser = await User.findOne({ email: filters.adviserEmail }).select("_id");
      if (!adviser) {
        return res.status(400).json({ message: "No adviser found with the provided email." });
      }
      query.adviser = adviser._id;
    }

    const researchDocs = await Research.find(query)
      .populate("students", "name email")
      .populate("adviser", "name email")
      .sort({ createdAt: -1 });

    const panelMap = await buildPanelMap(researchDocs);
    const rows = researchDocs.map((doc) => transformResearchForExport(doc, panelMap.get(doc._id.toString())));

    const user = await User.findById(req.user.id);
    if (!user || !user.driveAccessToken) {
      return res.status(400).json({
        message: "Please connect your Google Drive account in Settings before exporting research records."
      });
    }

    const generatedBy = user.name || user.email || "Dean";
    const filtersSummary = Object.entries(filters || {})
      .filter(([, value]) => value && value !== "all")
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ");

    let fileBuffer;
    let mimeType;
    let extension;

    if (normalizedFormat === "pdf") {
      fileBuffer = await generatePdfBuffer(rows, {
        selectedFields,
        generatedBy,
        filtersSummary: filtersSummary || ""
      });
      mimeType = "application/pdf";
      extension = "pdf";
    } else {
      fileBuffer = await generateExcelBuffer(rows, {
        selectedFields,
        generatedBy,
        filtersSummary: filtersSummary || ""
      });
      mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      extension = "xlsx";
    }

    tempDirPath = await fs.promises.mkdtemp(path.join(os.tmpdir(), "research-export-"));
    const fileName = `research-export-${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`;
    const tempFilePath = path.join(tempDirPath, fileName);
    await fs.promises.writeFile(tempFilePath, fileBuffer);

    const driveTokens = buildDriveTokens(user);
    if (!driveTokens?.access_token) {
      throw new Error("Unable to read Google Drive credentials. Please reconnect your Drive account.");
    }

    const reportsFolderId =
      process.env.GOOGLE_DRIVE_REPORTS_FOLDER_ID ||
      process.env.GOOGLE_DRIVE_DEAN_REPORTS_FOLDER_ID ||
      getDeanDriveFolderId("reports");

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
    const exportRecord = new Export({
      exportedBy: req.user.id,
      format: normalizedFormat,
      recordCount: rows.length,
      selectedFields: selectedFields,
      filters: {
        status: filters.status,
        stage: filters.stage,
        adviserId: filters.adviserId,
        startDate: filters.startDate ? new Date(filters.startDate) : undefined,
        endDate: filters.endDate ? new Date(filters.endDate) : undefined,
        academicYear: filters.academicYear,
      },
      driveFileId: driveFile?.id,
      driveFileLink: driveFile?.webViewLink,
      driveFileName: driveFile?.name,
      driveFolderId: reportsFolderId,
      fileName: fileName,
      fileSize: fileBuffer.length,
      mimeType: mimeType,
      status: "completed",
    });

    await exportRecord.save();

    await logActivity(
      req.user.id,
      "export",
      "research",
      exportRecord._id,
      "Research Records Export",
      `Exported ${rows.length} research record(s) as ${normalizedFormat.toUpperCase()}`,
      {
        format: normalizedFormat,
        recordCount: rows.length,
        fields: selectedFields,
        filters: filtersSummary || null,
        driveFileId: driveFile?.id,
        exportId: exportRecord._id
      },
      req
    );

    res.json({
      message: `Research records exported as ${normalizedFormat.toUpperCase()} and saved to your Google Drive Reports folder.`,
      format: normalizedFormat,
      recordCount: rows.length,
      fields: selectedFields,
      driveFile,
      filters: filtersSummary || null,
      exportId: exportRecord._id
    });
  } catch (error) {
    console.error("Error exporting research records:", error);
    console.error("Error stack:", error.stack);
    console.error("Error details:", {
      message: error.message,
      name: error.name,
      code: error.code
    });

    // Save failed export record to MongoDB
    try {
      const failedExport = new Export({
        exportedBy: req.user.id,
        format: req.body?.format || "pdf",
        recordCount: 0,
        selectedFields: req.body?.fields || [],
        filters: req.body?.filters || {},
        status: "failed",
        errorMessage: error.message,
        fileName: `failed-export-${new Date().toISOString().replace(/[:.]/g, "-")}`,
      });
      await failedExport.save();
    } catch (saveError) {
      console.error("Failed to save export record:", saveError);
    }

    // Provide user-friendly error messages
    let userMessage = "Failed to export research records. Please try again.";
    
    const errorMsg = (error.message || error.toString() || "").toLowerCase();
    
    if (errorMsg.includes("google drive") || errorMsg.includes("drive")) {
      userMessage = "Unable to upload to Google Drive. Please check your Google Drive connection in Settings.";
    } else if (errorMsg.includes("folder") || errorMsg.includes("reports folder")) {
      userMessage = "Google Drive Reports folder is not configured. Please contact the administrator.";
    } else if (errorMsg.includes("credentials") || errorMsg.includes("token")) {
      userMessage = "Google Drive authentication error. Please reconnect your Google Drive account in Settings.";
    }

    res.status(500).json({ 
      message: userMessage
    });
  } finally {
    if (tempDirPath) {
      try {
        await fs.promises.rm(tempDirPath, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error("Failed to clean up temporary export directory:", cleanupError);
      }
    }
  }
};

// Bulk Archive Research Records
export const bulkArchiveResearch = async (req, res) => {
  try {
    const { researchIds } = req.body;
    
    if (!researchIds || !Array.isArray(researchIds) || researchIds.length === 0) {
      return res.status(400).json({ message: "Please select at least one research record to archive." });
    }

    const researchDocs = await Research.find({ _id: { $in: researchIds } });
    
    if (researchDocs.length !== researchIds.length) {
      return res.status(404).json({ message: "Some research records were not found." });
    }

    // Update each research to preserve original status
    const updatePromises = researchDocs.map(research => 
      Research.findByIdAndUpdate(
        research._id,
        {
          status: "archived",
          archivedAt: new Date(),
          archivedBy: req.user.id,
          statusBeforeArchive: research.status // Preserve original status
        },
        { new: true }
      )
    );

    await Promise.all(updatePromises);
    const updateResults = { modifiedCount: researchDocs.length };

    // Log activity for each archived record
    for (const research of researchDocs) {
      await logActivity(
        req.user.id,
        "archive",
        "research",
        research._id,
        research.title,
        `Archived research: ${research.title}`,
        { previousStatus: research.status },
        req
      );
    }

    res.json({
      message: `${updateResults.modifiedCount} research record(s) archived successfully.`,
      count: updateResults.modifiedCount
    });
  } catch (error) {
    console.error("Error in bulk archive:", error);
    res.status(500).json({ message: error.message || "Failed to archive research records." });
  }
};

// Bulk Approve Research Records
export const bulkApproveResearch = async (req, res) => {
  try {
    const { researchIds } = req.body;
    
    if (!researchIds || !Array.isArray(researchIds) || researchIds.length === 0) {
      return res.status(400).json({ message: "Please select at least one research record to approve." });
    }

    const researchDocs = await Research.find({ 
      _id: { $in: researchIds },
      status: "pending"
    }).populate("students", "name email").populate("adviser", "name email");
    
    if (researchDocs.length === 0) {
      return res.status(400).json({ message: "No pending research records found in the selection." });
    }

    const updateResults = await Research.updateMany(
      { _id: { $in: researchDocs.map(r => r._id) } },
      {
        status: "approved",
        approvedAt: new Date(),
        approvedBy: req.user.id
      }
    );

    // Send notification emails and log activity
    for (const research of researchDocs) {
      // Log activity
      await logActivity(
        req.user.id,
        "approve",
        "research",
        research._id,
        research.title,
        `Approved research: ${research.title}`,
        { previousStatus: research.status },
        req
      );

      // Send notification emails
      try {
        const students = research.students || [];
        const adviser = research.adviser;

        // Email students
        for (const student of students) {
          if (student.email) {
            await sendEmailNotification(
              student.email,
              "Research Approved",
              `Your research "${research.title}" has been approved by the Dean.`,
              `<p>Your research "<strong>${research.title}</strong>" has been approved by the Dean.</p>`
            );
          }
        }

        // Email adviser
        if (adviser && adviser.email) {
          await sendEmailNotification(
            adviser.email,
            "Research Approved",
            `The research "${research.title}" has been approved by the Dean.`,
            `<p>The research "<strong>${research.title}</strong>" has been approved by the Dean.</p>`
          );
        }
      } catch (emailError) {
        console.error(`Failed to send approval email for research ${research._id}:`, emailError);
        // Continue even if email fails
      }
    }

    res.json({
      message: `${updateResults.modifiedCount} research record(s) approved successfully.`,
      count: updateResults.modifiedCount
    });
  } catch (error) {
    console.error("Error in bulk approve:", error);
    res.status(500).json({ message: error.message || "Failed to approve research records." });
  }
};

// Bulk Share Research Records
export const bulkShareResearch = async (req, res) => {
  try {
    const { researchIds } = req.body;
    
    if (!researchIds || !Array.isArray(researchIds) || researchIds.length === 0) {
      return res.status(400).json({ message: "Please select at least one research record to share." });
    }

    const researchDocs = await Research.find({ _id: { $in: researchIds } });
    
    if (researchDocs.length !== researchIds.length) {
      return res.status(404).json({ message: "Some research records were not found." });
    }

    const updateResults = await Research.updateMany(
      { _id: { $in: researchIds } },
      {
        sharedWithDean: true,
        sharedAt: new Date(),
        sharedBy: req.user.id
      }
    );

    // Log activity for each shared record
    for (const research of researchDocs) {
      await logActivity(
        req.user.id,
        "share",
        "research",
        research._id,
        research.title,
        `Shared research with Dean: ${research.title}`,
        {},
        req
      );
    }

    res.json({
      message: `${updateResults.modifiedCount} research record(s) shared successfully.`,
      count: updateResults.modifiedCount
    });
  } catch (error) {
    console.error("Error in bulk share:", error);
    res.status(500).json({ message: error.message || "Failed to share research records." });
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

    console.log(' Research found:', research.title, 'Current status:', research.status);
    console.log(' Status before archive field:', research.statusBeforeArchive);

    // Toggle archive status
    let newStatus;
    const updateData = {};
    
    if (research.status === 'archived') {
      // Unarchiving - restore original status
      newStatus = research.statusBeforeArchive || 'approved';
      updateData.status = newStatus;
      updateData.archivedAt = null;
      updateData.archivedBy = null;
      updateData.statusBeforeArchive = null; // Clear the preserved status
      console.log(' Unarchiving research - restoring status to:', newStatus);
    } else {
      // Archiving - preserve current status
      newStatus = 'archived';
      updateData.status = newStatus;
      updateData.archivedAt = new Date();
      updateData.archivedBy = req.user.id;
      updateData.statusBeforeArchive = research.status; // Preserve original status before archiving
      console.log(' Archiving research - current status:', research.status);
      console.log(' Archiving research - preserving as statusBeforeArchive:', research.status);
    }

    const updatedResearch = await Research.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    console.log(' Research updated - new status:', updatedResearch.status);
    console.log(' Research updated - statusBeforeArchive:', updatedResearch.statusBeforeArchive);
    console.log(' Research updated, now logging activity...');
    
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

    console.log(' Archive research completed');

    res.json({ 
      message: `Research ${newStatus === 'archived' ? 'archived' : 'unarchived'} successfully`, 
      research: updatedResearch 
    });
  } catch (error) {
    console.error('Error in archiveResearch:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get monitoring and evaluation data
export const getMonitoringData = async (req, res) => {
  try {
    const { search, status } = req.query;
    
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

    const research = await Research.find(query)
      .populate("students", "name email")
      .populate("adviser", "name email")
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
      
    const parsedAccessibleTo = req.body.accessibleTo ? JSON.parse(req.body.accessibleTo) : ["dean"];
    console.log('Document accessibleTo from request:', req.body.accessibleTo);
    console.log('Parsed accessibleTo:', parsedAccessibleTo);
    
    const uploader = await User.findById(req.user.id);
    if (!uploader || !uploader.driveAccessToken) {
      return res.status(400).json({
        message: "Please connect your Google Drive account before uploading documents.",
      });
    }

    const driveTokens = buildDriveTokens(uploader);
    const driveFolderId = getDeanDriveFolderId(req.body.category);
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
      console.error("Error uploading dean document to Google Drive:", driveError);
      return res.status(500).json({
        message:
          "Failed to upload the document to Google Drive. Please reconnect your Drive account and try again.",
      });
    }
    
    const document = new Document({
      title: req.body.title,
      description: req.body.description,
      category: req.body.category,
      filename: req.file.originalname,
      filepath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedBy: req.user.id,
      accessibleTo: parsedAccessibleTo,
      driveFileId: driveFileData?.id,
      driveFileLink: driveFileData?.webViewLink,
      driveFileName: driveFileData?.name,
      driveMimeType: driveFileData?.mimeType,
      driveFolderId: driveFolderId || null,
      storageLocation: driveFileData ? "local+google-drive" : "local",
    });

    await document.save();
    console.log('Document saved successfully:', document._id);
    console.log('Document accessibleTo saved as:', document.accessibleTo);
    
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

// Permanently delete archived research
export const deleteResearch = async (req, res) => {
  try {
    const research = await Research.findById(req.params.id);
    
    if (!research) {
      return res.status(404).json({ message: "Research not found" });
    }
    
    // Only allow deletion if archived
    if (research.status !== 'archived') {
      return res.status(400).json({ 
        message: "Only archived research can be permanently deleted. Please archive it first." 
      });
    }
    
    // Log activity before deletion
    await logActivity(
      req.user.id,
      'delete',
      'research',
      req.params.id,
      research.title,
      `Permanently deleted research: ${research.title}`,
      { 
        title: research.title,
        adviser: research.adviser?.name,
        archivedAt: research.archivedAt 
      },
      req
    );
    
    // Delete the research
    await Research.findByIdAndDelete(req.params.id);
    
    res.json({ message: "Research permanently deleted" });
  } catch (error) {
    console.error('Error deleting research:', error);
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

// Helper function to send email
const sendEmailNotification = async (to, subject, text, html) => {
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
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      text,
      html,
    });
    return true;
  } catch (error) {
    console.error("Email error:", error);
    return false;
  }
};

// Send email
export const sendEmail = async (req, res) => {
  try {
    const { to, subject, text } = req.body;
    const success = await sendEmailNotification(to, subject, text);
    if (success) {
      res.json({ message: "Email sent successfully" });
    } else {
      res.status(500).json({ message: "Failed to send email" });
    }
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
      newUser._id,
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