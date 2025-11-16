# Google Calendar OAuth Setup Guide

## ✅ Configuration Verified

Your Google OAuth 2.0 client is correctly configured with:

### Authorized JavaScript Origins
- `http://localhost`
- `http://localhost:5173`

### Authorized Redirect URIs
- `http://localhost:5000/api/google-calendar/callback` ✅
- `http://127.0.0.1:5000/api/google-calendar/callback` ✅

## 🔧 Required Environment Variables

Make sure your `.env` file in the project root contains:

```env
# Google OAuth 2.0 Credentials
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:5000/api/google-calendar/callback

# Frontend URL (for OAuth redirects)
FRONTEND_URL=http://localhost:5173

# Backend Port (optional, defaults to 5000)
PORT=5000
```

## 📋 OAuth Flow

1. **User clicks "Connect Google Calendar"** → Frontend calls `/api/google-calendar/auth-url`
2. **Backend generates OAuth URL** → Returns authorization URL with:
   - `access_type: 'offline'` (to get refresh token)
   - `prompt: 'consent'` (to force refresh token generation)
   - `scope: calendar + calendar.events`
3. **User authorizes** → Google redirects to `/api/google-calendar/callback`
4. **Backend exchanges code for tokens** → Saves to user document:
   - `googleAccessToken`
   - `googleRefreshToken` ⭐ (critical for automatic token refresh)
   - `googleTokenExpiry`
   - `calendarConnected: true`
5. **User redirected** → Back to dashboard with `?calendar=connected`

## 🔑 Key Features

### Automatic Token Refresh
- Tokens are automatically refreshed when they expire
- Refresh tokens are saved to the database
- No manual re-authentication needed

### Calendar Event Creation
- Panel schedules (Program Head) → Auto-syncs to Google Calendar
- Consultation slots (Faculty) → Auto-syncs to Google Calendar
- Includes Google Meet links
- Sends calendar invitations to all participants

## 🐛 Troubleshooting

### Issue: `calendarSynced: false`
**Cause**: Missing refresh token
**Solution**: 
1. Disconnect Google Calendar in the app
2. Reconnect (this forces `prompt: 'consent'` to get refresh token)
3. Create a new schedule/slot

### Issue: "Error: redirect_uri_mismatch"
**Cause**: Redirect URI in `.env` doesn't match Google Console
**Solution**: 
- Verify `GOOGLE_REDIRECT_URI=http://localhost:5000/api/google-calendar/callback`
- Check Google Console has the exact same URI
- Wait 5 minutes for changes to propagate

### Issue: Tokens not refreshing
**Cause**: No refresh token stored
**Solution**:
- Ensure `prompt: 'consent'` is set (it is, line 37 in `googleCalendar.js`)
- User must reconnect calendar to get refresh token
- Check database for `googleRefreshToken` field

## 📝 Notes

- **Refresh Token**: Only issued on first authorization with `prompt: 'consent'`
- **Token Expiry**: Access tokens expire in 1 hour, refresh tokens don't expire
- **Automatic Refresh**: Handled by `googleapis` library via `oauth2Client.on('tokens')`
- **Database Update**: Refreshed tokens are automatically saved to user document

## 🔍 Verification

Check if setup is working:
1. Connect Google Calendar in the app
2. Check database: `User` document should have:
   - `calendarConnected: true`
   - `googleAccessToken: "..."` (present)
   - `googleRefreshToken: "..."` (present) ⭐
   - `googleTokenExpiry: Date` (present)
3. Create a panel schedule or consultation slot
4. Check schedule document: `calendarSynced: true`
5. Check Google Calendar: Event should appear with Meet link

## 🚀 Production Setup

For production, update:
1. **Google Console**: Add production redirect URIs
2. **Environment Variables**: 
   - `GOOGLE_REDIRECT_URI=https://yourdomain.com/api/google-calendar/callback`
   - `FRONTEND_URL=https://yourdomain.com`
3. **Authorized JavaScript Origins**: Add your production domain
4. **Authorized Redirect URIs**: Add your production callback URL

---

**Last Updated**: Based on current codebase configuration
**Status**: ✅ Configuration matches backend routes





