import Research from "../models/Research.js";
import User from "../models/User.js";
import Activity from "../models/Activity.js";
import ComplianceForm from "../models/ComplianceForm.js";
import Schedule from "../models/Schedule.js";
import Panel from "../models/Panel.js";
import mongoose from "mongoose";
import {
  createSpreadsheet,
  writeToSheet,
  readFromSheet,
  appendToSheet,
  formatCells,
  addSheet,
  shareSpreadsheet,
  getSpreadsheetInfo,
  getSheetsClient,
  insertImageOverlay,
  mergeCells,
} from "../utils/googleSheets.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";

// Create a basic spreadsheet
export const createSpreadsheetController = async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ message: "Spreadsheet title is required" });
    }

    const user = await User.findById(req.user.id);
    if (!user || !user.sheetsAccessToken) {
      return res.status(401).json({ message: "Google Sheets not connected" });
    }

    const result = await createSpreadsheet(
      title,
      user._id,
      user.sheetsAccessToken,
      user.sheetsRefreshToken
    );

    res.json({
      message: "Spreadsheet created successfully",
      spreadsheetId: result.spreadsheetId,
      spreadsheetUrl: result.spreadsheetUrl,
      title: result.title,
    });
  } catch (error) {
    console.error("Error creating spreadsheet:", error);
    res.status(500).json({ message: error.message || "Failed to create spreadsheet" });
  }
};

// Helper functions (imported from deanController logic)
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

// Helper function to convert column number to Excel column letter (A, B, ..., Z, AA, AB, ...)
const getColumnLetter = (colNum) => {
  let result = '';
  while (colNum > 0) {
    colNum--;
    result = String.fromCharCode(65 + (colNum % 26)) + result;
    colNum = Math.floor(colNum / 26);
  }
  return result;
};

const transformResearchForExport = (researchDoc, panelDoc) => {
  try {
    const formCounts = (researchDoc.forms || []).reduce((acc, form) => {
      const type = form.type || "other";
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    const panelMembers = panelDoc && panelDoc.members
      ? panelDoc.members
          .filter((member) => member && member.isSelected !== false)
          .map((member) => ({
            name: member.isExternal
              ? member.name
              : member.faculty
                ? member.faculty.name
                : "Unknown",
            role: member.role || "member",
            isExternal: member.isExternal || false,
          }))
      : [];

    const submissionsByStage = (researchDoc.forms || []).reduce((acc, form) => {
      const type = form.type || "other";
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    return {
      title: researchDoc.title,
      students: researchDoc.students || [],
      adviser: researchDoc.adviser || null,
      status: researchDoc.status || "pending",
      stage: researchDoc.stage || "proposal",
      progress: researchDoc.progress || 0,
      panelMembers: panelMembers,
      submissionsPerStage: submissionsByStage,
      totalSubmissions: researchDoc.forms?.length || 0,
      createdAt: researchDoc.createdAt,
      updatedAt: researchDoc.updatedAt,
      academicYear: researchDoc.academicYear || null,
    };
  } catch (error) {
    console.error("Error transforming research:", error);
    throw error;
  }
};

// Create research progress dashboard with logo and header matching Excel format
export const createResearchDashboard = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.sheetsAccessToken) {
      return res.status(401).json({ message: "Google Sheets not connected" });
    }

    // Get filters and fields from request body (matching Excel export)
    const { filters = {}, fields = [] } = req.body || {};
    const selectedFields = sanitizeSelectedFields(fields);
    const query = buildResearchFilterQuery(filters);

    if (filters.adviserEmail && !query.adviser) {
      const adviser = await User.findOne({ email: filters.adviserEmail }).select("_id");
      if (adviser) {
        query.adviser = adviser._id;
      }
    }

    // Fetch research records with filters
    const researchDocs = await Research.find(query)
      .populate("students", "name email")
      .populate("adviser", "name email")
      .sort({ createdAt: -1 });

    const panelMap = await buildPanelMap(researchDocs);
    const rows = researchDocs.map((doc) => {
      try {
        return transformResearchForExport(doc, panelMap.get(doc._id.toString()));
      } catch (error) {
        console.error(`Error transforming research ${doc._id}:`, error);
        throw error;
      }
    });

    if (!rows || rows.length === 0) {
      return res.status(400).json({ 
        message: "No research records found matching the selected filters." 
      });
    }

    const generatedBy = user.name || user.email || "Dean";
    const filtersSummary = Object.entries(filters || {})
      .filter(([, value]) => value && value !== "all")
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ");

    // Create spreadsheet
    const title = `Research Records Report - ${new Date().toLocaleDateString()}`;
    const result = await createSpreadsheet(
      title,
      user._id,
      user.sheetsAccessToken,
      user.sheetsRefreshToken
    );

    const spreadsheetId = result.spreadsheetId;
    const sheets = await getSheetsClient(user._id, user.sheetsAccessToken, user.sheetsRefreshToken);
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetId = spreadsheet.data.sheets[0].properties.sheetId;
    
    // Define maxColumns based on selectedFields
    const maxColumns = selectedFields.length;

    // Find logo file
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const projectRoot = path.resolve(__dirname, '..', '..');
    const logoPaths = [
      path.join(projectRoot, 'frontend', 'public', 'logo.jpg'),
      path.join(projectRoot, 'frontend', 'public', 'logo.png'),
      path.join(projectRoot, 'public', 'logo.jpg'),
      path.join(projectRoot, 'public', 'logo.png'),
    ];
    
    let logoUrl = null;
    let logoPath = null;
    for (const lp of logoPaths) {
      if (fs.existsSync(lp)) {
        logoPath = lp;
        break;
      }
    }

    // Convert logo to base64 for direct embedding (no Drive upload needed)
    let logoBase64 = null;
    if (logoPath) {
      try {
        const logoBuffer = fs.readFileSync(logoPath);
        const logoExt = path.extname(logoPath).slice(1).toLowerCase();
        const mimeType = logoExt === 'png' ? 'image/png' : 'image/jpeg';
        logoBase64 = `data:${mimeType};base64,${logoBuffer.toString('base64')}`;
        console.log('Logo converted to base64 for embedding');
      } catch (logoError) {
        console.log('Could not read logo file:', logoError.message);
      }
    }

    // Start building the sheet structure (matching the image exactly)
    let currentRow = 0;

    // Row 1: Logo (centered, merged across all columns)
    if (logoBase64) {
      try {
        // Merge all columns in first row to create centered container
        await mergeCells(spreadsheetId, sheetId, currentRow, currentRow, 0, maxColumns, user._id, user.sheetsAccessToken, user.sheetsRefreshToken);
        
        // Calculate center column for logo positioning
        const centerCol = Math.floor((maxColumns - 1) / 2);
        const centerColLetter = getColumnLetter(centerCol + 1);
        
        // Insert logo using IMAGE formula with base64 data URI
        await writeToSheet(
          spreadsheetId,
          `Sheet1!${centerColLetter}${currentRow + 1}`,
          [[`=IMAGE("${logoBase64}", 1)`]],
          user._id,
          user.sheetsAccessToken,
          user.sheetsRefreshToken
        );
        
        // Set row height for logo area
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: spreadsheetId,
          requestBody: {
            requests: [
              {
                updateDimensionProperties: {
                  range: {
                    sheetId: sheetId,
                    dimension: "ROWS",
                    startIndex: currentRow,
                    endIndex: currentRow + 1,
                  },
                  properties: {
                    pixelSize: 105,
                  },
                  fields: "pixelSize",
                },
              },
            ],
          },
        });
        
        currentRow += 1;
      } catch (logoInsertError) {
        console.log('Could not insert logo into sheet:', logoInsertError.message);
        currentRow += 1;
      }
    } else {
      currentRow += 1;
    }

    // Blue divider line above university name (matching image)
    const blueDividerRow = currentRow;
    await mergeCells(spreadsheetId, sheetId, blueDividerRow, blueDividerRow, 0, maxColumns, user._id, user.sheetsAccessToken, user.sheetsRefreshToken);
    await formatCells(spreadsheetId, sheetId, blueDividerRow, blueDividerRow + 1, 0, maxColumns, {
      backgroundColor: { red: 0.12, green: 0.25, blue: 0.69 } // Blue color
    }, user._id, user.sheetsAccessToken, user.sheetsRefreshToken);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          updateDimensionProperties: {
            range: { sheetId, dimension: "ROWS", startIndex: blueDividerRow, endIndex: blueDividerRow + 1 },
            properties: { pixelSize: 2 },
            fields: "pixelSize"
          }
        }]
      }
    });

    // University Header - matching image exactly
    const headerStartRow = blueDividerRow + 1;
    
    // University Name
    await mergeCells(spreadsheetId, sheetId, headerStartRow, headerStartRow, 0, maxColumns, user._id, user.sheetsAccessToken, user.sheetsRefreshToken);
    await writeToSheet(
      spreadsheetId,
      `Sheet1!A${headerStartRow + 1}`,
      [["BUKIDNON STATE UNIVERSITY"]],
      user._id,
      user.sheetsAccessToken,
      user.sheetsRefreshToken
    );
    await formatCells(spreadsheetId, sheetId, headerStartRow, headerStartRow + 1, 0, maxColumns, {
      textFormat: { bold: true, fontSize: 20, foregroundColor: { red: 0.49, green: 0.11, blue: 0.14 } },
      horizontalAlignment: "CENTER",
      verticalAlignment: "MIDDLE",
      backgroundColor: { red: 1, green: 1, blue: 1 } // White background (matching image)
    }, user._id, user.sheetsAccessToken, user.sheetsRefreshToken);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          updateDimensionProperties: {
            range: { sheetId, dimension: "ROWS", startIndex: headerStartRow, endIndex: headerStartRow + 1 },
            properties: { pixelSize: 25 },
            fields: "pixelSize"
          }
        }]
      }
    });

    // Location
    const locationRow = headerStartRow + 1;
    await mergeCells(spreadsheetId, sheetId, locationRow, locationRow, 0, maxColumns, user._id, user.sheetsAccessToken, user.sheetsRefreshToken);
    await writeToSheet(
      spreadsheetId,
      `Sheet1!A${locationRow + 1}`,
      [["Malaybalay City, Bukidnon 8700"]],
      user._id,
      user.sheetsAccessToken,
      user.sheetsRefreshToken
    );
    await formatCells(spreadsheetId, sheetId, locationRow, locationRow + 1, 0, maxColumns, {
      textFormat: { fontSize: 11, foregroundColor: { red: 0.22, green: 0.25, blue: 0.32 } },
      horizontalAlignment: "CENTER",
      verticalAlignment: "MIDDLE",
      backgroundColor: { red: 1, green: 1, blue: 1 } // White background
    }, user._id, user.sheetsAccessToken, user.sheetsRefreshToken);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          updateDimensionProperties: {
            range: { sheetId, dimension: "ROWS", startIndex: locationRow, endIndex: locationRow + 1 },
            properties: { pixelSize: 18 },
            fields: "pixelSize"
          }
        }]
      }
    });

    // Contact (blue, underlined - matching image)
    const contactRow = locationRow + 1;
    await mergeCells(spreadsheetId, sheetId, contactRow, contactRow, 0, maxColumns, user._id, user.sheetsAccessToken, user.sheetsRefreshToken);
    await writeToSheet(
      spreadsheetId,
      `Sheet1!A${contactRow + 1}`,
      [["Tel (088) 813-5661 to 5663; TeleFax (088) 813-2717, www.buksu.edu.ph"]],
      user._id,
      user.sheetsAccessToken,
      user.sheetsRefreshToken
    );
    // Note: Google Sheets API doesn't support underline directly, but we'll use blue color
    await formatCells(spreadsheetId, sheetId, contactRow, contactRow + 1, 0, maxColumns, {
      textFormat: { fontSize: 10, foregroundColor: { red: 0.12, green: 0.25, blue: 0.69 } },
      horizontalAlignment: "CENTER",
      verticalAlignment: "MIDDLE",
      backgroundColor: { red: 1, green: 1, blue: 1 } // White background
    }, user._id, user.sheetsAccessToken, user.sheetsRefreshToken);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          updateDimensionProperties: {
            range: { sheetId, dimension: "ROWS", startIndex: contactRow, endIndex: contactRow + 1 },
            properties: { pixelSize: 18 },
            fields: "pixelSize"
          }
        }]
      }
    });

    // College Name
    const collegeRow = contactRow + 1;
    await mergeCells(spreadsheetId, sheetId, collegeRow, collegeRow, 0, maxColumns, user._id, user.sheetsAccessToken, user.sheetsRefreshToken);
    await writeToSheet(
      spreadsheetId,
      `Sheet1!A${collegeRow + 1}`,
      [["College of Public Administration and Governance"]],
      user._id,
      user.sheetsAccessToken,
      user.sheetsRefreshToken
    );
    await formatCells(spreadsheetId, sheetId, collegeRow, collegeRow + 1, 0, maxColumns, {
      textFormat: { fontSize: 13, foregroundColor: { red: 0.22, green: 0.25, blue: 0.32 } },
      horizontalAlignment: "CENTER",
      verticalAlignment: "MIDDLE",
      backgroundColor: { red: 1, green: 1, blue: 1 } // White background
    }, user._id, user.sheetsAccessToken, user.sheetsRefreshToken);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          updateDimensionProperties: {
            range: { sheetId, dimension: "ROWS", startIndex: collegeRow, endIndex: collegeRow + 1 },
            properties: { pixelSize: 22 },
            fields: "pixelSize"
          }
        }]
      }
    });

    // Thick dark red divider line (matching image)
    const dividerRow = collegeRow + 1;
    await mergeCells(spreadsheetId, sheetId, dividerRow, dividerRow, 0, maxColumns, user._id, user.sheetsAccessToken, user.sheetsRefreshToken);
    await formatCells(spreadsheetId, sheetId, dividerRow, dividerRow + 1, 0, maxColumns, {
      backgroundColor: { red: 0.49, green: 0.11, blue: 0.14 } // Dark red
    }, user._id, user.sheetsAccessToken, user.sheetsRefreshToken);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          updateDimensionProperties: {
            range: { sheetId, dimension: "ROWS", startIndex: dividerRow, endIndex: dividerRow + 1 },
            properties: { pixelSize: 5 }, // Thicker line to match image
            fields: "pixelSize"
          }
        }]
      }
    });

    // Report Title
    const reportTitleRow = dividerRow + 1;
    await mergeCells(spreadsheetId, sheetId, reportTitleRow, reportTitleRow, 0, maxColumns, user._id, user.sheetsAccessToken, user.sheetsRefreshToken);
    await writeToSheet(
      spreadsheetId,
      `Sheet1!A${reportTitleRow + 1}`,
      [["RESEARCH RECORDS REPORT"]],
      user._id,
      user.sheetsAccessToken,
      user.sheetsRefreshToken
    );
    await formatCells(spreadsheetId, sheetId, reportTitleRow, reportTitleRow + 1, 0, maxColumns, {
      textFormat: { bold: true, fontSize: 16, foregroundColor: { red: 0.07, green: 0.09, blue: 0.15 } },
      horizontalAlignment: "CENTER",
      verticalAlignment: "MIDDLE"
    }, user._id, user.sheetsAccessToken, user.sheetsRefreshToken);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          updateDimensionProperties: {
            range: { sheetId, dimension: "ROWS", startIndex: reportTitleRow, endIndex: reportTitleRow + 1 },
            properties: { pixelSize: 25 },
            fields: "pixelSize"
          }
        }]
      }
    });

    currentRow = reportTitleRow + 1;

    // Gray separator line (matching image)
    const graySeparatorRow = currentRow;
    await mergeCells(spreadsheetId, sheetId, graySeparatorRow, graySeparatorRow, 0, maxColumns, user._id, user.sheetsAccessToken, user.sheetsRefreshToken);
    await formatCells(spreadsheetId, sheetId, graySeparatorRow, graySeparatorRow + 1, 0, maxColumns, {
      backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 } // Gray color
    }, user._id, user.sheetsAccessToken, user.sheetsRefreshToken);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          updateDimensionProperties: {
            range: { sheetId, dimension: "ROWS", startIndex: graySeparatorRow, endIndex: graySeparatorRow + 1 },
            properties: { pixelSize: 2 },
            fields: "pixelSize"
          }
        }]
      }
    });

    // Report Details Box - matching image format (left-aligned, black text)
    const detailsRow = graySeparatorRow + 1;
    const dateGenerated = formatDateValue(new Date(), true);
    let detailsText = `Generated by: ${generatedBy} | Date Generated: ${dateGenerated} | Total Records: ${rows.length}`;
    if (filtersSummary) {
      detailsText += ` | Applied Filters: ${filtersSummary}`;
    }
    
    await mergeCells(spreadsheetId, sheetId, detailsRow, detailsRow, 0, maxColumns, user._id, user.sheetsAccessToken, user.sheetsRefreshToken);
    await writeToSheet(
      spreadsheetId,
      `Sheet1!A${detailsRow + 1}`,
      [[detailsText]],
      user._id,
      user.sheetsAccessToken,
      user.sheetsRefreshToken
    );
    await formatCells(spreadsheetId, sheetId, detailsRow, detailsRow + 1, 0, maxColumns, {
      backgroundColor: { red: 1, green: 1, blue: 1 }, // White background
      textFormat: { fontSize: 11, foregroundColor: { red: 0, green: 0, blue: 0 } }, // Black text
      horizontalAlignment: "LEFT", // Left-aligned (matching image)
      verticalAlignment: "MIDDLE"
    }, user._id, user.sheetsAccessToken, user.sheetsRefreshToken);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          updateDimensionProperties: {
            range: { sheetId, dimension: "ROWS", startIndex: detailsRow, endIndex: detailsRow + 1 },
            properties: { pixelSize: 20 },
            fields: "pixelSize"
          }
        }]
      }
    });

    currentRow = detailsRow + 2; // Add spacing row

    // Data Headers - using selectedFields and FIELD_LABELS
    const headers = selectedFields.map(field => FIELD_LABELS[field] || field);
    const headerRowNum = currentRow;

    await writeToSheet(
      spreadsheetId,
      `Sheet1!A${headerRowNum + 1}:${getColumnLetter(maxColumns)}${headerRowNum + 1}`,
      [headers],
      user._id,
      user.sheetsAccessToken,
      user.sheetsRefreshToken
    );

    // Format header row - matching Excel format
    await formatCells(
      spreadsheetId,
      sheetId,
      headerRowNum,
      headerRowNum + 1,
      0,
      headers.length,
      {
        backgroundColor: { red: 0.49, green: 0.11, blue: 0.14 }, // #7C1D23
        textFormat: { 
          bold: true, 
          foregroundColor: { red: 1, green: 1, blue: 1 }, 
          fontSize: 12 
        },
        horizontalAlignment: "CENTER",
        verticalAlignment: "MIDDLE"
      },
      user._id,
      user.sheetsAccessToken,
      user.sheetsRefreshToken
    );
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          updateDimensionProperties: {
            range: { sheetId, dimension: "ROWS", startIndex: headerRowNum, endIndex: headerRowNum + 1 },
            properties: { pixelSize: 30 },
            fields: "pixelSize"
          }
        }]
      }
    });

    currentRow = headerRowNum + 1;

    // Prepare data rows using formatFieldValue (matching Excel format)
    const dataRows = rows.map((row) => {
      return selectedFields.map(field => formatFieldValue(row, field));
    });

    // Write data rows
    if (dataRows.length > 0) {
      const endCol = getColumnLetter(maxColumns);
      await writeToSheet(
        spreadsheetId,
        `Sheet1!A${currentRow + 1}:${endCol}${currentRow + dataRows.length}`,
        dataRows,
        user._id,
        user.sheetsAccessToken,
        user.sheetsRefreshToken
      );
    }

    // Set column widths - matching Excel format
    const columnWidthsMap = {
      title: 35 * 7, // Convert Excel width units to pixels (approx)
      students: 25 * 7,
      adviser: 30 * 7,
      status: 18 * 7,
      stage: 25 * 7,
      progress: 12 * 7,
      createdAt: 18 * 7,
      updatedAt: 18 * 7,
      totalSubmissions: 15 * 7,
      panelMembers: 30 * 7,
      submissionsPerStage: 30 * 7,
      academicYear: 15 * 7
    };
    
    const columnRequests = selectedFields.map((field, index) => ({
      updateDimensionProperties: {
        range: {
          sheetId: sheetId,
          dimension: "COLUMNS",
          startIndex: index,
          endIndex: index + 1,
        },
        properties: {
          pixelSize: columnWidthsMap[field] || 150,
        },
        fields: "pixelSize",
      },
    }));

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetId,
      requestBody: {
        requests: columnRequests,
      },
    });

    // Format data rows - matching Excel format (center alignment, borders, alternating colors)
    if (dataRows.length > 0) {
      // Set row heights for data rows
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: spreadsheetId,
        requestBody: {
          requests: [{
            updateDimensionProperties: {
              range: {
                sheetId: sheetId,
                dimension: "ROWS",
                startIndex: currentRow,
                endIndex: currentRow + dataRows.length,
              },
              properties: { pixelSize: 25 },
              fields: "pixelSize",
            },
          }],
        },
      });

      // Format all data cells - center alignment, alternating row colors
      // Note: borders are not supported by formatCells function, so we skip them
      for (let i = 0; i < dataRows.length; i++) {
        const rowIndex = currentRow + i;
        const isEven = i % 2 === 0;
        await formatCells(spreadsheetId, sheetId, rowIndex, rowIndex + 1, 0, maxColumns, {
          horizontalAlignment: "CENTER",
          verticalAlignment: "MIDDLE",
          backgroundColor: isEven 
            ? { red: 1, green: 1, blue: 1 } // White
            : { red: 0.98, green: 0.98, blue: 0.98 }, // #F9FAFB
          textFormat: { fontSize: 11 }
        }, user._id, user.sheetsAccessToken, user.sheetsRefreshToken);
      }
    }

    res.json({
      message: "Research dashboard created successfully",
      spreadsheetId: result.spreadsheetId,
      spreadsheetUrl: result.spreadsheetUrl,
      recordCount: rows.length,
    });
  } catch (error) {
    console.error("Error creating research dashboard:", error);
    console.error("Error stack:", error.stack);
    console.error("Error details:", {
      message: error.message,
      name: error.name,
      code: error.code,
      response: error.response?.data
    });
    
    // Provide more specific error messages
    let errorMessage = "Failed to create research dashboard";
    if (error.message) {
      errorMessage = error.message;
    } else if (error.response?.data?.error) {
      errorMessage = error.response.data.error;
    }
    
    res.status(500).json({ 
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? {
        stack: error.stack,
        name: error.name,
        code: error.code
      } : undefined
    });
  }
};

// Update research data in existing sheet
export const updateResearchData = async (req, res) => {
  try {
    const { spreadsheetId, range = "Sheet1!A2" } = req.body;

    if (!spreadsheetId) {
      return res.status(400).json({ message: "Spreadsheet ID is required" });
    }

    const user = await User.findById(req.user.id);
    if (!user || !user.sheetsAccessToken) {
      return res.status(401).json({ message: "Google Sheets not connected" });
    }

    // Fetch latest research records
    const researchList = await Research.find({ archivedAt: null })
      .populate("students", "name email studentId")
      .populate("adviser", "name email")
      .sort({ createdAt: -1 });

    const rows = researchList.map((research) => {
      const students = research.students
        .map((s) => `${s.name} (${s.studentId || s.email})`)
        .join(", ");
      const adviser = research.adviser ? research.adviser.name : "N/A";
      const status = research.status || "pending";
      const stage = research.stage || "proposal";
      const progress = research.progress || 0;
      const createdDate = research.createdAt
        ? new Date(research.createdAt).toLocaleDateString()
        : "N/A";
      const updatedDate = research.updatedAt
        ? new Date(research.updatedAt).toLocaleDateString()
        : "N/A";

      return [research.title, students, adviser, status, stage, progress, createdDate, updatedDate];
    });

    // Clear existing data (except headers)
    await writeToSheet(
      spreadsheetId,
      range,
      rows,
      user._id,
      user.sheetsAccessToken,
      user.sheetsRefreshToken
    );

    res.json({
      message: "Research data updated successfully",
      recordCount: rows.length,
    });
  } catch (error) {
    console.error("Error updating research data:", error);
    res.status(500).json({ message: error.message || "Failed to update research data" });
  }
};

// Export activity logs to sheet
export const exportActivityLogs = async (req, res) => {
  try {
    const { startDate, endDate, action, entityType } = req.body;

    const user = await User.findById(req.user.id);
    if (!user || !user.sheetsAccessToken) {
      return res.status(401).json({ message: "Google Sheets not connected" });
    }

    // Build query
    const query = {};
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    if (action) query.action = action;
    if (entityType) query.entityType = entityType;

    const activities = await Activity.find(query)
      .populate("user", "name email role")
      .sort({ createdAt: -1 })
      .limit(10000); // Limit to prevent memory issues

    // Create spreadsheet
    const title = `Activity Logs Export - ${new Date().toLocaleDateString()}`;
    const result = await createSpreadsheet(
      title,
      user._id,
      user.sheetsAccessToken,
      user.sheetsRefreshToken
    );

    const spreadsheetId = result.spreadsheetId;

    // Headers
    const headers = ["Date", "User", "Email", "Role", "Action", "Entity Type", "Entity Name", "Description"];

    // Data rows
    const rows = activities.map((activity) => {
      const date = activity.createdAt ? new Date(activity.createdAt).toLocaleString() : "N/A";
      const userName = activity.user ? activity.user.name : "N/A";
      const userEmail = activity.user ? activity.user.email : "N/A";
      const userRole = activity.user ? activity.user.role : "N/A";
      const action = activity.action || "N/A";
      const entityType = activity.entityType || "N/A";
      const entityName = activity.entityName || "N/A";
      const description = activity.description || "N/A";

      return [date, userName, userEmail, userRole, action, entityType, entityName, description];
    });

    // Write headers
    await writeToSheet(
      spreadsheetId,
      "Sheet1!A1:H1",
      [headers],
      user._id,
      user.sheetsAccessToken,
      user.sheetsRefreshToken
    );

    // Format headers
    const sheets = await getSheetsClient(user._id, user.sheetsAccessToken, user.sheetsRefreshToken);
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetId = spreadsheet.data.sheets[0].properties.sheetId;

    await formatCells(
      spreadsheetId,
      sheetId,
      0,
      1,
      0,
      headers.length,
      {
        backgroundColor: { red: 0.2, green: 0.11, blue: 0.14 },
        textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
        horizontalAlignment: "CENTER",
      },
      user._id,
      user.sheetsAccessToken,
      user.sheetsRefreshToken
    );

    // Write data
    if (rows.length > 0) {
      await writeToSheet(
        spreadsheetId,
        `Sheet1!A2:H${rows.length + 1}`,
        rows,
        user._id,
        user.sheetsAccessToken,
        user.sheetsRefreshToken
      );
    }

    res.json({
      message: "Activity logs exported successfully",
      spreadsheetId: result.spreadsheetId,
      spreadsheetUrl: result.spreadsheetUrl,
      recordCount: activities.length,
    });
  } catch (error) {
    console.error("Error exporting activity logs:", error);
    res.status(500).json({ message: error.message || "Failed to export activity logs" });
  }
};

// Export compliance forms tracking
export const exportComplianceTracking = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.sheetsAccessToken) {
      return res.status(401).json({ message: "Google Sheets not connected" });
    }

    const complianceForms = await ComplianceForm.find({ isCurrent: true })
      .populate("student", "name email studentId")
      .populate("research", "title")
      .populate("reviewedBy", "name email")
      .sort({ uploadedAt: -1 });

    // Create spreadsheet
    const title = `Compliance Forms Tracking - ${new Date().toLocaleDateString()}`;
    const result = await createSpreadsheet(
      title,
      user._id,
      user.sheetsAccessToken,
      user.sheetsRefreshToken
    );

    const spreadsheetId = result.spreadsheetId;

    // Headers
    const headers = [
      "Student",
      "Student ID",
      "Research Title",
      "Form Type",
      "Status",
      "Version",
      "Uploaded Date",
      "Reviewed By",
      "Review Date",
    ];

    // Data rows
    const rows = complianceForms.map((form) => {
      const student = form.student ? form.student.name : "N/A";
      const studentId = form.student ? form.student.studentId || form.student.email : "N/A";
      const researchTitle = form.research ? form.research.title : "N/A";
      const formType = form.formType || "N/A";
      const status = form.status || "pending";
      const version = form.version || 1;
      const uploadedDate = form.uploadedAt
        ? new Date(form.uploadedAt).toLocaleDateString()
        : "N/A";
      const reviewedBy = form.reviewedBy ? form.reviewedBy.name : "N/A";
      const reviewDate = form.reviewedAt
        ? new Date(form.reviewedAt).toLocaleDateString()
        : "N/A";

      return [student, studentId, researchTitle, formType, status, version, uploadedDate, reviewedBy, reviewDate];
    });

    // Write headers
    await writeToSheet(
      spreadsheetId,
      "Sheet1!A1:I1",
      [headers],
      user._id,
      user.sheetsAccessToken,
      user.sheetsRefreshToken
    );

    // Format headers
    const sheets = await getSheetsClient(user._id, user.sheetsAccessToken, user.sheetsRefreshToken);
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetId = spreadsheet.data.sheets[0].properties.sheetId;

    await formatCells(
      spreadsheetId,
      sheetId,
      0,
      1,
      0,
      headers.length,
      {
        backgroundColor: { red: 0.2, green: 0.11, blue: 0.14 },
        textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
        horizontalAlignment: "CENTER",
      },
      user._id,
      user.sheetsAccessToken,
      user.sheetsRefreshToken
    );

    // Write data
    if (rows.length > 0) {
      await writeToSheet(
        spreadsheetId,
        `Sheet1!A2:I${rows.length + 1}`,
        rows,
        user._id,
        user.sheetsAccessToken,
        user.sheetsRefreshToken
      );
    }

    res.json({
      message: "Compliance tracking exported successfully",
      spreadsheetId: result.spreadsheetId,
      spreadsheetUrl: result.spreadsheetUrl,
      recordCount: complianceForms.length,
    });
  } catch (error) {
    console.error("Error exporting compliance tracking:", error);
    res.status(500).json({ message: error.message || "Failed to export compliance tracking" });
  }
};

// Export schedules to sheet
export const exportSchedules = async (req, res) => {
  try {
    const { startDate, endDate, type } = req.body;

    const user = await User.findById(req.user.id);
    if (!user || !user.sheetsAccessToken) {
      return res.status(401).json({ message: "Google Sheets not connected" });
    }

    // Build query
    const query = {};
    if (startDate || endDate) {
      query.datetime = {};
      if (startDate) query.datetime.$gte = new Date(startDate);
      if (endDate) query.datetime.$lte = new Date(endDate);
    }
    if (type) query.type = type;

    const schedules = await Schedule.find(query)
      .populate("research", "title")
      .populate("createdBy", "name email")
      .populate("participants.user", "name email")
      .sort({ datetime: 1 });

    // Create spreadsheet
    const title = `Schedules Export - ${new Date().toLocaleDateString()}`;
    const result = await createSpreadsheet(
      title,
      user._id,
      user.sheetsAccessToken,
      user.sheetsRefreshToken
    );

    const spreadsheetId = result.spreadsheetId;

    // Headers
    const headers = [
      "Date & Time",
      "Type",
      "Title",
      "Research Title",
      "Location",
      "Duration (min)",
      "Status",
      "Participants",
      "Created By",
    ];

    // Data rows
    const rows = schedules.map((schedule) => {
      const datetime = schedule.datetime
        ? new Date(schedule.datetime).toLocaleString()
        : "N/A";
      const type = schedule.type || "N/A";
      const title = schedule.title || "N/A";
      const researchTitle = schedule.research ? schedule.research.title : "N/A";
      const location = schedule.location || "N/A";
      const duration = schedule.duration || 60;
      const status = schedule.status || "scheduled";
      const participants = schedule.participants
        .map((p) => `${p.user ? p.user.name : "N/A"} (${p.role})`)
        .join(", ");
      const createdBy = schedule.createdBy ? schedule.createdBy.name : "N/A";

      return [datetime, type, title, researchTitle, location, duration, status, participants, createdBy];
    });

    // Write headers
    await writeToSheet(
      spreadsheetId,
      "Sheet1!A1:I1",
      [headers],
      user._id,
      user.sheetsAccessToken,
      user.sheetsRefreshToken
    );

    // Format headers
    const sheets = await getSheetsClient(user._id, user.sheetsAccessToken, user.sheetsRefreshToken);
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetId = spreadsheet.data.sheets[0].properties.sheetId;

    await formatCells(
      spreadsheetId,
      sheetId,
      0,
      1,
      0,
      headers.length,
      {
        backgroundColor: { red: 0.2, green: 0.11, blue: 0.14 },
        textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
        horizontalAlignment: "CENTER",
      },
      user._id,
      user.sheetsAccessToken,
      user.sheetsRefreshToken
    );

    // Write data
    if (rows.length > 0) {
      await writeToSheet(
        spreadsheetId,
        `Sheet1!A2:I${rows.length + 1}`,
        rows,
        user._id,
        user.sheetsAccessToken,
        user.sheetsRefreshToken
      );
    }

    res.json({
      message: "Schedules exported successfully",
      spreadsheetId: result.spreadsheetId,
      spreadsheetUrl: result.spreadsheetUrl,
      recordCount: schedules.length,
    });
  } catch (error) {
    console.error("Error exporting schedules:", error);
    res.status(500).json({ message: error.message || "Failed to export schedules" });
  }
};

// Export panel assignments
export const exportPanelAssignments = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.sheetsAccessToken) {
      return res.status(401).json({ message: "Google Sheets not connected" });
    }

    const panels = await Panel.find()
      .populate("research", "title students")
      .populate("research.students", "name email studentId")
      .populate("members.faculty", "name email")
      .populate("assignedBy", "name email")
      .sort({ createdAt: -1 });

    // Create spreadsheet
    const title = `Panel Assignments - ${new Date().toLocaleDateString()}`;
    const result = await createSpreadsheet(
      title,
      user._id,
      user.sheetsAccessToken,
      user.sheetsRefreshToken
    );

    const spreadsheetId = result.spreadsheetId;

    // Headers
    const headers = [
      "Panel Name",
      "Type",
      "Research Title",
      "Students",
      "Panel Member",
      "Role",
      "Status",
      "Assigned By",
      "Panel Status",
    ];

    // Data rows - one row per panel member
    const rows = [];
    panels.forEach((panel) => {
      const researchTitle = panel.research ? panel.research.title : "N/A";
      const students = panel.research && panel.research.students
        ? panel.research.students.map((s) => `${s.name} (${s.studentId || s.email})`).join(", ")
        : "N/A";

      if (panel.members && panel.members.length > 0) {
        panel.members.forEach((member) => {
          const memberName = member.faculty
            ? member.faculty.name
            : member.name || "N/A";
          const role = member.role || "N/A";
          const status = member.status || "assigned";
          const assignedBy = panel.assignedBy ? panel.assignedBy.name : "N/A";
          const panelStatus = panel.status || "pending";

          rows.push([
            panel.name,
            panel.type,
            researchTitle,
            students,
            memberName,
            role,
            status,
            assignedBy,
            panelStatus,
          ]);
        });
      } else {
        // Panel with no members
        rows.push([
          panel.name,
          panel.type,
          researchTitle,
          students,
          "N/A",
          "N/A",
          "N/A",
          panel.assignedBy ? panel.assignedBy.name : "N/A",
          panel.status || "pending",
        ]);
      }
    });

    // Write headers
    await writeToSheet(
      spreadsheetId,
      "Sheet1!A1:I1",
      [headers],
      user._id,
      user.sheetsAccessToken,
      user.sheetsRefreshToken
    );

    // Format headers
    const sheets = await getSheetsClient(user._id, user.sheetsAccessToken, user.sheetsRefreshToken);
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetId = spreadsheet.data.sheets[0].properties.sheetId;

    await formatCells(
      spreadsheetId,
      sheetId,
      0,
      1,
      0,
      headers.length,
      {
        backgroundColor: { red: 0.2, green: 0.11, blue: 0.14 },
        textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
        horizontalAlignment: "CENTER",
      },
      user._id,
      user.sheetsAccessToken,
      user.sheetsRefreshToken
    );

    // Write data
    if (rows.length > 0) {
      await writeToSheet(
        spreadsheetId,
        `Sheet1!A2:I${rows.length + 1}`,
        rows,
        user._id,
        user.sheetsAccessToken,
        user.sheetsRefreshToken
      );
    }

    res.json({
      message: "Panel assignments exported successfully",
      spreadsheetId: result.spreadsheetId,
      spreadsheetUrl: result.spreadsheetUrl,
      recordCount: rows.length,
    });
  } catch (error) {
    console.error("Error exporting panel assignments:", error);
    res.status(500).json({ message: error.message || "Failed to export panel assignments" });
  }
};

// Generic write to sheet
export const writeToSheetController = async (req, res) => {
  try {
    const { spreadsheetId, range, values } = req.body;

    if (!spreadsheetId || !range || !values) {
      return res.status(400).json({ message: "Spreadsheet ID, range, and values are required" });
    }

    const user = await User.findById(req.user.id);
    if (!user || !user.sheetsAccessToken) {
      return res.status(401).json({ message: "Google Sheets not connected" });
    }

    const result = await writeToSheet(
      spreadsheetId,
      range,
      values,
      user._id,
      user.sheetsAccessToken,
      user.sheetsRefreshToken
    );

    res.json({
      message: "Data written to sheet successfully",
      updatedCells: result.updatedCells,
    });
  } catch (error) {
    console.error("Error writing to sheet:", error);
    res.status(500).json({ message: error.message || "Failed to write to sheet" });
  }
};

// Generic read from sheet
export const readFromSheetController = async (req, res) => {
  try {
    const { spreadsheetId, range } = req.query;

    if (!spreadsheetId || !range) {
      return res.status(400).json({ message: "Spreadsheet ID and range are required" });
    }

    const user = await User.findById(req.user.id);
    if (!user || !user.sheetsAccessToken) {
      return res.status(401).json({ message: "Google Sheets not connected" });
    }

    const values = await readFromSheet(
      spreadsheetId,
      range,
      user._id,
      user.sheetsAccessToken,
      user.sheetsRefreshToken
    );

    res.json({
      values: values,
    });
  } catch (error) {
    console.error("Error reading from sheet:", error);
    res.status(500).json({ message: error.message || "Failed to read from sheet" });
  }
};

// Get spreadsheet info
export const getSpreadsheetInfoController = async (req, res) => {
  try {
    const { spreadsheetId } = req.params;

    if (!spreadsheetId) {
      return res.status(400).json({ message: "Spreadsheet ID is required" });
    }

    const user = await User.findById(req.user.id);
    if (!user || !user.sheetsAccessToken) {
      return res.status(401).json({ message: "Google Sheets not connected" });
    }

    const info = await getSpreadsheetInfo(
      spreadsheetId,
      user._id,
      user.sheetsAccessToken,
      user.sheetsRefreshToken
    );

    res.json(info);
  } catch (error) {
    console.error("Error getting spreadsheet info:", error);
    res.status(500).json({ message: error.message || "Failed to get spreadsheet info" });
  }
};

