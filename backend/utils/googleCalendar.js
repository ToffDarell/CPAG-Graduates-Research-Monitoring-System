import { google } from 'googleapis';
import User from '../models/User.js';

// Initialize Calendar client with automatic token refresh
export const getCalendarClient = async (userId, accessToken, refreshToken) => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  // Set up token refresh listener to automatically update database
  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token && userId) {
      try {
        const updateData = {
          googleAccessToken: tokens.access_token,
        };
        
        if (tokens.refresh_token) {
          updateData.googleRefreshToken = tokens.refresh_token;
        }
        
        if (tokens.expiry_date) {
          updateData.googleTokenExpiry = new Date(tokens.expiry_date);
        } else {
          // Default to 1 hour if no expiry date provided
          updateData.googleTokenExpiry = new Date(Date.now() + 3600000);
        }
        
        await User.findByIdAndUpdate(userId, updateData);
        console.log('[Google Calendar] Tokens refreshed and saved to database for user:', userId);
      } catch (error) {
        console.error('[Google Calendar] Error saving refreshed tokens:', error);
      }
    }
  });

  // Set initial credentials
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  // Note: Token refresh will happen automatically by googleapis when making API calls
  // if the token is expired and a refresh token is available. We don't need to
  // proactively refresh here - the oauth2Client will handle it automatically.

  return google.calendar({ version: 'v3', auth: oauth2Client });
};

/**
 * Create a consultation event in Google Calendar
 */
// Helper function to convert UTC datetime to Manila timezone for Google Calendar
const formatDateTimeForManila = (date) => {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error('Invalid date object');
  }

  // Get UTC milliseconds (always UTC, regardless of server timezone)
  const utcMilliseconds = date.getTime();
  
  // Manila is UTC+8, so add 8 hours (8 * 60 * 60 * 1000 milliseconds)
  const manilaMilliseconds = utcMilliseconds + (8 * 60 * 60 * 1000);
  
  // Create a Date object representing Manila time
  // Note: This Date object still represents the same moment in time, just displayed differently
  const manilaDate = new Date(manilaMilliseconds);
  
  // Now format this as if it were in Manila timezone
  // We'll use Intl.DateTimeFormat to format it, but we need to be careful
  // The Date object represents UTC time, but we want Manila time components
  
  // Actually, the simplest approach: Get UTC components after adding 8 hours
  // This works because we're adding 8 hours to UTC, which gives us Manila time
  const manilaYear = manilaDate.getUTCFullYear();
  const manilaMonth = manilaDate.getUTCMonth();
  const manilaDay = manilaDate.getUTCDate();
  const manilaHours = manilaDate.getUTCHours();
  const manilaMinutes = manilaDate.getUTCMinutes();
  const manilaSeconds = manilaDate.getUTCSeconds();
  
  // Format with leading zeros
  const year = String(manilaYear);
  const month = String(manilaMonth + 1).padStart(2, '0');
  const day = String(manilaDay).padStart(2, '0');
  const hour = String(manilaHours).padStart(2, '0');
  const minute = String(manilaMinutes).padStart(2, '0');
  const second = String(manilaSeconds).padStart(2, '0');

  const result = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  
  // Debug logging
  const originalUTCHours = date.getUTCHours();
  const convertedManilaHours = parseInt(hour);
  console.log('[formatDateTimeForManila] Manual conversion:', {
    inputUTC: date.toISOString(),
    inputUTCHours: originalUTCHours,
    outputManila: result,
    manilaHours: convertedManilaHours,
    expected: originalUTCHours + 8 >= 24 ? (originalUTCHours + 8 - 24) : (originalUTCHours + 8),
    conversionMethod: 'manual (UTC+8)',
    conversionCorrect: convertedManilaHours === (originalUTCHours + 8 >= 24 ? (originalUTCHours + 8 - 24) : (originalUTCHours + 8))
  });

  // Return RFC3339 format: "YYYY-MM-DDTHH:mm:ss"
  // When combined with timeZone: 'Asia/Manila', Google Calendar will interpret
  // this datetime as being in Manila timezone
  return result;
};

export const createConsultationEvent = async (scheduleData, accessToken, refreshToken, userId) => {
  try {
    console.log('[Google Calendar] Creating event:', {
      title: scheduleData.title,
      datetime: scheduleData.datetime,
      datetimeType: typeof scheduleData.datetime,
      location: scheduleData.location,
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
      userId: userId
    });
    
    const calendar = await getCalendarClient(userId, accessToken, refreshToken);

    // The datetime from database is in UTC, convert to Manila timezone for Google Calendar
    // Database: 2025-11-23T07:00:00.000Z (7:00 AM UTC)
    // Should send: 2025-11-23T15:00:00 (3:00 PM Manila time = 7 AM UTC + 8 hours)
    
    // IMPORTANT: Ensure we're working with UTC time
    // scheduleData.datetime might be a Date object, Mongoose Date, or string
    // Convert to ISO string first to ensure UTC, then create Date object
    let startTime;
    if (scheduleData.datetime instanceof Date) {
      // If it's already a Date object, use toISOString() to get UTC string, then parse
      startTime = new Date(scheduleData.datetime.toISOString());
    } else if (typeof scheduleData.datetime === 'string') {
      // If it's a string, parse it directly
      startTime = new Date(scheduleData.datetime);
    } else {
      // Fallback: try to convert
      startTime = new Date(scheduleData.datetime);
    }
    
    // Ensure we have a valid UTC Date object by using getTime() which always returns UTC milliseconds
    const utcMilliseconds = startTime.getTime();
    if (isNaN(utcMilliseconds)) {
      throw new Error(`Invalid datetime: ${scheduleData.datetime}`);
    }
    
    // Create fresh Date objects from UTC milliseconds to avoid timezone issues
    startTime = new Date(utcMilliseconds);
    const endTime = new Date(utcMilliseconds + (scheduleData.duration || 60) * 60000);

    // Verify the Date object is correct
    console.log('[Google Calendar] Date object created:', {
      inputDatetime: scheduleData.datetime,
      inputType: typeof scheduleData.datetime,
      inputIsDate: scheduleData.datetime instanceof Date,
      startTimeISO: startTime.toISOString(),
      startTimeUTC: startTime.toUTCString(),
      startTimeUTCHours: startTime.getUTCHours(),
      startTimeUTCMinutes: startTime.getUTCMinutes(),
      startTimeMilliseconds: startTime.getTime(),
      serverTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });

    const startDateTime = formatDateTimeForManila(startTime);
    const endDateTime = formatDateTimeForManila(endTime);

    // Debug logging to verify conversion
    // Get UTC hours for logging (always get it fresh to avoid any scope issues)
    const utcHoursForLogging = startTime.getUTCHours();
    const manilaHoursForLogging = parseInt(startDateTime.split('T')[1].split(':')[0]);
    let expectedManilaHoursForLogging = utcHoursForLogging + 8;
    if (expectedManilaHoursForLogging >= 24) {
      expectedManilaHoursForLogging = expectedManilaHoursForLogging - 24;
    }

    console.log('[Google Calendar] Datetime conversion:', {
      originalUTC: startTime.toISOString(),
      originalUTCHours: utcHoursForLogging,
      originalUTCMinutes: startTime.getUTCMinutes(),
      convertedManila: startDateTime,
      manilaHours: manilaHoursForLogging,
      manilaMinutes: parseInt(startDateTime.split('T')[1].split(':')[1]),
      expectedManilaHours: expectedManilaHoursForLogging,
      conversionCorrect: manilaHoursForLogging === expectedManilaHoursForLogging,
      timeDifference: manilaHoursForLogging - utcHoursForLogging,
      expectedDifference: 8
    });

    const event = {
      summary: scheduleData.title || 'Thesis Consultation',
      description: `
${scheduleData.description || 'Consultation session'}

Location: ${scheduleData.location}
Type: ${scheduleData.type}
${scheduleData.researchTitle ? `Research: ${scheduleData.researchTitle}` : ''}
      `.trim(),
      location: scheduleData.location,
      start: {
        dateTime: startDateTime,
        timeZone: 'Asia/Manila',
      },
      end: {
        dateTime: endDateTime,
        timeZone: 'Asia/Manila',
      },
      attendees: scheduleData.attendeeEmails?.map(email => ({ email })) || [],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 30 },
        ],
      },
      conferenceData: {
        createRequest: {
          requestId: `consult-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    };

    // CRITICAL: Log exactly what we're sending to Google Calendar
    console.log('[Google Calendar] FINAL EVENT DATA BEING SENT:', {
      summary: event.summary,
      start: {
        dateTime: event.start.dateTime,
        timeZone: event.start.timeZone,
        // Verify what Google Calendar will receive
        willShowAs: `Google Calendar will show this as: ${event.start.dateTime} ${event.start.timeZone}`
      },
      end: {
        dateTime: event.end.dateTime,
        timeZone: event.end.timeZone
      },
      location: event.location
    });
    
    // Double-check: If we're sending 07:00:00, it will show as 7:00 AM Manila time
    // If we're sending 15:00:00, it will show as 3:00 PM Manila time
    const startHour = parseInt(event.start.dateTime.split('T')[1].split(':')[0]);
    const checkUTCHours = startTime.getUTCHours();
    if (startHour === 7 && checkUTCHours === 7) {
      console.error('[Google Calendar] ERROR: Sending UTC time (07:00) instead of Manila time (15:00)!');
      console.error('[Google Calendar] Conversion did not work! UTC hours:', checkUTCHours, 'Manila hours:', startHour);
    }
    
    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
      conferenceDataVersion: 1,
      sendUpdates: 'all',
    });

    console.log('[Google Calendar] Response from Google Calendar API:', {
      eventId: response.data.id,
      start: response.data.start,
      end: response.data.end,
      startDateTime: response.data.start.dateTime,
      startTimeZone: response.data.start.timeZone,
      htmlLink: response.data.htmlLink
    });
    
    // Verify what Google Calendar actually stored
    const responseStartHour = response.data.start.dateTime 
      ? parseInt(response.data.start.dateTime.split('T')[1]?.split(':')[0] || '0')
      : null;
    console.log('[Google Calendar] Event stored in Google Calendar with hour:', responseStartHour);

    console.log('[Google Calendar] Event created successfully:', {
      eventId: response.data.id,
      eventLink: response.data.htmlLink,
      meetLink: response.data.hangoutLink
    });

    return {
      eventId: response.data.id,
      eventLink: response.data.htmlLink,
      meetLink: response.data.hangoutLink,
      success: true,
    };
  } catch (error) {
    console.error('[Google Calendar] Error creating event:', error);
    console.error('[Google Calendar] Error details:', {
      message: error.message,
      code: error.code,
      response: error.response?.data,
      status: error.response?.status,
      statusText: error.response?.statusText
    });
    throw new Error(`Failed to create calendar event: ${error.message}`);
  }
};

/**
 * Update an existing calendar event
 */
export const updateCalendarEvent = async (eventId, updates, accessToken, refreshToken, userId) => {
  try {
    const calendar = await getCalendarClient(userId, accessToken, refreshToken);

    const updateData = {};

    if (updates.title) {
      updateData.summary = updates.title;
    }

    if (updates.description) {
      updateData.description = updates.description;
    }

    if (updates.location) {
      updateData.location = updates.location;
    }

    if (updates.datetime) {
      const startTime = new Date(updates.datetime);
      const endTime = new Date(startTime.getTime() + (updates.duration || 60) * 60000);
      
      // Use the shared formatDateTimeForManila function
      updateData.start = {
        dateTime: formatDateTimeForManila(startTime),
        timeZone: 'Asia/Manila',
      };
      updateData.end = {
        dateTime: formatDateTimeForManila(endTime),
        timeZone: 'Asia/Manila',
      };

      console.log('[Google Calendar] Update datetime conversion:', {
        originalUTC: startTime.toISOString(),
        convertedManila: updateData.start.dateTime,
        timeZone: 'Asia/Manila'
      });
    }

    if (updates.attendeeEmails) {
      updateData.attendees = updates.attendeeEmails.map(email => ({ email }));
    }

    const response = await calendar.events.patch({
      calendarId: 'primary',
      eventId: eventId,
      requestBody: updateData,
      sendUpdates: 'all',
    });

    return {
      eventId: response.data.id,
      eventLink: response.data.htmlLink,
      meetLink: response.data.hangoutLink,
      success: true,
    };
  } catch (error) {
    console.error('Error updating calendar event:', error);
    throw new Error(`Failed to update calendar event: ${error.message}`);
  }
};

/**
 * Delete a calendar event
 */
export const deleteCalendarEvent = async (eventId, accessToken, refreshToken, userId) => {
  try {
    const calendar = await getCalendarClient(userId, accessToken, refreshToken);

    await calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId,
      sendUpdates: 'all',
    });

    return { success: true, message: 'Event deleted successfully' };
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    throw new Error(`Failed to delete calendar event: ${error.message}`);
  }
};

/**
 * Get events for a specific date range
 */
export const getCalendarEvents = async (startDate, endDate, accessToken, refreshToken, userId) => {
  try {
    const calendar = await getCalendarClient(userId, accessToken, refreshToken);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    return response.data.items || [];
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    throw new Error(`Failed to fetch calendar events: ${error.message}`);
  }
};


