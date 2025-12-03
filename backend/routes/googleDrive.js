import express from 'express';
import multer from 'multer';
import { protect } from '../middleware/auth.js';
import {
  getAuthUrl,
  handleCallback,
  uploadFile,
  savePickerFile,
  getStatus,
  getAccessToken,
  disconnect,
  getMyUploads,
  getSharedUploads
} from '../controllers/googleDriveController.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Generate Google Drive OAuth URL
router.get('/auth-url', protect, getAuthUrl);

// OAuth callback to save Drive tokens
router.get('/callback', handleCallback);

// Upload a local file to Google Drive and save metadata
router.post('/upload', protect, upload.single('file'), uploadFile);

// Save a Google Picker-selected file (no re-upload)
router.post('/save-picker', protect, savePickerFile);

// Get current user's Drive status
router.get('/status', protect, getStatus);

// Get Drive access token for Picker (if valid and not expired)
router.get('/access-token', protect, getAccessToken);

// Disconnect Drive
router.post('/disconnect', protect, disconnect);

// List uploads owned by the current user
router.get('/my-uploads', protect, getMyUploads);

// List uploads shared with the current user's role
router.get('/shared', protect, getSharedUploads);

export default router;
