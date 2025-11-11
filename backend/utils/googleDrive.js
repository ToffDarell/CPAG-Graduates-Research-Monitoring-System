import { google } from "googleapis";
import fs from "fs";

// Create OAuth2 Client for Google Drive
export const createDriveOAuthClient = () => {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_DRIVE_REDIRECT_URI ||
    process.env.GOOGLE_REDIRECT_URI ||
    "http://localhost:5000/api/google-drive/callback";

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Google Drive OAuth variables missing. Set GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, GOOGLE_DRIVE_REDIRECT_URI."
    );
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
};

// Generate Google Auth URL
export const getDriveAuthUrl = () => {
  const oauth2Client = createDriveOAuthClient();
  const scopes = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive.readonly"
  ];
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: scopes,
  });
};

// Upload File to Google Drive
export const uploadFileToDrive = async (filePath, fileName, mimeType, tokens) => {
  const oauth2Client = createDriveOAuthClient();
  oauth2Client.setCredentials(tokens);
  const drive = google.drive({ version: "v3", auth: oauth2Client });

  const fileMetadata = { name: fileName };
  const media = { mimeType: mimeType, body: fs.createReadStream(filePath) };

  const response = await drive.files.create({
    resource: fileMetadata,
    media: media,
    fields: "id, webViewLink, iconLink, thumbnailLink, name, mimeType",
  });

  return response.data;
};

// Download File from Google Drive
export const downloadFileFromDrive = async (fileId, accessToken) => {
  const oauth2Client = createDriveOAuthClient();
  oauth2Client.setCredentials({ access_token: accessToken });
  const drive = google.drive({ version: "v3", auth: oauth2Client });

  // Get file metadata
  const fileMetadata = await drive.files.get({
    fileId: fileId,
    fields: "id, name, mimeType, size, webViewLink",
  });

  const mimeType = fileMetadata.data.mimeType;
  
  // Handle Google Workspace files (Docs, Sheets, etc.) - need to export
  let exportMimeType = null;
  if (mimeType === 'application/vnd.google-apps.document') {
    exportMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'; // Export as DOCX
  } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
    exportMimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'; // Export as XLSX
  } else if (mimeType === 'application/vnd.google-apps.presentation') {
    exportMimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'; // Export as PPTX
  }

  let response;
  if (exportMimeType) {
    // Export Google Workspace file
    response = await drive.files.export(
      {
        fileId: fileId,
        mimeType: exportMimeType,
      },
      { responseType: "stream" }
    );
    // Update metadata mimeType to match exported format
    fileMetadata.data.mimeType = exportMimeType;
    // Update filename extension
    const nameParts = fileMetadata.data.name.split('.');
    if (exportMimeType.includes('wordprocessingml')) {
      fileMetadata.data.name = nameParts[0] + '.docx';
    } else if (exportMimeType.includes('spreadsheetml')) {
      fileMetadata.data.name = nameParts[0] + '.xlsx';
    } else if (exportMimeType.includes('presentationml')) {
      fileMetadata.data.name = nameParts[0] + '.pptx';
    }
  } else {
    // Download regular file
    response = await drive.files.get(
      {
        fileId: fileId,
        alt: "media",
      },
      { responseType: "stream" }
    );
  }

  return {
    stream: response.data,
    metadata: fileMetadata.data,
  };
};