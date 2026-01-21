import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { FaUpload, FaCalendar, FaBook, FaCheckCircle, FaClock, FaFileAlt, FaChartLine, FaSignOutAlt, FaBars, FaTimes as FaClose, FaTimesCircle, FaDownload, FaSearch, FaFilter, FaExclamationTriangle, FaChevronRight, FaInfoCircle, FaChevronDown, FaChevronUp, FaPaperclip, FaHistory, FaComments, FaEye, FaCog } from "react-icons/fa";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { renderAsync } from 'docx-preview';
import MySchedule from "../../components/MyScheduleComponent";
import DriveUploader from "../../components/DriveUploader";
import { showSuccess, showError, showWarning, showDangerConfirm, showConfirm } from "../../utils/sweetAlert";
import { checkPermission } from "../../utils/permissionChecker";
import Settings from "../Settings";

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

const GraduateDashboard = ({ setUser, user }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Initialize selectedTab from URL params, default to "chapters"
  const tabFromUrl = searchParams.get('tab');
  const [selectedTab, setSelectedTab] = useState(tabFromUrl || "chapters");
  const [uploadProgress, setUploadProgress] = useState({
    chapter1: false,
    chapter2: false,
    chapter3: false
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [myResearch, setMyResearch] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadingChapter, setUploadingChapter] = useState(null);
  const [mySchedules, setMySchedules] = useState([]);
  const [adviserFeedback, setAdviserFeedback] = useState([]);
  const [progressOverview, setProgressOverview] = useState(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressError, setProgressError] = useState(null);
  const [chapterData, setChapterData] = useState([]);
  const [chapterLoading, setChapterLoading] = useState(false);
  const [chapterError, setChapterError] = useState(null);
  const [filters, setFilters] = useState({
    chapter: '',
    partName: '',
    status: '',
    startDate: '',
    endDate: '',
    search: ''
  });
  const [showSettings, setShowSettings] = useState(false);


  const completedChapters = Object.values(uploadProgress).filter(Boolean).length;
  const totalChapters = Object.keys(uploadProgress).length;
  const progressPercentage = (completedChapters / totalChapters) * 100;

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
  }, [selectedTab]); // setSearchParams is stable, doesn't need to be in deps

  // Check permissions when tab changes and redirect if disabled
  useEffect(() => {
    const checkTabPermissions = async () => {
      if (!selectedTab) return;

      const permissionMap = {
        'chapters': { 
          permissions: ['upload_documents'], 
          feature: 'Research Chapters', 
          context: 'You will not be able to upload research chapters.',
          redirectTo: 'schedule'
        },
        'compliance': { 
          permissions: ['upload_documents'], 
          feature: 'Compliance Forms', 
          context: 'You will not be able to upload compliance forms.',
          redirectTo: 'chapters'
        },
        'schedule': { 
          permissions: ['view_schedules', 'manage_schedules'], 
          feature: 'My Schedule', 
          context: 'You will not be able to view or manage your schedule.',
          redirectTo: 'chapters'
        },
        'progress': { 
          permissions: ['view_research'], 
          feature: 'Progress Tracking', 
          context: 'You will not be able to view your progress.',
          redirectTo: 'chapters'
        },
        'completed': { 
          permissions: ['view_research'], 
          feature: 'Completed Thesis', 
          context: 'You will not be able to view completed thesis.',
          redirectTo: 'chapters'
        },
        'documents': { 
          permissions: ['view_documents'], 
          feature: 'Documents', 
          context: 'You will not be able to view documents.',
          redirectTo: 'chapters'
        },
      };

      const tabConfig = permissionMap[selectedTab];
      if (tabConfig) {
        // Define redirect callback that will be called after user clicks OK
        const handleRedirect = () => {
          const redirectTab = tabConfig.redirectTo || 'chapters';
          setSelectedTab(redirectTab);
          setSearchParams({ tab: redirectTab }, { replace: true });
        };

        const hasPermission = await checkPermission(
          tabConfig.permissions,
          tabConfig.feature,
          tabConfig.context,
          handleRedirect // Pass callback to be called after OK button is clicked
        );
        // Note: If permission check fails, the redirect callback is called automatically
        // after the user clicks OK on the warning dialog
      }
    };

    checkTabPermissions();
  }, [selectedTab, setSearchParams]);

  // Track if component has mounted to avoid double fetch
  const filtersInitialized = useRef(false);

  // Fetch my research data
  useEffect(() => {
    fetchMyResearch();
    fetchMySchedules();
    fetchAdviserFeedback();
    fetchProgressOverview();
    fetchChapterSubmissions();
    filtersInitialized.current = true;
  }, []);

  // Refetch submissions when filters change (with debounce for search)
  useEffect(() => {
    if (!filtersInitialized.current) return; // Skip on initial mount
    
    const timeoutId = setTimeout(() => {
      fetchChapterSubmissions(filters);
    }, filters.search ? 500 : 0); // Debounce search by 500ms
    
    return () => clearTimeout(timeoutId);
  }, [filters]);

  const fetchMyResearch = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/student/research', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMyResearch(res.data);
      
      // Update upload progress based on research files
      if (res.data.length > 0) {
        const research = res.data[0]; // Assuming student has one main research
        const progress = {
          chapter1: research.forms?.some(f => f.type === 'chapter1' && f.status === 'approved') || false,
          chapter2: research.forms?.some(f => f.type === 'chapter2' && f.status === 'approved') || false,
          chapter3: research.forms?.some(f => f.type === 'chapter3' && f.status === 'approved') || false,
        };
        setUploadProgress(progress);
      }
    } catch (error) {
      console.error('Error fetching research:', error);
    }
  };

  const fetchChapterSubmissions = async (filterParams = {}) => {
    setChapterLoading(true);
    setChapterError(null);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      
      // Add filter parameters
      if (filterParams.chapter) params.append('chapter', filterParams.chapter);
      if (filterParams.partName) params.append('partName', filterParams.partName);
      if (filterParams.status) params.append('status', filterParams.status);
      if (filterParams.startDate) params.append('startDate', filterParams.startDate);
      if (filterParams.endDate) params.append('endDate', filterParams.endDate);
      if (filterParams.search) params.append('search', filterParams.search);
      
      const queryString = params.toString();
      const url = `/api/student/chapters${queryString ? `?${queryString}` : ''}`;
      
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const chapters = res.data?.chapters || [];
      console.log('[fetchChapterSubmissions] Received chapters:', chapters.map(ch => ({
        chapterType: ch.chapterType,
        submissionCount: ch.submissions?.length || 0,
        submissions: ch.submissions?.map(s => ({
          id: s.id,
          version: s.version,
          partName: s.partName,
          filename: s.filename
        }))
      })));
      setChapterData(chapters);

      const chapterProgress = chapters.reduce((acc, chapter) => {
        const approvedSubmission = chapter.submissions?.find(
          (submission) => submission.status === 'approved'
        );
        acc[chapter.chapterType] = Boolean(approvedSubmission);
        return acc;
      }, { chapter1: false, chapter2: false, chapter3: false });

      setUploadProgress((prev) => ({
        ...prev,
        ...chapterProgress,
      }));
    } catch (error) {
      console.error('Error fetching chapter submissions:', error);
      setChapterError(error.response?.data?.message || 'Failed to load chapter submissions');
    } finally {
      setChapterLoading(false);
    }
  };

  const fetchMySchedules = async (filters = {}) => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.type) params.append('type', filters.type);
      
      // Add cache-busting timestamp to force fresh data
      params.append('_t', Date.now().toString());
      
      const res = await axios.get(`/api/student/schedules?${params.toString()}`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      setMySchedules(res.data);
      console.log('Fetched schedules:', res.data.length, 'items');
    } catch (error) {
      console.error('Error fetching schedules:', error);
    }
  };

  const fetchAdviserFeedback = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/student/feedback', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAdviserFeedback(res.data);
    } catch (error) {
      console.error('Error fetching feedback:', error);
    }
  };

  const fetchProgressOverview = async () => {
    setProgressLoading(true);
    setProgressError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/student/progress', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProgressOverview(res.data);
    } catch (error) {
      console.error('Error fetching progress overview:', error);
      setProgressError(error.response?.data?.message || 'Failed to load progress overview');
    } finally {
      setProgressLoading(false);
    }
  };

  const handleChapterUpload = async ({ chapterType, chapterTitle, partName, file }) => {
    if (!file || !chapterType) return;
    
    setUploadingChapter(chapterType);
    setLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      const researchId = myResearch[0]?._id || '';
      
      if (!researchId) {
        throw new Error('No active research found. Please create a research first.');
      }

      console.log('Uploading chapter:', {
        chapterType,
        chapterTitle,
        isDriveFile: file.isDriveFile,
        hasDriveFileId: !!file.driveFileId,
        hasAccessToken: !!file.accessToken,
        isFileInstance: file instanceof File,
        researchId: researchId
      });

      // Check if it's a Google Drive file
      if (file.isDriveFile && file.driveFileId && file.accessToken) {
        console.log('Uploading chapter from Google Drive...', {
          driveFileId: file.driveFileId,
          fileName: file.name,
          chapterType: chapterType,
          researchId: researchId
        });

        let endpoint = '/api/student/chapter-from-drive';
        let response;

        try {
          console.log('Attempting upload via proxy to:', endpoint);
          response = await axios.post(endpoint, {
            driveFileId: file.driveFileId,
            accessToken: file.accessToken,
            researchId: researchId,
            chapterType: chapterType,
            chapterTitle: chapterTitle || '',
            partName: partName || null
          }, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
        } catch (proxyError) {
          // If proxy returns 404, try direct backend URL
          if (proxyError.response?.status === 404) {
            console.warn('Proxy returned 404, trying direct backend URL...');
            const directEndpoint = 'http://localhost:5000/api/student/chapter-from-drive';
            console.log('Attempting upload via direct URL to:', directEndpoint);
            try {
              response = await axios.post(directEndpoint, {
                driveFileId: file.driveFileId,
                accessToken: file.accessToken,
                researchId: researchId,
                chapterType: chapterType,
                chapterTitle: chapterTitle || '',
                partName: partName || null
              }, {
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              });
            } catch (directError) {
              console.error('Direct backend call also failed:', directError);
              if (directError.response?.status === 404) {
                throw new Error('The chapter upload endpoint was not found. Please ensure the backend server is running and has been restarted to load the new route.');
              } else if (directError.code === 'ECONNREFUSED') {
                throw new Error('Cannot connect to backend server. Please ensure the backend is running on http://localhost:5000');
              } else {
                throw directError;
              }
            }
          } else {
            throw proxyError;
          }
        }

        console.log('Google Drive upload response:', response.data);
      } else if (file instanceof File) {
        console.log('Uploading regular file...', {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type
        });

        // Regular file upload
      const formData = new FormData();
      formData.append('file', file);
        formData.append('researchId', researchId);
        formData.append('chapterType', chapterType);
        formData.append('chapterTitle', chapterTitle || '');
        if (partName) {
          formData.append('partName', partName);
        }

        const response = await axios.post('/api/student/chapter', formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
        console.log('Regular upload response:', response.data);
      } else {
        console.error('Invalid file selection:', file);
        throw new Error('Invalid file selection. Please select a file again. If using Google Drive, make sure the file was selected correctly.');
      }

      // Refresh data
      fetchMyResearch();
      fetchChapterSubmissions();
      fetchProgressOverview();
      
      return true;
    } catch (error) {
      console.error('Error uploading chapter:', error);
      console.error('Error response:', error.response);
      console.error('Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      
      const errorMessage = error.response?.data?.message || error.message || 'Error uploading chapter. Please try again.';
      showError('Upload Error', errorMessage);
      throw error;
    } finally {
      setLoading(false);
      setUploadingChapter(null);
    }
  };


  const handleLogout = async () => {
    // Show confirmation dialog with SweetAlert
    const result = await showConfirm(
      'Log Out', 
      'Are you sure you want to log out?',
      'Log Out',
      'Cancel'
    );
    
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
    { id: "chapters", label: "Research Chapters", icon: <FaBook /> },
    { id: "compliance", label: "Compliance Forms", icon: <FaFileAlt /> },
    { id: "schedule", label: "My Schedule", icon: <FaCalendar /> },
    { id: "progress", label: "Progress Tracking", icon: <FaChartLine /> },
    { id: "completed", label: "Completed Thesis", icon: <FaCheckCircle /> },
    { id: "documents", label: "Documents", icon: <FaFileAlt /> },
  ];

  const renderContent = () => {
    switch (selectedTab) {
      case "chapters":
        return (
          <ResearchChapters 
          progress={uploadProgress} 
            chapters={chapterData}
            chapterLoading={chapterLoading}
            chapterError={chapterError}
          onChapterUpload={handleChapterUpload}
            uploading={loading}
          uploadingChapter={uploadingChapter}
            filters={filters}
            setFilters={setFilters}
            onRefresh={() => fetchChapterSubmissions(filters)}
          />
        );
      case "compliance":
        return <ComplianceForms 
          myResearch={myResearch}
          onFormUpload={fetchMyResearch}
        />;
      case "schedule":
        return <MySchedule schedules={mySchedules} onRefresh={fetchMySchedules} />;
      case "progress":
        return (
          <ProgressTracking
            data={progressOverview}
            loading={progressLoading}
            error={progressError}
            onRefresh={fetchProgressOverview}
            fallback={{
              percentage: progressPercentage,
              completed: completedChapters,
              total: totalChapters,
              research: myResearch,
            }}
          feedback={adviserFeedback}
          />
        );
      case "completed":
        return <CompletedThesis />;
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
              <h2 className="text-lg font-bold text-white">Graduate Student</h2>
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
                  <h1 className="text-3xl font-bold mb-1">Graduate Student Dashboard</h1>
                  <p className="text-gray-100 text-sm">Track your research progress and manage submissions</p>
                </div>
                <div className="hidden md:block">
                  <div className="bg-white/10 rounded-lg p-3">
                    <FaBook className="h-12 w-12 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <StatCard
            title="Chapters Completed"
            value={`${completedChapters}/${totalChapters}`}
            icon={<FaBook className="h-6 w-6" />}
            color="maroon"
          />
          <StatCard
            title="Documents Uploaded"
            value={myResearch.length > 0 ? myResearch[0].forms?.length || 0 : 0}
            icon={<FaFileAlt className="h-6 w-6" />}
            color="blue"
          />
          <StatCard
            title="Upcoming Consultations"
            value={mySchedules.length}
            icon={<FaCalendar className="h-6 w-6" />}
            color="gold"
          />
          <StatCard
            title="Overall Progress"
            value={`${Math.round(progressPercentage)}%`}
            icon={<FaChartLine className="h-6 w-6" />}
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
      // blob should be ArrayBuffer (converted in onClick handler)
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

// Research Chapters Component
const ResearchChapters = ({
  progress,
  chapters = [],
  chapterLoading,
  chapterError,
  onChapterUpload,
  uploading,
  uploadingChapter,
  filters = { chapter: '', partName: '', status: '', startDate: '', endDate: '', search: '' },
  setFilters,
  onRefresh,
}) => {
  const defaultTitles = useMemo(
    () => ({
      chapter1: "Chapter 1 - Introduction",
      chapter2: "Chapter 2 - Literature Review",
      chapter3: "Chapter 3 - Methodology",
    }),
    []
  );

  const [selectedChapter, setSelectedChapter] = useState("chapter1");
  const [chapterTitle, setChapterTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);
  const [expanded, setExpanded] = useState({
    chapter1: true,
    chapter2: false,
    chapter3: false,
  });
  const [showPartModal, setShowPartModal] = useState(false);
  const [partName, setPartName] = useState("");
  const [viewDocumentUrl, setViewDocumentUrl] = useState(null);
  const [viewDocumentFilename, setViewDocumentFilename] = useState(null);
  const [viewDocumentType, setViewDocumentType] = useState(null); // 'pdf', 'docx', 'doc', etc.
  const [viewDocumentSubmissionId, setViewDocumentSubmissionId] = useState(null); // Store submission ID for download
  const [docxBlob, setDocxBlob] = useState(null); // Store DOCX blob for docx-preview
  const docxContainerRef = useRef(null); // Ref for DOCX container
  const fileInputRef = useRef(null);

  useEffect(() => {
    setFormError(null);
    setFormSuccess(null);
  }, [selectedChapter]);

  // Cleanup blob URLs when component unmounts or modal closes
  useEffect(() => {
    return () => {
      if (viewDocumentUrl && viewDocumentUrl.startsWith('blob:')) {
        window.URL.revokeObjectURL(viewDocumentUrl);
      }
    };
  }, [viewDocumentUrl]);

  const resetForm = useCallback(() => {
    setSelectedFile(null);
    setChapterTitle("");
    setPartName("");
    setDragActive(false);
    setShowPartModal(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleFileSelect = useCallback((file) => {
    if (!file) return;
    
    // Handle Google Drive files
    if (file.isDriveFile && file.driveFileId && file.accessToken) {
      setSelectedFile(file);
      setFormError(null);
      return;
    }
    
    // Handle regular file uploads
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!allowedTypes.includes(file.type)) {
      setFormError("Unsupported file type. Please upload a PDF or Word document.");
      return;
    }

    if (file.size > maxSize) {
      setFormError("File size exceeds the 10MB limit.");
      return;
    }

    setSelectedFile(file);
    setFormError(null);
  }, []);

  const handleGoogleDriveFileSelected = useCallback((fileInfo) => {
    console.log('Google Drive file selected for chapter:', fileInfo);
    
    if (!fileInfo || !fileInfo.id) {
      setFormError("Failed to get Google Drive file information. Please try again.");
      return;
    }

    if (!fileInfo.accessToken) {
      setFormError("Failed to get Google Drive access token. Please try selecting the file again.");
      return;
    }

    // Store the drive file info
    setSelectedFile({
      name: fileInfo.name,
      driveFileId: fileInfo.id,
      accessToken: fileInfo.accessToken,
      mimeType: fileInfo.mimeType,
      size: fileInfo.size,
      isDriveFile: true
    });
    setFormError(null);
  }, []);

  const handleDrag = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.type === "dragenter" || event.type === "dragover") {
      setDragActive(true);
    } else if (event.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      setDragActive(false);
      if (event.dataTransfer?.files?.[0]) {
        handleFileSelect(event.dataTransfer.files[0]);
      }
    },
    [handleFileSelect]
  );

  const handleUpload = async () => {
    // Check permission before allowing upload action
    const hasPermission = await checkPermission(
      ['upload_documents'],
      'Upload Chapter',
      'You will not be able to upload chapters.'
    );
    if (!hasPermission) {
      return;
    }
    
    if (!selectedFile) {
      setFormError("Please select a chapter file to upload.");
      return;
    }

    // If part modal is open, partName must be provided
    if (showPartModal && !partName.trim()) {
      setFormError("Please enter a part name or close the part modal.");
      return;
    }

    setFormError(null);
    try {
      await onChapterUpload({
        chapterType: selectedChapter,
        chapterTitle: chapterTitle.trim(),
        partName: showPartModal && partName.trim() ? partName.trim() : null,
        file: selectedFile,
      });
      setFormSuccess("Chapter uploaded successfully and is now pending review.");
      resetForm();
      setTimeout(() => setFormSuccess(null), 4000);
    } catch (error) {
      const errorMessage =
        error?.response?.data?.message || "Upload failed. Please try again.";
      setFormError(errorMessage);
    }
  };

  const downloadFile = useCallback(async (endpoint, filename) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(endpoint, {
        responseType: "blob",
        headers: { Authorization: `Bearer ${token}` },
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename || "file");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading file:", error);
      showError("Download Error", "Failed to download the file. Please try again.");
    }
  }, []);

  const totalSubmissions = useMemo(
    () =>
      chapters.reduce(
        (acc, chapter) => acc + (chapter.submissions?.length || 0),
        0
      ),
    [chapters]
  );

  const approvedSubmissions = useMemo(
    () =>
      chapters.reduce((acc, chapter) => {
        const approved = chapter.submissions?.filter(
          (submission) => submission.status === "approved"
        );
        return acc + (approved?.length || 0);
      }, 0),
    [chapters]
  );

  const statusClasses = {
    pending: "bg-yellow-100 text-yellow-700",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
    revision: "bg-orange-100 text-orange-700",
  };

  const statusLabels = {
    pending: "Pending Review",
    approved: "Reviewed",
    rejected: "Rejected",
    revision: "Needs Revision",
  };

  const formatDateTime = (value) =>
    value
      ? new Date(value).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : "—";

  const toggleChapter = (chapterType) => {
    setExpanded((prev) => ({
      ...prev,
      [chapterType]: !prev[chapterType],
    }));
  };

  const isUploadingCurrent = Boolean(
    uploading && uploadingChapter === selectedChapter
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
        <h2 className="text-xl font-bold text-gray-800">Research Chapters</h2>
          <p className="text-sm text-gray-500">
            Upload thesis chapters individually, track review status, and access reviewer feedback.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
            {approvedSubmissions}/{Object.keys(progress).length} Chapters Reviewed
          </div>
          <div className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
            {totalSubmissions} Submission{totalSubmissions !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="p-5 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
            <FaUpload className="text-[#7C1D23]" />
            Submit a Chapter for Review
          </h3>
          <p className="text-sm text-gray-500">
            Select the chapter, provide a title, and upload your latest draft. You can resubmit new versions at any time.
          </p>
          <p className="mt-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            Note: Please upload your chapter as a <span className="font-semibold">PDF file</span> so your adviser can add comments and feedback directly on the document.
          </p>
        </div>
        <div
          className="p-5 space-y-4"
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Chapter
              </label>
              <select
                value={selectedChapter}
                onChange={(e) => setSelectedChapter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23]/20 focus:border-[#7C1D23]"
              >
                <option value="chapter1">Chapter 1 - Introduction</option>
                <option value="chapter2">Chapter 2 - Literature Review</option>
                <option value="chapter3">Chapter 3 - Methodology</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Chapter Title <span className="text-gray-400 text-xs">(optional)</span>
              </label>
              <input
                type="text"
                value={chapterTitle}
                onChange={(e) => setChapterTitle(e.target.value)}
                placeholder={defaultTitles[selectedChapter]}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23]/20 focus:border-[#7C1D23]"
                maxLength={150}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setShowPartModal(!showPartModal);
                if (showPartModal) {
                  setPartName("");
                }
              }}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                showPartModal
                  ? "bg-[#7C1D23] text-white hover:bg-[#5a1519]"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <FaPaperclip className="text-xs" />
              {showPartModal ? "Cancel Specific Part" : "Add Specific Part"}
            </button>
            {showPartModal && (
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Part Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={partName}
                  onChange={(e) => setPartName(e.target.value)}
                  placeholder="e.g., Objectives, Background, Local Literature, Significance of the Study"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23]/20 focus:border-[#7C1D23]"
                  maxLength={100}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter the specific part name for this chapter submission
                </p>
              </div>
            )}
              </div>

          <div
            className={`border-2 border-dashed rounded-lg p-6 transition-colors ${
              dragActive ? "border-[#7C1D23] bg-[#f9f1f2]" : "border-gray-300 bg-gray-50"
            }`}
          >
            <div className="flex flex-col items-center text-center">
              <FaUpload className="text-[#7C1D23] text-xl mb-2" />
              <p className="text-sm text-gray-600 mb-2">
                Drag and drop your chapter file here, or select from your options below
              </p>
              <p className="text-xs text-gray-400 mb-4">
                Accepted formats: PDF, DOC, DOCX • Max size: 10MB
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
                  defaultType="chapter"
                  driveButtonLabel="Upload from Google Drive"
                  buttonBg="#7C1D23"
                  buttonTextColor="#ffffff"
                  skipBackendSave={true}
                  onFilePicked={handleGoogleDriveFileSelected}
                />
            </div>
              
              {selectedFile && (
                <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-gray-200 text-sm text-gray-700">
                  <FaFileAlt className="text-gray-500" />
                  <span className="truncate max-w-xs">{selectedFile.name}</span>
                  {selectedFile.isDriveFile && (
                    <span className="text-xs text-blue-600">📁 From Google Drive</span>
                  )}
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-red-500 hover:text-red-600 text-xs"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
                <input 
              ref={fileInputRef}
                  type="file" 
              className="hidden"
                  accept=".pdf,.doc,.docx"
              onChange={(event) => handleFileSelect(event.target.files?.[0])}
            />
          </div>

          {formError && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
              <FaTimesCircle className="mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {formSuccess && (
            <div className="flex items-start gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md p-3">
              <FaCheckCircle className="mt-0.5 text-green-600" />
              <span>{formSuccess}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            {selectedFile && (
                <button 
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                disabled={isUploadingCurrent}
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={handleUpload}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-md transition-colors ${
                isUploadingCurrent ? "bg-gray-400 cursor-not-allowed" : "bg-[#7C1D23] hover:bg-[#5a1519]"
              }`}
              disabled={isUploadingCurrent || !selectedFile}
            >
              {isUploadingCurrent ? (
                "Uploading..."
              ) : (
                <>
                  <FaUpload className="text-xs" />
                  Upload Chapter
                </>
              )}
                </button>
          </div>
        </div>
      </div>

      {chapterError && (
        <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
          <FaExclamationTriangle className="mt-0.5" />
          <span>{chapterError}</span>
              </div>
            )}

      {chapterLoading ? (
        <div className="bg-white border border-gray-200 rounded-lg p-6 text-sm text-gray-500">
          Loading chapter submissions...
          </div>
      ) : chapters.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-6 text-sm text-gray-500">
          No chapter submissions yet. Upload your first chapter to begin the review process.
        </div>
      ) : (
        <div className="space-y-4">
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
                  value={filters?.search || ''}
                  onChange={(e) => setFilters && setFilters({ ...filters, search: e.target.value })}
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
                    value={filters?.chapter || ''}
                    onChange={(e) => setFilters && setFilters({ ...filters, chapter: e.target.value })}
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
                    value={filters?.partName || ''}
                    onChange={(e) => setFilters && setFilters({ ...filters, partName: e.target.value })}
                    placeholder="Filter by part name..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23]/20 focus:border-[#7C1D23]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={filters?.status || ''}
                    onChange={(e) => setFilters && setFilters({ ...filters, status: e.target.value })}
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
                      value={filters?.startDate || ''}
                      onChange={(e) => setFilters && setFilters({ ...filters, startDate: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23]/20 focus:border-[#7C1D23] text-sm"
                      placeholder="Start"
                    />
                    <input
                      type="date"
                      value={filters?.endDate || ''}
                      onChange={(e) => setFilters && setFilters({ ...filters, endDate: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23]/20 focus:border-[#7C1D23] text-sm"
                      placeholder="End"
                    />
                  </div>
                </div>
              </div>

              {/* Clear Filters Button */}
              {setFilters && (filters?.chapter || filters?.partName || filters?.status || filters?.startDate || filters?.endDate || filters?.search) && (
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
          {chapters.map((chapter) => {
            const latestSubmission = chapter.submissions?.[0];
            const submissionCount = chapter.submissions?.length || 0;
            const isExpanded = expanded[chapter.chapterType];

            return (
              <div
                key={chapter.chapterType}
                className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleChapter(chapter.chapterType)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="text-left">
                    <p className="text-sm font-semibold text-gray-800">
                      {defaultTitles[chapter.chapterType]}
                    </p>
                    <p className="text-xs text-gray-500">
                      {submissionCount} submission{submissionCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {latestSubmission ? (
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          statusClasses[latestSubmission.status] ||
                          "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {statusLabels[latestSubmission.status] ||
                          latestSubmission.status}
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        No submissions yet
                      </span>
                    )}
                    {isExpanded ? (
                      <FaChevronUp className="text-gray-500" />
                    ) : (
                      <FaChevronDown className="text-gray-500" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-200 px-5 py-4">
                    {submissionCount === 0 ? (
                      <p className="text-sm text-gray-500">
                        No submissions yet for this chapter.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {(() => {
                          console.log(`[ResearchChapters] ${chapter.chapterType} - Total submissions:`, chapter.submissions?.length || 0);
                          console.log(`[ResearchChapters] ${chapter.chapterType} - Submissions:`, chapter.submissions?.map(s => ({
                            id: s.id,
                            version: s.version,
                            partName: s.partName,
                            filename: s.filename
                          })));
                          
                          // Group submissions by partName (null for full chapter, string for specific part)
                          const groupedSubmissions = new Map();
                          
                          chapter.submissions?.forEach((submission) => {
                            // Normalize partName: null, undefined, or empty string all become 'full-chapter'
                            const partKey = (submission.partName && submission.partName.trim()) 
                              ? submission.partName.trim() 
                              : 'full-chapter';
                            if (!groupedSubmissions.has(partKey)) {
                              groupedSubmissions.set(partKey, []);
                            }
                            groupedSubmissions.get(partKey).push(submission);
                          });
                          
                          console.log(`[ResearchChapters] ${chapter.chapterType} - Grouped:`, Array.from(groupedSubmissions.entries()).map(([key, subs]) => ({
                            partKey: key,
                            count: subs.length,
                            versions: subs.map(s => s.version || 1)
                          })));

                          // Sort each group by version (highest first) or date (newest first)
                          groupedSubmissions.forEach((subs) => {
                            subs.sort((a, b) => {
                              const versionA = a.version || 1;
                              const versionB = b.version || 1;
                              if (versionA !== versionB) {
                                return versionB - versionA; // Higher version first
                              }
                              return new Date(b.uploadedAt) - new Date(a.uploadedAt); // Newer first
                            });
                          });

                          // Convert to array and get only latest version per part
                          const groups = Array.from(groupedSubmissions.entries());
                          
                          return (
                            <>
                              {groups.map(([partKey, submissions]) => {
                                // Get only the latest version (first in sorted array)
                                const latestSubmission = submissions[0];
                                
                                return (
                                  <div key={partKey} className="space-y-3">
                                    {groups.length > 1 && (
                                      <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide px-2">
                                        {partKey === 'full-chapter' ? 'Full Chapter Submissions' : `${latestSubmission.partName} Submissions`}
                                      </div>
                                    )}
                                    {(() => {
                                      const submission = latestSubmission;
                                      const index = 0; // Always the latest
                                      
                                      return (
                                    <div
                                      key={submission.id}
                                      className={`border rounded-lg p-4 shadow-sm ${
                                        index === 0 
                                          ? 'border-blue-300 bg-blue-50' 
                                          : 'border-gray-200 bg-white'
                                      }`}
                                    >
                                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                                        <div>
                                          <div className="flex items-center gap-2 flex-wrap">
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
                                          <p className="text-xs text-gray-500 mt-1">
                                            Uploaded {formatDateTime(submission.uploadedAt)}
                                            {submission.uploadedBy?.name
                                              ? ` • ${submission.uploadedBy.name}`
                                              : ""}
                                          </p>
                                        </div>
                                        <span
                                          className={`self-start px-3 py-1 rounded-full text-xs font-medium ${
                                            statusClasses[submission.status] ||
                                            "bg-gray-100 text-gray-600"
                                          }`}
                                        >
                                          {statusLabels[submission.status] || submission.status}
                                        </span>
                                      </div>

                                      <div className="mt-3 text-sm text-gray-600 space-y-2">
                                        {submission.chapterTitle && (
                                          <p>
                                            <strong>Title:</strong>{" "}
                                            {submission.chapterTitle}
                                          </p>
                                        )}
                                        <p>
                                          <strong>File name:</strong>{" "}
                                          {submission.file?.filename || submission.filename}
                                        </p>
                                        {submission.feedback && (
                                          <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded-md p-3">
                                            <p className="text-xs font-semibold text-yellow-800 mb-1">Adviser Feedback:</p>
                                            <p className="text-sm text-yellow-900 whitespace-pre-line">{submission.feedback}</p>
                                          </div>
                                        )}
                                      </div>

                                      <div className="mt-4 flex flex-wrap gap-2">
                                        {/* View Document Button */}
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            try {
                                              const token = localStorage.getItem('token');
                                              const viewUrl = `/api/student/chapter-submissions/${submission.id}/view`;
                                              
                                              // Get file extension to determine file type
                                              const filename = submission.filename || submission.file?.filename || 'document';
                                              const fileExtension = filename.split('.').pop()?.toLowerCase();
                                              
                                              // Store submission ID and filename
                                              setViewDocumentSubmissionId(submission.id);
                                              setViewDocumentFilename(filename);
                                              setViewDocumentType(fileExtension);
                                              
                                              if (fileExtension === 'docx' || fileExtension === 'doc') {
                                                // For DOCX files, fetch as arraybuffer directly for better compatibility
                                                const response = await axios.get(viewUrl, {
                                                  headers: { Authorization: `Bearer ${token}` },
                                                  responseType: 'arraybuffer'
                                                });
                                                
                                                // Check if response is valid
                                                if (!response.data || response.data.byteLength === 0) {
                                                  throw new Error('File is empty or invalid');
                                                }
                                                
                                                // Check content type
                                                const contentType = response.headers['content-type'] || '';
                                                if (contentType.includes('text/html') || contentType.includes('application/json')) {
                                                  // Might be an error page
                                                  const decoder = new TextDecoder();
                                                  const text = decoder.decode(new Uint8Array(response.data));
                                                  try {
                                                    const errorData = JSON.parse(text);
                                                    throw new Error(errorData.message || 'Server error');
                                                  } catch {
                                                    throw new Error('Received HTML instead of document file. Please check the file on the server.');
                                                  }
                                                }
                                                
                                                // Verify file signature
                                                const uint8Array = new Uint8Array(response.data);
                                                
                                                // DOCX files are ZIP archives and start with PK (0x50 0x4B)
                                                // Old .doc files use OLE format and start with different bytes (0xD0 0xCF 0x11 0xE0)
                                                const isDocx = uint8Array.length >= 2 && uint8Array[0] === 0x50 && uint8Array[1] === 0x4B;
                                                const isOldDoc = uint8Array.length >= 4 && 
                                                  uint8Array[0] === 0xD0 && uint8Array[1] === 0xCF && 
                                                  uint8Array[2] === 0x11 && uint8Array[3] === 0xE0;
                                                
                                                if (isDocx || isOldDoc) {
                                                  // Valid DOCX or old DOC file
                                                  setDocxBlob(response.data);
                                                  setViewDocumentUrl(null); // Clear URL for DOCX
                                                } else {
                                                  // File doesn't match expected signatures, but try to render anyway
                                                  // docx-preview might still be able to handle it
                                                  console.warn('File signature check failed, but attempting to render anyway. First bytes:', 
                                                    Array.from(uint8Array.slice(0, 8)).map(b => '0x' + b.toString(16).toUpperCase()).join(' '));
                                                  setDocxBlob(response.data);
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
                                              showError('Error', error.response?.data?.message || 'Failed to open document. Please try again.');
                                            }
                                          }}
                                          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                                        >
                                          <FaEye />
                                          View Document
                                        </button>

                                        {/* Download Button */}
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            try {
                                              const token = localStorage.getItem('token');
                                              const downloadUrl = `/api/student/chapter-submissions/${submission.id}/download`;
                                              
                                              // For files stored in Google Drive, redirect to Drive link
                                              if (submission.driveFileLink && (submission.storageLocation === 'google-drive' || submission.storageLocation === 'local+google-drive')) {
                                                window.open(submission.driveFileLink, '_blank');
                                              } else {
                                                // For local files, download via axios to handle auth
                                                const response = await axios.get(downloadUrl, {
                                                  headers: { Authorization: `Bearer ${token}` },
                                                  responseType: 'blob'
                                                });
                                                
                                                const url = window.URL.createObjectURL(new Blob([response.data]));
                                                const link = document.createElement('a');
                                                link.href = url;
                                                link.setAttribute('download', submission.filename || submission.file?.filename || 'document');
                                                document.body.appendChild(link);
                                                link.click();
                                                link.remove();
                                                window.URL.revokeObjectURL(url);
                                              }
                                            } catch (error) {
                                              console.error('Error downloading document:', error);
                                              showError('Error', error.response?.data?.message || 'Failed to download document. Please try again.');
                                            }
                                          }}
                                          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors"
                                        >
                                          <FaDownload />
                                          Download
                                        </button>

                                        {/* Delete Button - Show for all non-approved submissions (including older versions) */}
                                        {submission.status !== 'approved' ? (
                                          <button
                                            type="button"
                                            onClick={async () => {
                                              const versionText = submission.version ? `Version ${submission.version}` : 'this submission';
                                              const partText = submission.partName ? ` (${submission.partName})` : '';
                                              const result = await showDangerConfirm('Delete Submission', `Are you sure you want to delete ${versionText}${partText}? This action cannot be undone.`);
                                              if (result.isConfirmed) {
                                                try {
                                                  const token = localStorage.getItem('token');
                                                  await axios.delete(`/api/student/chapter-submissions/${submission.id}`, {
                                                    headers: { Authorization: `Bearer ${token}` }
                                                  });
                                                  // Refresh submissions if callback provided, otherwise reload page
                                                  if (onRefresh) {
                                                    onRefresh();
                                                  } else {
                                                    window.location.reload();
                                                  }
                                                } catch (error) {
                                                  showError('Error', error.response?.data?.message || 'Failed to delete submission');
                                                }
                                              }
                                            }}
                                            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
                                            title={submission.status === 'approved' ? 'Approved submissions cannot be deleted' : 'Delete this submission'}
                                          >
                                            <FaTimesCircle />
                                            Delete
                                          </button>
                                        ) : (
                                          <span className="text-xs text-gray-500 italic px-3 py-2">
                                            Approved submissions cannot be deleted
                                          </span>
                                        )}
                                      </div>

                                      {submission.reviewComment && (
                                        <div className="mt-4 bg-green-50 border border-green-200 rounded-md p-3 text-sm text-green-800">
                                          <div className="flex items-center gap-2 font-semibold">
                                            <FaInfoCircle />
                                            Reviewer Comment
                                          </div>
                                          <p className="mt-2 whitespace-pre-line">
                                            {submission.reviewComment}
                                          </p>
                                          <p className="text-xs text-green-600 mt-2">
                                            {submission.reviewedBy?.name
                                              ? `Reviewed by ${submission.reviewedBy.name}`
                                              : "Reviewed"}
                                            {submission.reviewedAt
                                              ? ` • ${formatDateTime(submission.reviewedAt)}`
                                              : ""}
                                          </p>
                                        </div>
                                      )}

                                      {submission.reviewFiles?.length > 0 && (
                                        <div className="mt-3">
                                          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                            <FaPaperclip />
                                            Reviewer Attachments
                                          </div>
                                          <ul className="mt-2 space-y-2">
                                            {submission.reviewFiles.map((file) => (
                                              <li
                                                key={file.id}
                                                className="flex items-center justify-between text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-3 py-2"
                                              >
                                                <span>{file.filename}</span>
                                                <button
                                                  type="button"
                                                  className="inline-flex items-center gap-1 text-[#7C1D23] hover:text-[#5a1519]"
                                                  onClick={() =>
                                                    downloadFile(file.downloadUrl, file.filename)
                                                  }
                                                >
                                                  <FaDownload className="text-xs" />
                                                  Download
                                                </button>
                                              </li>
                                            ))}
                                          </ul>
      </div>
                                      )}
    </div>
  );
                                    })()}
                                  </div>
                                );
                              })}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Document Viewer Modal */}
      {(viewDocumentUrl || (viewDocumentFilename && (viewDocumentType === 'docx' || viewDocumentType === 'doc'))) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75" onClick={() => {
          // Clean up blob URL if it's a local file
          if (viewDocumentUrl && viewDocumentUrl.startsWith('blob:')) {
            window.URL.revokeObjectURL(viewDocumentUrl);
          }
          setViewDocumentUrl(null);
          setViewDocumentFilename(null);
          setViewDocumentType(null);
          setViewDocumentSubmissionId(null);
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
                  setViewDocumentSubmissionId(null);
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
                  {docxBlob && docxContainerRef.current && (
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

// Compliance Forms Component
const ComplianceForms = ({ myResearch, onFormUpload }) => {
  const [complianceForms, setComplianceForms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [formType, setFormType] = useState("ethics");
  const [dragActive, setDragActive] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedForm, setSelectedForm] = useState(null);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [errorMessage, setErrorMessage] = useState("");
  const fileInputRef = React.useRef(null);
  const [viewingDocument, setViewingDocument] = useState(null);
  const [showDocumentViewer, setShowDocumentViewer] = useState(false);
  const [documentBlobUrl, setDocumentBlobUrl] = useState(null);
  const docxPreviewRef = useRef(null);

  useEffect(() => {
    fetchComplianceForms();
  }, []);

  const fetchComplianceForms = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/student/compliance-forms', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setComplianceForms(res.data);
    } catch (error) {
      console.error('Error fetching compliance forms:', error);
      setErrorMessage('Failed to fetch compliance forms');
      setTimeout(() => setErrorMessage(""), 4000);
    } finally {
      setLoading(false);
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

  const handleFileSelect = (file) => {
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    const ALLOWED_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

    if (file.size > MAX_SIZE) {
      setErrorMessage("File size exceeds 10MB limit");
      setTimeout(() => setErrorMessage(""), 4000);
      return;
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      setErrorMessage("Unsupported file format. Allowed: PDF, DOC, DOCX");
      setTimeout(() => setErrorMessage(""), 4000);
      return;
    }

    setSelectedFile(file);
    setShowUploadModal(true);
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    // Check permission before allowing upload action
    const hasPermission = await checkPermission(
      ['upload_documents'],
      'Upload Compliance Form',
      'You will not be able to upload compliance forms.'
    );
    if (!hasPermission) {
      return;
    }
    
    if (!selectedFile || !formType || !myResearch || myResearch.length === 0) {
      setErrorMessage("Please select a file, form type, and ensure you have an active research");
      setTimeout(() => setErrorMessage(""), 4000);
      return;
    }

    setUploading(true);
    setErrorMessage("");
    
    try {
      const token = localStorage.getItem('token');
      
      console.log('Uploading file:', {
        selectedFile: selectedFile,
        isDriveFile: selectedFile.isDriveFile,
        hasDriveFileId: !!selectedFile.driveFileId,
        hasAccessToken: !!selectedFile.accessToken,
        isFileInstance: selectedFile instanceof File,
        formType: formType,
        researchId: myResearch[0]?._id,
        researchExists: !!myResearch[0]
      });
      
      // Check if it's a Google Drive file
      if (selectedFile.isDriveFile && selectedFile.driveFileId && selectedFile.accessToken) {
        console.log('Uploading from Google Drive...', {
          driveFileId: selectedFile.driveFileId,
          fileName: selectedFile.name,
          formType: formType,
          researchId: myResearch[0]._id
        });
        
        // Upload from Google Drive
        // Try proxy first, if it fails with 404, try direct backend URL
        let endpoint = '/api/student/compliance-form-from-drive';
        let response;
        
        try {
          console.log('Attempting upload via proxy to:', endpoint);
          response = await axios.post(endpoint, {
            driveFileId: selectedFile.driveFileId,
            accessToken: selectedFile.accessToken,
            researchId: myResearch[0]._id,
            formType: formType
          }, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
        } catch (proxyError) {
          // If proxy returns 404, try direct backend URL
          if (proxyError.response?.status === 404) {
            console.warn('Proxy returned 404, trying direct backend URL...');
            endpoint = 'http://localhost:5000/api/student/compliance-form-from-drive';
            console.log('Attempting upload via direct URL to:', endpoint);
            response = await axios.post(endpoint, {
              driveFileId: selectedFile.driveFileId,
              accessToken: selectedFile.accessToken,
              researchId: myResearch[0]._id,
              formType: formType
            }, {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });
          } else {
            throw proxyError;
          }
        }
        
        console.log('Google Drive upload response:', response.data);
      } else if (selectedFile instanceof File) {
        console.log('Uploading regular file...', {
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          fileType: selectedFile.type
        });
        
        // Regular file upload
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('researchId', myResearch[0]._id);
        formData.append('formType', formType);

        const response = await axios.post('/api/student/compliance-form', formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        });
        console.log('Regular upload response:', response.data);
      } else {
        console.error('Invalid file selection:', selectedFile);
        throw new Error('Invalid file selection. Please select a file again. If using Google Drive, make sure the file was selected correctly.');
      }

      setSuccessMessage("Compliance form uploaded successfully! You will receive a notification when it is reviewed.");
      setSelectedFile(null);
      setFormType("ethics");
      setShowUploadModal(false);
      
      // Refresh compliance forms list
      await fetchComplianceForms();
      if (onFormUpload) onFormUpload();
      
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (error) {
      console.error('Error uploading compliance form:', error);
      console.error('Error response:', error.response);
      console.error('Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      
      let errorMessage = 'Error uploading compliance form. Please try again.';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setErrorMessage(errorMessage);
      // Keep modal open on error so user can retry
      setTimeout(() => setErrorMessage(""), 8000);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (formId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/student/compliance-forms/${formId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', response.headers['content-disposition']?.split('filename=')[1] || 'compliance-form.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading compliance form:', error);
      setErrorMessage('Failed to download compliance form');
      setTimeout(() => setErrorMessage(""), 4000);
    }
  };

  const handleView = async (formId) => {
    try {
      const token = localStorage.getItem('token');
      // Find form in complianceForms array
      const form = complianceForms.find(f => f._id === formId);
      
      if (!form) {
        setErrorMessage('Form not found');
        setTimeout(() => setErrorMessage(""), 4000);
        return;
      }

      const filename = form.filename || 'compliance-form';
      const fileExtension = filename.split('.').pop()?.toLowerCase();
      const isDocx = fileExtension === 'docx' || fileExtension === 'doc';

      const response = await axios.get(`/api/student/compliance-forms/${formId}/view`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: isDocx ? 'arraybuffer' : 'blob'
      });

      if (isDocx) {
        // For DOCX files, store as blob for docx-preview
        const blob = new Blob([response.data], { 
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
        });
        setDocumentBlobUrl(URL.createObjectURL(blob));
        setViewingDocument({ ...form, fileExtension });
        setShowDocumentViewer(true);
      } else {
        // For PDF and other files, create blob URL for iframe
        const blob = new Blob([response.data], { type: response.headers['content-type'] || 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setDocumentBlobUrl(url);
        setViewingDocument({ ...form, fileExtension });
        setShowDocumentViewer(true);
      }
    } catch (error) {
      console.error('Error viewing compliance form:', error);
      setErrorMessage('Failed to view compliance form');
      setTimeout(() => setErrorMessage(""), 4000);
    }
  };

  // Cleanup blob URL when modal closes
  const handleCloseViewer = () => {
    if (documentBlobUrl) {
      URL.revokeObjectURL(documentBlobUrl);
      setDocumentBlobUrl(null);
    }
    // Clear DOCX preview
    if (docxPreviewRef.current) {
      docxPreviewRef.current.innerHTML = '';
    }
    setShowDocumentViewer(false);
    setViewingDocument(null);
  };

  // Effect to render DOCX files
  useEffect(() => {
    if (showDocumentViewer && viewingDocument && documentBlobUrl && docxPreviewRef.current) {
      const isDocx = viewingDocument.fileExtension === 'docx' || viewingDocument.fileExtension === 'doc';
      
      if (isDocx) {
        // Clear previous content
        docxPreviewRef.current.innerHTML = '';
        
        // Fetch and render DOCX
        fetch(documentBlobUrl)
          .then(response => response.blob())
          .then(blob => {
            renderAsync(blob, docxPreviewRef.current, null, {
              className: 'docx-wrapper',
              inWrapper: true,
              ignoreWidth: false,
              ignoreHeight: false,
              ignoreFonts: false,
              breakPages: true,
              experimental: false,
              trimXmlDeclaration: true,
              useBase64URL: false,
              useMathMLPolyfill: true,
              showChanges: false,
            })
            .catch(error => {
              console.error('Error rendering DOCX:', error);
              docxPreviewRef.current.innerHTML = '<p class="text-red-500 p-4">Error rendering document. Please try downloading the file.</p>';
            });
          })
          .catch(error => {
            console.error('Error fetching DOCX:', error);
            docxPreviewRef.current.innerHTML = '<p class="text-red-500 p-4">Error loading document. Please try again.</p>';
          });
      }
    }
  }, [showDocumentViewer, viewingDocument, documentBlobUrl]);

  const handleViewVersionHistory = async (formId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/student/compliance-forms/${formId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedForm(res.data);
      setShowVersionHistory(true);
    } catch (error) {
      console.error('Error fetching version history:', error);
      setErrorMessage('Failed to fetch version history');
      setTimeout(() => setErrorMessage(""), 4000);
    }
  };

  const handleGoogleDriveFileSelected = async (fileInfo) => {
    console.log('Google Drive file selected:', fileInfo);
    
    if (!fileInfo || !fileInfo.id) {
      setErrorMessage("Failed to get Google Drive file information. Please try again.");
      setTimeout(() => setErrorMessage(""), 4000);
      return;
    }

    if (!fileInfo.accessToken) {
      setErrorMessage("Failed to get Google Drive access token. Please try selecting the file again.");
      setTimeout(() => setErrorMessage(""), 4000);
      return;
    }

    // Store the drive file info and show upload modal
    setSelectedFile({
      name: fileInfo.name,
      driveFileId: fileInfo.id,
      accessToken: fileInfo.accessToken,
      mimeType: fileInfo.mimeType,
      size: fileInfo.size,
      isDriveFile: true
    });
    setShowUploadModal(true);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-700';
      case 'rejected':
        return 'bg-red-100 text-red-700';
      case 'revision':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-yellow-100 text-yellow-700';
    }
  };

  const getFormTypeLabel = (type) => {
    const types = {
      ethics: 'Ethics',
      declaration: 'Declaration',
      consent: 'Consent',
      authorization: 'Authorization',
      other: 'Other'
    };
    return types[type] || type;
  };

  // Group forms by type, showing only the current version for each type
  const groupedForms = complianceForms.reduce((acc, form) => {
    if (form.isCurrent) {
      // If we already have a form of this type, keep the one with higher version
      if (!acc[form.formType] || acc[form.formType].version < form.version) {
        acc[form.formType] = form;
      }
    }
    return acc;
  }, {});

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

      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">Compliance Forms</h2>
      </div>

      {/* Upload Area */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Upload Compliance Form</h3>
        
        {/* Drag and Drop Area */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive ? 'border-[#7C1D23] bg-red-50' : 'border-gray-300 bg-gray-50'
          }`}
        >
          <FaUpload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-700 font-medium mb-2">
            Drag and drop your file here, or click to browse
          </p>
          <p className="text-sm text-gray-500 mb-4">
            Supported formats: PDF, DOC, DOCX (Max 10MB)
          </p>
          <div className="flex gap-3 justify-center">
        <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-[#7C1D23] text-white rounded-md hover:bg-[#5a1519] transition-colors text-sm font-medium"
        >
              Select File from Computer
        </button>
            <DriveUploader
              defaultType="compliance"
              driveButtonLabel="Upload from Google Drive"
              buttonBg="#7C1D23"
              buttonTextColor="#ffffff"
              skipBackendSave={true}
              onFilePicked={handleGoogleDriveFileSelected}
            />
      </div>
          <input 
            ref={fileInputRef}
            type="file" 
            onChange={handleFileInputChange}
            accept=".pdf,.doc,.docx"
            className="hidden"
          />
            </div>
          </div>

      {/* Upload Modal */}
      {showUploadModal && (
        // Match global modal overlay style (Dean / Export PDF-Excel)
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6"
          onClick={(e) => {
            // Close modal when clicking outside
            if (e.target === e.currentTarget) {
              setShowUploadModal(false);
              setSelectedFile(null);
            }
          }}
        >
          <div 
            className="bg-white rounded-lg shadow-lg max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Upload Compliance Form</h3>
          <button 
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowUploadModal(false);
                  setSelectedFile(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <FaClose className="h-6 w-6" />
          </button>
        </div>

            {selectedFile && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-700">Selected File:</p>
                <p className="text-sm text-gray-600">{selectedFile.name}</p>
                {selectedFile.size && (
                  <p className="text-xs text-gray-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                )}
                {selectedFile.isDriveFile && (
                  <p className="text-xs text-blue-600 mt-1">📁 From Google Drive</p>
                )}
      </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Form Type <span className="text-red-500">*</span>
              </label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-[#7C1D23]"
              >
                <option value="ethics">Ethics</option>
                <option value="declaration">Declaration</option>
                <option value="consent">Consent</option>
                <option value="authorization">Authorization</option>
                <option value="other">Other</option>
              </select>
      </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowUploadModal(false);
                  setSelectedFile(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  await handleUpload();
                }}
                disabled={uploading || !selectedFile || !formType}
                className="px-4 py-2 bg-[#7C1D23] text-white rounded-md hover:bg-[#5a1519] transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? 'Uploading...' : 'Upload Compliance Form'}
              </button>
              </div>
          </div>
        </div>
      )}

      {/* Submission List */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">My Submissions</h3>
        
        {loading ? (
          <p className="text-center text-gray-500 py-8">Loading...</p>
        ) : complianceForms.length === 0 ? (
          <div className="text-center py-8">
            <FaFileAlt className="mx-auto h-12 w-12 text-gray-400 mb-3" />
            <p className="text-gray-500 text-sm">No compliance forms uploaded yet.</p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {(() => {
                const startIndex = (currentPage - 1) * itemsPerPage;
                const endIndex = startIndex + itemsPerPage;
                const paginatedForms = Object.values(groupedForms).slice(startIndex, endIndex);
                
                return paginatedForms.map((form) => (
              <div key={form._id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-semibold text-gray-800">{getFormTypeLabel(form.formType)}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(form.status)}`}>
                        {form.status.charAt(0).toUpperCase() + form.status.slice(1)}
                    </span>
                      {form.version > 1 && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                          Version {form.version}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-1">{form.filename}</p>
                    <p className="text-xs text-gray-500">
                      Uploaded: {new Date(form.uploadedAt).toLocaleString()}
                    </p>
                    {form.reviewedAt && (
                      <p className="text-xs text-gray-500">
                        Reviewed: {new Date(form.reviewedAt).toLocaleString()}
                      </p>
                    )}
                    {form.reviewComments && (
                      <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-700">
                        <p className="font-medium">Review Comments:</p>
                        <p>{form.reviewComments}</p>
                  </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 ml-4">
                    <button
                      onClick={() => handleView(form._id)}
                      className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs font-medium"
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleDownload(form._id)}
                      className="px-3 py-1 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-xs font-medium"
                    >
                      Download
                    </button>
                    {form.version > 1 && (
                      <button
                        onClick={() => handleViewVersionHistory(form._id)}
                        className="px-3 py-1 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-xs font-medium"
                      >
                        History
                      </button>
                    )}
                </div>
              </div>
              </div>
                ));
              })()}
            </div>
            {Object.values(groupedForms).length > 0 && (() => {
              const startIndex = (currentPage - 1) * itemsPerPage;
              const endIndex = Math.min(startIndex + itemsPerPage, Object.values(groupedForms).length);
              const totalPages = Math.ceil(Object.values(groupedForms).length / itemsPerPage);
              
              return (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={Object.values(groupedForms).length}
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

      {/* Version History Modal */}
      {showVersionHistory && selectedForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-lg max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Version History: {getFormTypeLabel(selectedForm.formType)}</h3>
              <button
                onClick={() => {
                  setShowVersionHistory(false);
                  setSelectedForm(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <FaClose className="h-6 w-6" />
              </button>
            </div>

            {(() => {
              // Combine current form with version history, sorted by version
              const allVersions = [
                selectedForm.complianceForm,
                ...(selectedForm.versionHistory || [])
              ].sort((a, b) => b.version - a.version);
              
              return allVersions.length > 0 ? (
              <div className="space-y-4">
                  {allVersions.map((version) => (
                    <div key={version._id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-800">Version {version.version}</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(version.status)}`}>
                            {version.status.charAt(0).toUpperCase() + version.status.slice(1)}
                          </span>
                          {version.isCurrent && (
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                              Current
                            </span>
                      )}
                    </div>
                        <div className="flex gap-2">
                  <button
                            onClick={() => handleView(version._id)}
                            className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs font-medium"
                  >
                            View
                  </button>
                  <button
                            onClick={() => handleDownload(version._id)}
                            className="px-3 py-1 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-xs font-medium"
                  >
                            Download
                  </button>
                </div>
              </div>
                      <p className="text-sm text-gray-600 mb-1">{version.filename}</p>
                      <p className="text-xs text-gray-500">
                        Uploaded: {new Date(version.uploadedAt).toLocaleString()}
                      </p>
                      {version.reviewedAt && (
                        <p className="text-xs text-gray-500">
                          Reviewed: {new Date(version.reviewedAt).toLocaleString()}
                        </p>
                      )}
                      {version.reviewComments && (
                        <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-700">
                          <p className="font-medium">Review Comments:</p>
                          <p>{version.reviewComments}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">No version history available</p>
              );
            })()}
          </div>
        </div>
      )}

      {/* Document Viewer Modal */}
      {showDocumentViewer && viewingDocument && documentBlobUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full h-full flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#7C1D23] to-[#5a1519] text-white p-4 rounded-t-lg flex justify-between items-center">
              <h3 className="text-lg font-bold">{viewingDocument.filename || 'Compliance Form'}</h3>
              <button 
                onClick={handleCloseViewer}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <FaClose className="h-5 w-5" />
              </button>
            </div>
            
            {/* Document Content */}
            <div className="flex-1 p-4 overflow-auto">
              {viewingDocument.fileExtension === 'docx' || viewingDocument.fileExtension === 'doc' ? (
                <div 
                  ref={docxPreviewRef}
                  className="w-full h-full docx-container"
                  style={{ padding: '20px', backgroundColor: '#fff' }}
                />
              ) : viewingDocument.fileExtension === 'pdf' ? (
                <iframe
                  src={documentBlobUrl}
                  className="w-full h-full border-0"
                  title={viewingDocument.filename}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500">
                    Document preview not available for this file type. 
                    <button 
                      onClick={() => handleDownload(viewingDocument._id)}
                      className="ml-2 text-[#7C1D23] hover:underline"
                    >
                      Download to view
                    </button>
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Progress Tracking Component
const ProgressTracking = ({ data, loading, error, onRefresh, fallback, feedback }) => {
  const navigate = useNavigate();
  const [selectedMilestone, setSelectedMilestone] = useState(null);

  useEffect(() => {
    if (data?.milestones?.length) {
      const exists = selectedMilestone && data.milestones.some((m) => m.id === selectedMilestone.id);
      if (!exists) {
        setSelectedMilestone(data.milestones[0]);
      }
    } else if (!loading) {
      setSelectedMilestone(null);
    }
  }, [data, loading, selectedMilestone]);

  const percentage = data?.percentage ?? fallback?.percentage ?? 0;
  const totalMilestones = data?.totalMilestones ?? fallback?.total ?? 0;
  const completedCount = data?.completedCount ?? fallback?.completed ?? 0;
  const researchInfo = data?.research ?? (fallback?.research?.[0] ? {
    title: fallback.research[0].title,
    stage: fallback.research[0].stage,
    status: fallback.research[0].status,
  } : null);
  const upcomingDeadlines = data?.upcomingDeadlines ?? [];
  const notifications = data?.notifications ?? [];
  const milestones = data?.milestones ?? [];

  const formatDate = (value) => {
    if (!value) return "Not set";
    return new Date(value).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const statusStyles = {
    completed: "bg-green-100 text-green-700 border border-green-200",
    "in-progress": "bg-blue-100 text-blue-700 border border-blue-200",
    "not-started": "bg-gray-100 text-gray-600 border border-gray-200",
  };

  const statusLabels = {
    completed: "Completed",
    "in-progress": "In Progress",
    "not-started": "Not Started",
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-10 text-center">
        <p className="text-gray-500 text-sm">Loading your progress overview...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <FaExclamationTriangle className="text-red-600" />
          <h3 className="text-sm font-semibold">Unable to load progress overview</h3>
        </div>
        <p className="text-sm mb-4">{error}</p>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (data && data.hasResearch === false) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-10 text-center">
        <FaInfoCircle className="mx-auto text-3xl text-gray-400 mb-3" />
        <h3 className="text-lg font-semibold text-gray-800 mb-1">No Research Assigned Yet</h3>
        <p className="text-sm text-gray-500">
          Once your adviser assigns you to a research group, your progress tracking details will appear here.
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
      <h2 className="text-xl font-bold text-gray-800">Progress Tracking</h2>
          {researchInfo && (
            <p className="text-sm text-gray-500">
              {researchInfo.title}
              {researchInfo.stage && ` · Stage: ${researchInfo.stage}`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            Last updated: {formatDate(data?.updatedAt || new Date())}
          </span>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="px-3 py-2 bg-[#7C1D23] text-white rounded-md text-xs font-semibold hover:bg-[#5a1519] transition-colors"
            >
              Refresh
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="space-y-5 xl:col-span-2">
      <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400">Overall Completion</p>
                <p className="text-3xl font-bold text-[#7C1D23]">{Math.min(100, Math.max(0, percentage))}%</p>
          </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-gray-400">Milestones</p>
                <p className="text-lg font-semibold text-gray-700">
                  {completedCount}/{totalMilestones}
                </p>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
            <div
              className="bg-[#7C1D23] h-3 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
            ></div>
          </div>
            <p className="text-xs text-gray-500">
              Keep completing milestones to reach 100%. Automatic updates occur when submissions are approved or defenses are completed.
            </p>
        </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <FaClock className="text-[#7C1D23]" />
                <h3 className="text-sm font-semibold text-gray-800">Upcoming & Overdue Deadlines</h3>
          </div>
              {upcomingDeadlines.length === 0 ? (
                <p className="text-sm text-gray-500">No urgent deadlines in the next 7 days.</p>
              ) : (
                <div className="space-y-3">
                  {upcomingDeadlines.map((deadline) => (
                    <div
                      key={deadline.id}
                      className={`p-3 rounded-lg border ${
                        deadline.isOverdue
                          ? "border-red-200 bg-red-50"
                          : "border-yellow-200 bg-yellow-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-800">
                          {deadline.title}
                        </p>
                        <span
                          className={`text-xs font-semibold ${
                            deadline.isOverdue ? "text-red-600" : "text-yellow-700"
                          }`}
                        >
                          {deadline.isOverdue
                            ? `Overdue by ${Math.abs(deadline.daysUntilDue)} day(s)`
                            : `Due in ${deadline.daysUntilDue} day(s)`}
                        </span>
          </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Due date: {formatDate(deadline.dueDate)}
                      </p>
          </div>
                  ))}
        </div>
              )}
      </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <FaInfoCircle className="text-[#7C1D23]" />
                <h3 className="text-sm font-semibold text-gray-800">Deadline Notifications</h3>
              </div>
              {notifications.length === 0 ? (
                <p className="text-sm text-gray-500">No deadline alerts at this time.</p>
              ) : (
                <ul className="space-y-3">
                  {notifications.map((notification, index) => (
                    <li
                      key={`${notification.milestoneId}-${index}`}
                      className={`p-3 rounded-lg border-l-4 ${
                        notification.severity === "high"
                          ? "border-red-500 bg-red-50 text-red-700"
                          : "border-yellow-500 bg-yellow-50 text-yellow-700"
                      }`}
                    >
                      <p className="text-xs uppercase font-semibold mb-1">
                        {notification.severity === "high" ? "Urgent" : "Upcoming"}
                      </p>
                      <p className="text-sm">{notification.message}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Milestone Tracker</h3>
              <span className="text-xs text-gray-400">
                Click a milestone to view details and submission links
              </span>
            </div>
            {milestones.length === 0 ? (
              <p className="text-sm text-gray-500">
                Milestone details are not available yet. Progress will appear as soon as milestones are defined.
              </p>
            ) : (
          <div className="space-y-3">
                {milestones.map((milestone) => {
                  const isActive = selectedMilestone?.id === milestone.id;
                  return (
                    <button
                      key={milestone.id}
                      onClick={() => setSelectedMilestone(milestone)}
                      className={`w-full text-left p-4 rounded-lg border transition-all ${
                        isActive
                          ? "border-[#7C1D23] bg-[#7c1d2310]"
                          : "border-gray-200 bg-white hover:border-[#7C1D23]/40 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <span
                            className={`px-2 py-1 text-xs font-semibold rounded-full ${statusStyles[milestone.status]}`}
                          >
                            {statusLabels[milestone.status]}
              </span>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">
                              {milestone.title}
                            </p>
                            {milestone.dueDate && (
                              <p className="text-xs text-gray-500">
                                Due {formatDate(milestone.dueDate)}
                              </p>
                            )}
            </div>
                        </div>
                        <FaChevronRight
                          className={`text-sm transition-transform ${
                            isActive ? "text-[#7C1D23] rotate-90" : "text-gray-400"
                          }`}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Milestone Details</h3>
            {!selectedMilestone ? (
              <p className="text-sm text-gray-500">
                Select a milestone from the list to see its details and recommended actions.
              </p>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-xs uppercase text-gray-400">Milestone</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {selectedMilestone.title}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedMilestone.description}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Status</span>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusStyles[selectedMilestone.status]}`}>
                      {statusLabels[selectedMilestone.status]}
              </span>
            </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Due Date</span>
                    <span className="text-xs text-gray-700">
                      {formatDate(selectedMilestone.dueDate)}
                    </span>
          </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Completed</span>
                    <span className="text-xs text-gray-700">
                      {selectedMilestone.completedAt
                        ? formatDate(selectedMilestone.completedAt)
                        : "Not yet completed"}
                    </span>
        </div>
                </div>

                {selectedMilestone.submissionLink && (
                  <button
                    onClick={() => navigate(selectedMilestone.submissionLink)}
                    className="w-full px-4 py-2 bg-[#7C1D23] text-white text-sm font-semibold rounded-md hover:bg-[#5a1519] transition-colors"
                  >
                    Go to Submission Area
                  </button>
                )}
              </div>
            )}
          </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Recent Adviser Feedback</h3>
            <div className="space-y-3 max-h-80 overflow-y-auto">
          {feedback && feedback.length > 0 ? (
                feedback.slice(0, 5).map((item, index) => (
              <div 
                key={index} 
                    className={`p-3 rounded-lg border-l-4 ${
                      item.type === "approval"
                        ? "bg-green-50 border-green-500"
                        : item.type === "rejection"
                        ? "bg-red-50 border-red-500"
                        : item.type === "revision"
                        ? "bg-orange-50 border-orange-500"
                        : "bg-blue-50 border-blue-500"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800">
                          {item.adviser?.name || "Adviser"}
                    </span>
                        {item.commentCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                            <FaComments className="text-xs" />
                            {item.commentCount} {item.commentCount === 1 ? 'comment' : 'comments'}
                          </span>
                        )}
                  </div>
                      <span className="text-xs text-gray-400">
                        {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                    <p className="text-xs text-gray-500 capitalize mb-1">{item.type}</p>
                    <p className="text-sm text-gray-700 mb-2">{item.message}</p>
                    {item.file && (
                      <button
                        onClick={() => navigate(`/feedback/${item._id}/view`)}
                        className="inline-flex items-center gap-1 text-xs px-3 py-1.5 bg-[#7C1D23] text-white rounded-md hover:bg-[#5a1519] transition-colors font-medium shadow-sm"
                      >
                        <FaEye className="text-xs" />
                        {item.totalComments > 0 || item.commentCount > 0 
                          ? `View Feedback (${item.totalComments || item.commentCount})`
                          : 'View Document'}
                      </button>
                )}
              </div>
            ))
          ) : (
                <p className="text-sm text-gray-500">No feedback yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Completed Thesis Component
const CompletedThesis = () => {
  const [completedThesis, setCompletedThesis] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [semesterFilter, setSemesterFilter] = useState("");
  const [academicYearFilter, setAcademicYearFilter] = useState("");
  const [selectedThesis, setSelectedThesis] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    fetchCompletedThesis();
  }, [semesterFilter, academicYearFilter]);

  const fetchCompletedThesis = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (semesterFilter) params.append('semester', semesterFilter);
      if (academicYearFilter) params.append('academicYear', academicYearFilter);
      if (searchQuery) params.append('search', searchQuery);

      const res = await axios.get(`/api/student/completed-thesis?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCompletedThesis(res.data);
    } catch (error) {
      console.error('Error fetching completed thesis:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchCompletedThesis();
  };

  const handleViewDetails = async (thesis) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/student/completed-thesis/${thesis._id}/panel-feedback`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Backend returns { panel: {...}, feedback: [...] }
      setSelectedThesis({ ...thesis, panelFeedbackData: res.data });
      setShowDetails(true);
    } catch (error) {
      console.error('Error fetching thesis details:', error);
      showError('Error', 'Failed to fetch thesis details');
    }
  };


  // Get unique academic years for filter
  const academicYears = [...new Set(completedThesis.map(t => t.academicYear).filter(Boolean))].sort().reverse();

  // Filter by search query
  const filteredThesis = completedThesis.filter(thesis => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return thesis.title.toLowerCase().includes(query) ||
           (thesis.abstract && thesis.abstract.toLowerCase().includes(query));
  });

  const getEvaluationStatusColor = (status) => {
    switch (status) {
      case 'passed':
      case 'approved':
        return 'bg-green-100 text-green-700';
      case 'failed':
      case 'rejected':
        return 'bg-red-100 text-red-700';
      case 'in-review':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getRecommendationColor = (recommendation) => {
    switch (recommendation) {
      case 'approve':
        return 'bg-green-100 text-green-700';
      case 'reject':
        return 'bg-red-100 text-red-700';
      case 'revision':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">Completed Thesis</h2>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by title or abstract..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-[#7C1D23]"
              />
            </div>
          </div>

          {/* Semester Filter */}
          <div>
            <select
              value={semesterFilter}
              onChange={(e) => setSemesterFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-[#7C1D23]"
            >
              <option value="">All Semesters</option>
              <option value="1st">1st Semester</option>
              <option value="2nd">2nd Semester</option>
              <option value="Summer">Summer</option>
            </select>
          </div>

          {/* Academic Year Filter */}
          <div>
            <select
              value={academicYearFilter}
              onChange={(e) => setAcademicYearFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-[#7C1D23]"
            >
              <option value="">All Academic Years</option>
              {academicYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-[#7C1D23] text-white rounded-md hover:bg-[#5a1519] transition-colors text-sm font-medium flex items-center gap-2"
          >
            <FaSearch />
            Search
          </button>
        </div>
      </div>

      {/* Thesis List */}
      {loading ? (
            <div className="text-center py-8">
          <p className="text-gray-500">Loading...</p>
        </div>
      ) : filteredThesis.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <FaFileAlt className="mx-auto h-12 w-12 text-gray-400 mb-3" />
          <p className="text-gray-500 text-sm">No completed thesis found.</p>
            </div>
      ) : (
        <div className="space-y-4">
          {filteredThesis.map((thesis) => (
            <div key={thesis._id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-800">{thesis.title}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEvaluationStatusColor(thesis.evaluationStatus)}`}>
                      {thesis.evaluationStatus || 'N/A'}
                    </span>
                    {thesis.finalGrade && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        Grade: {thesis.finalGrade}
                      </span>
          )}
        </div>
                  
                  {thesis.abstract && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{thesis.abstract}</p>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                    <div>
                      <span className="font-medium">Submission Date:</span>
                      <p className="text-gray-800">
                        {thesis.submissionDate ? new Date(thesis.submissionDate).toLocaleDateString() : 'N/A'}
                      </p>
      </div>
                    <div>
                      <span className="font-medium">Finalized Date:</span>
                      <p className="text-gray-800">
                        {thesis.finalizedDate ? new Date(thesis.finalizedDate).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium">Semester:</span>
                      <p className="text-gray-800">{thesis.semester || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="font-medium">Academic Year:</span>
                      <p className="text-gray-800">{thesis.academicYear || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="mt-3 text-sm text-gray-600">
                    <span className="font-medium">Adviser:</span> {thesis.adviser?.name || 'N/A'}
                  </div>
                </div>

                <div className="flex flex-col gap-2 ml-4">
                  <button
                    onClick={() => handleViewDetails(thesis)}
                    className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs font-medium"
                  >
                    View Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Thesis Details Modal */}
      {showDetails && selectedThesis && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Thesis Details</h3>
              <button
                onClick={() => {
                  setShowDetails(false);
                  setSelectedThesis(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <FaClose className="h-6 w-6" />
              </button>
            </div>

            {/* Thesis Information */}
            <div className="mb-6">
              <h4 className="text-md font-semibold text-gray-800 mb-2">Title</h4>
              <p className="text-gray-700 mb-4">{selectedThesis.title}</p>

              {selectedThesis.abstract && (
                <>
                  <h4 className="text-md font-semibold text-gray-800 mb-2">Abstract</h4>
                  <p className="text-gray-700 mb-4">{selectedThesis.abstract}</p>
                </>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <span className="text-sm font-medium text-gray-600">Submission Date:</span>
                  <p className="text-gray-800">
                    {selectedThesis.submissionDate ? new Date(selectedThesis.submissionDate).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Finalized Date:</span>
                  <p className="text-gray-800">
                    {selectedThesis.finalizedDate ? new Date(selectedThesis.finalizedDate).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Final Grade:</span>
                  <p className="text-gray-800">{selectedThesis.finalGrade || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Evaluation Status:</span>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getEvaluationStatusColor(selectedThesis.evaluationStatus)}`}>
                    {selectedThesis.evaluationStatus || 'N/A'}
                  </span>
                </div>
              </div>

              <div className="mb-4">
                <span className="text-sm font-medium text-gray-600">Student(s):</span>
                <p className="text-gray-800">
                  {selectedThesis.students?.map(s => s.name).join(', ') || 'N/A'}
                </p>
              </div>

              <div className="mb-4">
                <span className="text-sm font-medium text-gray-600">Adviser:</span>
                <p className="text-gray-800">{selectedThesis.adviser?.name || 'N/A'}</p>
              </div>
            </div>

            {/* Panel Information */}
            {selectedThesis.panelFeedbackData?.panel && (
              <div className="mb-6">
                <h4 className="text-md font-semibold text-gray-800 mb-4">Panel Information</h4>
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <p className="text-sm text-gray-700 mb-2">
                    <span className="font-medium">Panel Name:</span> {selectedThesis.panelFeedbackData.panel.name}
                  </p>
                  <p className="text-sm text-gray-700 mb-2">
                    <span className="font-medium">Panel Type:</span> {selectedThesis.panelFeedbackData.panel.type}
                  </p>
                  <p className="text-sm text-gray-700 mb-2">
                    <span className="font-medium">Status:</span> {selectedThesis.panelFeedbackData.panel.status}
                  </p>
                  {selectedThesis.panelFeedbackData.panel.meetingDate && (
                    <p className="text-sm text-gray-700 mb-2">
                      <span className="font-medium">Meeting Date:</span> {new Date(selectedThesis.panelFeedbackData.panel.meetingDate).toLocaleDateString()}
                    </p>
                  )}
                  {selectedThesis.panelFeedbackData.panel.meetingLocation && (
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Meeting Location:</span> {selectedThesis.panelFeedbackData.panel.meetingLocation}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Panel Feedback */}
            {selectedThesis.panelFeedbackData?.feedback && selectedThesis.panelFeedbackData.feedback.length > 0 && (
              <div className="mb-6">
                <h4 className="text-md font-semibold text-gray-800 mb-4">Panel Feedback</h4>
                <div className="space-y-4">
                  {selectedThesis.panelFeedbackData.feedback.map((feedback, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-800">
                            {feedback.panelist?.name || 'Unknown Panelist'}
                          </span>
                          {feedback.panelist?.isExternal && (
                            <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                              External
                            </span>
                          )}
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRecommendationColor(feedback.recommendation)}`}>
                          {feedback.recommendation || 'N/A'}
                        </span>
                      </div>
                      {feedback.comments && (
                        <p className="text-sm text-gray-700 mt-2">{feedback.comments}</p>
                      )}
                      {feedback.submittedAt && (
                        <p className="text-xs text-gray-500 mt-2">
                          Submitted: {new Date(feedback.submittedAt).toLocaleString()}
                        </p>
                      )}
                      {feedback.status && (
                    <p className="text-xs text-gray-500 mt-1">
                          Status: {feedback.status}
                    </p>
                      )}
                  </div>
                  ))}
                </div>
                  </div>
                )}

            {(!selectedThesis.panelFeedbackData?.feedback || selectedThesis.panelFeedbackData.feedback.length === 0) && (
              <div className="mb-6">
                <h4 className="text-md font-semibold text-gray-800 mb-4">Panel Feedback</h4>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-sm text-gray-500">No panel feedback available.</p>
              </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDetails(false);
                  setSelectedThesis(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm font-medium"
              >
                Close
              </button>
            </div>
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
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerTitle, setViewerTitle] = useState("");
  const [viewerType, setViewerType] = useState(null); // 'docx' | 'pdf' | 'other'
  const [viewerUrl, setViewerUrl] = useState(null);
  const [docViewerBlob, setDocViewerBlob] = useState(null);
  const docViewerContainerRef = useRef(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('Fetching documents with token:', token ? 'Token exists' : 'No token found');
      
      if (!token) {
        console.error('No authentication token found');
        setLoading(false);
        return;
      }
      
      const response = await axios.get('/api/student/documents', {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Documents fetched successfully:', response.data.length, 'documents');
      setDocuments(response.data);
    } catch (error) {
      console.error('Error fetching documents:', error);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
        if (error.response.status === 401) {
          console.error('Authentication failed. Token may be invalid or expired.');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (doc) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/student/documents/${doc._id}/download`, {
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
      const filename = doc.filename || '';
      const extension = filename.split('.').pop()?.toLowerCase();
      const mimeType = doc.mimeType || '';

      setViewerTitle(doc.title || filename || 'Document');

      // Use DOCX preview for Word documents
      if (
        extension === 'docx' ||
        extension === 'doc' ||
        mimeType.includes('wordprocessingml') ||
        mimeType.includes('msword')
      ) {
        const response = await axios.get(`/api/student/documents/${doc._id}`, {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'arraybuffer'
        });

        if (!response.data || response.data.byteLength === 0) {
          throw new Error('File is empty or invalid');
        }

        setDocViewerBlob(response.data);
        setViewerType('docx');
        setViewerUrl(null);
        setViewerOpen(true);
      } else {
        // For PDF and other types, show in an embedded viewer
      const response = await axios.get(`/api/student/documents/${doc._id}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
        const contentType = response.headers['content-type'] || mimeType || 'application/pdf';
        const blob = new Blob([response.data], { type: contentType });
      const url = URL.createObjectURL(blob);

        setViewerType('pdf');
        setViewerUrl(url);
        setDocViewerBlob(null);
        setViewerOpen(true);
      }
    } catch (error) {
      console.error('Error viewing document:', error);
      showError('Error', 'Error viewing document: ' + (error.response?.data?.message || error.message));
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
      {/* Document Viewer Modal */}
      {viewerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
          <div className="bg-white rounded-lg shadow-lg max-w-5xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-800 truncate">
                {viewerTitle}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setViewerOpen(false);
                  if (viewerUrl) {
                    URL.revokeObjectURL(viewerUrl);
                  }
                  setViewerUrl(null);
                  setDocViewerBlob(null);
                  setViewerType(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <FaClose className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 bg-gray-50">
              {viewerType === 'docx' && (
                <div className="w-full h-[calc(90vh-3rem)] overflow-auto">
                  <div
                    ref={docViewerContainerRef}
                    className="docx-viewer p-4"
                  />
                  <DocxViewer
                    blob={docViewerBlob}
                    containerRef={docViewerContainerRef}
                    onError={(err) => {
                      console.error('DOCX viewer error:', err);
                      showError('Error', 'Failed to render DOCX document.');
                    }}
                  />
                </div>
              )}
              {viewerType !== 'docx' && viewerUrl && (
                <iframe
                  src={viewerUrl}
                  title="Document preview"
                  className="w-full h-[calc(90vh-3rem)] border-0"
                />
              )}
            </div>
          </div>
        </div>
      )}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">Available Documents</h2>
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
                      <FaEye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDownload(doc)}
                      className="p-2 text-gray-600 hover:text-[#7C1D23] transition-colors"
                      title="Download"
                    >
                      <FaDownload className="h-4 w-4" />
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
    </div>
  );
};

export default GraduateDashboard;

