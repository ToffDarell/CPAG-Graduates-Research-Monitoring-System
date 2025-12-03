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
          updateData.googleTokenExpiry = new Date(Date.now() + 3600000);
        }
        
        await User.findByIdAndUpdate(userId, updateData);
        console.log('[Google Calendar] Tokens refreshed and saved to database for user:', userId);
      } catch (error) {
        console.error('[Google Calendar] Error saving refreshed tokens:', error);
      }
    }
  });

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
};

/**
 * Create a consultation event in Google Calendar
 * Uses toISOString() with timeZone: 'Asia/Manila' - same approach as working implementations
 */
export const createConsultationEvent = async (scheduleData, accessToken, refreshToken, userId) => {
  try {
    console.log('[Google Calendar] Creating event:', {
      title: scheduleData.title,
      datetime: scheduleData.datetime,
      datetimeType: typeof scheduleData.datetime,
      duration: scheduleData.duration,
      location: scheduleData.location,
      userId: userId
    });
    
    const calendar = await getCalendarClient(userId, accessToken, refreshToken);

    // Convert datetime to Date object (UTC from database)
    const startTime = new Date(scheduleData.datetime);
    
    if (isNaN(startTime.getTime())) {
      throw new Error(`Invalid datetime: ${scheduleData.datetime}`);
    }
    
    // Calculate end time (duration is in minutes)
    const durationMs = (scheduleData.duration || 30) * 60000;
    const endTime = new Date(startTime.getTime() + durationMs);

    // Convert UTC time to Manila timezone format for Google Calendar
    // Google Calendar API expects datetime in the specified timezone, not UTC
    // Format: "2025-12-12T10:30:00" (without Z, represents local time in Asia/Manila)
    const formatDateTimeForManila = (date) => {
      // The date object from database is in UTC
      // Manila is UTC+8, so we add 8 hours to get Manila time
      const manilaOffsetMs = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
      const manilaTime = new Date(date.getTime() + manilaOffsetMs);
      
      // Format as YYYY-MM-DDTHH:mm:ss (no Z, no milliseconds)
      const year = manilaTime.getUTCFullYear();
      const month = String(manilaTime.getUTCMonth() + 1).padStart(2, '0');
      const day = String(manilaTime.getUTCDate()).padStart(2, '0');
      const hours = String(manilaTime.getUTCHours()).padStart(2, '0');
      const minutes = String(manilaTime.getUTCMinutes()).padStart(2, '0');
      const seconds = String(manilaTime.getUTCSeconds()).padStart(2, '0');
      
      return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    };

    const startDateTimeManila = formatDateTimeForManila(startTime);
    const endDateTimeManila = formatDateTimeForManila(endTime);

    console.log('[Google Calendar] Datetime handling:', {
      inputFromDB: scheduleData.datetime,
      startTimeUTC: startTime.toISOString(),
      endTimeUTC: endTime.toISOString(),
      startTimeManila: startDateTimeManila,
      endTimeManila: endDateTimeManila,
      durationMinutes: scheduleData.duration || 30,
      note: 'Converted UTC to Manila timezone format for Google Calendar'
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
        dateTime: startDateTimeManila,  // Manila timezone format: "2025-12-12T10:30:00"
        timeZone: 'Asia/Manila',         // Specifies this datetime is in Manila timezone
      },
      end: {
        dateTime: endDateTimeManila,     // Manila timezone format
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

    console.log('[Google Calendar] ⚡ SENDING TO GOOGLE:', {
      summary: event.summary,
      startDateTime: event.start.dateTime,
      startTimeZone: event.start.timeZone,
      endDateTime: event.end.dateTime,
      endTimeZone: event.end.timeZone,
    });
    
    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
      conferenceDataVersion: 1,
      sendUpdates: 'all',
    });

    // Extract meeting link from response
    let meetLink = null;
    if (response.data.hangoutLink) {
      meetLink = response.data.hangoutLink;
    } else if (response.data.conferenceData?.entryPoints) {
      const videoEntry = response.data.conferenceData.entryPoints.find(
        entry => entry.entryPointType === 'video' || entry.entryPointType === 'more'
      );
      if (videoEntry) {
        meetLink = videoEntry.uri;
      } else if (response.data.conferenceData.entryPoints.length > 0) {
        meetLink = response.data.conferenceData.entryPoints[0].uri;
      }
    }

    // If no meeting link found, try fetching the event again
    if (!meetLink && response.data.id) {
      try {
        const fetchedEvent = await calendar.events.get({
          calendarId: 'primary',
          eventId: response.data.id,
          conferenceDataVersion: 1
        });
        
        if (fetchedEvent.data.hangoutLink) {
          meetLink = fetchedEvent.data.hangoutLink;
        } else if (fetchedEvent.data.conferenceData?.entryPoints) {
          const videoEntry = fetchedEvent.data.conferenceData.entryPoints.find(
            entry => entry.entryPointType === 'video' || entry.entryPointType === 'more'
          );
          if (videoEntry) {
            meetLink = videoEntry.uri;
          } else if (fetchedEvent.data.conferenceData.entryPoints.length > 0) {
            meetLink = fetchedEvent.data.conferenceData.entryPoints[0].uri;
          }
        }
      } catch (fetchError) {
        console.warn('[Google Calendar] Could not fetch event for meeting link:', fetchError.message);
      }
    }

    // Use htmlLink from Google Calendar API - this is the official link format
    // The htmlLink should be in format: https://www.google.com/calendar/event?eid=...
    let calendarLink = response.data.htmlLink;
    
    // Verify htmlLink is valid and properly formatted
    if (!calendarLink || !calendarLink.includes('google.com/calendar/event')) {
      console.warn('[Google Calendar] htmlLink is missing or invalid, constructing from event ID');
      console.warn('[Google Calendar] htmlLink value:', calendarLink);
      
      // If htmlLink is not available or invalid, construct it from event ID
      if (response.data.id) {
        calendarLink = constructCalendarLink(response.data.id);
      } else {
        console.error('[Google Calendar] No event ID available to construct calendar link');
        calendarLink = null;
      }
    } else {
      // htmlLink is present and valid - use it directly
      console.log('[Google Calendar] Using htmlLink from API response');
    }
    
    // Log the calendar link for debugging
    console.log('[Google Calendar] Calendar link:', {
      htmlLink: response.data.htmlLink,
      finalLink: calendarLink,
      eventId: response.data.id,
      linkValid: calendarLink && calendarLink.includes('google.com/calendar/event')
    });

    console.log('[Google Calendar] ✅ SUCCESS! Event created:', {
      eventId: response.data.id,
      eventLink: calendarLink,
      meetLink: meetLink || 'Not available',
      googleStoredStart: response.data.start.dateTime,
      googleStoredTimeZone: response.data.start.timeZone
    });

    // ✅ SUCCESS: Google Calendar event added
    console.log('✅ [SUCCESS] Consultation successfully added to Google Calendar:', {
      eventId: response.data.id,
      title: scheduleData.title,
      datetime: scheduleData.datetime,
      googleCalendarLink: calendarLink,
      googleMeetLink: meetLink || 'Not available',
      timeZone: 'Asia/Manila'
    });

    return {
      eventId: response.data.id,
      eventLink: calendarLink,
      meetLink: meetLink,
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
 * Get calendar event link - verifies event exists and returns valid link
 */
export const getCalendarEventLink = async (eventId, accessToken, refreshToken, userId) => {
  try {
    const calendar = await getCalendarClient(userId, accessToken, refreshToken);
    
    // Fetch the event to get the htmlLink
    const event = await calendar.events.get({
      calendarId: 'primary',
      eventId: eventId,
    });
    
    if (event.data.htmlLink) {
      return event.data.htmlLink;
    }
    
    // If htmlLink is not available, construct it
    return constructCalendarLink(eventId);
  } catch (error) {
    console.error('[Google Calendar] Error fetching event for link:', error);
    // Return constructed link as fallback
    return constructCalendarLink(eventId);
  }
};

/**
 * Construct a Google Calendar event link from event ID
 * This function is exported so it can be used in controllers
 */
export const constructCalendarLink = (eventId) => {
  if (!eventId) return null;
  
  try {
    // Google Calendar event IDs need to be base64url encoded
    // Format: eventId@google.com needs to be base64url encoded
    const base64EventId = Buffer.from(eventId)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    return `https://www.google.com/calendar/event?eid=${base64EventId}`;
  } catch (error) {
    console.warn('[Google Calendar] Error constructing calendar link:', error);
    // Fallback: use URL encoding
    return `https://www.google.com/calendar/event?eid=${encodeURIComponent(eventId)}`;
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
      
      if (isNaN(startTime.getTime())) {
        throw new Error(`Invalid datetime: ${updates.datetime}`);
      }
      
      const durationMs = (updates.duration || 30) * 60000;
      const endTime = new Date(startTime.getTime() + durationMs);

      // Convert UTC time to Manila timezone format for Google Calendar
      const formatDateTimeForManila = (date) => {
        // The date object from database is in UTC
        // Manila is UTC+8, so we add 8 hours to get Manila time
        const manilaOffsetMs = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
        const manilaTime = new Date(date.getTime() + manilaOffsetMs);
        
        // Format as YYYY-MM-DDTHH:mm:ss (no Z, no milliseconds)
        const year = manilaTime.getUTCFullYear();
        const month = String(manilaTime.getUTCMonth() + 1).padStart(2, '0');
        const day = String(manilaTime.getUTCDate()).padStart(2, '0');
        const hours = String(manilaTime.getUTCHours()).padStart(2, '0');
        const minutes = String(manilaTime.getUTCMinutes()).padStart(2, '0');
        const seconds = String(manilaTime.getUTCSeconds()).padStart(2, '0');
        
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
      };
      
      updateData.start = {
        dateTime: formatDateTimeForManila(startTime),  // Manila timezone format
        timeZone: 'Asia/Manila',
      };
      updateData.end = {
        dateTime: formatDateTimeForManila(endTime),   // Manila timezone format
        timeZone: 'Asia/Manila',
      };

      console.log('[Google Calendar] Update datetime:', {
        inputDatetime: updates.datetime,
        startTimeUTC: startTime.toISOString(),
        endTimeUTC: endTime.toISOString(),
        startTimeManila: formatDateTimeForManila(startTime),
        endTimeManila: formatDateTimeForManila(endTime),
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

    // Extract meeting link
    let meetLink = null;
    if (response.data.hangoutLink) {
      meetLink = response.data.hangoutLink;
    } else if (response.data.conferenceData?.entryPoints) {
      const videoEntry = response.data.conferenceData.entryPoints.find(
        entry => entry.entryPointType === 'video' || entry.entryPointType === 'more'
      );
      if (videoEntry) {
        meetLink = videoEntry.uri;
      } else if (response.data.conferenceData.entryPoints.length > 0) {
        meetLink = response.data.conferenceData.entryPoints[0].uri;
      }
    }

    console.log('[Google Calendar] Event updated successfully:', {
      eventId: response.data.id,
      eventLink: response.data.htmlLink,
      meetLink: meetLink
    });

    return {
      eventId: response.data.id,
      eventLink: response.data.htmlLink,
      meetLink: meetLink,
      success: true,
    };
  } catch (error) {
    console.error('[Google Calendar] Error updating event:', error);
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

    console.log('[Google Calendar] Event deleted successfully:', eventId);

    return { success: true, message: 'Event deleted successfully' };
  } catch (error) {
    console.error('[Google Calendar] Error deleting event:', error);
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

    console.log('[Google Calendar] Fetched events:', {
      count: response.data.items?.length || 0,
      dateRange: `${startDate.toISOString()} to ${endDate.toISOString()}`
    });

    return response.data.items || [];
  } catch (error) {
    console.error('[Google Calendar] Error fetching events:', error);
    throw new Error(`Failed to fetch calendar events: ${error.message}`);
  }
};
  