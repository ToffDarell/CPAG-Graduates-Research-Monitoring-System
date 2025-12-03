import React, { useState, useEffect } from "react";
import { FaCalendar, FaCheckCircle, FaClock, FaTimes as FaClose, FaTimesCircle, FaVideo, FaUsers, FaList, FaTh, FaFilter, FaDownload, FaSync } from "react-icons/fa";
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import axios from "axios";
import { showError } from "../utils/sweetAlert";
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = momentLocalizer(moment);

const MySchedule = ({ schedules, onRefresh }) => {
  const [viewMode, setViewMode] = useState("list"); // list or calendar
  const [calendarView, setCalendarView] = useState("week"); // 'month', 'week', 'day', 'agenda'
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showCustomRequestModal, setShowCustomRequestModal] = useState(false);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [adviserInfo, setAdviserInfo] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  // Custom request form state
  const [customRequest, setCustomRequest] = useState({
    title: "",
    description: "",
    datetime: "",
    duration: 60,
    location: "",
    message: "",
    consultationType: "face-to-face"
  });
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState({
    type: "all",
    startDate: "",
    endDate: "",
  });

  

  const fetchAvailableSlots = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/student/available-slots', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAvailableSlots(res.data.slots || []);
      setAdviserInfo(res.data.adviser);
      setShowRequestModal(true);
    } catch (error) {
      console.error('Error fetching available slots:', error);
      setErrorMessage(error.response?.data?.message || 'Failed to fetch available slots');
      setTimeout(() => setErrorMessage(""), 4000);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestConsultation = async (slotId) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('/api/student/request-consultation', {
        scheduleId: slotId,
        message: message || "Consultation request"
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccessMessage(res.data.message || "Consultation requested successfully!");
      setShowRequestModal(false);
      setMessage("");
      onRefresh && onRefresh();
    } catch (error) {
      console.error('Error requesting consultation:', error);
      setErrorMessage(error.response?.data?.message || 'Failed to request consultation');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCustomRequest = async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('/api/student/create-consultation-request', {
        title: customRequest.title,
        description: customRequest.description,
        datetime: customRequest.datetime,
        duration: customRequest.duration,
        location: customRequest.location,
        message: customRequest.message,
        consultationType: customRequest.consultationType
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccessMessage(res.data.message || "Custom consultation request created successfully!");
      setShowCustomRequestModal(false);
      setCustomRequest({
        title: "",
        description: "",
        datetime: "",
        duration: 60,
        location: "",
        message: "",
        consultationType: "face-to-face"
      });
      onRefresh && onRefresh();
    } catch (error) {
      console.error('Error creating custom consultation request:', error);
      setErrorMessage(error.response?.data?.message || 'Failed to create custom consultation request');
    } finally {
      setLoading(false);
    }
  };

  const handleExportICS = async (scheduleId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/student/schedules/${scheduleId}/export-ics`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `defense-${scheduleId}.ics`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting schedule:', error);
      showError('Error', 'Error exporting schedule to calendar');
    }
  };

  const applyFilters = () => {
    onRefresh && onRefresh(filters);
    setShowFilters(false);
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      onRefresh && await onRefresh(filters);
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'consultation':
        return 'Consultation';
      case 'proposal_defense':
        return 'Proposal Defense';
      case 'final_defense':
        return 'Final Defense';
      default:
        return type;
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'consultation':
        return 'bg-blue-100 text-blue-700';
      case 'proposal_defense':
        return 'bg-purple-100 text-purple-700';
      case 'final_defense':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  // Convert schedules to calendar events format
  const calendarEvents = schedules.map(schedule => ({
    id: schedule._id,
    title: schedule.title,
    start: new Date(schedule.datetime),
    end: new Date(new Date(schedule.datetime).getTime() + (schedule.duration || 60) * 60000),
    resource: schedule,
  }));

  // Calendar event handlers
  const handleSelectEvent = (event) => {
    setSelectedEvent(event.resource);
    setShowEventModal(true);
  };

  // Get panelists from schedule
  const getPanelists = (schedule) => {
    const panelists = [];
    const seen = new Set(); // Track unique panelists by ID or email
    
    // For panel defense schedules, prioritize panel.members (includes external panelists)
    if (schedule.panel && schedule.panel.members) {
      const panelMembers = schedule.panel.members
        .filter(member => member.isSelected) // Only show selected members
        .map(member => {
          if (member.isExternal) {
            // External panelist - has name and email directly
            const identifier = member.email?.toLowerCase();
            if (identifier && !seen.has(identifier)) {
              seen.add(identifier);
              return {
                user: {
                  name: member.name,
                  email: member.email
                },
                role: member.role || 'member',
                isExternal: true
              };
            }
          } else {
            // Internal faculty - has faculty reference
            const identifier = member.faculty?._id?.toString() || member.faculty?.toString();
            if (identifier && !seen.has(identifier)) {
              seen.add(identifier);
              return {
                user: member.faculty,
                role: member.role || 'member',
                isExternal: false
              };
            }
          }
          return null;
        })
        .filter(Boolean); // Remove nulls from duplicates
      
      panelists.push(...panelMembers);
    } else {
      // For non-panel schedules (consultations), use participants array
      if (schedule.participants) {
        const participantPanelists = schedule.participants
          .filter(p => p.role === 'panel_member' || p.role === 'chair')
          .map(p => {
            const identifier = p.user?._id?.toString();
            if (identifier && !seen.has(identifier)) {
              seen.add(identifier);
              return {
                user: p.user,
                role: p.role,
                isExternal: false
              };
            }
            return null;
          })
          .filter(Boolean); // Remove nulls from duplicates
        
        panelists.push(...participantPanelists);
      }
    }
    
    return panelists;
  };

  // Filter and sort schedules
  const upcomingSchedules = schedules.filter(s => 
    new Date(s.datetime) >= new Date() && s.status !== 'cancelled'
  ).sort((a, b) => new Date(a.datetime) - new Date(b.datetime));

  const myConfirmedSchedules = upcomingSchedules.filter(s => {
    const myParticipation = s.participants?.find(p => p.role === 'student');
    return myParticipation && myParticipation.status === 'confirmed';
  });

  const myPendingRequests = upcomingSchedules.filter(s => {
    const myParticipation = s.participants?.find(p => p.role === 'student');
    return myParticipation && myParticipation.status === 'invited';
  });

  // Separate defenses from consultations
  const defenseSchedules = myConfirmedSchedules.filter(s => 
    s.type === 'proposal_defense' || s.type === 'final_defense'
  );

  const consultationSchedules = myConfirmedSchedules.filter(s => 
    s.type === 'consultation'
  );

  const eventStyleGetter = (event) => {
    const type = event.resource.type;
    let backgroundColor = '#3174ad';
    if (type === 'proposal_defense') backgroundColor = '#9333ea';
    if (type === 'final_defense') backgroundColor = '#dc2626';
    
    return {
      style: {
        backgroundColor,
        borderRadius: '5px',
        opacity: 0.8,
        color: 'white',
        border: '0px',
        display: 'block'
      }
    };
  };

  return (
    <div className="space-y-5">
      {/* Success/Error Messages */}
      {successMessage && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-md">
          <div className="flex items-center">
            <FaCheckCircle className="h-5 w-5 text-green-500 mr-3" />
            <p className="text-green-700 font-medium">{successMessage}</p>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
          <div className="flex items-center">
            <FaTimesCircle className="h-5 w-5 text-red-500 mr-3" />
            <p className="text-red-700 font-medium">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h2 className="text-xl font-bold text-gray-800">My Schedule</h2>
        <div className="flex items-center space-x-2">
          {/* View Toggle */}
          <div className="bg-gray-100 rounded-md p-1">
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                viewMode === "list" ? "bg-white text-[#7C1D23] shadow" : "text-gray-600"
              }`}
            >
              <FaList className="inline mr-1" /> List
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                viewMode === "calendar" ? "bg-white text-[#7C1D23] shadow" : "text-gray-600"
              }`}
            >
              <FaTh className="inline mr-1" /> Calendar
            </button>
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium ${
              refreshing ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            title="Refresh schedules"
          >
            <FaSync className={`inline mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {/* Filter Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-medium"
          >
            <FaFilter className="inline mr-2" />
            Filter
          </button>

          {/* Show Consultation Slot Button */}
          <button
            onClick={fetchAvailableSlots}
            disabled={loading}
            className="px-4 py-2 bg-[#7C1D23] text-white rounded-md hover:bg-[#5a1519] transition-colors text-sm font-medium disabled:opacity-50"
          >
            <FaCalendar className="inline mr-2" />
            {loading ? "Loading..." : "Show Consultation Slot"}
          </button>

          {/* Create Custom Request Button */}
          <button
            onClick={() => setShowCustomRequestModal(true)}
            disabled={loading}
            className="px-4 py-2 bg-[#2563eb] text-white rounded-md hover:bg-[#1d4ed8] transition-colors text-sm font-medium disabled:opacity-50"
          >
            <FaCalendar className="inline mr-2" />
            Create Custom Request
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-md font-semibold text-gray-800 mb-3">Filter Schedules</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={filters.type}
                onChange={(e) => setFilters({...filters, type: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23]"
              >
                <option value="all">All Types</option>
                <option value="consultation">Consultation</option>
                <option value="proposal_defense">Proposal Defense</option>
                <option value="final_defense">Final Defense</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23]"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2 mt-4">
            <button
              onClick={() => {
                setFilters({ type: "all", startDate: "", endDate: "" });
                onRefresh && onRefresh({});
                setShowFilters(false);
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm font-medium"
            >
              Clear
            </button>
            <button
              onClick={applyFilters}
              className="px-4 py-2 bg-[#7C1D23] text-white rounded-md hover:bg-[#5a1519] text-sm font-medium"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-green-700">{consultationSchedules.length}</p>
              <p className="text-xs text-green-600 font-medium uppercase">Consultations</p>
            </div>
            <FaCalendar className="h-8 w-8 text-green-600" />
          </div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-purple-700">{defenseSchedules.length}</p>
              <p className="text-xs text-purple-600 font-medium uppercase">Defense Sessions</p>
            </div>
            <FaUsers className="h-8 w-8 text-purple-600" />
          </div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-yellow-700">{myPendingRequests.length}</p>
              <p className="text-xs text-yellow-600 font-medium uppercase">Pending</p>
            </div>
            <FaClock className="h-8 w-8 text-yellow-600" />
          </div>
        </div>
      </div>

      {/* Pending Requests */}
      {myPendingRequests.length > 0 && (
        <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-5">
          <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
            <FaClock className="mr-2 text-yellow-600" />
            Pending Approval ({myPendingRequests.length})
          </h3>
          <div className="space-y-3">
            {myPendingRequests.map((schedule) => (
              <div key={schedule._id} className="bg-white rounded-lg p-4 border border-yellow-300">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-gray-800">{schedule.title}</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      <FaCalendar className="inline mr-1" />
                      {new Date(schedule.datetime).toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-500">Location: {schedule.location}</p>
                  </div>
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                    Pending
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Calendar or List View */}
      {viewMode === "calendar" ? (
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm" style={{ height: '700px' }}>
          <style>{`
            .rbc-toolbar {
              display: flex !important;
              flex-wrap: wrap !important;
              justify-content: space-between !important;
              align-items: center !important;
              margin-bottom: 15px !important;
              padding: 10px 0 !important;
            }
            .rbc-toolbar button {
              color: #333 !important;
              border: 1px solid #ccc !important;
              background-color: #fff !important;
              padding: 8px 16px !important;
              border-radius: 6px !important;
              cursor: pointer !important;
              font-size: 14px !important;
              font-weight: 500 !important;
              margin: 2px !important;
              transition: all 0.2s !important;
              pointer-events: auto !important;
              user-select: none !important;
            }
            .rbc-toolbar button:hover {
              background-color: #f3f4f6 !important;
              border-color: #9ca3af !important;
            }
            .rbc-toolbar button:active,
            .rbc-toolbar button.rbc-active {
              background-color: #7C1D23 !important;
              color: #fff !important;
              border-color: #7C1D23 !important;
            }
            .rbc-toolbar button:focus {
              outline: 2px solid #7C1D23 !important;
              outline-offset: 2px !important;
            }
            .rbc-btn-group {
              display: inline-flex !important;
              gap: 4px !important;
            }
            .rbc-toolbar-label {
              font-size: 18px !important;
              font-weight: 600 !important;
              color: #1f2937 !important;
              flex: 1 !important;
              text-align: center !important;
            }
            .rbc-event {
              padding: 4px !important;
              border-radius: 4px !important;
              font-size: 13px !important;
            }
            .rbc-event:hover {
              opacity: 0.9 !important;
              cursor: pointer !important;
            }
            .rbc-selected {
              box-shadow: 0 0 0 2px #7C1D23 !important;
            }
            .rbc-agenda-empty {
              text-align: center !important;
              padding: 40px !important;
              color: #6b7280 !important;
              font-size: 14px !important;
            }
          `}</style>
          <Calendar
            localizer={localizer}
            events={calendarEvents}
            startAccessor="start"
            endAccessor="end"
            date={selectedDate}
            view={calendarView}
            onNavigate={(newDate) => setSelectedDate(newDate)}
            onView={(newView) => setCalendarView(newView)}
            style={{ height: '100%' }}
            onSelectEvent={handleSelectEvent}
            views={['month', 'week', 'day', 'agenda']}
            step={30}
            showMultiDayTimes
            popup
            messages={{
              date: 'Date',
              time: 'Time',
              event: 'Event',
              allDay: 'All Day',
              week: 'Week',
              work_week: 'Work Week',
              day: 'Day',
              month: 'Month',
              previous: 'Back',
              next: 'Next',
              yesterday: 'Yesterday',
              tomorrow: 'Tomorrow',
              today: 'Today',
              agenda: 'Agenda',
              noEventsInRange: 'No schedules in this range.',
              showMore: total => `+${total} more`
            }}
            eventPropGetter={(event) => ({
              style: {
                backgroundColor: event.resource.type === 'proposal_defense' ? '#9333ea' : 
                                event.resource.type === 'final_defense' ? '#dc2626' : '#7C1D23',
                borderColor: event.resource.type === 'proposal_defense' ? '#7c3aed' : 
                           event.resource.type === 'final_defense' ? '#b91c1c' : '#5a1519',
                borderRadius: '5px',
                opacity: 0.9,
                color: 'white',
                border: '1px solid',
                display: 'block'
              }
            })}
          />
        </div>
      ) : (
        <>
          {/* Defense Schedules */}
          {defenseSchedules.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <FaUsers className="mr-2 text-[#7C1D23]" />
                Thesis Defense Sessions ({defenseSchedules.length})
              </h3>
              <div className="space-y-4">
                {defenseSchedules.map((schedule) => {
                  const isApproaching = new Date(schedule.datetime) - new Date() < 24 * 60 * 60 * 1000;
                  const panelists = getPanelists(schedule);
                  
                  return (
                    <div 
                      key={schedule._id} 
                      className={`border rounded-lg p-5 hover:shadow-md transition-shadow ${
                        isApproaching ? 'border-orange-300 bg-orange-50' : 'border-gray-200 bg-white'
                      }`}
                    >
                      {isApproaching && (
                        <div className="mb-3">
                          <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                            <FaClock className="inline mr-1" />
                            Starting in less than 24 hours!
                          </span>
                        </div>
                      )}
                      
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h4 className="text-lg font-bold text-gray-800">{schedule.title}</h4>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(schedule.type)}`}>
                              {getTypeLabel(schedule.type)}
                            </span>
                          </div>
                          {schedule.description && (
                            <p className="text-sm text-gray-600 mb-2">{schedule.description}</p>
                          )}
                          {schedule.research && (
                            <p className="text-sm text-gray-600 mb-2">
                              <strong>Research:</strong> {schedule.research.title}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        <div>
                          <p className="text-sm text-gray-700">
                            <FaCalendar className="inline mr-1 text-[#7C1D23]" />
                            <strong>Date:</strong> {new Date(schedule.datetime).toLocaleDateString()}
                          </p>
                          <p className="text-sm text-gray-700">
                            <FaClock className="inline mr-1 text-[#7C1D23]" />
                            <strong>Time:</strong> {new Date(schedule.datetime).toLocaleTimeString()} ({schedule.duration || 60} mins)
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-700 mb-1">
                            <strong>Venue:</strong> {schedule.location}
                          </p>
                          {schedule.googleMeetLink && (
                            <a
                              href={schedule.googleMeetLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 font-medium"
                            >
                              <FaVideo className="mr-1" />
                              Join Virtual Meeting
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Panelists */}
                      {panelists.length > 0 && (
                        <div className="bg-gray-50 rounded-lg p-3 mb-3">
                          <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                            <FaUsers className="mr-2" />
                            Panel Members:
                          </p>
                          <div className="space-y-1">
                            {panelists.map((panelist, idx) => (
                              <div key={idx} className="flex items-center text-sm text-gray-600">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium mr-2 ${
                                  panelist.role === 'chair' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                                }`}>
                                  {panelist.role === 'chair' ? 'Chair' : panelist.role === 'external_examiner' ? 'External' : 'Member'}
                                </span>
                                {panelist.user?.name || 'N/A'}
                                {panelist.isExternal && (
                                  <span className="ml-2 px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                                    External
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end">
                        <button
                          onClick={() => handleExportICS(schedule._id)}
                          className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-medium"
                        >
                          <FaDownload className="mr-2" />
                          Export to Calendar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Consultation Schedules */}
          {consultationSchedules.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <FaCalendar className="mr-2 text-blue-600" />
                Consultations ({consultationSchedules.length})
              </h3>
              <div className="space-y-3">
                {consultationSchedules.map((schedule) => {
                  const isApproaching = new Date(schedule.datetime) - new Date() < 24 * 60 * 60 * 1000;
                  
                  return (
                    <div 
                      key={schedule._id} 
                      className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${
                        isApproaching ? 'border-orange-300 bg-orange-50' : 'border-gray-200 bg-white'
                      }`}
                    >
                      {isApproaching && (
                        <div className="mb-2">
                          <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                            <FaClock className="inline mr-1" />
                            Approaching Soon
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-800 mb-1">{schedule.title}</h4>
                          <p className="text-sm text-gray-600 mb-1">{schedule.description || 'Consultation with adviser'}</p>
                          <p className="text-sm text-gray-500">
                            <FaCalendar className="inline mr-1" />
                            {new Date(schedule.datetime).toLocaleDateString()} at {new Date(schedule.datetime).toLocaleTimeString()}
                          </p>
                          <p className="text-sm text-gray-500">Location: {schedule.location}</p>
                          {schedule.googleMeetLink && (
                            <a
                              href={schedule.googleMeetLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 font-medium mt-1"
                            >
                              <FaVideo className="mr-1" />
                              Join Virtual Meeting
                            </a>
                          )}
                        </div>
                        <div className="text-right ml-4">
                          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium block mb-2">
                            Confirmed
                          </span>
                          <button
                            onClick={() => handleExportICS(schedule._id)}
                            className="text-gray-600 hover:text-[#7C1D23] text-xs"
                          >
                            <FaDownload className="inline mr-1" />
                            Export
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {myConfirmedSchedules.length === 0 && (
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-8">
              <FaCalendar className="mx-auto h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-center text-sm">No scheduled sessions yet.</p>
              <p className="text-gray-400 text-center text-xs mt-1">Click "Show Consultation Slot" to view available consultation slots from your adviser.</p>
            </div>
          )}
        </>
      )}

      {/* Request Consultation Modal */}
      {showRequestModal && (
        // Match global modal overlay style (Dean / Export PDF-Excel)
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
          <div className="bg-white rounded-lg shadow-lg max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Request Consultation</h3>
                {adviserInfo && (
                  <p className="text-sm text-gray-600 mt-1">
                    Adviser: {adviserInfo.name} ({adviserInfo.email})
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowRequestModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FaClose className="h-6 w-6" />
              </button>
            </div>

            {availableSlots.length === 0 ? (
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-8">
                <FaCalendar className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                <p className="text-gray-500 text-center text-sm">No available consultation slots at the moment.</p>
                <p className="text-gray-400 text-center text-xs mt-1">Please check back later or contact your adviser directly.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Select an available time slot to request a consultation with your adviser:
                </p>
                {availableSlots.map((slot) => (
                  <div 
                    key={slot._id} 
                    className={`border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer ${
                      selectedSlot === slot._id ? 'border-[#7C1D23] bg-red-50' : 'border-gray-200 bg-white'
                    }`}
                    onClick={() => setSelectedSlot(slot._id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-800">{slot.title}</h4>
                        <p className="text-sm text-gray-600 mt-1">{slot.description}</p>
                        <div className="mt-2 space-y-1">
                          <p className="text-sm text-gray-500">
                            <FaCalendar className="inline mr-1" />
                            {new Date(slot.datetime).toLocaleDateString()} at {new Date(slot.datetime).toLocaleTimeString()}
                          </p>
                          <p className="text-sm text-gray-500">
                            <FaClock className="inline mr-1" />
                            Duration: {slot.duration} minutes
                          </p>
                          <p className="text-sm text-gray-500">
                            Location: {slot.location}
                          </p>
                        </div>
                      </div>
                      {selectedSlot === slot._id && (
                        <FaCheckCircle className="h-6 w-6 text-[#7C1D23]" />
                      )}
                    </div>
                  </div>
                ))}

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    onClick={() => setShowRequestModal(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleRequestConsultation(selectedSlot)}
                    disabled={!selectedSlot || loading}
                    className="px-6 py-2 bg-[#7C1D23] text-white rounded-md hover:bg-[#5a1519] transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? "Requesting..." : "Request Consultation"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Custom Consultation Request Modal */}
      {showCustomRequestModal && (
        // Match global modal overlay style (Dean / Export PDF-Excel)
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Create Custom Consultation Request</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Request a consultation with your preferred date and time
                </p>
              </div>
              <button
                onClick={() => setShowCustomRequestModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FaClose className="h-6 w-6" />
              </button>
            </div>

            {errorMessage && (
              <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4 rounded">
                <div className="flex items-center">
                  <FaTimesCircle className="h-5 w-5 text-red-500 mr-3" />
                  <p className="text-red-700 text-sm">{errorMessage}</p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Consultation Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={customRequest.title}
                  onChange={(e) => setCustomRequest({...customRequest, title: e.target.value})}
                  placeholder="e.g., Chapter 1 Review, Progress Discussion"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date & Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={customRequest.datetime}
                  onChange={(e) => setCustomRequest({...customRequest, datetime: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Consultation Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={customRequest.consultationType}
                  onChange={(e) => {
                    const newType = e.target.value;
                    setCustomRequest({
                      ...customRequest, 
                      consultationType: newType,
                      location: newType === "online" ? "Online" : customRequest.location
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-transparent"
                  required
                >
                  <option value="face-to-face">Face-to-Face</option>
                  <option value="online">Online</option>
                </select>
                {customRequest.consultationType === "online" && (
                  <p className="text-xs text-blue-600 mt-1">
                    A Google Meet link will be automatically generated if your adviser has Google Calendar connected.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    value={customRequest.duration}
                    onChange={(e) => setCustomRequest({...customRequest, duration: parseInt(e.target.value) || 60})}
                    min="15"
                    max="240"
                    step="15"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Location <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={customRequest.location}
                    onChange={(e) => setCustomRequest({...customRequest, location: e.target.value})}
                    placeholder={customRequest.consultationType === "online" ? "Will be set to 'Online'" : "e.g., Room 101"}
                    disabled={customRequest.consultationType === "online"}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={customRequest.description}
                  onChange={(e) => setCustomRequest({...customRequest, description: e.target.value})}
                  placeholder="Brief description of what you'd like to discuss..."
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Additional Message (Optional)
                </label>
                <textarea
                  value={customRequest.message}
                  onChange={(e) => setCustomRequest({...customRequest, message: e.target.value})}
                  placeholder="Any additional information or special requests..."
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-transparent"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => {
                    setShowCustomRequestModal(false);
                    setCustomRequest({
                      title: "",
                      description: "",
                      datetime: "",
                      duration: 60,
                      location: "",
                      message: "",
                      consultationType: "face-to-face"
                    });
                    setErrorMessage("");
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateCustomRequest}
                  disabled={
                    !customRequest.title || 
                    !customRequest.datetime || 
                    (customRequest.consultationType === "face-to-face" && !customRequest.location) ||
                    (customRequest.consultationType === "online" && customRequest.location !== "Online") ||
                    loading
                  }
                  className="px-6 py-2 bg-[#2563eb] text-white rounded-md hover:bg-[#1d4ed8] transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Creating..." : "Create Request"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Event Detail Modal */}
      {showEventModal && selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-800">{selectedEvent.title}</h3>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium mt-2 ${getTypeColor(selectedEvent.type)}`}>
                  {getTypeLabel(selectedEvent.type)}
                </span>
              </div>
              <button
                onClick={() => setShowEventModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FaClose className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Date & Time */}
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">
                  <FaCalendar className="inline mr-2" />
                  Date & Time
                </label>
                <p className="text-gray-800">
                  {new Date(selectedEvent.datetime).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })} at {new Date(selectedEvent.datetime).toLocaleTimeString()}
                </p>
                <p className="text-sm text-gray-600">
                  Duration: {selectedEvent.duration || 60} minutes
                </p>
              </div>

              {/* Location */}
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Location</label>
                <p className="text-gray-800">{selectedEvent.location}</p>
              </div>

              {/* Description */}
              {selectedEvent.description && (
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">Description</label>
                  <p className="text-gray-800">{selectedEvent.description}</p>
                </div>
              )}

              {/* Virtual Link */}
              {selectedEvent.virtualLink && (
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">
                    <FaVideo className="inline mr-2" />
                    Virtual Meeting
                  </label>
                  <a
                    href={selectedEvent.virtualLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {selectedEvent.virtualLink}
                  </a>
                </div>
              )}

              {/* Panelists */}
              {getPanelists(selectedEvent).length > 0 && (
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">
                    <FaUsers className="inline mr-2" />
                    Panel Members
                  </label>
                  <div className="space-y-2">
                    {getPanelists(selectedEvent).map((panelist, idx) => (
                      <div key={idx} className="flex items-start text-gray-800">
                        <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center mr-3 text-sm font-semibold flex-shrink-0">
                          {panelist.user?.name?.charAt(0) || '?'}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{panelist.user?.name || 'N/A'}</p>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              panelist.role === 'chair' ? 'bg-blue-100 text-blue-700' : 
                              panelist.role === 'external_examiner' ? 'bg-purple-100 text-purple-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {panelist.role === 'chair' ? 'Chair' : 
                               panelist.role === 'external_examiner' ? 'External Examiner' : 
                               'Member'}
                            </span>
                            {panelist.isExternal && (
                              <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                                External
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-600">{panelist.user?.email || ''}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  onClick={() => handleExportICS(selectedEvent._id)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm font-medium"
                >
                  <FaDownload className="inline mr-2" />
                  Export to Calendar
                </button>
                <button
                  onClick={() => setShowEventModal(false)}
                  className="px-4 py-2 bg-[#7C1D23] text-white rounded-md hover:bg-[#5a1519] transition-colors text-sm font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MySchedule;

