import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { FaCheckCircle, FaTimesCircle, FaUsers, FaClipboardList, FaCalendar, FaFileAlt, FaClock, FaSignOutAlt, FaBars, FaTimes as FaClose, FaUpload, FaGoogle, FaVideo, FaCog, FaChevronDown, FaChevronUp, FaTrash, FaEye, FaFilter, FaSearch } from "react-icons/fa";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { renderAsync } from 'docx-preview';
import { showSuccess, showError, showWarning, showConfirm, showDangerConfirm } from "../../utils/sweetAlert";
import { checkPermission } from "../../utils/permissionChecker";
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Document, Page, pdfjs } from 'react-pdf';
// Import CSS for react-pdf (v10 uses dist/Page/ not dist/esm/Page/)
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import Settings from "../Settings";
import DriveUploader from "../../components/DriveUploader";

// Configure PDF.js worker - using local file from react-pdf's pdfjs-dist
// This ensures the worker version matches the API version exactly (both are 5.4.296)
// The worker file is copied from react-pdf's node_modules to public/pdf.worker.min.js
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

const localizer = momentLocalizer(moment);

// Reusable Pagination Component
const Pagination = ({ 
  currentPage, 
  totalPages, 
  totalItems, 
  itemsPerPage, 
  onPageChange, 
  onItemsPerPageChange,
  startIndex,
  endIndex 
}) => {
  const handleFirstPage = () => onPageChange(1);
  const handlePrevPage = () => onPageChange(Math.max(1, currentPage - 1));
  const handleNextPage = () => onPageChange(Math.min(totalPages, currentPage + 1));
  const handleLastPage = () => onPageChange(totalPages);
  const handlePageClick = (page) => onPageChange(page);

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  // Always show pagination if there are items, even if only one page
  if (totalItems === 0) {
    return null; // Only hide if there are no items at all
  }

  return (
    <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
      <div className="flex flex-1 justify-between sm:hidden">
        <button
          onClick={handlePrevPage}
          disabled={currentPage === 1}
          className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <button
          onClick={handleNextPage}
          disabled={currentPage === totalPages}
          className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-700">
            Showing <span className="font-medium">{startIndex}</span> to <span className="font-medium">{endIndex}</span> of{' '}
            <span className="font-medium">{totalItems}</span> results
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1">
            <label className="text-sm text-gray-700">Items per page:</label>
            <select
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
              className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-[#7C1D23] focus:border-transparent"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={handleFirstPage}
              disabled={currentPage === 1}
              className="px-2 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              title="First page"
            >
              ««
            </button>
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              className="px-2 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Previous page"
            >
              ‹
            </button>
            {getPageNumbers().map((page, idx) => (
              <React.Fragment key={idx}>
                {page === '...' ? (
                  <span className="px-2 py-1 text-sm text-gray-700">...</span>
                ) : (
                  <button
                    onClick={() => handlePageClick(page)}
                    className={`px-3 py-1 border rounded-md text-sm font-medium ${
                      currentPage === page
                        ? 'bg-[#7C1D23] text-white border-[#7C1D23]'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                )}
              </React.Fragment>
            ))}
            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="px-2 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Next page"
            >
              ›
            </button>
            <button
              onClick={handleLastPage}
              disabled={currentPage === totalPages}
              className="px-2 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Last page"
            >
              »»
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const FacultyAdviserDashboard = ({ setUser, user }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Initialize selectedTab from URL params, default to "submissions"
  const tabFromUrl = searchParams.get('tab');
  const [selectedTab, setSelectedTab] = useState(tabFromUrl || "submissions");
  const [students, setStudents] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Google Calendar state
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Initialize tab from URL on mount (only if URL has tab param and it differs from initial state)
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl && tabFromUrl !== selectedTab) {
      setSelectedTab(tabFromUrl);
    } else if (!tabFromUrl && selectedTab) {
      // If no tab in URL but we have a selectedTab, update URL
      setSearchParams({ tab: selectedTab }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Update URL when tab changes (after initial mount)
  useEffect(() => {
    const currentTab = searchParams.get('tab');
    if (selectedTab && currentTab !== selectedTab) {
      setSearchParams({ tab: selectedTab }, { replace: true });
    }
  }, [selectedTab]);

  // Track permission warnings shown per tab
  const permissionWarningsRef = useRef({});

  // Check permissions when tab changes
  useEffect(() => {
    const checkTabPermissions = async () => {
      if (!selectedTab || permissionWarningsRef.current[selectedTab]) return;

      const permissionMap = {
        'submissions': { permissions: ['view_research'], feature: 'Student Submissions', context: 'You will not be able to view student submissions.' },
        'feedback': { permissions: ['create_feedback', 'view_feedback'], feature: 'Feedback Management', context: 'You will not be able to create or view feedback.' },
        'panels': { permissions: ['review_panels'], feature: 'Panel Reviews', context: 'You will not be able to review panels.' },
        'schedule': { permissions: ['view_schedules', 'manage_schedules'], feature: 'Consultation Schedule', context: 'You will not be able to view or manage consultation schedules.' },
        'students': { permissions: ['view_users'], feature: 'My Students', context: 'You will not be able to view your students.' },
        'documents': { permissions: ['view_documents'], feature: 'Documents', context: 'You will not be able to view documents.' },
      };

      const tabConfig = permissionMap[selectedTab];
      if (tabConfig) {
        const hasPermission = await checkPermission(
          tabConfig.permissions,
          tabConfig.feature,
          tabConfig.context
        );
        if (!hasPermission) {
          permissionWarningsRef.current[selectedTab] = true;
        }
      }
    };

    checkTabPermissions();
  }, [selectedTab]); 

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
      // Preserve tab param when cleaning up calendar param
      const currentTab = searchParams.get('tab') || 'submissions';
      navigate(`/dashboard/faculty?tab=${currentTab}`, { replace: true });
    } else if (calendarParam === 'error') {
      // Preserve tab param when cleaning up calendar param
      const currentTab = searchParams.get('tab') || 'submissions';
      navigate(`/dashboard/faculty?tab=${currentTab}`, { replace: true });
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
      
      // Show user-friendly error message
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          'Failed to connect to Google Calendar. Please check server configuration.';
      
      showError('Connection Error', `${errorMessage}\n\n${error.response?.data?.details || ''}`);
    } finally {
      setCalendarLoading(false);
    }
  };

  const disconnectGoogleCalendar = async () => {
    const result = await showConfirm('Disconnect Google Calendar?', 'Are you sure you want to disconnect Google Calendar?');
    if (!result.isConfirmed) return;
    
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
    console.log('[APPROVE SUBMISSION] Starting approval:', { researchId, fileId });
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/faculty/submissions/approve-reject', {
        researchId,
        fileId,
        action: 'approved',
        message: 'Submission approved successfully.'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('[APPROVE SUBMISSION] Success:', response.data);
      fetchStudentSubmissions();
    } catch (error) {
      console.error('[APPROVE SUBMISSION] Error:', error);
      console.error('[APPROVE SUBMISSION] Error response:', error.response?.data);
      showError('Error', 'Error approving submission');
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
      showError('Error', 'Error rejecting submission');
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
      await showSuccess('Success', 'Thesis status updated successfully!');
    } catch (error) {
      console.error('Error updating thesis status:', error);
      showError('Error', 'Error updating thesis status');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    // Show confirmation dialog
    const result = await showConfirm('Log Out', 'Are you sure you want to log out?');
    if (result.isConfirmed) {
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

  const handleOpenSettings = () => {
    setSidebarOpen(false);
    setShowSettings(true);
  };

  const handleCloseSettings = () => setShowSettings(false);

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
          onRefresh={fetchStudentSubmissions}
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

        {/* Settings & Logout Buttons */}
        <div className="p-4 border-t border-[#5a1519] space-y-3">
          <button
            onClick={showSettings ? handleCloseSettings : handleOpenSettings}
            className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 w-full ${
              showSettings
                ? "bg-white text-[#7C1D23]"
                : "text-white bg-[#6e1b20] hover:bg-[#5a1519]"
            }`}
          >
            <FaCog className="h-5 w-5" />
            <span className="font-medium text-sm">
              {showSettings ? "Close Settings" : "Settings"}
            </span>
          </button>
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
            {showSettings ? (
              <Settings
                user={user}
                setUser={setUser}
                embedded
                onClose={handleCloseSettings}
              />
            ) : (
              renderContent()
            )}
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

// DOCX Viewer Component using docx-preview
const DocxViewer = ({ blob, containerRef, onError }) => {
  useEffect(() => {
    if (blob && containerRef.current) {
      // Clear previous content
      containerRef.current.innerHTML = '';
      
      // Render DOCX using docx-preview
      renderAsync(
        blob, // document: ArrayBuffer | Blob | Uint8Array
        containerRef.current, // bodyContainer: HTMLElement
        null, // styleContainer: HTMLElement (null = use bodyContainer)
        {
          className: "docx",
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          ignoreLastRenderedPageBreak: true,
          experimental: false,
          trimXmlDeclaration: true,
          useBase64URL: false,
          renderChanges: false,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
          renderComments: false,
          renderAltChunks: true,
          debug: false,
        }
      )
      .then(() => {
        console.log("DOCX: finished rendering");
      })
      .catch((error) => {
        console.error("Error rendering DOCX:", error);
        if (onError) {
          onError(error);
        }
      });
    }
    
    // Cleanup function
    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [blob, containerRef, onError]);
  
  return null; // This component doesn't render anything itself
};

// Student Submissions Component
const StudentSubmissions = ({ submissions, onApprove, onReject, onRefresh, loading }) => {
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionReasonType, setRejectionReasonType] = useState("predefined"); // "predefined" or "custom"
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedForm, setSelectedForm] = useState(null);
  const [expandedChapters, setExpandedChapters] = useState({
    chapter1: false,
    chapter2: false,
    chapter3: false
  });
  const [viewDocumentUrl, setViewDocumentUrl] = useState(null);
  const [viewDocumentFilename, setViewDocumentFilename] = useState(null);
  const [viewDocumentType, setViewDocumentType] = useState(null);
  const [docxBlob, setDocxBlob] = useState(null);
  const docxContainerRef = useRef(null);
  // Filters state
  const [filters, setFilters] = useState({
    chapter: '',
    partName: '',
    status: '',
    startDate: '',
    endDate: '',
    search: ''
  });

  // Chapter titles mapping
  const chapterTitles = useMemo(() => ({
    chapter1: "Chapter 1 - Introduction",
    chapter2: "Chapter 2 - Literature Review",
    chapter3: "Chapter 3 - Methodology",
  }), []);

  // Group submissions by chapter type, filter, and show only latest version per part
  const groupedSubmissions = useMemo(() => {
    const groups = {
      chapter1: [],
      chapter2: [],
      chapter3: []
    };

    // First, collect all submissions
    const allSubmissions = [];
    submissions.forEach(research => {
      const student = research.students?.[0];
      research.forms?.forEach(form => {
        if (form.type === 'chapter1' || form.type === 'chapter2' || form.type === 'chapter3') {
          allSubmissions.push({
            ...form,
            research: research,
            student: student,
            studentId: student?._id || student?.id
          });
        }
      });
    });

    // Apply filters
    let filtered = allSubmissions;
    
    // Filter by chapter
    if (filters.chapter) {
      filtered = filtered.filter(s => s.type === filters.chapter);
    }
    
    // Filter by part name
    if (filters.partName) {
      const partNameLower = filters.partName.toLowerCase();
      filtered = filtered.filter(s => {
        const partName = s.partName || '';
        return partName.toLowerCase().includes(partNameLower);
      });
    }
    
    // Filter by status
    if (filters.status) {
      filtered = filtered.filter(s => s.status === filters.status);
    }
    
    // Filter by date range
    if (filters.startDate) {
      const startDate = new Date(filters.startDate);
      startDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter(s => {
        const uploadDate = new Date(s.uploadedAt);
        return uploadDate >= startDate;
      });
    }
    
    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(s => {
        const uploadDate = new Date(s.uploadedAt);
        return uploadDate <= endDate;
      });
    }
    
    // Filter by search (part name, filename, chapter title)
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(s => {
        const partName = (s.partName || '').toLowerCase();
        const filename = (s.filename || '').toLowerCase();
        const chapterTitle = chapterTitles[s.type]?.toLowerCase() || '';
        return partName.includes(searchLower) || 
               filename.includes(searchLower) || 
               chapterTitle.includes(searchLower);
      });
    }

    // Group by chapter type
    filtered.forEach(submission => {
      if (submission.type === 'chapter1' || submission.type === 'chapter2' || submission.type === 'chapter3') {
        groups[submission.type].push(submission);
      }
    });

    // For each chapter, group by student and partName, then get latest version
    Object.keys(groups).forEach(chapterType => {
      // Group by student first
      const byStudent = {};
      groups[chapterType].forEach(submission => {
        const studentId = submission.studentId?.toString() || 'unknown';
        if (!byStudent[studentId]) {
          byStudent[studentId] = [];
        }
        byStudent[studentId].push(submission);
      });
      
      // For each student, group by partName and get latest version
      const latestSubmissions = [];
      Object.keys(byStudent).forEach(studentId => {
        const studentSubs = byStudent[studentId];
        
        // Group by partName (null/undefined/empty = 'full-chapter')
        const byPart = {};
        studentSubs.forEach(submission => {
          const partKey = (submission.partName && submission.partName.trim()) 
            ? submission.partName.trim() 
            : 'full-chapter';
          if (!byPart[partKey]) {
            byPart[partKey] = [];
          }
          byPart[partKey].push(submission);
        });
        
        // For each part, get the latest version (highest version number, or newest date)
        Object.keys(byPart).forEach(partKey => {
          const partSubs = byPart[partKey];
          // Sort by version (descending) then by date (newest first)
          partSubs.sort((a, b) => {
            const versionA = a.version || 1;
            const versionB = b.version || 1;
            if (versionA !== versionB) {
              return versionB - versionA; // Higher version first
            }
            const dateA = new Date(a.uploadedAt || 0);
            const dateB = new Date(b.uploadedAt || 0);
            return dateB - dateA; // Newer first
          });
          
          // Take only the latest (first in sorted array)
          if (partSubs.length > 0) {
            latestSubmissions.push(partSubs[0]);
          }
        });
      });
      
      // Sort by date (newest first) for display
      groups[chapterType] = latestSubmissions.sort((a, b) => {
        const dateA = new Date(a.uploadedAt || 0);
        const dateB = new Date(b.uploadedAt || 0);
        return dateB - dateA; // Newest first
      });
    });

    return groups;
  }, [submissions, filters, chapterTitles]);

  // Toggle chapter expansion
  const toggleChapter = useCallback((chapterType) => {
    setExpandedChapters(prev => ({
      ...prev,
      [chapterType]: !prev[chapterType]
    }));
  }, []);

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
    setRejectionReasonType("predefined");
  };

  const handleDeleteClick = async (research, form) => {
    const versionText = form.version ? `Version ${form.version}` : 'this submission';
    const partText = form.partName ? ` (${form.partName})` : '';
    const studentName = research.students?.[0]?.name || 'Student';
    const statusText = form.status === 'approved' ? ' (APPROVED)' : '';
    
    // Get the submission ID - handle both _id and id fields
    const submissionId = form._id || form.id;
    
    if (!submissionId) {
      showError('Error', 'Submission ID not found');
      console.error('Form object:', form);
      return;
    }
    
    const result = await showDangerConfirm('Delete Submission', `Are you sure you want to delete ${versionText}${partText}${statusText} from ${studentName}? This action cannot be undone.`);
    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem('token');
        console.log('Deleting submission:', submissionId);
        const response = await axios.delete(`/api/faculty/submissions/${submissionId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Delete response:', response.data);
        // Refresh submissions if callback provided
        if (onRefresh) {
          onRefresh();
        }
      } catch (error) {
        console.error('Delete error:', error);
        console.error('Error response:', error.response);
        showError('Error', error.response?.data?.message || 'Failed to delete submission. Please check the console for details.');
      }
    }
  };

  const handleViewDocument = async (research, form) => {
    try {
      const token = localStorage.getItem('token');
      const submissionId = form._id || form.id;
      
      if (!submissionId) {
        showError('Error', 'Submission ID not found');
        return;
      }
      
      // Get file extension to determine file type
      const filename = form.filename || 'document';
      const fileExtension = filename.split('.').pop()?.toLowerCase();
      
      // Store filename and type
      setViewDocumentFilename(filename);
      setViewDocumentType(fileExtension);
      
      // Use the faculty view endpoint
      const viewUrl = `/api/faculty/submissions/${submissionId}/view`;
      
      if (fileExtension === 'docx' || fileExtension === 'doc') {
        // For DOCX files, fetch as blob first, then convert to arraybuffer
        // This ensures proper handling of the streamed response
        const response = await axios.get(viewUrl, {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        });
        
        // Check if response is valid
        if (!response.data || response.data.size === 0) {
          throw new Error('File is empty or invalid');
        }
        
        // Check content type first (before consuming the blob)
        const contentType = response.headers['content-type'] || '';
        if (contentType.includes('text/html') || contentType.includes('application/json')) {
          // Might be an error page - clone blob before reading
          const clonedBlob = response.data.slice();
          const text = await clonedBlob.text();
          try {
            const errorData = JSON.parse(text);
            throw new Error(errorData.message || 'Server error');
          } catch {
            throw new Error('Received HTML instead of document file. Please check the file on the server.');
          }
        }
        
        // Convert blob to arraybuffer for docx-preview
        const arrayBuffer = await response.data.arrayBuffer();
        
        // Verify file signature
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // DOCX files are ZIP archives and start with PK (0x50 0x4B)
        // Old .doc files use OLE format and start with different bytes (0xD0 0xCF 0x11 0xE0)
        const isDocx = uint8Array.length >= 2 && uint8Array[0] === 0x50 && uint8Array[1] === 0x4B;
        const isOldDoc = uint8Array.length >= 4 && 
          uint8Array[0] === 0xD0 && uint8Array[1] === 0xCF && 
          uint8Array[2] === 0x11 && uint8Array[3] === 0xE0;
        
        if (isDocx || isOldDoc) {
          // Valid DOCX or old DOC file
          setDocxBlob(arrayBuffer);
          setViewDocumentUrl(null); // Clear URL for DOCX
        } else {
          // File doesn't match expected signatures, but try to render anyway
          console.warn('File signature check failed, but attempting to render anyway. First bytes:', 
            Array.from(uint8Array.slice(0, 8)).map(b => '0x' + b.toString(16).toUpperCase()).join(' '));
          setDocxBlob(arrayBuffer);
          setViewDocumentUrl(null);
        }
      } else {
        // For PDF and other files, fetch as blob for iframe
        const response = await axios.get(viewUrl, {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        });
        
        const contentType = response.headers['content-type'] || 'application/pdf';
        const blob = new Blob([response.data], { type: contentType });
        const url = window.URL.createObjectURL(blob);
        setViewDocumentUrl(url);
        setDocxBlob(null); // Clear DOCX blob
      }
    } catch (error) {
      console.error('Error viewing document:', error);
      showError('Error', error.response?.data?.message || error.message || 'Failed to open document. Please try again.');
    }
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
      showWarning('Validation Error', 'Please provide a rejection reason.');
      return;
    }
    await onReject(selectedSubmission._id, selectedForm._id, rejectionReason);
    setShowRejectModal(false);
    setSuccessMessage("Submission has been rejected. Reason recorded.");
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 4000);
    setRejectionReason("");
    setRejectionReasonType("predefined");
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

    {/* Filters and Search */}
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <FaFilter className="text-[#7C1D23]" />
        <h3 className="text-lg font-semibold text-gray-800">Filters & Search</h3>
      </div>
      
      <div className="space-y-4">
        {/* Search Bar */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <FaSearch className="inline mr-1" />
            Search
          </label>
          <input
            type="text"
            value={filters.search || ''}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            placeholder="Search by part name, filename, or chapter title..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23]/20 focus:border-[#7C1D23]"
          />
        </div>

        {/* Filter Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Chapter
            </label>
            <select
              value={filters.chapter || ''}
              onChange={(e) => setFilters({ ...filters, chapter: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23]/20 focus:border-[#7C1D23]"
            >
              <option value="">All Chapters</option>
              <option value="chapter1">Chapter 1</option>
              <option value="chapter2">Chapter 2</option>
              <option value="chapter3">Chapter 3</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Part Name
            </label>
            <input
              type="text"
              value={filters.partName || ''}
              onChange={(e) => setFilters({ ...filters, partName: e.target.value })}
              placeholder="Filter by part name..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23]/20 focus:border-[#7C1D23]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filters.status || ''}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23]/20 focus:border-[#7C1D23]"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="revision">Revision</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date Range
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                value={filters.startDate || ''}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23]/20 focus:border-[#7C1D23] text-sm"
                placeholder="Start"
              />
              <input
                type="date"
                value={filters.endDate || ''}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23]/20 focus:border-[#7C1D23] text-sm"
                placeholder="End"
              />
            </div>
          </div>
        </div>

        {/* Clear Filters Button */}
        {(filters.chapter || filters.partName || filters.status || filters.startDate || filters.endDate || filters.search) && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setFilters({
                chapter: '',
                partName: '',
                status: '',
                startDate: '',
                endDate: '',
                search: ''
              })}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>
    </div>

    <div className="space-y-4">
      {submissions.length === 0 ? (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-8">
          <p className="text-gray-500 text-center text-sm">No submissions to review yet.</p>
        </div>
      ) : (
        // Group by chapter type
        ['chapter1', 'chapter2', 'chapter3'].map((chapterType) => {
          const chapterSubmissions = groupedSubmissions[chapterType];
          const submissionCount = chapterSubmissions.length;
          const reviewedCount = chapterSubmissions.filter(s => s.status === 'approved' || s.status === 'rejected').length;
          const isExpanded = expandedChapters[chapterType];
          const allReviewed = reviewedCount === submissionCount && submissionCount > 0;

          if (submissionCount === 0) return null;

          return (
            <div
              key={chapterType}
              className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggleChapter(chapterType)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="text-left">
                  <p className="text-sm font-semibold text-gray-800">
                    {chapterTitles[chapterType]}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {submissionCount} submission{submissionCount !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    reviewedCount === submissionCount ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                  }`}>
                    {reviewedCount === submissionCount ? "Reviewed" : "Pending"}
                  </span>
                  {isExpanded ? (
                    <FaChevronUp className="text-gray-500" />
                  ) : (
                    <FaChevronDown className="text-gray-500" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-gray-200 px-5 py-4">
                  {chapterSubmissions.length === 0 ? (
                    <p className="text-sm text-gray-500">No submissions found matching the filters.</p>
                  ) : (
                    <div className="space-y-4">
                      {(() => {
                        // Group submissions by partName (null for full chapter, string for specific part)
                        const groupedSubmissions = new Map();
                        
                        chapterSubmissions.forEach((submission) => {
                          // Normalize partName: null, undefined, or empty string all become 'full-chapter'
                          const partKey = (submission.partName && submission.partName.trim()) 
                            ? submission.partName.trim() 
                            : 'full-chapter';
                          if (!groupedSubmissions.has(partKey)) {
                            groupedSubmissions.set(partKey, []);
                          }
                          groupedSubmissions.get(partKey).push(submission);
                        });
                        
                        // Convert to array and render
                        const groups = Array.from(groupedSubmissions.entries());
                        
                        return (
                          <>
                            {groups.map(([partKey, submissions]) => (
                              <div key={partKey} className="space-y-3">
                                {groups.length > 1 && (
                                  <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide px-2">
                                    {partKey === 'full-chapter' ? 'Full Chapter Submissions' : `${submissions[0].partName} Submissions`}
                                  </div>
                                )}
                                {submissions.map((submission, index) => (
                                  <div
                                    key={submission._id || submission.id}
                                    className={`border rounded-lg p-4 shadow-sm ${
                                      index === 0 
                                        ? 'border-blue-300 bg-blue-50' 
                                        : 'border-gray-200 bg-white'
                                    }`}
                                  >
                                    <div className="mb-3 pb-3 border-b border-gray-200">
                                      <div className="flex items-center space-x-3">
                                        <div className="h-10 w-10 rounded-full bg-[#7C1D23] flex items-center justify-center text-white font-semibold text-sm">
                                          {submission.student?.name?.charAt(0) || 'S'}
                                        </div>
                                        <div>
                                          <h4 className="font-medium text-gray-800">{submission.student?.name || 'Student'}</h4>
                                          <p className="text-xs text-gray-600">{submission.research?.title}</p>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center space-x-2 mb-2 flex-wrap">
                                          <span className="text-sm font-semibold text-gray-800">
                                            Version {submission.version || 1}
                                          </span>
                                          {submission.partName && (
                                            <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                                              {submission.partName}
                                            </span>
                                          )}
                                          {!submission.partName && (
                                            <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                                              Full Chapter
                                            </span>
                                          )}
                                          {index === 0 && (
                                            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                                              Latest
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center space-x-2">
                                          <FaFileAlt className="text-gray-600" />
                                          <h5 className="font-medium text-gray-800">{submission.filename || 'Document'}</h5>
                                        </div>
                                        <div className="mt-2 space-y-1">
                                          <p className="text-xs text-gray-500">
                                            <span className="font-medium">Date of Submission:</span>{" "}
                                            {submission.uploadedAt ? new Date(submission.uploadedAt).toLocaleString() : 'N/A'}
                                          </p>
                                          <p className="text-xs text-gray-500">
                                            <span className="font-medium">Current Status:</span>{" "}
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                              submission.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                                              submission.status === "approved" ? "bg-green-100 text-green-700" :
                                              submission.status === "rejected" ? "bg-red-100 text-red-700" :
                                              "bg-gray-100 text-gray-700"
                                            }`}>
                                              {submission.status}
                                            </span>
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <div className="flex space-x-2 mt-4 flex-wrap gap-2">
                                      {/* View Document Button */}
                                      <button 
                                        onClick={() => handleViewDocument(submission.research, submission)}
                                        disabled={loading}
                                        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
                                        title="View Document"
                                      >
                                        <FaEye className="mr-2 text-sm" />
                                        View Document
                                      </button>
                                      {submission.status === 'pending' && (
                                        <>
                                          <button 
                                            onClick={() => handleApproveClick(submission.research, submission)}
                                            disabled={loading}
                                            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50"
                                          >
                                            <FaCheckCircle className="mr-2 text-sm" />
                                            Approve
                                          </button>
                                          <button 
                                            onClick={() => handleRejectClick(submission.research, submission)}
                                            disabled={loading}
                                            className="flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
                                          >
                                            <FaTimesCircle className="mr-2 text-sm" />
                                            Reject
                                          </button>
                                        </>
                                      )}
                                      {/* Delete button - Faculty can delete any submission including approved ones */}
                                      <button 
                                        onClick={() => handleDeleteClick(submission.research, submission)}
                                        disabled={loading}
                                        className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-medium disabled:opacity-50"
                                        title="Delete this submission (including approved versions)"
                                      >
                                        <FaTrash className="mr-2 text-sm" />
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>

      {/* Approve Confirmation Modal */}
      {showApproveModal && selectedSubmission && (
        // Match Dean / Export PDF-Excel overlay
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
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
        // Match Dean / Export PDF-Excel overlay
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
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

            {/* Reason Type Selection */}
            <div className="mb-4">
              <div className="flex space-x-4 mb-3">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="predefined"
                    checked={rejectionReasonType === "predefined"}
                    onChange={(e) => {
                      setRejectionReasonType(e.target.value);
                      setRejectionReason("");
                    }}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Select a reason</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="custom"
                    checked={rejectionReasonType === "custom"}
                    onChange={(e) => {
                      setRejectionReasonType(e.target.value);
                      setRejectionReason("");
                    }}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Custom message</span>
                </label>
              </div>

              {/* Predefined Reasons */}
              {rejectionReasonType === "predefined" && (
                <select
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-transparent"
                >
                  <option value="">Select a reason...</option>
                  <option value="Incomplete content - Missing required sections or information">Incomplete content - Missing required sections or information</option>
                  <option value="Formatting issues - Document does not meet formatting requirements">Formatting issues - Document does not meet formatting requirements</option>
                  <option value="Quality concerns - Content needs significant improvement">Quality concerns - Content needs significant improvement</option>
                  <option value="Citation errors - Incorrect or missing citations">Citation errors - Incorrect or missing citations</option>
                  <option value="Grammar and language - Multiple grammatical errors or unclear writing">Grammar and language - Multiple grammatical errors or unclear writing</option>
                  <option value="Research methodology - Issues with research design or methodology">Research methodology - Issues with research design or methodology</option>
                  <option value="Data analysis - Problems with data presentation or analysis">Data analysis - Problems with data presentation or analysis</option>
                  <option value="Needs major revision - Significant changes required before approval">Needs major revision - Significant changes required before approval</option>
                </select>
              )}

              {/* Custom Message */}
              {rejectionReasonType === "custom" && (
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter your custom rejection reason (required)..."
                  rows="4"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-transparent resize-none"
                  required
                />
              )}
            </div>

            <div className="flex justify-end space-x-3 mt-4">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason("");
                  setRejectionReasonType("predefined");
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

      {/* Document Viewer Modal (Documents tab - view document) */}
      {(viewDocumentUrl || (viewDocumentFilename && (viewDocumentType === 'docx' || viewDocumentType === 'doc'))) && (
        // Match Dean / Export PDF-Excel overlay
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6" onClick={() => {
          // Clean up blob URL if it's a local file
          if (viewDocumentUrl && viewDocumentUrl.startsWith('blob:')) {
            window.URL.revokeObjectURL(viewDocumentUrl);
          }
          setViewDocumentUrl(null);
          setViewDocumentFilename(null);
          setViewDocumentType(null);
          setDocxBlob(null);
          if (docxContainerRef.current) {
            docxContainerRef.current.innerHTML = '';
          }
        }}>
          <div className="relative w-full h-full flex flex-col bg-white" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-[#7C1D23] text-white">
              <h3 className="text-lg font-semibold truncate flex-1 mr-4">
                {viewDocumentFilename || 'Document Viewer'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  // Clean up blob URL if it's a local file
                  if (viewDocumentUrl && viewDocumentUrl.startsWith('blob:')) {
                    window.URL.revokeObjectURL(viewDocumentUrl);
                  }
                  setViewDocumentUrl(null);
                  setViewDocumentFilename(null);
                  setViewDocumentType(null);
                  setDocxBlob(null);
                  if (docxContainerRef.current) {
                    docxContainerRef.current.innerHTML = '';
                  }
                }}
                className="p-2 hover:bg-[#5a1519] rounded-md transition-colors"
                aria-label="Close"
              >
                <FaClose className="text-xl" />
              </button>
            </div>

            {/* Document Viewer */}
            <div className="flex-1 overflow-hidden">
              {viewDocumentType === 'docx' || viewDocumentType === 'doc' ? (
                // For DOCX files, use docx-preview
                <div className="w-full h-full overflow-auto bg-white">
                  <div 
                    ref={docxContainerRef}
                    className="docx-wrapper p-4"
                    style={{ minHeight: '100%' }}
                  />
                  {docxBlob && (
                    <DocxViewer 
                      blob={docxBlob} 
                      containerRef={docxContainerRef}
                      onError={(error) => {
                        console.error('Error rendering DOCX:', error);
                        if (docxContainerRef.current) {
                          docxContainerRef.current.innerHTML = `
                            <div class="p-8 text-center">
                              <p class="text-red-600 mb-4">Error rendering document. Please try downloading it instead.</p>
                              <button 
                                onclick="window.location.reload()" 
                                class="px-6 py-3 bg-[#7C1D23] text-white rounded-md hover:bg-[#5a1519] transition-colors"
                              >
                                Download Document
                              </button>
                            </div>
                          `;
                        }
                      }}
                    />
                  )}
                </div>
              ) : viewDocumentUrl ? (
                // For PDF and other files, use iframe
                <iframe
                  src={viewDocumentUrl}
                  className="w-full h-full border-0"
                  title="Document Viewer"
                  style={{ minHeight: '100%' }}
                />
              ) : null}
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
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  // Document viewer state
  const [showDocumentViewer, setShowDocumentViewer] = useState(false);
  const [viewingFeedback, setViewingFeedback] = useState(null);
  const [documentBlobUrl, setDocumentBlobUrl] = useState(null);
  const [comments, setComments] = useState([]);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [selectedText, setSelectedText] = useState('');
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [commentPosition, setCommentPosition] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [scale, setScale] = useState(1.0);
  const [loadingComments, setLoadingComments] = useState(false);
  const commentTextareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const [isDriveConnected, setIsDriveConnected] = useState(false);

  useEffect(() => {
    fetchStudents();
    fetchAllFeedback();
    checkDriveStatus();
  }, []);

  const checkDriveStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/google-drive/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsDriveConnected(res.data.connected || false);
    } catch (error) {
      console.error('Error checking Drive status:', error);
      setIsDriveConnected(false);
    }
  };

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
      
      // Handle Drive files: download and convert to File object
      let fileToUpload = file;
      if (file && file.isDriveFile) {
        try {
          // Download file from Google Drive using the access token
          const driveResponse = await fetch(
            `https://www.googleapis.com/drive/v3/files/${file.driveFileId}?alt=media`,
            {
              headers: {
                Authorization: `Bearer ${file.accessToken}`,
              },
            }
          );

          if (!driveResponse.ok) {
            throw new Error('Failed to download file from Google Drive');
          }

          const blob = await driveResponse.blob();
          // Convert blob to File object
          fileToUpload = new File([blob], file.name, {
            type: file.mimeType || blob.type,
          });
        } catch (driveError) {
          console.error('Error downloading Drive file:', driveError);
          showError('Drive Download Error', 'Failed to download file from Google Drive. Please try again.');
          setLoading(false);
          return;
        }
      }
      
      if (fileToUpload) {
        formData.append('file', fileToUpload);
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

  // Handle view feedback
  const handleViewFeedback = async (feedback) => {
    try {
      const token = localStorage.getItem('token');
      const url = `/api/faculty/feedback/view/${feedback._id}`;
      console.log('[VIEW FEEDBACK] Requesting:', {
        url,
        feedbackId: feedback._id,
        hasFile: !!feedback.file,
        filename: feedback.file?.filename
      });
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      console.log('[VIEW FEEDBACK] Response received:', {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers['content-type'],
        size: response.data?.size
      });
      
      // Use mimetype from feedback.file or default to application/pdf
      const mimeType = feedback.file?.mimetype || 'application/pdf';
      const blob = new Blob([response.data], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);
      
      setDocumentBlobUrl(blobUrl);
      setViewingFeedback(feedback);
      setShowDocumentViewer(true);
      setPageNumber(1);
      setScale(1.0);
      
      // Fetch comments
      await fetchComments(feedback._id);
    } catch (error) {
      console.error('[VIEW FEEDBACK] Error:', error);
      
      // If error response is a Blob, convert it to text to read the error message
      let errorMessage = "Failed to view document";
      if (error.response?.data instanceof Blob) {
        try {
          const text = await error.response.data.text();
          const json = JSON.parse(text);
          errorMessage = json.message || errorMessage;
          console.error('[VIEW FEEDBACK] Server error message:', json);
        } catch (parseError) {
          console.error('[VIEW FEEDBACK] Could not parse error response:', parseError);
          errorMessage = `Server error (${error.response?.status}): ${error.response?.statusText}`;
        }
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      console.error('[VIEW FEEDBACK] Error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        errorMessage
      });
      
      setErrorMessage(errorMessage);
      setTimeout(() => setErrorMessage(""), 4000);
    }
  };

  // Fetch comments
  const fetchComments = async (feedbackId) => {
    try {
      setLoadingComments(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/faculty/feedback/${feedbackId}/comments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setComments(response.data);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  // Handle PDF load
  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  // Handle text selection for PDFs
  const handleTextSelection = () => {
    const selection = window.getSelection();
    const text = selection.toString().trim();
    
    if (text && viewingFeedback?.file?.mimetype === 'application/pdf') {
      // Limit selected text to reasonable length (500 characters max)
      const maxLength = 500;
      const truncatedText = text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
      
      setSelectedText(truncatedText);
      
      // Get selection position
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const viewerContainer = document.querySelector('.pdf-viewer-container');
      const containerRect = viewerContainer ? viewerContainer.getBoundingClientRect() : { left: 0, top: 0 };
      
      setCommentPosition({
        selectedText: truncatedText,
        pageNumber: pageNumber,
        position: {
          coordinates: {
            x: rect.x - containerRect.left,
            y: rect.y - containerRect.top,
            width: rect.width,
            height: rect.height
          }
        },
        isGeneral: false
      });
      setShowCommentBox(true);
      setTimeout(() => commentTextareaRef.current?.focus(), 0);
    } else if (!text && commentPosition?.isGeneral !== true) {
      // Clear selection if no text selected
      setShowCommentBox(false);
      setCommentPosition(null);
      setSelectedText('');
    }
  };

  // Add comment
  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      const token = localStorage.getItem('token');
      await axios.post(`/api/faculty/feedback/${viewingFeedback._id}/comments`, {
        comment: newComment,
        position: commentPosition?.position || null,
        pageNumber: commentPosition?.pageNumber || pageNumber || 1,
        selectedText: commentPosition?.selectedText || '',
        highlightColor: commentPosition?.selectedText ? "#ffeb3b" : undefined
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setNewComment('');
      setShowCommentBox(false);
      setCommentPosition(null);
      setSelectedText('');
      await fetchComments(viewingFeedback._id);
      setSuccessMessage("Comment added successfully");
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (error) {
      console.error('Error adding comment:', error);
      setErrorMessage("Failed to add comment");
      setTimeout(() => setErrorMessage(""), 4000);
    }
  };

  const handleOpenGeneralComment = () => {
    setCommentPosition({
      selectedText: '',
      pageNumber: pageNumber || 1,
      position: null,
      isGeneral: true
    });
    setShowCommentBox(true);
    setTimeout(() => commentTextareaRef.current?.focus(), 0);
  };

  // Delete comment
  const handleDeleteComment = async (commentId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/faculty/feedback/comments/${commentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchComments(viewingFeedback._id);
      setSuccessMessage("Comment deleted successfully");
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (error) {
      console.error('Error deleting comment:', error);
      setErrorMessage("Failed to delete comment");
      setTimeout(() => setErrorMessage(""), 4000);
    }
  };

  // Resolve comment
  const handleResolveComment = async (commentId, resolved) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`/api/faculty/feedback/comments/${commentId}`, {
        resolved: !resolved
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchComments(viewingFeedback._id);
    } catch (error) {
      console.error('Error resolving comment:', error);
      setErrorMessage("Failed to update comment");
      setTimeout(() => setErrorMessage(""), 4000);
    }
  };

  // Close viewer
  const handleCloseViewer = () => {
    if (documentBlobUrl) {
      URL.revokeObjectURL(documentBlobUrl);
    }
    setShowDocumentViewer(false);
    setViewingFeedback(null);
    setDocumentBlobUrl(null);
    setComments([]);
    setPageNumber(1);
    setNumPages(null);
    setShowCommentBox(false);
    setCommentPosition(null);
    setNewComment('');
    setSelectedText('');
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
              className={`border-2 border-dashed rounded-lg p-6 transition-colors ${
                dragActive ? 'border-[#7C1D23] bg-red-50' : 'border-gray-300 bg-gray-50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {file ? (
                <div className="space-y-2 text-center">
                  <FaFileAlt className="mx-auto h-12 w-12 text-[#7C1D23]" />
                  <p className="text-sm font-medium text-gray-800">{file.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                  {file.isDriveFile && (
                    <span className="text-xs text-blue-600">📁 From Google Drive</span>
                  )}
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Remove File
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center">
                  <FaUpload className="text-[#7C1D23] text-xl mb-2" />
                  <p className="text-sm text-gray-600 mb-2">
                    Drag and drop your file here, or select from your options below
                  </p>
                  <p className="text-xs text-gray-400 mb-4">
                    Supported: PDF, Word (.doc, .docx), Images (.jpg, .png) • Max 10MB
                  </p>
                  
                  <div className="flex gap-3 justify-center">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-[#7C1D23] text-white rounded-md hover:bg-[#5a1519] transition-colors text-sm font-medium"
                    >
                      Select File from Computer
                    </button>
                    <DriveUploader
                      defaultType="other"
                      driveButtonLabel="Upload from Google Drive"
                      buttonBg="#7C1D23"
                      buttonTextColor="#ffffff"
                      skipBackendSave={true}
                      onFilePicked={(fileInfo) => {
                        if (!fileInfo || !fileInfo.id || !fileInfo.accessToken) {
                          showError('Error', 'Failed to get Google Drive file information. Please try again.');
                          return;
                        }
                        const MAX_SIZE = 10 * 1024 * 1024; // 10MB
                        const ALLOWED_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/jpg', 'image/png'];
                        
                        if (fileInfo.size && fileInfo.size > MAX_SIZE) {
                          showError('File Too Large', 'File size exceeds 10MB limit');
                          return;
                        }
                        
                        if (fileInfo.mimeType && !ALLOWED_TYPES.includes(fileInfo.mimeType)) {
                          showError('Invalid File Type', 'Unsupported file format. Allowed: PDF, Word documents, Images (JPG, PNG)');
                          return;
                        }
                        
                        setFile({
                          name: fileInfo.name,
                          driveFileId: fileInfo.id,
                          accessToken: fileInfo.accessToken,
                          mimeType: fileInfo.mimeType,
                          size: fileInfo.size,
                          isDriveFile: true,
                        });
                        setErrorMessage("");
                      }}
                    />
                  </div>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileChange}
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  />
                </div>
              )}
            </div>
            {!isDriveConnected && (
              <div className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
                <span>
                  Google Drive is not connected. Please connect your Drive account in Settings before uploading files.
                </span>
              </div>
            )}
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
          <>
            <div className="space-y-3">
              {(() => {
                const startIndex = (currentPage - 1) * itemsPerPage;
                const endIndex = startIndex + itemsPerPage;
                const paginatedFeedback = feedbackList.slice(startIndex, endIndex);
                const totalPages = Math.ceil(feedbackList.length / itemsPerPage);
                
                return paginatedFeedback.map((feedback) => (
              <div key={feedback._id} className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${
                feedback.createdBy && feedback.createdBy.role === 'dean' 
                  ? 'border-purple-300 bg-purple-50' 
                  : 'border-gray-200'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2 flex-wrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        feedback.category === 'approval' ? 'bg-green-100 text-green-700' :
                        feedback.category === 'revision_request' ? 'bg-orange-100 text-orange-700' :
                        feedback.category === 'chapter_review' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {feedback.category.replace('_', ' ').toUpperCase()}
                      </span>
                      {feedback.createdBy && feedback.createdBy.role === 'dean' && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 border border-purple-300">
                          From Dean
                        </span>
                      )}
                      <span className="text-xs text-gray-500">Version {feedback.version}</span>
                    </div>
                    <h4 className="font-semibold text-gray-800">
                      To: {feedback.student?.name}
                    </h4>
                    {feedback.createdBy && feedback.createdBy.role === 'dean' && (
                      <p className="text-sm text-purple-700 font-medium mt-1">
                        From: {feedback.createdBy.name || 'Dean'}
                      </p>
                    )}
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
                      <>
                        <button
                          onClick={() => handleViewFeedback(feedback)}
                          className="px-3 py-1 bg-green-100 text-green-700 rounded-md hover:bg-green-200 text-xs font-medium"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleDownload(feedback._id, feedback.file.filename)}
                          className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 text-xs font-medium"
                        >
                          Download
                        </button>
                      </>
                    )}
                    {!(feedback.createdBy && feedback.createdBy.role === 'dean') && (
                      <button
                        onClick={() => handleDeleteClick(feedback)}
                        className="px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200 text-xs font-medium"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
                ));
              })()}
            </div>
            {feedbackList.length > 0 && (() => {
              const startIndex = (currentPage - 1) * itemsPerPage;
              const endIndex = Math.min(startIndex + itemsPerPage, feedbackList.length);
              const totalPages = Math.ceil(feedbackList.length / itemsPerPage);
              
              return (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={feedbackList.length}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={(newItemsPerPage) => {
                    setItemsPerPage(newItemsPerPage);
                    setCurrentPage(1);
                  }}
                  startIndex={startIndex + 1}
                  endIndex={endIndex}
                />
              );
            })()}
          </>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && selectedFeedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
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

            {selectedFeedback.createdBy && selectedFeedback.createdBy.role === 'dean' && (
              <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-400 rounded">
                <p className="text-sm text-red-800">
                  <strong>Warning:</strong> This feedback was created by the Dean and cannot be deleted.
                </p>
              </div>
            )}

            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-sm text-gray-700">
                <span className="font-medium">Student:</span> {selectedFeedback.student?.name}
              </p>
              <p className="text-sm text-gray-700">
                <span className="font-medium">Category:</span> {selectedFeedback.category}
              </p>
              {selectedFeedback.createdBy && selectedFeedback.createdBy.role === 'dean' && (
                <p className="text-sm text-purple-700 mt-1">
                  <span className="font-medium">From:</span> {selectedFeedback.createdBy.name || 'Dean'}
                </p>
              )}
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
                disabled={loading || (selectedFeedback.createdBy && selectedFeedback.createdBy.role === 'dean')}
                className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Viewer Modal (Feedback view) */}
      {showDocumentViewer && viewingFeedback && documentBlobUrl && (
        // Match Dean / Export PDF-Excel overlay
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
          <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full h-full flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#7C1D23] to-[#5a1519] text-white p-4 rounded-t-lg flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <h3 className="text-lg font-bold">
                  {viewingFeedback.file.filename}
                </h3>
                <span className="text-sm opacity-90">
                  {viewingFeedback.student?.name}
                </span>
              </div>
              <button 
                onClick={handleCloseViewer}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <FaClose className="h-6 w-6" />
              </button>
            </div>
            
            {/* Content Area - Split View */}
            <div className="flex-1 flex overflow-hidden">
              {/* Document Viewer (Left) */}
              <div className="flex-1 p-4 overflow-auto relative bg-gray-100 pdf-viewer-container">
                {viewingFeedback.file.mimetype === 'application/pdf' ? (
                  <div className="flex flex-col items-center">
                    {/* PDF Controls */}
                    <div className="mb-4 flex items-center space-x-4 bg-white p-2 rounded-lg shadow sticky top-0 z-20">
                      <button
                        onClick={() => setPageNumber(prev => Math.max(1, prev - 1))}
                        disabled={pageNumber <= 1}
                        className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-gray-700">
                        Page {pageNumber} of {numPages || '--'}
                      </span>
                      <button
                        onClick={() => setPageNumber(prev => Math.min(numPages || 1, prev + 1))}
                        disabled={pageNumber >= (numPages || 1)}
                        className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        Next
                      </button>
                      <div className="border-l border-gray-300 h-6 mx-2"></div>
                      <button
                        onClick={() => setScale(prev => Math.max(0.5, prev - 0.25))}
                        className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
                      >
                        -
                      </button>
                      <span className="text-sm text-gray-700 min-w-[60px] text-center">{Math.round(scale * 100)}%</span>
                      <button
                        onClick={() => setScale(prev => Math.min(2, prev + 0.25))}
                        className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
                      >
                        +
                      </button>
                    </div>

                    {/* PDF Document */}
                    <div onMouseUp={handleTextSelection} className="shadow-lg bg-white">
                      <Document
                        file={documentBlobUrl}
                        onLoadSuccess={onDocumentLoadSuccess}
                        loading={<div className="text-center py-8">Loading PDF...</div>}
                        error={<div className="text-center py-8 text-red-600">Failed to load PDF</div>}
                      >
                        <Page
                          pageNumber={pageNumber}
                          scale={scale}
                          renderTextLayer={true}
                          renderAnnotationLayer={true}
                        />
                      </Document>
                    </div>
                  </div>
                ) : viewingFeedback.file.mimetype?.startsWith('image/') ? (
                  <div className="flex items-center justify-center h-full">
                    <img 
                      src={documentBlobUrl} 
                      alt={viewingFeedback.file.filename}
                      className="max-w-full max-h-full object-contain shadow-lg"
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-500">
                      Document preview not available for this file type.
                      <button 
                        onClick={() => handleDownload(viewingFeedback._id, viewingFeedback.file.filename)}
                        className="ml-2 text-[#7C1D23] hover:underline"
                      >
                        Download to view
                      </button>
                    </p>
                  </div>
                )}

                {/* Comment Box */}
                {showCommentBox && (
                  <div className="absolute top-20 right-4 bg-white border-2 border-[#7C1D23] rounded-lg shadow-xl p-4 z-50 w-80">
                    <h4 className="font-semibold text-gray-800 mb-2">Add Comment</h4>
                    {commentPosition?.selectedText ? (
                      <p className="text-sm text-gray-600 italic mb-2 p-2 bg-gray-50 rounded">
                        "{commentPosition.selectedText}"
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500 mb-2 p-2 bg-gray-50 rounded">
                        This comment will apply to the current page/document.
                      </p>
                    )}
                    <textarea
                      ref={commentTextareaRef}
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Enter your comment..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-transparent resize-none"
                      rows="4"
                    />
                    <div className="flex space-x-2 mt-3">
                      <button
                        onClick={handleAddComment}
                        className="flex-1 px-4 py-2 bg-[#7C1D23] text-white rounded-md hover:bg-[#5a1519] text-sm font-medium"
                      >
                        Add Comment
                      </button>
                      <button
                        onClick={() => {
                          setShowCommentBox(false);
                          setCommentPosition(null);
                          setNewComment('');
                          setSelectedText('');
                        }}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Comments Panel (Right) */}
              <div className="w-96 border-l border-gray-200 flex flex-col bg-white">
                <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-3">
                  <h4 className="font-semibold text-gray-800">Comments ({comments.length})</h4>
                  <button
                    onClick={handleOpenGeneralComment}
                    className="text-xs px-3 py-1 bg-[#7C1D23] text-white rounded hover:bg-[#5a1519] transition-colors"
                  >
                    + Comment
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {loadingComments ? (
                    <div className="text-center py-8">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#7C1D23]"></div>
                      <p className="mt-2 text-gray-500 text-sm">Loading comments...</p>
                    </div>
                  ) : comments.length === 0 ? (
                    <div className="text-center py-8">
                      <FaFileAlt className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                      <p className="text-gray-500 text-sm">
                        No comments yet. Select text or use the button above to add one.
                      </p>
                    </div>
                  ) : (
                    comments.map((comment) => (
                      <div
                        key={comment._id}
                        className={`p-3 rounded-lg border ${
                          comment.resolved
                            ? 'bg-gray-50 border-gray-200'
                            : 'bg-yellow-50 border-yellow-200'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <span className="font-medium text-sm text-gray-800">
                              {comment.createdBy.name}
                            </span>
                            {comment.position?.pageNumber && (
                              <span className="text-xs text-gray-500 ml-2">
                                (Page {comment.position.pageNumber})
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-500">
                            {new Date(comment.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {comment.position?.selectedText && (
                          <p className="text-xs text-gray-600 italic mb-2 p-2 bg-white rounded border-l-2 border-yellow-400">
                            "{comment.position.selectedText}"
                          </p>
                        )}
                        <p className="text-sm text-gray-700 mb-2">{comment.comment}</p>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleResolveComment(comment._id, comment.resolved)}
                            className={`text-xs px-2 py-1 rounded ${
                              comment.resolved
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {comment.resolved ? '✓ Resolved' : 'Mark Resolved'}
                          </button>
                          <button
                            onClick={() => handleDeleteComment(comment._id)}
                            className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200"
                          >
                            Delete
                          </button>
                        </div>
                        {comment.resolved && comment.resolvedBy && (
                          <p className="text-xs text-green-600 mt-2">
                            Resolved by {comment.resolvedBy.name}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
  </div>
);
};

// Consultation Schedule Component
const ConsultationSchedule = ({ schedules, onRefresh }) => {
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
    consultationType: "face-to-face",
    syncToCalendar: true
  });
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [selectedScheduleToDecline, setSelectedScheduleToDecline] = useState(null);
  const [selectedParticipantToDecline, setSelectedParticipantToDecline] = useState(null);
  const [declineReason, setDeclineReason] = useState("");
  const [declineReasonType, setDeclineReasonType] = useState("predefined"); // "predefined" or "custom"
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

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
      // Send datetime in datetime-local format (YYYY-MM-DDTHH:mm)
      // The backend will treat this as Manila time (UTC+8) and convert to UTC for storage
      // Do NOT convert to ISO here to avoid browser timezone issues
      
      const response = await axios.post('/api/faculty/schedules', {
        ...formData,
        datetime: formData.datetime // Send as-is in datetime-local format
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Show appropriate message based on calendar sync status
      if (response.data.calendarSynced) {
        setSuccessMessage(response.data.message || "Consultation slot created and synced to Google Calendar!");
      } else if (response.data.calendarError) {
        setErrorMessage(response.data.message || `Calendar sync failed: ${response.data.calendarError.message}. Please check your calendar connection.`);
        setSuccessMessage("Consultation slot created, but Google Calendar sync failed.");
      } else {
        setSuccessMessage(response.data.message || "Consultation slot created successfully.");
      }
      
      setShowCreateModal(false);
      setFormData({
        title: "",
        description: "",
        datetime: "",
        duration: 60,
        location: "",
        consultationType: "face-to-face",
        syncToCalendar: true
      });
      
      // Refresh schedules
      if (onRefresh) onRefresh();
      
      setTimeout(() => {
        setSuccessMessage("");
        setErrorMessage("");
      }, 6000);
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

  const handleDeclineRequest = (scheduleId, participantId) => {
    setSelectedScheduleToDecline(scheduleId);
    setSelectedParticipantToDecline(participantId);
    setShowDeclineModal(true);
    setDeclineReason("");
    setDeclineReasonType("predefined");
  };

  const confirmDeclineRequest = async () => {
    if (!declineReason.trim()) {
      setErrorMessage("Please select a reason or provide a custom message.");
      setTimeout(() => setErrorMessage(""), 4000);
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put('/api/faculty/schedules/status', {
        scheduleId: selectedScheduleToDecline,
        participantId: selectedParticipantToDecline,
        action: "decline",
        rejectionReason: declineReason
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccessMessage("Consultation request declined.");
      setShowDeclineModal(false);
      setSelectedScheduleToDecline(null);
      setSelectedParticipantToDecline(null);
      setDeclineReason("");
      setDeclineReasonType("predefined");
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
    // Convert UTC datetime to local time for datetime-local input
    const date = new Date(schedule.datetime);
    // Get local time components
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    // Format as YYYY-MM-DDTHH:mm (local time, not UTC)
    const datetimeLocal = `${year}-${month}-${day}T${hours}:${minutes}`;
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
      // Send datetime in datetime-local format (YYYY-MM-DDTHH:mm)
      // The backend will treat this as Manila time (UTC+8) and convert to UTC for storage
      // Do NOT convert to ISO here to avoid browser timezone issues
      
      const response = await axios.put('/api/faculty/schedules/update', {
        scheduleId: selectedSchedule._id,
        ...formData,
        datetime: formData.datetime // Send as-is in datetime-local format
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
              
              // Parse description to extract student message if present
              // Format: "Student message: {message}" or just description
              let description = schedule.description || '';
              let studentMessage = null;
              
              if (description.includes('Student message: ')) {
                const parts = description.split('Student message: ');
                description = parts[0].trim() || null;
                studentMessage = parts[1]?.trim() || null;
              }
              
              // Get consultation type with proper formatting
              const consultationType = schedule.consultationType || 'face-to-face';
              const consultationTypeDisplay = consultationType === 'online' ? 'Online' : 'Face-to-Face';
              
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
                      <p className="text-sm text-gray-500 mt-1">
                        <strong>Consultation Type:</strong> {consultationTypeDisplay}
                      </p>
                      {description && (
                        <p className="text-sm text-gray-600 mt-2">
                          <strong>Description:</strong> {description}
                        </p>
                      )}
                      {studentMessage && (
                        <p className="text-sm text-gray-700 mt-2 bg-blue-50 p-2 rounded border-l-2 border-blue-300">
                          <strong>Student Message:</strong> {studentMessage}
                        </p>
                      )}
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

      {/* Decline Consultation Request Modal */}
      {showDeclineModal && (
        // Match Dean / Export PDF-Excel overlay
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mr-4">
                <FaTimesCircle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800">Decline Consultation Request</h3>
            </div>
            <p className="text-gray-600 mb-4">
              Please provide a reason for declining this consultation request:
            </p>

            {/* Reason Type Selection */}
            <div className="mb-4">
              <div className="flex space-x-4 mb-3">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="predefined"
                    checked={declineReasonType === "predefined"}
                    onChange={(e) => {
                      setDeclineReasonType(e.target.value);
                      setDeclineReason("");
                    }}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Select a reason</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="custom"
                    checked={declineReasonType === "custom"}
                    onChange={(e) => {
                      setDeclineReasonType(e.target.value);
                      setDeclineReason("");
                    }}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Custom message</span>
                </label>
              </div>

              {/* Predefined Reasons */}
              {declineReasonType === "predefined" && (
                <select
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-transparent"
                >
                  <option value="">Select a reason...</option>
                  <option value="Schedule conflict - I have another commitment at this time">Schedule conflict - I have another commitment at this time</option>
                  <option value="Requested time is not available - Please select a different time slot">Requested time is not available - Please select a different time slot</option>
                  <option value="Insufficient notice - Please request consultations at least 24 hours in advance">Insufficient notice - Please request consultations at least 24 hours in advance</option>
                  <option value="The requested date/time has already passed">The requested date/time has already passed</option>
                  <option value="Please use a different consultation slot that better fits both our schedules">Please use a different consultation slot that better fits both our schedules</option>
                  <option value="The consultation topic requires more preparation time">The consultation topic requires more preparation time</option>
                </select>
              )}

              {/* Custom Message */}
              {declineReasonType === "custom" && (
                <textarea
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  placeholder="Enter your custom message (required)..."
                  rows="4"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-transparent resize-none"
                  required
                />
              )}
            </div>

            <div className="flex justify-end space-x-3 mt-4">
              <button
                onClick={() => {
                  setShowDeclineModal(false);
                  setSelectedScheduleToDecline(null);
                  setSelectedParticipantToDecline(null);
                  setDeclineReason("");
                  setDeclineReasonType("predefined");
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeclineRequest}
                disabled={loading || !declineReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {loading ? "Declining..." : "Confirm Decline"}
              </button>
            </div>
          </div>
        </div>
      )}

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
            <>
              <div className="space-y-4">
                {(() => {
                  const startIndex = (currentPage - 1) * itemsPerPage;
                  const endIndex = startIndex + itemsPerPage;
                  const paginatedSchedules = upcomingSchedules.slice(startIndex, endIndex);
                  
                  return paginatedSchedules.map((schedule) => {
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
                  });
                })()}
              </div>
              {upcomingSchedules.length > 0 && (() => {
                const startIndex = (currentPage - 1) * itemsPerPage;
                const endIndex = Math.min(startIndex + itemsPerPage, upcomingSchedules.length);
                const totalPages = Math.ceil(upcomingSchedules.length / itemsPerPage);
                
                return (
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={upcomingSchedules.length}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={(newItemsPerPage) => {
                      setItemsPerPage(newItemsPerPage);
                      setCurrentPage(1);
                    }}
                    startIndex={startIndex + 1}
                    endIndex={endIndex}
                  />
                );
              })()}
            </>
          )}
      </div>
      )}

      {/* Create Consultation Slot Modal */}
      {showCreateModal && (
        // Match Dean / Export PDF-Excel overlay
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
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
                  Consultation Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.consultationType}
                  onChange={(e) => setFormData({...formData, consultationType: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-transparent"
                  required
                >
                  <option value="face-to-face">Face-to-Face</option>
                  <option value="online">Online</option>
                </select>
                {formData.consultationType === "online" && (
                  <p className="text-xs text-blue-600 mt-1">
                    A Google Meet link will be automatically generated if Google Calendar is connected.
                  </p>
                )}
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
                  placeholder={formData.consultationType === "online" ? "Will be set to 'Online'" : "e.g., Faculty Office, Room 301"}
                  disabled={formData.consultationType === "online"}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                  required
                />
              </div>

              {/* Google Calendar Sync Toggle */}
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
                      Automatically add to Google Calendar and generate a Meet link (requires connection in Settings)
                    </p>
                  </label>
                </div>
              </div>

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
        // Match Dean / Export PDF-Excel overlay
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
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
        // Match Dean / Export PDF-Excel overlay
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
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
  const [deanRemarks, setDeanRemarks] = useState([]);
  const [loadingDeanRemarks, setLoadingDeanRemarks] = useState(false);

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
    fetchDeanRemarks(research._id);
  };

  const fetchDeanRemarks = async (researchId) => {
    try {
      setLoadingDeanRemarks(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/faculty/feedback/research/${researchId}/dean-remarks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDeanRemarks(res.data);
    } catch (error) {
      console.error('Error fetching Dean remarks:', error);
      setDeanRemarks([]);
    } finally {
      setLoadingDeanRemarks(false);
    }
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
      // Match Dean / Export PDF-Excel overlay for View & Update Status modal
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
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

            {/* Dean Remarks Section */}
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <h4 className="text-md font-semibold text-gray-800 mb-3">Comments from Dean</h4>
              {loadingDeanRemarks ? (
                <div className="text-center py-4">
                  <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-[#7C1D23]"></div>
                  <p className="mt-2 text-sm text-gray-500">Loading Dean remarks...</p>
                </div>
              ) : deanRemarks && deanRemarks.length > 0 ? (
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {deanRemarks.map((remark, index) => (
                    <div key={index} className="p-3 bg-white rounded-md border border-purple-100">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-purple-800">
                            {remark.createdBy?.name || 'Dean'}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                            {remark.type || 'feedback'}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(remark.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{remark.message}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500 text-sm">
                  No remarks from Dean yet.
                </div>
              )}
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
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

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
      showError('Error', 'Error loading panel assignments');
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
      showWarning('Validation Error', 'Please provide review comments');
      return;
    }
    if (reviewForm.recommendation === 'pending') {
      showWarning('Validation Error', 'Please select a recommendation');
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

      await showSuccess('Success', 'Review submitted successfully!');
      handleCloseReviewModal();
      fetchPanels();
    } catch (error) {
      console.error('Error submitting review:', error);
      showError('Error', error?.response?.data?.message || 'Error submitting review');
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
        <>
          <div className="space-y-4">
            {(() => {
              const startIndex = (currentPage - 1) * itemsPerPage;
              const endIndex = startIndex + itemsPerPage;
              const paginatedPanels = panels.slice(startIndex, endIndex);
              
              return paginatedPanels.map(panel => (
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
                    <span className="font-medium">Research:</span> {panel.research?.title || (
                      <span className="text-red-600 italic">Research has been deleted</span>
                    )}
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

              {/* All Panelists' Reviews for this Research (including external) */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Panelists' Reviews for this Research
                </p>
                <div className="space-y-2">
                  {panel.reviews && panel.reviews.length > 0 ? (
                      panel.reviews.map((review, idx) => {
                        const isCurrentUserReview = panel.myReview && review._id === panel.myReview._id;
                        const displayName =
                          review.isExternal
                            ? (review.panelistName || review.panelistEmail || 'External Panelist')
                            : (review.panelist?.name || 'Panelist');
                        const displayEmail = review.isExternal && review.panelistEmail 
                          ? review.panelistEmail 
                          : (review.panelist?.email || '');

                        return (
                          <div
                            key={review._id || idx}
                            className={`border rounded-lg p-3 ${
                              review.isExternal 
                                ? 'border-purple-300 bg-purple-50' 
                                : 'border-gray-200 bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-gray-800">
                                  {displayName}
                                </span>
                                {review.isExternal && (
                                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-purple-100 text-purple-700 border border-purple-300">
                                    External Panelist
                                  </span>
                                )}
                                {isCurrentUserReview && (
                                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-700">
                                    You
                                  </span>
                                )}
                                {review.recommendation && review.recommendation !== 'pending' && (
                                  <span
                                    className={`px-2 py-0.5 text-xs font-medium rounded ${getRecommendationColor(
                                      review.recommendation
                                    )}`}
                                  >
                                    {review.recommendation.replace(/_/g, ' ')}
                                  </span>
                                )}
                                {review.status && (
                                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                                    review.status === 'submitted' 
                                      ? 'bg-green-100 text-green-700' 
                                      : review.status === 'pending'
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : 'bg-gray-100 text-gray-700'
                                  }`}>
                                    {review.status.replace(/_/g, ' ')}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                {review.submittedAt && (
                                  <span className="text-xs text-gray-500">
                                    Submitted: {new Date(review.submittedAt).toLocaleDateString()}
                                  </span>
                                )}
                                {!review.submittedAt && review.dueDate && (
                                  <span className="text-xs text-gray-500">
                                    Due: {new Date(review.dueDate).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                            {displayEmail && (
                              <p className="text-xs text-gray-500 mb-1">
                                {displayEmail}
                              </p>
                            )}
                            {review.comments && (
                              <div className="mt-2 pt-2 border-t border-gray-200">
                                <p className="text-xs font-medium text-gray-600 mb-1">Comments:</p>
                                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                  {review.comments}
                                </p>
                              </div>
                            )}
                            {!review.comments && review.status === 'submitted' && (
                              <p className="text-xs text-gray-500 italic mt-1">
                                No comments provided
                              </p>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-gray-500 italic">No reviews submitted yet.</p>
                    )}
                </div>
              </div>
            </div>
              ));
            })()}
          </div>
          {panels.length > 0 && (() => {
            const startIndex = (currentPage - 1) * itemsPerPage;
            const endIndex = Math.min(startIndex + itemsPerPage, panels.length);
            const totalPages = Math.ceil(panels.length / itemsPerPage);
            
            return (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={panels.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={(newItemsPerPage) => {
                  setItemsPerPage(newItemsPerPage);
                  setCurrentPage(1);
                }}
                startIndex={startIndex + 1}
                endIndex={endIndex}
              />
            );
          })()}
        </>
      )}

      {/* Review Submission Modal (Submit Review) */}
      {showReviewModal && selectedPanel && (
        // Match Dean / Export PDF-Excel overlay
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Submit Panel Review</h3>
                  <p className="text-sm text-gray-600 mt-1">{selectedPanel.name}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Research: {selectedPanel.research?.title || (
                      <span className="text-red-600 italic">Research has been deleted</span>
                    )}
                  </p>
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
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  // Document viewer state (for inline preview)
  const [viewUrl, setViewUrl] = useState(null);
  const [viewFilename, setViewFilename] = useState("");
  const [viewType, setViewType] = useState(""); // 'docx' or 'other'
  const [docxBlob, setDocxBlob] = useState(null);
  const docxContainerRef = useRef(null);

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
      showError('Error', 'Error downloading document: ' + (error.response?.data?.message || error.message));
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
      const filename = doc.filename || 'document';
      const lowerName = filename.toLowerCase();
      const isDocx = doc.mimeType?.includes('word') ||
        lowerName.endsWith('.docx') ||
        lowerName.endsWith('.doc');

      // Reset any previous viewer state
      if (viewUrl && viewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(viewUrl);
      }
      if (docxContainerRef.current) {
        docxContainerRef.current.innerHTML = '';
      }

      if (isDocx) {
        // Use docx-preview for DOC/DOCX files
        setDocxBlob(blob);
        setViewType('docx');
        setViewFilename(filename);
        setViewUrl(null);
      } else {
        // For PDFs and other types, preview via iframe
        const url = URL.createObjectURL(blob);
        setViewUrl(url);
        setViewType('other');
        setViewFilename(filename);
        setDocxBlob(null);
      }
    } catch (error) {
      console.error('Error viewing document:', error);
      showError('Error', 'Error viewing document');
    }
  };

  const handleCloseViewer = () => {
    if (viewUrl && viewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(viewUrl);
    }
    setViewUrl(null);
    setViewFilename("");
    setViewType("");
    setDocxBlob(null);
    if (docxContainerRef.current) {
      docxContainerRef.current.innerHTML = '';
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
          <>
            <div className="divide-y divide-gray-200">
              {(() => {
                const startIndex = (currentPage - 1) * itemsPerPage;
                const endIndex = startIndex + itemsPerPage;
                const paginatedDocuments = filteredDocuments.slice(startIndex, endIndex);
                
                return paginatedDocuments.map((doc) => (
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
                ));
              })()}
            </div>
            {filteredDocuments.length > 0 && (() => {
              const startIndex = (currentPage - 1) * itemsPerPage;
              const endIndex = Math.min(startIndex + itemsPerPage, filteredDocuments.length);
              const totalPages = Math.ceil(filteredDocuments.length / itemsPerPage);
              
              return (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={filteredDocuments.length}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={(newItemsPerPage) => {
                    setItemsPerPage(newItemsPerPage);
                    setCurrentPage(1);
                  }}
                  startIndex={startIndex + 1}
                  endIndex={endIndex}
                />
              );
            })()}
          </>
        )}
      </div>

      {/* Document Viewer Modal (Documents tab) */}
      {(viewUrl || docxBlob) && (
        // Match Dean / Export PDF-Excel overlay
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6"
          onClick={handleCloseViewer}
        >
          <div
            className="relative w-full h-full flex flex-col bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-[#7C1D23] text-white">
              <h3 className="text-lg font-semibold truncate flex-1 mr-4">
                {viewFilename || 'Document Viewer'}
              </h3>
              <button
                type="button"
                onClick={handleCloseViewer}
                className="p-2 hover:bg-[#5a1519] rounded-md transition-colors"
                aria-label="Close"
              >
                <FaClose className="text-xl" />
              </button>
            </div>

            {/* Document Viewer */}
            <div className="flex-1 overflow-hidden">
              {viewType === 'docx' && docxBlob ? (
                // For DOCX files, use docx-preview
                <div className="w-full h-full overflow-auto bg-white">
                  <div
                    ref={docxContainerRef}
                    className="docx-wrapper p-4"
                    style={{ minHeight: '100%' }}
                  />
                  {docxBlob && (
                    <DocxViewer
                      blob={docxBlob}
                      containerRef={docxContainerRef}
                      onError={(error) => {
                        console.error('Error rendering DOCX:', error);
                        if (docxContainerRef.current) {
                          docxContainerRef.current.innerHTML = `
                            <div class="p-8 text-center">
                              <p class="text-red-600 mb-4">Error rendering document. Please try downloading it instead.</p>
                            </div>
                          `;
                        }
                      }}
                    />
                  )}
                </div>
              ) : viewUrl ? (
                // For PDF and other files, use iframe
                <iframe
                  src={viewUrl}
                  className="w-full h-full border-0"
                  title="Document Viewer"
                  style={{ minHeight: '100%' }}
                />
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacultyAdviserDashboard;
