import { google } from "googleapis";
import User from "../models/User.js";

// Create OAuth2 Client for Google Sheets
// Reuses Google Drive OAuth credentials and redirect URI for simplicity
export const createSheetsOAuthClient = () => {
  const clientId = process.env.GOOGLE_SHEETS_CLIENT_ID || process.env.GOOGLE_DRIVE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_SHEETS_CLIENT_SECRET || process.env.GOOGLE_DRIVE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
  // Use the same redirect URI as Google Drive since we're reusing the same OAuth app
  const redirectUri =
    process.env.GOOGLE_SHEETS_REDIRECT_URI ||
    process.env.GOOGLE_DRIVE_REDIRECT_URI ||
    process.env.GOOGLE_REDIRECT_URI ||
    "http://localhost:5000/api/google-drive/callback";

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Google Sheets OAuth variables missing. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI (or reuse Google Drive credentials)."
    );
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
};

// Generate Google Auth URL for Sheets
export const getSheetsAuthUrl = () => {
  const oauth2Client = createSheetsOAuthClient();
  const scopes = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
  ];
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: scopes,
  });
};

// Get authenticated Sheets client
export const getSheetsClient = async (userId, accessToken, refreshToken) => {
  const oauth2Client = createSheetsOAuthClient();

  // Set up token refresh listener to automatically update database
  oauth2Client.on("tokens", async (tokens) => {
    if (tokens.access_token && userId) {
      try {
        const updateData = {
          sheetsAccessToken: tokens.access_token,
        };

        if (tokens.refresh_token) {
          updateData.sheetsRefreshToken = tokens.refresh_token;
        }

        if (tokens.expiry_date) {
          updateData.sheetsTokenExpiry = new Date(tokens.expiry_date);
        } else {
          updateData.sheetsTokenExpiry = new Date(Date.now() + 3600000);
        }

        await User.findByIdAndUpdate(userId, updateData);
        console.log("[Google Sheets] Tokens refreshed and saved to database for user:", userId);
      } catch (error) {
        console.error("[Google Sheets] Error saving refreshed tokens:", error);
      }
    }
  });

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  return google.sheets({ version: "v4", auth: oauth2Client });
};

// Create a new spreadsheet
export const createSpreadsheet = async (title, userId, accessToken, refreshToken) => {
  try {
    const sheets = await getSheetsClient(userId, accessToken, refreshToken);
    const drive = google.drive({ version: "v3", auth: sheets.auth });

    const spreadsheet = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: title,
        },
      },
    });

    return {
      spreadsheetId: spreadsheet.data.spreadsheetId,
      spreadsheetUrl: spreadsheet.data.spreadsheetUrl,
      title: spreadsheet.data.properties.title,
    };
  } catch (error) {
    console.error("[Google Sheets] Error creating spreadsheet:", error);
    throw new Error(`Failed to create spreadsheet: ${error.message}`);
  }
};

// Write data to a spreadsheet
export const writeToSheet = async (
  spreadsheetId,
  range,
  values,
  userId,
  accessToken,
  refreshToken
) => {
  try {
    const sheets = await getSheetsClient(userId, accessToken, refreshToken);

    const response = await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
      range: range,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: values,
      },
    });

    return response.data;
  } catch (error) {
    console.error("[Google Sheets] Error writing to sheet:", error);
    throw new Error(`Failed to write to sheet: ${error.message}`);
  }
};

// Read data from a spreadsheet
export const readFromSheet = async (
  spreadsheetId,
  range,
  userId,
  accessToken,
  refreshToken
) => {
  try {
    const sheets = await getSheetsClient(userId, accessToken, refreshToken);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: range,
    });

    return response.data.values || [];
  } catch (error) {
    console.error("[Google Sheets] Error reading from sheet:", error);
    throw new Error(`Failed to read from sheet: ${error.message}`);
  }
};

// Append data to a spreadsheet
export const appendToSheet = async (
  spreadsheetId,
  range,
  values,
  userId,
  accessToken,
  refreshToken
) => {
  try {
    const sheets = await getSheetsClient(userId, accessToken, refreshToken);

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: spreadsheetId,
      range: range,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: values,
      },
    });

    return response.data;
  } catch (error) {
    console.error("[Google Sheets] Error appending to sheet:", error);
    throw new Error(`Failed to append to sheet: ${error.message}`);
  }
};

// Clear a range in a spreadsheet
export const clearSheet = async (
  spreadsheetId,
  range,
  userId,
  accessToken,
  refreshToken
) => {
  try {
    const sheets = await getSheetsClient(userId, accessToken, refreshToken);

    const response = await sheets.spreadsheets.values.clear({
      spreadsheetId: spreadsheetId,
      range: range,
    });

    return response.data;
  } catch (error) {
    console.error("[Google Sheets] Error clearing sheet:", error);
    throw new Error(`Failed to clear sheet: ${error.message}`);
  }
};

// Format cells (bold, colors, etc.)
export const formatCells = async (
  spreadsheetId,
  sheetId,
  startRowIndex,
  endRowIndex,
  startColumnIndex,
  endColumnIndex,
  formatOptions,
  userId,
  accessToken,
  refreshToken
) => {
  try {
    const sheets = await getSheetsClient(userId, accessToken, refreshToken);

    // Build the fields string based on what's actually in formatOptions
    const fields = [];
    if (formatOptions.backgroundColor) fields.push("backgroundColor");
    if (formatOptions.textFormat) {
      if (formatOptions.textFormat.bold !== undefined) fields.push("textFormat.bold");
      if (formatOptions.textFormat.fontSize !== undefined) fields.push("textFormat.fontSize");
      if (formatOptions.textFormat.foregroundColor) fields.push("textFormat.foregroundColor");
    }
    if (formatOptions.horizontalAlignment) fields.push("horizontalAlignment");
    if (formatOptions.verticalAlignment) fields.push("verticalAlignment");
    if (formatOptions.wrapStrategy) fields.push("wrapStrategy");

    const requests = [
      {
        repeatCell: {
          range: {
            sheetId: sheetId,
            startRowIndex: startRowIndex,
            endRowIndex: endRowIndex,
            startColumnIndex: startColumnIndex,
            endColumnIndex: endColumnIndex,
          },
          cell: {
            userEnteredFormat: formatOptions,
          },
          fields: `userEnteredFormat(${fields.join(",")})`,
        },
      },
    ];

    const response = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetId,
      requestBody: {
        requests: requests,
      },
    });

    return response.data;
  } catch (error) {
    console.error("[Google Sheets] Error formatting cells:", error);
    throw new Error(`Failed to format cells: ${error.message}`);
  }
};

// Create a new sheet in a spreadsheet
export const addSheet = async (spreadsheetId, sheetTitle, userId, accessToken, refreshToken) => {
  try {
    const sheets = await getSheetsClient(userId, accessToken, refreshToken);

    const response = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetTitle,
              },
            },
          },
        ],
      },
    });

    return response.data;
  } catch (error) {
    console.error("[Google Sheets] Error adding sheet:", error);
    throw new Error(`Failed to add sheet: ${error.message}`);
  }
};

// Share spreadsheet with users
export const shareSpreadsheet = async (
  spreadsheetId,
  email,
  role = "reader",
  userId,
  accessToken,
  refreshToken
) => {
  try {
    const sheets = await getSheetsClient(userId, accessToken, refreshToken);
    const oauth2Client = createSheetsOAuthClient();
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    const drive = google.drive({ version: "v3", auth: oauth2Client });

    const response = await drive.permissions.create({
      fileId: spreadsheetId,
      requestBody: {
        role: role, // 'reader', 'writer', 'commenter'
        type: "user",
        emailAddress: email,
      },
      fields: "id",
    });

    return response.data;
  } catch (error) {
    console.error("[Google Sheets] Error sharing spreadsheet:", error);
    throw new Error(`Failed to share spreadsheet: ${error.message}`);
  }
};

// Get spreadsheet metadata
export const getSpreadsheetInfo = async (spreadsheetId, userId, accessToken, refreshToken) => {
  try {
    const sheets = await getSheetsClient(userId, accessToken, refreshToken);

    const response = await sheets.spreadsheets.get({
      spreadsheetId: spreadsheetId,
    });

    return {
      spreadsheetId: response.data.spreadsheetId,
      title: response.data.properties.title,
      url: response.data.spreadsheetUrl,
      sheets: response.data.sheets.map((sheet) => ({
        sheetId: sheet.properties.sheetId,
        title: sheet.properties.title,
      })),
    };
  } catch (error) {
    console.error("[Google Sheets] Error getting spreadsheet info:", error);
    throw new Error(`Failed to get spreadsheet info: ${error.message}`);
  }
};

// Insert image into Google Sheets using overlay (better than IMAGE formula)
export const insertImageOverlay = async (
  spreadsheetId,
  sheetId,
  imageUrl,
  rowIndex,
  columnIndex,
  offsetX = 0,
  offsetY = 0,
  width = 200,
  height = 200,
  userId,
  accessToken,
  refreshToken
) => {
  try {
    const sheets = await getSheetsClient(userId, accessToken, refreshToken);

    const requests = [
      {
        insertImage: {
          sheetId: sheetId,
          uri: imageUrl,
          cell: {
            rowIndex: rowIndex,
            columnIndex: columnIndex,
          },
          offsetX: offsetX,
          offsetY: offsetY,
          width: width,
          height: height,
        },
      },
    ];

    const response = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetId,
      requestBody: {
        requests: requests,
      },
    });

    return response.data;
  } catch (error) {
    console.error("[Google Sheets] Error inserting image overlay:", error);
    // Fallback to IMAGE formula if overlay fails
    try {
      const cell = String.fromCharCode(65 + columnIndex) + (rowIndex + 1);
      await writeToSheet(
        spreadsheetId,
        `Sheet1!${cell}`,
        [[`=IMAGE("${imageUrl}", 1)`]],
        userId,
        accessToken,
        refreshToken
      );
      return { fallback: true };
    } catch (fallbackError) {
      console.error("[Google Sheets] Fallback IMAGE formula also failed:", fallbackError);
      throw new Error(`Failed to insert image: ${error.message}`);
    }
  }
};

// Merge cells
export const mergeCells = async (
  spreadsheetId,
  sheetId,
  startRowIndex,
  endRowIndex,
  startColumnIndex,
  endColumnIndex,
  userId,
  accessToken,
  refreshToken
) => {
  try {
    const sheets = await getSheetsClient(userId, accessToken, refreshToken);

    const requests = [
      {
        mergeCells: {
          range: {
            sheetId: sheetId,
            startRowIndex: startRowIndex,
            endRowIndex: endRowIndex,
            startColumnIndex: startColumnIndex,
            endColumnIndex: endColumnIndex,
          },
          mergeType: "MERGE_ALL",
        },
      },
    ];

    const response = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetId,
      requestBody: {
        requests: requests,
      },
    });

    return response.data;
  } catch (error) {
    console.error("[Google Sheets] Error merging cells:", error);
    throw new Error(`Failed to merge cells: ${error.message}`);
  }
};

