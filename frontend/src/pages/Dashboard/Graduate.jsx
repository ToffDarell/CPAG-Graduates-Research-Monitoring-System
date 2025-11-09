import React, { useState, useEffect } from "react";
import { FaUpload, FaCalendar, FaBook, FaCheckCircle, FaClock, FaFileAlt, FaChartLine, FaSignOutAlt, FaBars, FaTimes as FaClose, FaTimesCircle, FaDownload } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const GraduateDashboard = ({setUser}) => {
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState("chapters");
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

  const completedChapters = Object.values(uploadProgress).filter(Boolean).length;
  const totalChapters = Object.keys(uploadProgress).length;
  const progressPercentage = (completedChapters / totalChapters) * 100;

  // Fetch my research data
  useEffect(() => {
    fetchMyResearch();
    fetchMySchedules();
    fetchAdviserFeedback();
  }, []);

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

  const fetchMySchedules = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/student/schedules', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMySchedules(res.data);
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

  const handleChapterUpload = async (chapterType, file) => {
    if (!file) return;
    
    setUploadingChapter(chapterType);
    setLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('researchId', myResearch[0]?._id || '');
      formData.append('chapterType', chapterType);

      await axios.post('/api/student/chapter', formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      // Update progress
      setUploadProgress(prev => ({
        ...prev,
        [chapterType]: true
      }));
      
      // Refresh research data
      fetchMyResearch();
      alert(`${chapterType} uploaded successfully!`);
    } catch (error) {
      console.error('Error uploading chapter:', error);
      alert('Error uploading chapter. Please try again.');
    } finally {
      setLoading(false);
      setUploadingChapter(null);
    }
  };

  const handleComplianceFormUpload = async (file) => {
    if (!file) return;
    
    setLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('researchId', myResearch[0]?._id || '');

      await axios.post('/api/student/compliance-form', formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      alert('Compliance form uploaded successfully!');
    } catch (error) {
      console.error('Error uploading compliance form:', error);
      alert('Error uploading compliance form. Please try again.');
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
    { id: "chapters", label: "Research Chapters", icon: <FaBook /> },
    { id: "compliance", label: "Compliance Forms", icon: <FaFileAlt /> },
    { id: "schedule", label: "My Schedule", icon: <FaCalendar /> },
    { id: "progress", label: "Progress Tracking", icon: <FaChartLine /> },
    { id: "documents", label: "Documents", icon: <FaFileAlt /> },
  ];

  const renderContent = () => {
    switch (selectedTab) {
      case "chapters":
        return <ResearchChapters 
          progress={uploadProgress} 
          onChapterUpload={handleChapterUpload}
          loading={loading}
          uploadingChapter={uploadingChapter}
        />;
      case "compliance":
        return <ComplianceForms 
          onFormUpload={handleComplianceFormUpload}
          loading={loading}
        />;
      case "schedule":
        return <MySchedule schedules={mySchedules} />;
      case "progress":
        return <ProgressTracking 
          percentage={progressPercentage} 
          completed={completedChapters} 
          total={totalChapters} 
          myResearch={myResearch}
          feedback={adviserFeedback}
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

// Research Chapters Component
const ResearchChapters = ({ progress, onChapterUpload, loading, uploadingChapter }) => {
  const handleFileChange = (chapterType, event) => {
    const file = event.target.files[0];
    if (file) {
      onChapterUpload(chapterType, file);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">Research Chapters</h2>
        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
          {Object.values(progress).filter(Boolean).length}/{Object.keys(progress).length} Completed
        </span>
      </div>

      <div className="space-y-4">
        {[
          { id: 1, title: "Chapter 1 - Introduction", status: progress.chapter1 },
          { id: 2, title: "Chapter 2 - Literature Review", status: progress.chapter2 },
          { id: 3, title: "Chapter 3 - Methodology", status: progress.chapter3 },
        ].map((chapter) => (
          <div
            key={chapter.id}
            className={`p-5 rounded-lg border transition-all ${
              chapter.status
                ? "border-green-300 bg-green-50"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                {chapter.status ? (
                  <FaCheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <FaClock className="h-5 w-5 text-gray-400" />
                )}
                <h3 className="text-base font-semibold text-gray-800">{chapter.title}</h3>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  chapter.status
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {chapter.status ? "Completed" : "Pending"}
              </span>
            </div>
            {!chapter.status && (
              <div className="flex items-center space-x-3">
                <input 
                  type="file" 
                  className="flex-1 text-sm border border-gray-300 rounded-md p-2"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => handleFileChange(chapter.id === 1 ? 'chapter1' : chapter.id === 2 ? 'chapter2' : 'chapter3', e)}
                  disabled={loading}
                />
                <button 
                  className={`flex items-center px-4 py-2 text-white rounded-md transition-colors text-sm font-medium ${
                    uploadingChapter === (chapter.id === 1 ? 'chapter1' : chapter.id === 2 ? 'chapter2' : 'chapter3')
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-[#7C1D23] hover:bg-[#5a1519]'
                  }`}
                  disabled={loading}
                >
                  <FaUpload className="mr-2 text-sm" />
                  {uploadingChapter === (chapter.id === 1 ? 'chapter1' : chapter.id === 2 ? 'chapter2' : 'chapter3') ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Compliance Forms Component
const ComplianceForms = ({ onFormUpload, loading }) => {
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      onFormUpload(file);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">Compliance Forms</h2>
        <div className="flex items-center space-x-3">
          <input 
            type="file" 
            className="text-sm border border-gray-300 rounded-md p-2"
            accept=".pdf,.doc,.docx"
            onChange={handleFileChange}
            disabled={loading}
          />
          <button 
            className={`flex items-center px-4 py-2 text-white rounded-md transition-colors text-sm font-medium ${
              loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#7C1D23] hover:bg-[#5a1519]'
            }`}
            disabled={loading}
          >
            <FaUpload className="mr-2 text-sm" />
            {loading ? 'Uploading...' : 'Upload Form'}
          </button>
        </div>
      </div>
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-8">
        <p className="text-gray-500 text-center text-sm">Upload your compliance forms here. Accepted formats: PDF, DOC, DOCX</p>
      </div>
    </div>
  );
};

// My Schedule Component
const MySchedule = ({ schedules }) => {
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [adviserInfo, setAdviserInfo] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

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
      window.location.reload(); // Refresh to show updated schedule
    } catch (error) {
      console.error('Error requesting consultation:', error);
      setErrorMessage(error.response?.data?.message || 'Failed to request consultation');
    } finally {
      setLoading(false);
    }
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
        <h2 className="text-xl font-bold text-gray-800">My Consultation Schedule</h2>
        <button
          onClick={fetchAvailableSlots}
          disabled={loading}
          className="px-4 py-2 bg-[#7C1D23] text-white rounded-md hover:bg-[#5a1519] transition-colors text-sm font-medium disabled:opacity-50"
        >
          <FaCalendar className="inline mr-2" />
          {loading ? "Loading..." : "Request Consultation"}
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-green-700">{myConfirmedSchedules.length}</p>
              <p className="text-xs text-green-600 font-medium uppercase">Confirmed</p>
            </div>
            <FaCheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-yellow-700">{myPendingRequests.length}</p>
              <p className="text-xs text-yellow-600 font-medium uppercase">Pending Approval</p>
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
                <h4 className="font-semibold text-gray-800">{schedule.title}</h4>
                <p className="text-sm text-gray-600 mt-1">
                  <FaCalendar className="inline mr-1" />
                  {new Date(schedule.datetime).toLocaleString()}
                </p>
                <p className="text-sm text-gray-500">Location: {schedule.location}</p>
                <span className="inline-block mt-2 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                  Waiting for adviser approval
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirmed Schedules */}
      <div className="space-y-4">
        {myConfirmedSchedules.length > 0 ? (
          myConfirmedSchedules.map((schedule) => {
            const isApproaching = new Date(schedule.datetime) - new Date() < 24 * 60 * 60 * 1000;
            return (
              <div 
                key={schedule._id} 
                className={`bg-white border rounded-lg p-5 hover:shadow-md transition-shadow ${
                  isApproaching ? 'border-orange-300 bg-orange-50' : 'border-gray-200'
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
                  <div>
                    <h3 className="text-base font-semibold text-gray-800">{schedule.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{schedule.description || 'Consultation with adviser'}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      <FaCalendar className="inline mr-1" />
                      {new Date(schedule.datetime).toLocaleDateString()} at {new Date(schedule.datetime).toLocaleTimeString()}
                    </p>
                    <p className="text-sm text-gray-500">Location: {schedule.location}</p>
                  </div>
                  <div className="text-right">
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                      Confirmed
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-8">
            <FaCalendar className="mx-auto h-12 w-12 text-gray-400 mb-3" />
            <p className="text-gray-500 text-center text-sm">No confirmed consultations yet.</p>
            <p className="text-gray-400 text-center text-xs mt-1">Click "Request Consultation" to schedule a meeting with your adviser.</p>
          </div>
        )}
      </div>

      {/* Request Consultation Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
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
    </div>
  );
};

// Progress Tracking Component
const ProgressTracking = ({ percentage, completed, total, myResearch, feedback }) => {
  const documentsUploaded = myResearch.length > 0 ? myResearch[0].forms?.length || 0 : 0;
  
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-gray-800">Progress Tracking</h2>

      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="mb-5">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-gray-700">Overall Completion</span>
            <span className="text-sm font-bold text-[#7C1D23]">{Math.round(percentage)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-[#7C1D23] h-3 rounded-full transition-all duration-500"
              style={{ width: `${percentage}%` }}
            ></div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-200">
            <p className="text-3xl font-bold text-green-600">{completed}</p>
            <p className="text-xs text-gray-600 mt-1 uppercase font-semibold">Chapters Done</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-200">
            <p className="text-3xl font-bold text-yellow-600">{total - completed}</p>
            <p className="text-xs text-gray-600 mt-1 uppercase font-semibold">Chapters Pending</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-200">
            <p className="text-3xl font-bold text-[#1E3A8A]">{documentsUploaded}</p>
            <p className="text-xs text-gray-600 mt-1 uppercase font-semibold">Documents Uploaded</p>
          </div>
        </div>
      </div>

      {/* Research Status */}
      {myResearch.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Research Status</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Current Stage:</span>
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                {myResearch[0].stage || 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Status:</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                myResearch[0].status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                myResearch[0].status === 'in-progress' ? 'bg-blue-100 text-blue-700' :
                myResearch[0].status === 'for-revision' ? 'bg-orange-100 text-orange-700' :
                myResearch[0].status === 'completed' ? 'bg-green-100 text-green-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {myResearch[0].status === 'for-revision' ? 'For Revision' : myResearch[0].status}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Adviser Feedback & Notifications */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Adviser Feedback & Notifications</h3>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {feedback && feedback.length > 0 ? (
            feedback.map((item, index) => (
              <div 
                key={index} 
                className={`p-4 rounded-lg border-l-4 ${
                  item.type === 'approval' ? 'bg-green-50 border-green-500' :
                  item.type === 'rejection' ? 'bg-red-50 border-red-500' :
                  item.type === 'revision' ? 'bg-orange-50 border-orange-500' :
                  'bg-blue-50 border-blue-500'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center space-x-2">
                    {item.type === 'approval' && <FaCheckCircle className="text-green-600" />}
                    {item.type === 'rejection' && <FaTimesCircle className="text-red-600" />}
                    {item.type === 'revision' && <FaFileAlt className="text-orange-600" />}
                    {item.type === 'feedback' && <FaFileAlt className="text-blue-600" />}
                    <span className="text-sm font-semibold text-gray-800">
                      {item.adviser?.name || 'Adviser'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                      item.type === 'approval' ? 'bg-green-100 text-green-700' :
                      item.type === 'rejection' ? 'bg-red-100 text-red-700' :
                      item.type === 'revision' ? 'bg-orange-100 text-orange-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {item.type}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{item.message}</p>
                {item.type === 'rejection' && (
                  <div className="mt-3 p-3 bg-white rounded border border-red-200">
                    <p className="text-xs font-semibold text-red-700 mb-1">Action Required:</p>
                    <p className="text-xs text-gray-600">Please review the feedback and resubmit your work after making the necessary revisions.</p>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <FaFileAlt className="mx-auto h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm">No feedback or notifications yet.</p>
              <p className="text-gray-400 text-xs mt-1">Your adviser's feedback will appear here.</p>
            </div>
          )}
        </div>
      </div>
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
      const response = await axios.get('/api/student/documents', {
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
      alert('Error downloading document: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleView = async (doc) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/student/documents/${doc._id}`, {
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
                      <FaDownload className="h-4 w-4" />
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

export default GraduateDashboard;

