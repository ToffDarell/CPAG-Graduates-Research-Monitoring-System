import { google } from 'googleapis';
import User from '../models/User.js';

const createOAuthClient = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Google OAuth environment variables are not fully configured. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI.'
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
};

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
];

/**
 * Generate Google OAuth authorization URL
 */
export const getAuthUrl = async (req, res) => {
  try {
    const oauth2Client = createOAuthClient();

    // Get user email to use as login hint for account pre-selection
    const user = await User.findById(req.user.id).select('email');
    const loginHint = user?.email || undefined;

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
      state: req.user.id,
      login_hint: loginHint, // Pre-select user's email account
    });

    res.json({ 
      authUrl,
      message: 'Please visit this URL to authorize Google Calendar access' 
    });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ message: 'Failed to generate authorization URL' });
  }
};

/**
 * Handle Google OAuth callback
 */
export const handleCallback = async (req, res) => {
  try {
    const oauth2Client = createOAuthClient();
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
    let redirectPath = '/dashboard/faculty';
    
    if (userId) {
      const user = await User.findByIdAndUpdate(userId, {
        googleAccessToken: tokens.access_token,
        googleRefreshToken: tokens.refresh_token || undefined,
        googleTokenExpiry: expiryDate,
        calendarConnected: true,
      }, { new: true });

      // Redirect based on user role
      if (user) {
        if (user.role === 'program head') {
          redirectPath = '/dashboard/program-head';
        } else if (user.role === 'faculty adviser') {
          redirectPath = '/dashboard/faculty';
        }
      }
    }

    res.redirect(`${process.env.FRONTEND_URL}${redirectPath}?calendar=connected`);
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    // Try to redirect to the correct dashboard, default to faculty if role unknown
    const defaultPath = '/dashboard/faculty';
    res.redirect(`${process.env.FRONTEND_URL}${defaultPath}?calendar=error`);
  }
};

/**
 * Check calendar connection status
 */
export const getStatus = async (req, res) => {
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
};

/**
 * Disconnect Google Calendar
 */
export const disconnect = async (req, res) => {
  try {
    const oauth2Client = createOAuthClient();
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
};

