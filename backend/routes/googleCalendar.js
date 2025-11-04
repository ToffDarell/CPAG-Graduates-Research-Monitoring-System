import express from 'express';
import { google } from 'googleapis';
import { protect } from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
];

/**
 * Generate Google OAuth authorization URL
 */
router.get('/auth-url', protect, (req, res) => {
  try {
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
      state: req.user.id,
    });

    res.json({ 
      authUrl,
      message: 'Please visit this URL to authorize Google Calendar access' 
    });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ message: 'Failed to generate authorization URL' });
  }
});

/**
 * Handle Google OAuth callback
 */
router.get('/callback', async (req, res) => {
  try {
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

    const userId = state;
    if (userId) {
      await User.findByIdAndUpdate(userId, {
        googleAccessToken: tokens.access_token,
        googleRefreshToken: tokens.refresh_token || undefined,
        googleTokenExpiry: expiryDate,
        calendarConnected: true,
      });
    }

    res.redirect(`${process.env.FRONTEND_URL}/dashboard/faculty?calendar=connected`);
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    res.redirect(`${process.env.FRONTEND_URL}/dashboard/faculty?calendar=error`);
  }
});

/**
 * Check calendar connection status
 */
router.get('/status', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('calendarConnected googleTokenExpiry');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isConnected = user.calendarConnected && user.googleTokenExpiry > new Date();

    res.json({
      connected: isConnected,
      expiresAt: user.googleTokenExpiry,
      needsReauth: user.calendarConnected && user.googleTokenExpiry <= new Date(),
    });
  } catch (error) {
    console.error('Error checking calendar status:', error);
    res.status(500).json({ message: 'Error checking calendar status' });
  }
});

/**
 * Disconnect Google Calendar
 */
router.post('/disconnect', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.googleAccessToken) {
      try {
        await oauth2Client.revokeToken(user.googleAccessToken);
      } catch (revokeError) {
        console.error('Error revoking token:', revokeError);
      }
    }

    user.googleAccessToken = undefined;
    user.googleRefreshToken = undefined;
    user.googleTokenExpiry = undefined;
    user.calendarConnected = false;
    await user.save();

    res.json({ message: 'Google Calendar disconnected successfully' });
  } catch (error) {
    console.error('Error disconnecting calendar:', error);
    res.status(500).json({ message: 'Error disconnecting calendar' });
  }
});

export default router;


