import { google } from 'googleapis';

// Initialize Calendar client
export const getCalendarClient = (accessToken) => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({ access_token: accessToken });
  return google.calendar({ version: 'v3', auth: oauth2Client });
};

/**
 * Create a consultation event in Google Calendar
 */
export const createConsultationEvent = async (scheduleData, accessToken) => {
  try {
    const calendar = getCalendarClient(accessToken);

    const startTime = new Date(scheduleData.datetime);
    const endTime = new Date(startTime.getTime() + (scheduleData.duration || 60) * 60000);

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
        dateTime: startTime.toISOString(),
        timeZone: 'Asia/Manila',
      },
      end: {
        dateTime: endTime.toISOString(),
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

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
      conferenceDataVersion: 1,
      sendUpdates: 'all',
    });

    return {
      eventId: response.data.id,
      eventLink: response.data.htmlLink,
      meetLink: response.data.hangoutLink,
      success: true,
    };
  } catch (error) {
    console.error('Error creating Google Calendar event:', error);
    throw new Error(`Failed to create calendar event: ${error.message}`);
  }
};

/**
 * Update an existing calendar event
 */
export const updateCalendarEvent = async (eventId, updates, accessToken) => {
  try {
    const calendar = getCalendarClient(accessToken);

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
      
      updateData.start = {
        dateTime: startTime.toISOString(),
        timeZone: 'Asia/Manila',
      };
      updateData.end = {
        dateTime: endTime.toISOString(),
        timeZone: 'Asia/Manila',
      };
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
export const deleteCalendarEvent = async (eventId, accessToken) => {
  try {
    const calendar = getCalendarClient(accessToken);

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
export const getCalendarEvents = async (startDate, endDate, accessToken) => {
  try {
    const calendar = getCalendarClient(accessToken);

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


