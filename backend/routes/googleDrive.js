import express from 'express';
import multer from 'multer';
import { createDriveOAuthClient, uploadFileToDrive } from '../utils/googleDrive.js';
import { protect } from '../middleware/auth.js';
import User from '../models/User.js';
import DriveUpload from '../models/DriveUpload.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive.file'];

// Generate Google Drive OAuth URL
router.get('/auth-url', protect, (req, res) => {
  try {
    const oauth2Client = createDriveOAuthClient();
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: DRIVE_SCOPES,
      state: req.user.id,
    });
    res.json({ authUrl });
  } catch (error) {
    console.error('Drive auth-url error:', error);
    res.status(500).json({ message: 'Failed to generate Google Drive authorization URL' });
  }
});

// OAuth callback to save Drive tokens
router.get('/callback', async (req, res) => {
  try {
    const oauth2Client = createDriveOAuthClient();
    const { code, state } = req.query;
    if (!code) {
      return res.status(400).json({ message: 'Authorization code not provided' });
    }
    const { tokens } = await oauth2Client.getToken(code);

    const expiryDate = new Date();
    if (tokens.expiry_date) {
      expiryDate.setTime(tokens.expiry_date);
    } else {
      expiryDate.setHours(expiryDate.getHours() + 1);
    }

    if (state) {
      await User.findByIdAndUpdate(
        state,
        {
          driveAccessToken: tokens.access_token,
          driveRefreshToken: tokens.refresh_token || undefined,
          driveTokenExpiry: expiryDate,
          driveConnected: true,
        },
        { new: true }
      );
    }

    const redirectPath = '/drive/connected';
    res.redirect(`${process.env.FRONTEND_URL}${redirectPath}`);
  } catch (error) {
    console.error('Drive OAuth callback error:', error);
    const redirectPath = '/drive/error';
    res.redirect(`${process.env.FRONTEND_URL}${redirectPath}`);
  }
});

// Upload a local file to Google Drive and save metadata
router.post('/upload', protect, upload.single('file'), async (req, res) => {
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
    const driveResult = await uploadFileToDrive(
      req.file.path,
      req.file.originalname,
      req.file.mimetype,
      tokens
    );

    const record = await DriveUpload.create({
      name: driveResult.name || req.file.originalname,
      mimeType: driveResult.mimeType || req.file.mimetype,
      size: req.file.size,
      driveFileId: driveResult.id,
      webViewLink: driveResult.webViewLink,
      iconLink: driveResult.iconLink,
      thumbnailLink: driveResult.thumbnailLink,
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
});

// Save a Google Picker-selected file (no re-upload)
router.post('/save-picker', protect, async (req, res) => {
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
});

// List uploads owned by the current user
router.get('/my-uploads', protect, async (req, res) => {
  try {
    const files = await DriveUpload.find({ owner: req.user.id }).sort({ createdAt: -1 });
    res.json(files);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// List uploads shared with the current user's role
router.get('/shared', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('role');
    const files = await DriveUpload.find({ sharedWithRoles: user.role }).sort({ createdAt: -1 });
    res.json(files);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;

