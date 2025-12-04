import { createDriveOAuthClient, uploadFileToDrive } from '../utils/googleDrive.js';
import { createSheetsOAuthClient } from '../utils/googleSheets.js';
import User from '../models/User.js';
import DriveUpload from '../models/DriveUpload.js';

const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive.file'];

// Generate Google Drive OAuth URL
export const getAuthUrl = async (req, res) => {
  try {
    const oauth2Client = createDriveOAuthClient();
    // Add service identifier to state so callback can route correctly
    const state = `drive:${req.user.id}`;
    
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'select_account consent', // Show account picker to select from existing accounts, then consent if needed
      scope: DRIVE_SCOPES,
      state: state,
    });
    res.json({ authUrl });
  } catch (error) {
    console.error('Drive auth-url error:', error);
    res.status(500).json({ message: 'Failed to generate Google Drive authorization URL' });
  }
};

// OAuth callback to save Drive tokens
// Also handles Google Sheets callbacks since they use the same redirect URI
export const handleCallback = async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code) {
      return res.status(400).json({ message: 'Authorization code not provided' });
    }

    // Parse state to determine which service (drive or sheets)
    let service = 'drive'; // default
    let userId = state;
    
    if (state && state.includes(':')) {
      const [servicePart, userPart] = state.split(':');
      if (servicePart === 'sheets' || servicePart === 'drive') {
        service = servicePart;
        userId = userPart;
      }
    }

    // Use the appropriate OAuth client based on service
    const oauth2Client = service === 'sheets' 
      ? createSheetsOAuthClient()
      : createDriveOAuthClient();
    
    const { tokens } = await oauth2Client.getToken(code);

    const expiryDate = new Date();
    if (tokens.expiry_date) {
      expiryDate.setTime(tokens.expiry_date);
    } else {
      expiryDate.setHours(expiryDate.getHours() + 1);
    }

    if (userId) {
      if (service === 'sheets') {
        await User.findByIdAndUpdate(
          userId,
          {
            sheetsAccessToken: tokens.access_token,
            sheetsRefreshToken: tokens.refresh_token || undefined,
            sheetsTokenExpiry: expiryDate,
            sheetsConnected: true,
          },
          { new: true }
        );
      } else {
        await User.findByIdAndUpdate(
          userId,
          {
            driveAccessToken: tokens.access_token,
            driveRefreshToken: tokens.refresh_token || undefined,
            driveTokenExpiry: expiryDate,
            driveConnected: true,
          },
          { new: true }
        );
      }
    }

    const redirectPath = '/drive/connected';
    res.redirect(`${process.env.FRONTEND_URL}${redirectPath}`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    const redirectPath = '/drive/error';
    res.redirect(`${process.env.FRONTEND_URL}${redirectPath}`);
  }
};

// Upload a local file to Google Drive and save metadata
export const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    const user = await User.findById(req.user.id);
    if (!user || !user.driveAccessToken) {
      return res.status(401).json({ message: 'Google Drive not connected' });
    }
    const tokens = {
      access_token: user.driveAccessToken,
      refresh_token: user.driveRefreshToken,
      expiry_date: user.driveTokenExpiry ? user.driveTokenExpiry.getTime() : undefined,
    };
    const { file: driveResult, tokens: updatedTokens } = await uploadFileToDrive(
      req.file.path,
      req.file.originalname,
      req.file.mimetype,
      tokens
    );

    if (updatedTokens) {
      const updates = {};
      if (updatedTokens.access_token && updatedTokens.access_token !== user.driveAccessToken) {
        updates.driveAccessToken = updatedTokens.access_token;
      }
      if (updatedTokens.expiry_date) {
        updates.driveTokenExpiry = new Date(updatedTokens.expiry_date);
      }
      if (Object.keys(updates).length) {
        await User.findByIdAndUpdate(user._id, updates, { new: false });
      }
    }

    const record = await DriveUpload.create({
      name: driveResult?.name || req.file.originalname,
      mimeType: driveResult?.mimeType || req.file.mimetype,
      size: req.file.size,
      driveFileId: driveResult?.id,
      webViewLink: driveResult?.webViewLink,
      iconLink: driveResult?.iconLink,
      thumbnailLink: driveResult?.thumbnailLink,
      type: req.body.type || 'other',
      ownerEmail: user.email,
      owner: user._id,
      sharedWithRoles: req.body.sharedWithRoles ? JSON.parse(req.body.sharedWithRoles) : undefined,
      sharedWithUsers: req.body.sharedWithUsers ? JSON.parse(req.body.sharedWithUsers) : undefined,
      research: req.body.research || undefined,
    });

    res.json({ message: 'Uploaded to Drive', file: record });
  } catch (error) {
    console.error('Drive upload route error:', error);
    res.status(500).json({ message: error.message || 'Upload failed' });
  }
};

// Save a Google Picker-selected file (no re-upload)
export const savePickerFile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const {
      id, name, mimeType, webViewLink, iconLink, thumbnailLink, size,
      ownerEmail, type, research, sharedWithRoles, sharedWithUsers
    } = req.body;

    if (!id || !name || !mimeType || !webViewLink) {
      return res.status(400).json({ message: 'Missing required file metadata' });
    }

    const record = await DriveUpload.create({
      name,
      mimeType,
      size,
      driveFileId: id,
      webViewLink,
      iconLink,
      thumbnailLink,
      type: type || 'other',
      ownerEmail: ownerEmail || user.email,
      owner: user._id,
      sharedWithRoles,
      sharedWithUsers,
      research,
    });

    res.json({ message: 'Saved Picker file', file: record });
  } catch (error) {
    console.error('Save Picker error:', error);
    res.status(500).json({ message: error.message || 'Failed to save file' });
  }
};

// Get current user's Drive status
export const getStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      'driveConnected driveAccessToken driveRefreshToken driveTokenExpiry email name role'
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const hasAccessToken = Boolean(user.driveAccessToken);
    const hasRefreshToken = Boolean(user.driveRefreshToken);
    const tokenExpiresAt = user.driveTokenExpiry || null;
    const connected = Boolean(user.driveConnected && hasAccessToken);
    const needsReconnect =
      connected && tokenExpiresAt ? tokenExpiresAt.getTime() < Date.now() : false;

    res.json({
      connected,
      driveConnected: user.driveConnected,
      hasAccessToken,
      hasRefreshToken,
      tokenExpiresAt,
      needsReconnect,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    console.error('Error fetching drive status:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch drive status' });
  }
};

// Get Drive access token for Picker (if valid and not expired)
export const getAccessToken = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      'driveConnected driveAccessToken driveRefreshToken driveTokenExpiry'
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.driveConnected || !user.driveAccessToken) {
      return res.status(401).json({ message: 'Google Drive not connected' });
    }

    // Check if token is expired
    const tokenExpiresAt = user.driveTokenExpiry;
    const isExpired = tokenExpiresAt && tokenExpiresAt.getTime() < Date.now();

    // If expired, try to refresh using refresh token
    if (isExpired && user.driveRefreshToken) {
      try {
        const oauth2Client = createDriveOAuthClient();
        oauth2Client.setCredentials({
          refresh_token: user.driveRefreshToken,
        });
        
        const { credentials } = await oauth2Client.refreshAccessToken();
        
        // Update user with new tokens
        const newExpiryDate = new Date();
        if (credentials.expiry_date) {
          newExpiryDate.setTime(credentials.expiry_date);
        } else {
          newExpiryDate.setHours(newExpiryDate.getHours() + 1);
        }

        await User.findByIdAndUpdate(user._id, {
          driveAccessToken: credentials.access_token,
          driveTokenExpiry: newExpiryDate,
          ...(credentials.refresh_token && { driveRefreshToken: credentials.refresh_token }),
        });

        return res.json({
          accessToken: credentials.access_token,
          expiresAt: newExpiryDate,
        });
      } catch (refreshError) {
        console.error('Error refreshing Drive token:', refreshError);
        return res.status(401).json({ 
          message: 'Access token expired and refresh failed. Please reconnect Google Drive in Settings.' 
        });
      }
    }

    if (isExpired) {
      return res.status(401).json({ 
        message: 'Access token expired. Please reconnect Google Drive in Settings.' 
      });
    }

    // Return the access token (it's safe to expose since user is authenticated)
    res.json({
      accessToken: user.driveAccessToken,
      expiresAt: tokenExpiresAt,
    });
  } catch (error) {
    console.error('Error fetching drive access token:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch access token' });
  }
};

// Disconnect Drive
export const disconnect = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Clear Drive-related fields using $unset to properly remove them
    // Using $unset with empty string removes the field from the document
    await User.findByIdAndUpdate(
      req.user.id,
      {
        $unset: {
          driveAccessToken: '',
          driveRefreshToken: '',
          driveTokenExpiry: ''
        },
        $set: {
          driveConnected: false
        }
      },
      { 
        new: true,
        runValidators: false // Skip validation to avoid password requirement issues
      }
    );

    res.json({ message: 'Google Drive disconnected successfully' });
  } catch (error) {
    console.error('Drive disconnect error:', error);
    res.status(500).json({ 
      message: 'Failed to disconnect Google Drive',
      error: error.message 
    });
  }
};

// List uploads owned by the current user
export const getMyUploads = async (req, res) => {
  try {
    const files = await DriveUpload.find({ owner: req.user.id }).sort({ createdAt: -1 });
    res.json(files);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// List uploads shared with the current user's role
export const getSharedUploads = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('role');
    const files = await DriveUpload.find({ sharedWithRoles: user.role }).sort({ createdAt: -1 });
    res.json(files);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

