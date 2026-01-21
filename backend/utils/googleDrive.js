import { google } from "googleapis";
import fs from "fs";
import { checkOutboundLimit, OutboundRateLimitError } from "./outboundRateLimit.js";
import User from "../models/User.js";

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
    "https://www.googleapis.com/auth/drive"
  ];
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: scopes,
  });
};

// Upload File to Google Drive
export const uploadFileToDrive = async (filePath, fileName, mimeType, tokens, options = {}) => {
  console.log("========================================");
  console.log("[Google Drive] uploadFileToDrive CALLED");
  console.log("[Google Drive] Parameters:", {
    filePath,
    fileName,
    mimeType,
    hasAccessToken: !!tokens?.access_token,
    hasRefreshToken: !!tokens?.refresh_token,
    hasExpiryDate: !!tokens?.expiry_date,
    options
  });
  
  const { parentFolderId, userId } = options;

  try {
    // Rate limit outbound Drive calls per-user (fallback: global).
    // Global 5/min is too strict and causes exports to "fail" during normal use.
    const rateKey = userId || "global";
    console.log(`[Google Drive] Checking rate limit (max 60 calls per minute) for key: ${rateKey}...`);
    checkOutboundLimit("gdrive", 60, rateKey);
    console.log("[Google Drive] Rate limit check passed ✓");
  } catch (rateLimitError) {
    console.error("========================================");
    console.error("[Google Drive] RATE LIMIT EXCEEDED!");
    console.error("[Google Drive] Rate limit error details:", {
      message: rateLimitError.message,
      name: rateLimitError.name,
      scope: rateLimitError.scope,
      stack: rateLimitError.stack
    });
    // Re-throw with more context but keep the original error type
    if (rateLimitError instanceof OutboundRateLimitError) {
      throw rateLimitError;
    }
    throw new Error(`Google Drive rate limit exceeded (max 5 calls per minute). Please wait a minute and try again.`);
  }
  const oauth2Client = createDriveOAuthClient();

  // Set up token refresh listener if userId is provided
  if (userId) {
    oauth2Client.on("tokens", async (tokens) => {
      if (tokens.access_token && userId) {
        try {
          const updateData = {
            driveAccessToken: tokens.access_token,
          };

          if (tokens.refresh_token) {
            updateData.driveRefreshToken = tokens.refresh_token;
          }

          if (tokens.expiry_date) {
            updateData.driveTokenExpiry = new Date(tokens.expiry_date);
          } else {
            updateData.driveTokenExpiry = new Date(Date.now() + 3600000);
          }

          await User.findByIdAndUpdate(userId, updateData);
          console.log("[Google Drive] Tokens refreshed and saved to database for user:", userId);
        } catch (error) {
          console.error("[Google Drive] Error saving refreshed tokens:", error);
        }
      }
    });
  }

  // Check if token is expired and refresh if needed
  if (tokens.refresh_token) {
    try {
      // Check if token is likely expired (Google tokens expire after 1 hour)
      // Add a 5-minute buffer to refresh before actual expiry
      const expiryTime = tokens.expiry_date || 0;
      const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
      const isExpired = expiryTime && (expiryTime - bufferTime) < Date.now();
      
      if (isExpired) {
        console.log("[Google Drive] Access token expired or expiring soon, refreshing...", {
          expiryTime: new Date(expiryTime).toISOString(),
          currentTime: new Date().toISOString()
        });
        
        oauth2Client.setCredentials({
          refresh_token: tokens.refresh_token,
        });
        
        const { credentials } = await oauth2Client.refreshAccessToken();
        
        if (!credentials.access_token) {
          throw new Error("Token refresh did not return a new access token");
        }
        
        // Update tokens with refreshed credentials
        tokens = {
          access_token: credentials.access_token,
          refresh_token: credentials.refresh_token || tokens.refresh_token,
          expiry_date: credentials.expiry_date || Date.now() + 3600000,
        };

        // Update user with new tokens if userId is provided
        if (userId) {
          const newExpiryDate = new Date();
          if (credentials.expiry_date) {
            newExpiryDate.setTime(credentials.expiry_date);
          } else {
            newExpiryDate.setHours(newExpiryDate.getHours() + 1);
          }

          await User.findByIdAndUpdate(userId, {
            driveAccessToken: credentials.access_token,
            driveTokenExpiry: newExpiryDate,
            ...(credentials.refresh_token && { driveRefreshToken: credentials.refresh_token }),
          });
          console.log("[Google Drive] Token refreshed and saved for user:", userId, {
            newExpiryDate: newExpiryDate.toISOString()
          });
        }
        
        console.log("[Google Drive] Token refresh successful");
      } else {
        console.log("[Google Drive] Access token is still valid", {
          expiryTime: new Date(expiryTime).toISOString()
        });
      }
    } catch (refreshError) {
      console.error("[Google Drive] Error refreshing token:", {
        message: refreshError.message,
        code: refreshError.code,
        response: refreshError.response?.data,
        stack: refreshError.stack
      });
      
      // If refresh fails with invalid_grant, throw a more specific error
      if (refreshError.response?.data?.error === 'invalid_grant' || 
          refreshError.message?.includes('invalid_grant')) {
        throw new Error('invalid_grant: Please reconnect Google Drive in Settings.');
      }
      
      // If refresh fails for other reasons, we'll still try with the existing token
      // It might work if the token is still valid
      console.log("[Google Drive] Continuing with existing token despite refresh error");
    }
  } else {
    console.log("[Google Drive] No refresh token available, using access token as-is");
  }

  // Set credentials with the (possibly refreshed) tokens
  oauth2Client.setCredentials(tokens);
  const drive = google.drive({ version: "v3", auth: oauth2Client });

  // Verify parent folder exists if specified
  if (parentFolderId) {
    try {
      await drive.files.get({
        fileId: parentFolderId,
        fields: "id, name, mimeType",
        supportsAllDrives: true,
      });
      console.log(`[Google Drive] Parent folder verified: ${parentFolderId}`);
    } catch (folderError) {
      console.error(`[Google Drive] Error verifying parent folder ${parentFolderId}:`, {
        message: folderError.message,
        code: folderError.code,
        response: folderError.response?.data
      });
      throw new Error(`The specified Reports folder (${parentFolderId}) does not exist or is not accessible. Please check GOOGLE_DRIVE_REPORTS_FOLDER_ID.`);
    }
  }

  // Verify file exists before uploading
  try {
    const fileStats = await fs.promises.stat(filePath);
    console.log(`[Google Drive] File exists, size: ${fileStats.size} bytes`);
    if (fileStats.size === 0) {
      throw new Error("File is empty and cannot be uploaded.");
    }
  } catch (statError) {
    console.error(`[Google Drive] Error checking file:`, statError);
    throw new Error(`File not found or cannot be read: ${statError.message}`);
  }

  const fileMetadata = parentFolderId
    ? { name: fileName, parents: [parentFolderId] }
    : { name: fileName };
  const media = { mimeType: mimeType, body: fs.createReadStream(filePath) };

  console.log("[Google Drive] Uploading file to Google Drive:", {
    fileName,
    mimeType,
    parentFolderId: parentFolderId || "root",
    filePath,
  });

  try {
    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: "id, webViewLink, iconLink, thumbnailLink, name, mimeType, parents",
      supportsAllDrives: true,
    });

    if (!response.data || !response.data.id) {
      throw new Error("Upload completed but did not return a valid file ID.");
    }

    console.log("[Google Drive] File uploaded successfully:", {
      fileId: response.data.id,
      fileName: response.data.name,
      webViewLink: response.data.webViewLink,
      parents: response.data.parents,
    });

    return {
      file: response.data,
      tokens: oauth2Client.credentials,
    };
  } catch (uploadError) {
    console.error("[Google Drive] Upload error details:", {
      message: uploadError.message,
      code: uploadError.code,
      response: uploadError.response?.data,
      status: uploadError.response?.status,
      statusText: uploadError.response?.statusText
    });
    
    // Re-throw with more context
    if (uploadError.response?.data?.error) {
      const errorMessage = uploadError.response.data.error_description || uploadError.response.data.error;
      throw new Error(`Google Drive API error: ${errorMessage}`);
    }
    throw uploadError;
  }
};

// Download File from Google Drive
export const downloadFileFromDrive = async (fileId, accessToken) => {
  // Downloads are also outbound Drive calls; keep them per-scope but less strict than 5/min.
  checkOutboundLimit("gdrive", 60, "global");
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