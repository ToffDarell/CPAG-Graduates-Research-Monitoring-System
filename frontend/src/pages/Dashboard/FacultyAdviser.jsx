import React, { useState, useEffect, useCallback } from "react";
import { FaCheckCircle, FaTimesCircle, FaUsers, FaClipboardList, FaCalendar, FaFileAlt, FaClock, FaSignOutAlt, FaBars, FaTimes as FaClose, FaUpload, FaGoogle, FaVideo } from "react-icons/fa";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = momentLocalizer(moment);

const FacultyAdviserDashboard = ({setUser}) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedTab, setSelectedTab] = useState("submissions");
  const [students, setStudents] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Google Calendar state
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);

  // Fetch data on component mount
  useEffect(() => {
    fetchStudentSubmissions();
    fetchMyStudents();
    fetchSchedules();
    checkCalendarStatus();
    
    // Check for calendar connection callback
    const calendarParam = searchParams.get('calendar');
    if (calendarParam === 'connected') {
      setCalendarConnected(true);
      navigate('/dashboard/faculty', { replace: true });
    } else if (calendarParam === 'error') {
      navigate('/dashboard/faculty', { replace: true });
    }
  }, []);

  const fetchStudentSubmissions = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/faculty/submissions', {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Only set submissions that have actual forms/files
      setSubmissions(res.data.filter(r => r.forms && r.forms.length > 0));
    } catch (error) {
      console.error('Error fetching submissions:', error);
    }
  };

  const fetchMyStudents = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/faculty/students', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStudents(res.data);
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const fetchSchedules = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/faculty/schedules', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSchedules(res.data);
    } catch (error) {
      console.error('Error fetching schedules:', error);
    }
  };

  // Google Calendar functions
  const checkCalendarStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/google-calendar/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCalendarConnected(res.data.connected);
    } catch (error) {
      console.error('Error checking calendar status:', error);
      setCalendarConnected(false);
    }
  };

  const connectGoogleCalendar = async () => {
    try {
      setCalendarLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/google-calendar/auth-url', {
        headers: { Authorization: `Bearer ${token}` }
      });
      window.location.href = res.data.authUrl;
    } catch (error) {
      console.error('Error getting auth URL:', error);
    } finally {
      setCalendarLoading(false);
    }
  };

  const disconnectGoogleCalendar = async () => {
    if (!window.confirm('Are you sure you want to disconnect Google Calendar?')) return;
    
    try {
      setCalendarLoading(true);
      const token = localStorage.getItem('token');
      await axios.post('/api/google-calendar/disconnect', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCalendarConnected(false);
    } catch (error) {
      console.error('Error disconnecting calendar:', error);
    } finally {
      setCalendarLoading(false);
    }
  };

  const handleApproveSubmission = async (researchId, fileId) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/faculty/submissions/approve-reject', {
        researchId,
        fileId,
        action: 'approved',
        message: 'Submission approved successfully.'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      fetchStudentSubmissions();
    } catch (error) {
      console.error('Error approving submission:', error);
      alert('Error approving submission');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectSubmission = async (researchId, fileId, rejectionReason) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/faculty/submissions/approve-reject', {
        researchId,
        fileId,
        action: 'rejected',
        message: rejectionReason
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      fetchStudentSubmissions();
    } catch (error) {
      console.error('Error rejecting submission:', error);
      alert('Error rejecting submission');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateThesisStatus = async (researchId, status, stage, progress) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(`/api/faculty/thesis/${researchId}/status`, {
        status,
        stage,
        progress
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      fetchMyStudents();
      alert('Thesis status updated successfully!');
    } catch (error) {
      console.error('Error updating thesis status:', error);
      alert('Error updating thesis status');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    // Show confirmation dialog
    if (window.confirm('Are you sure you want to log out?')) {
      // Clear session data
      localStorage.removeItem('token');
      sessionStorage.removeItem('selectedRole');
      setUser(null);
      // Navigate to login with state message
      navigate('/login', { 
        state: { message: 'You have been logged out successfully.' },
        replace: true  
      });
    }
  };

  const tabs = [
    { id: "submissions", label: "Student Submissions", icon: <FaClipboardList /> },
    { id: "feedback", label: "Feedback Management", icon: <FaFileAlt /> },
    { id: "panels", label: "Panel Reviews", icon: <FaUsers /> },
    { id: "schedule", label: "Consultation Schedule", icon: <FaCalendar /> },
    { id: "students", label: "My Students", icon: <FaUsers /> },
    { id: "documents", label: "Documents", icon: <FaFileAlt /> },
  ];

  const renderContent = () => {
    switch (selectedTab) {
      case "submissions":
        return <StudentSubmissions 
          submissions={submissions} 
          onApprove={handleApproveSubmission}
          onReject={handleRejectSubmission}
          loading={loading}
        />;
      case "feedback":
        return <FeedbackManagement />;
      case "panels":
        return <PanelReviews />;
      case "schedule":
        return <ConsultationSchedule 
          schedules={schedules} 
          onRefresh={fetchSchedules}
          calendarConnected={calendarConnected}
          onConnectCalendar={connectGoogleCalendar}
          onDisconnectCalendar={disconnectGoogleCalendar}
          calendarLoading={calendarLoading}
        />;
      case "students":
        return <StudentList 
          students={students} 
          onUpdateStatus={handleUpdateThesisStatus}
          loading={loading}
        />;
      case "documents":
        return <DocumentsView />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#7C1D23] transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#5a1519]">
          <div className="flex items-center space-x-3">
            <img 
              src="/logo.jpg" 
              alt="Logo" 
              className="h-10 w-10 object-contain rounded-lg"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <div>
              <h2 className="text-lg font-bold text-white">Faculty Adviser</h2>
              <p className="text-xs text-gray-200">Dashboard</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-white hover:text-gray-200"
          >
            <FaClose className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            {tabs.map((tab) => {
              const isActive = selectedTab === tab.id;
              return (
                <li key={tab.id}>
                  <button
                    onClick={() => {
                      setSelectedTab(tab.id);
                      setSidebarOpen(false);
                    }}
                    className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 w-full text-left ${
                      isActive
                        ? 'bg-white text-[#7C1D23] shadow-md'
                        : 'text-white hover:bg-[#5a1519] hover:text-gray-100'
                    }`}
                  >
                    <span className="text-lg">{tab.icon}</span>
                    <span className="font-medium text-sm">{tab.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-[#5a1519]">
          <button
            onClick={handleLogout}
            className="flex items-center space-x-3 px-4 py-3 rounded-lg text-white hover:bg-red-600 transition-all duration-200 w-full"
          >
            <FaSignOutAlt className="h-5 w-5" />
            <span className="font-medium text-sm">Logout</span>
          </button>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 lg:ml-64">
        {/* Mobile Menu Button */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden fixed top-4 left-4 z-30 p-2 bg-[#7C1D23] text-white rounded-lg shadow-lg"
        >
          <FaBars className="h-5 w-5" />
        </button>

        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="mb-6">
          <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
            <div className="p-6 bg-gradient-to-r from-[#7C1D23] to-[#5a1519] text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold mb-1">Faculty Adviser Dashboard</h1>
                  <p className="text-gray-100 text-sm">Guide and monitor your students' research progress</p>
                </div>
                <div className="hidden md:block">
                  <div className="bg-white/10 rounded-lg p-3">
                    <FaUsers className="h-12 w-12 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <StatCard
            title="Total Students"
            value={students.length}
            icon={<FaUsers className="h-6 w-6" />}
            color="maroon"
          />
          <StatCard
            title="Pending Reviews"
            value={submissions.filter(s => s.forms?.some(f => f.status === 'pending')).length}
            icon={<FaClock className="h-6 w-6" />}
            color="gold"
          />
          <StatCard
            title="Upcoming Consultations"
            value={schedules.filter(s => new Date(s.datetime) > new Date()).length}
            icon={<FaCalendar className="h-6 w-6" />}
            color="blue"
          />
          <StatCard
            title="Active Research"
            value={students.filter(s => s.status === 'in-progress').length}
            icon={<FaFileAlt className="h-6 w-6" />}
            color="gray"
          />
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
          {/* Content Area */}
          <div className="p-6 bg-white">
            {renderContent()}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

// Stat Card Component
const StatCard = ({ title, value, icon, color }) => {
  const colorClasses = {
    maroon: { bg: 'bg-[#7C1D23]' },
    blue: { bg: 'bg-[#1E3A8A]' },
    gold: { bg: 'bg-[#D4AF37]' },
    gray: { bg: 'bg-gray-600' }
  };

  return (
    <div className="bg-white overflow-hidden rounded-lg shadow-md hover:shadow-lg transition-all duration-300 border border-gray-200">
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</p>
            <p className="mt-2 text-2xl font-bold text-gray-800">{value}</p>
          </div>
          <div className={`p-3 rounded-lg ${colorClasses[color].bg}`}>
            <div className="text-white">{icon}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Student Submissions Component
const StudentSubmissions = ({ submissions, onApprove, onReject, loading }) => {
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedForm, setSelectedForm] = useState(null);

  const handleApproveClick = (research, form) => {
    setSelectedSubmission(research);
    setSelectedForm(form);
    setShowApproveModal(true);
  };

  const handleRejectClick = (research, form) => {
    setSelectedSubmission(research);
    setSelectedForm(form);
    setShowRejectModal(true);
    setRejectionReason("");
  };

  const confirmApprove = async () => {
    await onApprove(selectedSubmission._id, selectedForm._id);
    setShowApproveModal(false);
    setSuccessMessage("Submission has been approved successfully.");
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 4000);
  };

  const confirmReject = async () => {
    if (!rejectionReason.trim()) {
      alert("Please provide a rejection reason.");
      return;
    }
    await onReject(selectedSubmission._id, selectedForm._id, rejectionReason);
    setShowRejectModal(false);
    setSuccessMessage("Submission has been rejected. Reason recorded.");
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 4000);
    setRejectionReason("");
  };

  return (
  <div className="space-y-5">
      {/* Success Message */}
      {showSuccessMessage && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-md shadow-md animate-fade-in">
          <div className="flex items-center">
            <FaCheckCircle className="h-5 w-5 text-green-500 mr-3" />
            <p className="text-green-700 font-medium">{successMessage}</p>
          </div>
        </div>
      )}

    <div className="flex justify-between items-center">
      <h2 className="text-xl font-bold text-gray-800">Student Submissions</h2>
      <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
          {submissions.reduce((count, s) => count + (s.forms?.filter(f => f.status === 'pending').length || 0), 0)} Pending Reviews
      </span>
    </div>

    <div className="space-y-4">
      {submissions.length === 0 ? (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-8">
          <p className="text-gray-500 text-center text-sm">No submissions to review yet.</p>
        </div>
      ) : (
        submissions.map((research) => (
          <div key={research._id} className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow">
              <div className="mb-4 pb-4 border-b border-gray-200">
                <div className="flex items-center space-x-3">
                  <div className="h-12 w-12 rounded-full bg-[#7C1D23] flex items-center justify-center text-white font-semibold text-lg">
                    {research.students?.[0]?.name?.charAt(0) || 'S'}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-gray-800">{research.students?.[0]?.name || 'Student'}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {research.title} • Stage: {research.stage}
                    </p>
                  </div>
                </div>
              </div>

              {/* All Submitted Forms */}
              <div className="space-y-3">
                {research.forms?.filter(f => f.status === 'pending' || f.status === 'approved' || f.status === 'rejected').map((form, idx) => (
                  <div key={form._id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <FaFileAlt className="text-gray-600" />
                          <h4 className="font-medium text-gray-800">{form.filename || `Document ${idx + 1}`}</h4>
                        </div>
                        <div className="mt-2 space-y-1">
                          <p className="text-xs text-gray-500">
                            <span className="font-medium">Type:</span> {form.type || 'N/A'}
                          </p>
                          <p className="text-xs text-gray-500">
                            <span className="font-medium">Date of Submission:</span>{" "}
                            {form.uploadedAt ? new Date(form.uploadedAt).toLocaleString() : 'N/A'}
                          </p>
                          <p className="text-xs text-gray-500">
                            <span className="font-medium">Current Status:</span>{" "}
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              form.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                              form.status === "approved" ? "bg-green-100 text-green-700" :
                              form.status === "rejected" ? "bg-red-100 text-red-700" :
                              "bg-gray-100 text-gray-700"
                            }`}>
                              {form.status}
                  </span>
                          </p>
                </div>
              </div>
                      {form.status === 'pending' && (
                        <div className="flex space-x-2 ml-4">
                <button 
                            onClick={() => handleApproveClick(research, form)}
                  disabled={loading}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  <FaCheckCircle className="mr-2 text-sm" />
                  Approve
                </button>
                <button 
                            onClick={() => handleRejectClick(research, form)}
                  disabled={loading}
                  className="flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  <FaTimesCircle className="mr-2 text-sm" />
                  Reject
                </button>
              </div>
                      )}
                    </div>
                  </div>
                ))}
                {!research.forms || research.forms.length === 0 && (
                  <p className="text-sm text-gray-500 italic">No documents submitted yet.</p>
                )}
            </div>
          </div>
        ))
      )}
    </div>

      {/* Approve Confirmation Modal */}
      {showApproveModal && selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mr-4">
                <FaCheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800">Approve Submission</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to approve this submission from{" "}
              <span className="font-semibold">{selectedSubmission.students?.[0]?.name}</span>?
            </p>
            <div className="bg-gray-50 rounded-lg p-3 mb-6">
              <p className="text-sm text-gray-700">
                <span className="font-medium">Document:</span> {selectedForm?.filename}
              </p>
              <p className="text-sm text-gray-700">
                <span className="font-medium">Research:</span> {selectedSubmission.title}
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowApproveModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmApprove}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {loading ? "Approving..." : "Confirm Approval"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal with Reason Input */}
      {showRejectModal && selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mr-4">
                <FaTimesCircle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800">Reject Submission</h3>
            </div>
            <p className="text-gray-600 mb-4">
              Provide a reason for rejecting the submission from{" "}
              <span className="font-semibold">{selectedSubmission.students?.[0]?.name}</span>:
            </p>
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-sm text-gray-700">
                <span className="font-medium">Document:</span> {selectedForm?.filename}
              </p>
              <p className="text-sm text-gray-700">
                <span className="font-medium">Research:</span> {selectedSubmission.title}
              </p>
            </div>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason (required)..."
              rows="4"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-transparent resize-none"
              required
            />
            <div className="flex justify-end space-x-3 mt-4">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason("");
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmReject}
                disabled={loading || !rejectionReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {loading ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
  </div>
);
};

// Feedback Management Component
const FeedbackManagement = () => {
  const [students, setStudents] = useState([]);
  const [feedbackList, setFeedbackList] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedResearch, setSelectedResearch] = useState("");
  const [category, setCategory] = useState("general");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState(null);

  useEffect(() => {
    fetchStudents();
    fetchAllFeedback();
  }, []);

  const fetchStudents = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/faculty/students', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStudents(res.data);
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const fetchAllFeedback = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/faculty/feedback', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFeedbackList(res.data);
    } catch (error) {
      console.error('Error fetching feedback:', error);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (selectedFile) => {
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    const ALLOWED_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/jpg', 'image/png'];

    if (selectedFile.size > MAX_SIZE) {
      setErrorMessage("File size exceeds 10MB limit");
      setTimeout(() => setErrorMessage(""), 4000);
      return;
    }

    if (!ALLOWED_TYPES.includes(selectedFile.type)) {
      setErrorMessage("Unsupported file format. Allowed: PDF, Word documents, Images (JPG, PNG)");
      setTimeout(() => setErrorMessage(""), 4000);
      return;
    }

    setFile(selectedFile);
    setErrorMessage("");
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedResearch) {
      setErrorMessage("Please select a student/research");
      return;
    }

    if (!message.trim()) {
      setErrorMessage("Please provide feedback message");
      return;
    }

    setLoading(true);
    setUploadProgress(0);
    setErrorMessage("");

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('researchId', selectedResearch);
      formData.append('studentId', selectedStudent);
      formData.append('category', category);
      formData.append('message', message);
      if (file) {
        formData.append('file', file);
      }

      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
        }
      };

      const response = await axios.post('/api/faculty/feedback', formData, config);

      setSuccessMessage(response.data.message || "Feedback uploaded successfully!");
      setSelectedStudent("");
      setSelectedResearch("");
      setCategory("general");
      setMessage("");
      setFile(null);
      setUploadProgress(0);

      fetchAllFeedback(); // Refresh feedback list
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (error) {
      console.error('Error uploading feedback:', error);
      setErrorMessage(error.response?.data?.message || "Failed to upload feedback");
      setTimeout(() => setErrorMessage(""), 4000);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (feedbackId, filename) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/faculty/feedback/download/${feedbackId}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error downloading file:', error);
      setErrorMessage("Failed to download file");
      setTimeout(() => setErrorMessage(""), 4000);
    }
  };

  const handleDeleteClick = (feedback) => {
    setSelectedFeedback(feedback);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!selectedFeedback) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/faculty/feedback/${selectedFeedback._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccessMessage("Feedback deleted successfully");
      setShowDeleteDialog(false);
      setSelectedFeedback(null);
      fetchAllFeedback();
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (error) {
      console.error('Error deleting feedback:', error);
      setErrorMessage(error.response?.data?.message || "Failed to delete feedback");
      setShowDeleteDialog(false);
      setTimeout(() => setErrorMessage(""), 4000);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(2)} KB`;
    return `${(kb / 1024).toFixed(2)} MB`;
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

    <h2 className="text-xl font-bold text-gray-800">Feedback Management</h2>

      {/* Upload Feedback Form */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Upload New Feedback</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Student Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Student/Research <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedResearch}
              onChange={(e) => {
                const research = students.find(s => s._id === e.target.value);
                setSelectedResearch(e.target.value);
                setSelectedStudent(research?.students[0]?._id || "");
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-transparent"
              required
            >
              <option value="">-- Select Student --</option>
              {students.map((research) => (
                <option key={research._id} value={research._id}>
                  {research.students.map(s => s.name).join(", ")} - {research.title}
                </option>
              ))}
            </select>
    </div>

          {/* Category Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Feedback Category <span className="text-red-500">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-transparent"
              required
            >
              <option value="general">General Feedback</option>
              <option value="chapter_review">Chapter Review</option>
              <option value="progress_update">Progress Update</option>
              <option value="revision_request">Revision Request</option>
              <option value="approval">Approval</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Feedback Message <span className="text-red-500">*</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Provide detailed feedback for the student..."
              rows="4"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-transparent resize-none"
              required
            />
          </div>

          {/* File Upload - Drag & Drop */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Attach File (Optional)
            </label>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                dragActive ? 'border-[#7C1D23] bg-red-50' : 'border-gray-300 bg-gray-50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {file ? (
                <div className="space-y-2">
                  <FaFileAlt className="mx-auto h-12 w-12 text-[#7C1D23]" />
                  <p className="text-sm font-medium text-gray-800">{file.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Remove File
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <FaUpload className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="text-sm text-gray-600">
                    Drag and drop a file here, or{" "}
                    <label className="text-[#7C1D23] hover:text-[#5a1519] cursor-pointer font-medium">
                      browse
                      <input
                        type="file"
                        className="hidden"
                        onChange={handleFileChange}
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      />
                    </label>
                  </p>
                  <p className="text-xs text-gray-500">
                    Supported: PDF, Word (.doc, .docx), Images (.jpg, .png) • Max 10MB
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Upload Progress */}
          {uploadProgress > 0 && uploadProgress < 100 && (
            <div>
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-[#7C1D23] h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-[#7C1D23] text-white rounded-md hover:bg-[#5a1519] transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Uploading..." : "Upload Feedback"}
            </button>
          </div>
        </form>
      </div>

      {/* Uploaded Feedback List */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Previously Uploaded Feedback</h3>
        
        {feedbackList.length === 0 ? (
          <div className="text-center py-8">
            <FaFileAlt className="mx-auto h-12 w-12 text-gray-400 mb-3" />
            <p className="text-gray-500 text-sm">No feedback uploaded yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {feedbackList.map((feedback) => (
              <div key={feedback._id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        feedback.category === 'approval' ? 'bg-green-100 text-green-700' :
                        feedback.category === 'revision_request' ? 'bg-orange-100 text-orange-700' :
                        feedback.category === 'chapter_review' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {feedback.category.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-500">Version {feedback.version}</span>
                    </div>
                    <h4 className="font-semibold text-gray-800">
                      To: {feedback.student?.name}
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Research: {feedback.research?.title}
                    </p>
                    <p className="text-sm text-gray-700 mt-2">{feedback.message}</p>
                    {feedback.file && (
                      <div className="mt-2 flex items-center space-x-2 text-sm text-gray-600">
                        <FaFileAlt className="text-[#7C1D23]" />
                        <span>{feedback.file.filename}</span>
                        <span className="text-xs">({formatFileSize(feedback.file.filesize)})</span>
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      {new Date(feedback.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-col space-y-1 ml-4">
                    {feedback.file && (
                      <button
                        onClick={() => handleDownload(feedback._id, feedback.file.filename)}
                        className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 text-xs font-medium"
                      >
                        Download
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteClick(feedback)}
                      className="px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200 text-xs font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && selectedFeedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mr-4">
                <FaTimesCircle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800">Delete Feedback</h3>
            </div>

            <p className="text-gray-600 mb-4">
              Are you sure you want to delete this feedback?
            </p>

            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-sm text-gray-700">
                <span className="font-medium">Student:</span> {selectedFeedback.student?.name}
              </p>
              <p className="text-sm text-gray-700">
                <span className="font-medium">Category:</span> {selectedFeedback.category}
              </p>
              {selectedFeedback.file && (
                <p className="text-sm text-gray-700">
                  <span className="font-medium">File:</span> {selectedFeedback.file.filename}
                </p>
              )}
            </div>

            <p className="text-sm text-gray-500 mb-6">
              This action cannot be undone.
            </p>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteDialog(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={loading}
                className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {loading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
  </div>
);
};

// Consultation Schedule Component
const ConsultationSchedule = ({ schedules, onRefresh, calendarConnected, onConnectCalendar, onDisconnectCalendar, calendarLoading }) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [viewMode, setViewMode] = useState("list"); // "list" or "calendar"
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [calendarView, setCalendarView] = useState("week"); // "month", "week", "day", "agenda"
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    datetime: "",
    duration: 60,
    location: "",
    syncToCalendar: true
  });
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Convert schedules to calendar events format
  const calendarEvents = schedules.map(schedule => ({
    id: schedule._id,
    title: schedule.title,
    start: new Date(schedule.datetime),
    end: new Date(new Date(schedule.datetime).getTime() + (schedule.duration || 60) * 60000),
    resource: schedule,
  }));

  const handleCreateSlot = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    // Validate datetime before submission
    if (!formData.datetime) {
      setErrorMessage("Please select a date and time for the consultation");
      setLoading(false);
      return;
    }

    // Validate that datetime is not in the past
    const selectedDate = new Date(formData.datetime);
    if (selectedDate < new Date()) {
      setErrorMessage("Cannot schedule consultations in the past");
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/faculty/schedules', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccessMessage(response.data.message || "Consultation slot created successfully.");
      setShowCreateModal(false);
      setFormData({
        title: "",
        description: "",
        datetime: "",
        duration: 60,
        location: "",
        syncToCalendar: true
      });
      
      // Refresh schedules
      if (onRefresh) onRefresh();
      
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (error) {
      console.error("Error creating consultation slot:", error);
      setErrorMessage(error.response?.data?.message || "Failed to create consultation slot. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Calendar event handlers
  const handleSelectSlot = ({start, end}) => {
    setFormData({
      ...formData,
      datetime: moment(start).format('YYYY-MM-DDTHH:mm'),
      duration: Math.round((end - start) / 60000)
    });
    setShowCreateModal(true);
  };

  const handleSelectEvent = (event) => {
    setSelectedEvent(event.resource);
    setShowEditModal(true);
  };

  const handleEventDrop = async ({ event, start, end }) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put('/api/faculty/schedules/update', {
        scheduleId: event.id,
        datetime: start.toISOString(),
        duration: Math.round((end - start) / 60000)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (onRefresh) onRefresh();
      setSuccessMessage("Schedule updated successfully!");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      setErrorMessage("Failed to update schedule");
      setTimeout(() => setErrorMessage(""), 3000);
    }
  };

  const handleApproveRequest = async (scheduleId, participantId) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put('/api/faculty/schedules/status', {
        scheduleId,
        participantId,
        action: "approve"
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccessMessage("Consultation request approved successfully.");
      window.location.reload();
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (error) {
      console.error("Error approving request:", error);
      setErrorMessage(error.response?.data?.message || "Failed to approve request.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeclineRequest = async (scheduleId, participantId) => {
    if (!window.confirm("Are you sure you want to decline this consultation request?")) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put('/api/faculty/schedules/status', {
        scheduleId,
        participantId,
        action: "decline"
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccessMessage("Consultation request declined.");
      window.location.reload();
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (error) {
      console.error("Error declining request:", error);
      setErrorMessage(error.response?.data?.message || "Failed to decline request.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelConsultation = async (scheduleId) => {
    const reason = prompt("Please provide a reason for cancellation:");
    if (!reason) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put('/api/faculty/schedules/cancel', {
        scheduleId,
        reason
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccessMessage("Consultation cancelled successfully.");
      window.location.reload();
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (error) {
      console.error("Error cancelling consultation:", error);
      setErrorMessage(error.response?.data?.message || "Failed to cancel consultation.");
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (schedule) => {
    setSelectedSchedule(schedule);
    const datetimeLocal = new Date(schedule.datetime).toISOString().slice(0, 16);
    setFormData({
      title: schedule.title,
      description: schedule.description || "",
      datetime: datetimeLocal,
      duration: schedule.duration,
      location: schedule.location
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    try {
      const token = localStorage.getItem('token');
      const response = await axios.put('/api/faculty/schedules/update', {
        scheduleId: selectedSchedule._id,
        ...formData
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccessMessage(response.data.message || "Consultation slot updated successfully.");
      setShowEditModal(false);
      setSelectedSchedule(null);
      setFormData({
        title: "",
        description: "",
        datetime: "",
        duration: 60,
        location: ""
      });
      
      window.location.reload(); // Refresh to get updated schedules
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (error) {
      console.error("Error updating consultation slot:", error);
      setErrorMessage(error.response?.data?.message || "Failed to update consultation slot. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (schedule) => {
    setSelectedSchedule(schedule);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!selectedSchedule) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.delete(`/api/faculty/schedules/${selectedSchedule._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccessMessage(response.data.message || "Consultation slot deleted successfully.");
      setShowDeleteDialog(false);
      setSelectedSchedule(null);
      
      window.location.reload(); // Refresh to remove deleted schedule
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (error) {
      console.error("Error deleting consultation slot:", error);
      setErrorMessage(error.response?.data?.message || "Failed to delete consultation slot.");
      setShowDeleteDialog(false);
    } finally {
      setLoading(false);
    }
  };

  // Filter schedules by date
  const upcomingSchedules = schedules.filter(s => 
    new Date(s.datetime) > new Date() && s.status !== 'cancelled'
  ).sort((a, b) => new Date(a.datetime) - new Date(b.datetime));

  const pendingRequests = schedules.filter(s => 
    s.participants?.some(p => p.role === 'student' && p.status === 'invited')
  );

  const confirmedSchedules = schedules.filter(s => s.status === 'confirmed');

  // Check if a time slot is available
  const isTimeSlotAvailable = (datetime) => {
    const targetDate = new Date(datetime);
    return !schedules.some(s => {
      const scheduleDate = new Date(s.datetime);
      const timeDiff = Math.abs(scheduleDate - targetDate) / 60000; // in minutes
      return timeDiff < 60 && s.status !== 'cancelled';
    });
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
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">Consultation Schedule Management</h2>
        <div className="flex space-x-2">
          <button
            onClick={() => setViewMode(viewMode === "list" ? "calendar" : "list")}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm font-medium"
          >
            <FaCalendar className="inline mr-2" />
            {viewMode === "list" ? "Calendar View" : "List View"}
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-[#7C1D23] text-white rounded-md hover:bg-[#5a1519] transition-colors text-sm font-medium"
          >
            + Add Consultation Slot
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-yellow-700">{pendingRequests.length}</p>
              <p className="text-xs text-yellow-600 font-medium uppercase">Pending Requests</p>
            </div>
            <FaClock className="h-8 w-8 text-yellow-600" />
          </div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-green-700">{confirmedSchedules.length}</p>
              <p className="text-xs text-green-600 font-medium uppercase">Confirmed</p>
            </div>
            <FaCheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </div>
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-blue-700">{upcomingSchedules.length}</p>
              <p className="text-xs text-blue-600 font-medium uppercase">Upcoming</p>
            </div>
            <FaCalendar className="h-8 w-8 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Pending Requests Section */}
      {pendingRequests.length > 0 && (
        <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-5">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <FaClock className="mr-2 text-yellow-600" />
            Pending Consultation Requests ({pendingRequests.length})
          </h3>
          <div className="space-y-3">
            {pendingRequests.map((schedule) => {
              const studentParticipant = schedule.participants?.find(p => p.role === 'student');
              return (
                <div key={schedule._id} className="bg-white rounded-lg p-4 border border-yellow-300">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-800">{schedule.title}</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Student: {studentParticipant?.user?.name || 'N/A'}
                      </p>
                      <p className="text-sm text-gray-500">
                        <FaCalendar className="inline mr-1" />
                        {new Date(schedule.datetime).toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-500">
                        Location: {schedule.location}
                      </p>
                    </div>
                    <div className="flex space-x-2 ml-4">
                      <button
                        onClick={() => handleApproveRequest(schedule._id, studentParticipant?.user?._id)}
                        disabled={loading}
                        className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium disabled:opacity-50"
                      >
                        <FaCheckCircle className="inline mr-1" />
                        Approve
                      </button>
                      <button
                        onClick={() => handleDeclineRequest(schedule._id, studentParticipant?.user?._id)}
                        disabled={loading}
                        className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium disabled:opacity-50"
                      >
                        <FaTimesCircle className="inline mr-1" />
                        Decline
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Google Calendar Connection */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <FaGoogle className={`text-2xl ${calendarConnected ? 'text-green-600' : 'text-gray-400'}`} />
            <div>
              <h3 className="font-semibold text-gray-800">Google Calendar Integration</h3>
              <p className="text-sm text-gray-600">
                {calendarConnected 
                  ? '✅ Connected - Schedules sync automatically' 
                  : '❌ Not connected - Connect to enable sync'}
              </p>
            </div>
          </div>
          <button
            onClick={calendarConnected ? onDisconnectCalendar : onConnectCalendar}
            disabled={calendarLoading}
            className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${
              calendarConnected
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            } ${calendarLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {calendarLoading ? 'Loading...' : calendarConnected ? 'Disconnect' : 'Connect Calendar'}
          </button>
        </div>
      </div>

      {/* Calendar View */}
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
              padding: 0 12px !important;
            }
            .rbc-month-view,
            .rbc-time-view,
            .rbc-agenda-view {
              min-height: 500px !important;
            }
            .rbc-event {
              padding: 4px 8px !important;
              border-radius: 4px !important;
              font-size: 13px !important;
              cursor: pointer !important;
            }
            .rbc-agenda-view table {
              width: 100% !important;
            }
            .rbc-agenda-view .rbc-agenda-date-cell,
            .rbc-agenda-view .rbc-agenda-time-cell {
              white-space: nowrap !important;
              padding: 8px 12px !important;
            }
            .rbc-agenda-view .rbc-agenda-event-cell {
              padding: 8px 12px !important;
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
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            onEventDrop={handleEventDrop}
            selectable
            resizable
            views={['month', 'week', 'day', 'agenda']}
            step={30}
            showMultiDayTimes
            popup
            messages={{
              date: 'Date',
              time: 'Time',
              event: 'Consultation',
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
              noEventsInRange: 'No consultations scheduled in this range.',
              showMore: total => `+${total} more`
            }}
            eventPropGetter={(event) => ({
              style: {
                backgroundColor: event.resource.calendarSynced ? '#10b981' : '#7C1D23',
                borderColor: event.resource.calendarSynced ? '#059669' : '#5a1519',
              }
            })}
            tooltipAccessor={(event) => `${event.title} - ${event.resource.location}`}
          />
        </div>
      ) : (
        /* Schedules List */
        <div className="space-y-4">
          {schedules.length === 0 ? (
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-8">
              <FaCalendar className="mx-auto h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-center text-sm">No consultation schedules yet.</p>
              <p className="text-gray-400 text-center text-xs mt-1">Click "Add Consultation Slot" to create your first slot.</p>
            </div>
          ) : (
            upcomingSchedules.map((schedule) => {
            const studentParticipant = schedule.participants?.find(p => p.role === 'student');
            const isApproaching = new Date(schedule.datetime) - new Date() < 24 * 60 * 60 * 1000; // Within 24 hours

            return (
              <div 
                key={schedule._id} 
                className={`bg-white border rounded-lg p-5 hover:shadow-md transition-shadow ${
                  isApproaching ? 'border-orange-300 bg-orange-50' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {isApproaching && (
                      <div className="mb-2">
                        <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                          <FaClock className="inline mr-1" />
                          Approaching Soon
                        </span>
                      </div>
                    )}
                <h3 className="text-base font-semibold text-gray-800">{schedule.title}</h3>
                <p className="text-sm text-gray-600 mt-1">
                      {studentParticipant ? `with ${studentParticipant.user?.name}` : 'Available Slot'}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      <FaCalendar className="inline mr-1" />
                      {new Date(schedule.datetime).toLocaleDateString()} at {new Date(schedule.datetime).toLocaleTimeString()}
                    </p>
                    <p className="text-sm text-gray-500">Location: {schedule.location}</p>
                    <p className="text-sm text-gray-500">Duration: {schedule.duration} minutes</p>
                  </div>
                  <div className="text-right ml-4 space-y-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium block ${
                  schedule.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                  schedule.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                      schedule.status === 'cancelled' ? 'bg-gray-100 text-gray-700' :
                      'bg-yellow-100 text-yellow-700'
                }`}>
                  {schedule.status}
                </span>
                    {schedule.status !== 'cancelled' && (
                      <div className="flex flex-col space-y-1">
                        <button
                          onClick={() => handleEditClick(schedule)}
                          className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 text-xs font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteClick(schedule)}
                          className="px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200 text-xs font-medium"
                        >
                          Delete
                        </button>
              </div>
                    )}
            </div>
          </div>
              </div>
            );
          })
        )}
        </div>
      )}

      {/* Create Consultation Slot Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Create Consultation Slot</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FaClose className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleCreateSlot} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  placeholder="e.g., Weekly Consultation"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Brief description of the consultation"
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date & Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={formData.datetime}
                  onChange={(e) => setFormData({...formData, datetime: e.target.value})}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Duration (minutes) <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.duration}
                  onChange={(e) => setFormData({...formData, duration: parseInt(e.target.value)})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-transparent"
                  required
                >
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="90">1.5 hours</option>
                  <option value="120">2 hours</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                  placeholder="e.g., Faculty Office, Room 301"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-transparent"
                  required
                />
              </div>

              {/* Google Calendar Sync Toggle */}
              {calendarConnected && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="syncToCalendar"
                      checked={formData.syncToCalendar}
                      onChange={(e) => setFormData({...formData, syncToCalendar: e.target.checked})}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="syncToCalendar" className="flex-1 cursor-pointer">
                      <div className="flex items-center space-x-2">
                        <FaGoogle className="text-blue-600" />
                        <span className="font-medium text-gray-800">Sync to Google Calendar</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        Automatically add to Google Calendar and generate a Meet link
                      </p>
                    </label>
                  </div>
                </div>
              )}

              {!calendarConnected && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800">
                    💡 Connect Google Calendar above to enable automatic sync
                  </p>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-[#7C1D23] text-white rounded-md hover:bg-[#5a1519] transition-colors text-sm font-medium disabled:opacity-50"
                >
                  {loading ? "Creating..." : "Create Slot"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Consultation Slot Modal */}
      {showEditModal && selectedSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Edit Consultation Slot</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FaClose className="h-6 w-6" />
              </button>
            </div>

            {selectedSchedule.participants?.some(p => p.role === 'student') && (
              <div className="mb-4 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> This slot has students booked. They will be notified of any changes.
                </p>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  placeholder="e.g., Weekly Consultation"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Brief description of the consultation"
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date & Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={formData.datetime}
                  onChange={(e) => setFormData({...formData, datetime: e.target.value})}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Duration (minutes) <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.duration}
                  onChange={(e) => setFormData({...formData, duration: parseInt(e.target.value)})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-transparent"
                  required
                >
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="90">1.5 hours</option>
                  <option value="120">2 hours</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                  placeholder="e.g., Faculty Office, Room 301"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-transparent"
                  required
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  {loading ? "Updating..." : "Update Slot"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && selectedSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mr-4">
                <FaTimesCircle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800">Delete Consultation Slot</h3>
            </div>

            <p className="text-gray-600 mb-4">
              Are you sure you want to delete this consultation slot?
            </p>

            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-sm text-gray-700">
                <span className="font-medium">Title:</span> {selectedSchedule.title}
              </p>
              <p className="text-sm text-gray-700">
                <span className="font-medium">Date/Time:</span> {new Date(selectedSchedule.datetime).toLocaleString()}
              </p>
              <p className="text-sm text-gray-700">
                <span className="font-medium">Location:</span> {selectedSchedule.location}
              </p>
            </div>

            {selectedSchedule.participants?.some(p => p.role === 'student') && (
              <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-400 rounded">
                <p className="text-sm text-red-800">
                  <strong>Warning:</strong> Students with booked appointments will receive automatic cancellation notifications.
                </p>
              </div>
            )}

            <p className="text-sm text-gray-500 mb-6">
              This action cannot be undone. The slot will be permanently removed from the calendar.
            </p>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteDialog(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={loading}
                className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {loading ? "Deleting..." : "Delete Slot"}
              </button>
            </div>
          </div>
        </div>
      )}
  </div>
);
};

// Student List Component
const StudentList = ({ students, onUpdateStatus, loading }) => {
  const [assignedResearch, setAssignedResearch] = useState([]);
  const [detailedView, setDetailedView] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedStage, setSelectedStage] = useState("");
  const [selectedProgress, setSelectedProgress] = useState(0);
  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    fetchAssignedResearch();
  }, []);

  const fetchAssignedResearch = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/faculty/students', {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log("Assigned research:", res.data);
      setAssignedResearch(res.data);
    } catch (error) {
      console.error('Error fetching assigned research:', error);
    }
  };

  const handleViewDetails = (research) => {
    setSelectedStudent(research);
    setSelectedStatus(research.status);
    setSelectedStage(research.stage);
    setSelectedProgress(research.progress || 0);
    setDetailedView(true);
  };

  const handleUpdateStatus = async () => {
    try {
      await onUpdateStatus(selectedStudent._id, selectedStatus, selectedStage, selectedProgress);
      setShowConfirmation(true);
      setTimeout(() => {
        setShowConfirmation(false);
        setDetailedView(false);
      }, 2000);
      fetchAssignedResearch();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const statusOptions = [
    { value: "pending", label: "Pending", color: "yellow" },
    { value: "in-progress", label: "In Progress", color: "blue" },
    { value: "for-revision", label: "For Revision", color: "orange" },
    { value: "completed", label: "Completed", color: "green" },
  ];

  const stageOptions = [
    { value: "proposal", label: "Proposal" },
    { value: "chapter1", label: "Chapter 1" },
    { value: "chapter2", label: "Chapter 2" },
    { value: "chapter3", label: "Chapter 3" },
    { value: "defense", label: "Defense" },
    { value: "final", label: "Final" },
  ];

  if (detailedView && selectedStudent) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
        <div className="bg-white rounded-lg shadow-lg max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
          {/* Success Confirmation Message */}
          {showConfirmation && (
            <div className="mb-4 p-4 bg-green-50 border-l-4 border-green-500 rounded-md">
              <div className="flex items-center">
                <FaCheckCircle className="h-5 w-5 text-green-500 mr-3" />
                <p className="text-green-700 font-medium">
                  Research status has been successfully updated.
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Research Details & Status Update</h3>
            <button
              onClick={() => setDetailedView(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <FaClose className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Research Title */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="text-md font-semibold text-gray-800 mb-2">Research Title</h4>
              <p className="text-gray-700">{selectedStudent.title}</p>
            </div>

            {/* Student Information */}
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="text-md font-semibold text-gray-800 mb-2">Student Information</h4>
                {selectedStudent.students.map((student, index) => (
                  <div key={student._id} className="mt-2">
                    <p className="text-gray-700">
                    <span className="font-medium">Student {index + 1}:</span> {student.name}
                    </p>
                  <p className="text-sm text-gray-600">{student.email}</p>
                  </div>
                ))}
              </div>

            {/* Current Status Display */}
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="text-md font-semibold text-gray-800 mb-2">Current Status</h4>
              <div className="space-y-2">
                  <p className="text-gray-700">
                  <span className="font-medium">Status:</span>{" "}
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    selectedStudent.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    selectedStudent.status === 'in-progress' ? 'bg-blue-100 text-blue-700' :
                    selectedStudent.status === 'for-revision' ? 'bg-orange-100 text-orange-700' :
                    selectedStudent.status === 'completed' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-700'
                    }`}>
                      {selectedStudent.status}
                    </span>
                  </p>
                  <p className="text-gray-700">
                  <span className="font-medium">Stage:</span> {selectedStudent.stage}
                </p>
                <p className="text-gray-700">
                  <span className="font-medium">Progress:</span> {selectedStudent.progress || 0}%
                </p>
                <p className="text-sm text-gray-500">
                  Last updated: {new Date(selectedStudent.updatedAt).toLocaleString()}
                  </p>
                </div>
              </div>

            {/* Status Update Form */}
            <div className="p-4 bg-white rounded-lg border-2 border-[#7C1D23]">
              <h4 className="text-md font-semibold text-gray-800 mb-4">Update Research Status</h4>
              
              <div className="space-y-4">
                {/* Status Dropdown */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-transparent"
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
            </div>

                {/* Stage Dropdown */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stage <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedStage}
                    onChange={(e) => setSelectedStage(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-transparent"
                  >
                    {stageOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Progress Slider */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Progress: {selectedProgress}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={selectedProgress}
                    onChange={(e) => setSelectedProgress(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#7C1D23]"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-2 pt-4">
              <button
                onClick={() => setDetailedView(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateStatus}
                disabled={loading}
                className="flex items-center px-6 py-2 bg-[#7C1D23] text-white rounded-md hover:bg-[#5a1519] transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <FaClock className="mr-2 text-sm animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <FaCheckCircle className="mr-2 text-sm" />
                Update Status
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Return main list view
  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">Assigned Research</h2>
        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
          {assignedResearch.length} Assigned Projects
        </span>
      </div>

      <div className="space-y-4">
        {assignedResearch.length === 0 ? (
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-8">
            <p className="text-gray-500 text-center text-sm">No research projects assigned yet.</p>
          </div>
        ) : (
          assignedResearch.map((research) => (
            <div key={research._id} className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className="h-14 w-14 rounded-full bg-[#7C1D23] flex items-center justify-center text-white font-semibold text-xl">
                    {research.students[0]?.name?.charAt(0) || '?'}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800">{research.title}</h3>
                    <div className="mt-2">
                      {research.students.map((student, index) => (
                        <p key={student._id} className="text-sm text-gray-600">
                          Student {index + 1}: {student.name} ({student.email})
                        </p>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center space-x-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        research.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        research.status === 'in-progress' ? 'bg-blue-100 text-blue-700' :
                        research.status === 'for-revision' ? 'bg-orange-100 text-orange-700' :
                        research.status === 'completed' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {research.status === 'for-revision' ? 'For Revision' : research.status}
                      </span>
                      <span className="text-sm text-gray-500">
                        Stage: {research.stage}
                      </span>
                      <span className="text-sm text-gray-500">
                        Progress: {research.progress || 0}%
                      </span>
                    </div>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-xs text-gray-500">Last Updated</p>
                  <p className="text-sm font-medium text-gray-600">
                    {new Date(research.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex justify-end space-x-2">
                <button
                  onClick={() => handleViewDetails(research)}
                  className="px-4 py-2 bg-[#7C1D23] text-white rounded-md text-sm font-medium hover:bg-[#5a1519] transition-colors"
                >
                  View & Update Status
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Panel Reviews Component
const PanelReviews = () => {
  const [panels, setPanels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPanel, setSelectedPanel] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    comments: '',
    recommendation: 'pending',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchPanels();
  }, []);

  const fetchPanels = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/faculty/panels', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPanels(res.data || []);
    } catch (error) {
      console.error('Error fetching panels:', error);
      alert('Error loading panel assignments');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReviewModal = (panel) => {
    setSelectedPanel(panel);
    setReviewForm({
      comments: panel.myReview?.comments || '',
      recommendation: panel.myReview?.recommendation || 'pending',
    });
    setShowReviewModal(true);
  };

  const handleCloseReviewModal = () => {
    setShowReviewModal(false);
    setSelectedPanel(null);
    setReviewForm({ comments: '', recommendation: 'pending' });
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!reviewForm.comments.trim()) {
      alert('Please provide review comments');
      return;
    }
    if (reviewForm.recommendation === 'pending') {
      alert('Please select a recommendation');
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `/api/faculty/panels/${selectedPanel._id}/review`,
        {
          comments: reviewForm.comments,
          recommendation: reviewForm.recommendation,
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      alert('Review submitted successfully!');
      handleCloseReviewModal();
      fetchPanels();
    } catch (error) {
      console.error('Error submitting review:', error);
      alert(error?.response?.data?.message || 'Error submitting review');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      submitted: 'bg-green-100 text-green-800 border-green-300',
      overdue: 'bg-red-100 text-red-800 border-red-300',
      in_progress: 'bg-blue-100 text-blue-800 border-blue-300',
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getRecommendationColor = (recommendation) => {
    const colors = {
      approve: 'bg-green-100 text-green-800',
      reject: 'bg-red-100 text-red-800',
      revision: 'bg-yellow-100 text-yellow-800',
      pending: 'bg-gray-100 text-gray-800',
    };
    return colors[recommendation] || colors.pending;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Panel Reviews</h2>
        <p className="text-sm text-gray-600">Review and provide feedback on research panels you're assigned to</p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading panels...</p>
        </div>
      ) : panels.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <FaUsers className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-600 mb-2">No panel assignments found</p>
          <p className="text-sm text-gray-500">You haven't been assigned to any panels yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {panels.map(panel => (
            <div
              key={panel._id}
              className={`bg-white border rounded-lg p-5 hover:shadow-md transition-shadow ${
                panel.hasSubmittedReview ? 'border-green-300' : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{panel.name}</h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded border ${getStatusColor(panel.status)}`}>
                      {panel.status.replace(/_/g, ' ')}
                    </span>
                    {panel.hasSubmittedReview && (
                      <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-800 border border-green-300">
                        Review Submitted
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 mb-1">
                    <span className="font-medium">Research:</span> {panel.research?.title || 'N/A'}
                  </p>
                  <p className="text-sm text-gray-600 mb-1">
                    <span className="font-medium">Type:</span> {panel.type?.replace(/_/g, ' ')}
                  </p>
                  {panel.description && (
                    <p className="text-sm text-gray-600 mb-2">{panel.description}</p>
                  )}
                  {panel.reviewDueDate && (
                    <p className="text-xs text-gray-500">
                      Review Due: {new Date(panel.reviewDueDate).toLocaleDateString()}
                      {new Date(panel.reviewDueDate) < new Date() && !panel.hasSubmittedReview && (
                        <span className="ml-2 text-red-600 font-medium">(Overdue)</span>
                      )}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleOpenReviewModal(panel)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    panel.hasSubmittedReview
                      ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      : 'bg-[#7C1D23] text-white hover:bg-[#5a1519]'
                  }`}
                >
                  {panel.hasSubmittedReview ? 'Update Review' : 'Submit Review'}
                </button>
              </div>

              {/* My Review Status */}
              {panel.myReview && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Your Review</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Status: <span className={`font-medium ${getStatusColor(panel.reviewStatus).split(' ')[1]}`}>
                          {panel.reviewStatus.replace(/_/g, ' ')}
                        </span>
                      </p>
                      {panel.myReview.recommendation !== 'pending' && (
                        <span className={`inline-block mt-2 px-2 py-1 text-xs rounded ${getRecommendationColor(panel.myReview.recommendation)}`}>
                          Recommendation: {panel.myReview.recommendation.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                    {panel.myReview.submittedAt && (
                      <p className="text-xs text-gray-500">
                        Submitted: {new Date(panel.myReview.submittedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  {panel.myReview.comments && (
                    <p className="text-sm text-gray-700 mt-2 p-3 bg-gray-50 rounded border border-gray-200">
                      {panel.myReview.comments}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Review Submission Modal */}
      {showReviewModal && selectedPanel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Submit Panel Review</h3>
                  <p className="text-sm text-gray-600 mt-1">{selectedPanel.name}</p>
                  <p className="text-xs text-gray-500 mt-1">Research: {selectedPanel.research?.title}</p>
                </div>
                <button
                  onClick={handleCloseReviewModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FaClose className="h-5 w-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmitReview} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Review Comments <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={reviewForm.comments}
                    onChange={(e) => setReviewForm({ ...reviewForm, comments: e.target.value })}
                    rows={6}
                    className="w-full px-4 py-2 rounded-md border border-gray-300 focus:border-[#7C1D23] focus:ring-2 focus:ring-[#7C1D23]/20 text-sm"
                    placeholder="Provide your detailed review comments, feedback, and evaluation..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Recommendation <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={reviewForm.recommendation}
                    onChange={(e) => setReviewForm({ ...reviewForm, recommendation: e.target.value })}
                    className="w-full px-4 py-2 rounded-md border border-gray-300 focus:border-[#7C1D23] focus:ring-2 focus:ring-[#7C1D23]/20 text-sm"
                    required
                  >
                    <option value="pending">Select Recommendation</option>
                    <option value="approve">Approve</option>
                    <option value="revision">Require Revision</option>
                    <option value="reject">Reject</option>
                  </select>
                </div>

                {selectedPanel.reviewDueDate && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-yellow-800">
                      <span className="font-medium">Review Deadline:</span> {new Date(selectedPanel.reviewDueDate).toLocaleDateString()}
                      {new Date(selectedPanel.reviewDueDate) < new Date() && (
                        <span className="ml-2 font-medium">(Overdue)</span>
                      )}
                    </p>
                  </div>
                )}
              </div>

              <div className="p-5 border-t border-gray-200 bg-gray-50">
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleCloseReviewModal}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-[#7C1D23] text-white rounded-md text-sm font-medium hover:bg-[#5a1519] transition-colors disabled:opacity-60"
                  >
                    {submitting ? 'Submitting...' : 'Submit Review'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Documents View Component
const DocumentsView = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/faculty/documents', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDocuments(response.data);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (doc) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/faculty/documents/${doc._id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', doc.filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading document:', error);
      alert('Error downloading document: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleView = async (doc) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/faculty/documents/${doc._id}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: doc.mimeType });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (error) {
      console.error('Error viewing document:', error);
      alert('Error viewing document');
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         doc.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || doc.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(2)} KB`;
    return `${(kb / 1024).toFixed(2)} MB`;
  };

  const getCategoryColor = (category) => {
    const colors = {
      form: 'bg-blue-100 text-blue-700',
      template: 'bg-green-100 text-green-700',
      guideline: 'bg-purple-100 text-purple-700',
      policy: 'bg-red-100 text-red-700',
      other: 'bg-gray-100 text-gray-700'
    };
    return colors[category] || colors.other;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading documents...</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">Documents</h2>
        <span className="text-sm text-gray-600">{filteredDocuments.length} document(s)</span>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-transparent"
            />
          </div>
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-transparent"
            >
              <option value="all">All Categories</option>
              <option value="form">Forms</option>
              <option value="template">Templates</option>
              <option value="guideline">Guidelines</option>
              <option value="policy">Policies</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </div>

      {/* Documents List */}
      <div className="bg-white rounded-lg border border-gray-200">
        {filteredDocuments.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No documents available
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredDocuments.map((doc) => (
              <div key={doc._id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <FaFileAlt className="text-[#7C1D23] h-5 w-5" />
                      <h3 className="text-base font-semibold text-gray-900">{doc.title}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(doc.category)}`}>
                        {doc.category}
                      </span>
                    </div>
                    {doc.description && (
                      <p className="text-sm text-gray-600 mb-2">{doc.description}</p>
                    )}
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <span>Uploaded by: {doc.uploadedBy?.name || 'Unknown'}</span>
                      <span>•</span>
                      <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>{formatFileSize(doc.fileSize)}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => handleView(doc)}
                      className="p-2 text-gray-600 hover:text-blue-600 transition-colors"
                      title="View Document"
                    >
                      <FaFileAlt className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDownload(doc)}
                      className="p-2 text-gray-600 hover:text-[#7C1D23] transition-colors"
                      title="Download"
                    >
                      <FaUpload className="h-4 w-4 transform rotate-180" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FacultyAdviserDashboard;
