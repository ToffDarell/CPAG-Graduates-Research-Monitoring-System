import React, { useState, useEffect } from "react";
import { FaUpload, FaCalendar, FaBook, FaCheckCircle, FaClock, FaFileAlt, FaChartLine, FaSignOutAlt, FaBars, FaTimes as FaClose } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const GraduateDashboard = () => {
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
    localStorage.removeItem('token');
    sessionStorage.removeItem('selectedRole');
    navigate('/');
  };

  const tabs = [
    { id: "chapters", label: "Research Chapters", icon: <FaBook /> },
    { id: "compliance", label: "Compliance Forms", icon: <FaFileAlt /> },
    { id: "schedule", label: "My Schedule", icon: <FaCalendar /> },
    { id: "progress", label: "Progress Tracking", icon: <FaChartLine /> },
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
const MySchedule = ({ schedules }) => (
  <div className="space-y-5">
    <div className="flex justify-between items-center">
      <h2 className="text-xl font-bold text-gray-800">My Schedule</h2>
      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
        {schedules.length} Upcoming
      </span>
    </div>

    <div className="space-y-4">
      {schedules.length > 0 ? (
        schedules.map((schedule) => (
          <div key={schedule._id} className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-800">{schedule.title}</h3>
                <p className="text-sm text-gray-600 mt-1">{schedule.description}</p>
                <p className="text-sm text-gray-500 mt-1">{schedule.location}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-[#7C1D23]">
                  {new Date(schedule.datetime).toLocaleDateString()}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  {new Date(schedule.datetime).toLocaleTimeString()}
                </p>
                <button className="mt-3 px-4 py-2 bg-[#7C1D23] text-white rounded-md text-sm font-medium hover:bg-[#5a1519] transition-colors">
                  View Details
                </button>
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-8">
          <p className="text-gray-500 text-center text-sm">No upcoming schedules found.</p>
        </div>
      )}
    </div>
  </div>
);

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
    </div>
  );
};
export default GraduateDashboard;

