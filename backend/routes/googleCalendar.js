import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  getAuthUrl,
  handleCallback,
  getStatus,
  disconnect
} from '../controllers/googleCalendarController.js';

const router = express.Router();

/**
 * Generate Google OAuth authorization URL
 */
router.get('/auth-url', protect, getAuthUrl);

/**
 * Handle Google OAuth callback
 */
router.get('/callback', handleCallback);

/**
 * Check calendar connection status
 */
router.get('/status', protect, getStatus);

/**
 * Disconnect Google Calendar
 */
router.post('/disconnect', protect, disconnect);

export default router;
