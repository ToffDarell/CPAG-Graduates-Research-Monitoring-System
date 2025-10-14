import React, { useState, useEffect } from "react";
import { FaCheckCircle, FaTimesCircle, FaUsers, FaClipboardList, FaCalendar, FaFileAlt, FaClock, FaSignOutAlt, FaBars, FaTimes as FaClose } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const FacultyAdviserDashboard = () => {
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState("submissions");
  const [students, setStudents] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Fetch data on component mount
  useEffect(() => {
    fetchStudentSubmissions();
    fetchMyStudents();
    fetchSchedules();
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
      alert('Submission approved successfully!');
    } catch (error) {
      console.error('Error approving submission:', error);
      alert('Error approving submission');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectSubmission = async (researchId, fileId) => {
    const message = prompt('Please provide feedback for rejection:');
    if (!message) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/faculty/submissions/approve-reject', {
        researchId,
        fileId,
        action: 'rejected',
        message
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      fetchStudentSubmissions();
      alert('Submission rejected with feedback.');
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
    localStorage.removeItem('token');
    sessionStorage.removeItem('selectedRole');
    navigate('/');
  };

  const tabs = [
    { id: "submissions", label: "Student Submissions", icon: <FaClipboardList /> },
    { id: "feedback", label: "Feedback Management", icon: <FaFileAlt /> },
    { id: "schedule", label: "Consultation Schedule", icon: <FaCalendar /> },
    { id: "students", label: "My Students", icon: <FaUsers /> },
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
      case "schedule":
        return <ConsultationSchedule schedules={schedules} />;
      case "students":
        return <StudentList 
          students={students} 
          onUpdateStatus={handleUpdateThesisStatus}
          loading={loading}
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
const StudentSubmissions = ({ submissions, onApprove, onReject, loading }) => (
  <div className="space-y-5">
    <div className="flex justify-between items-center">
      <h2 className="text-xl font-bold text-gray-800">Student Submissions</h2>
      <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
        {submissions.filter(s => s.forms?.some(f => f.status === 'pending')).length} Pending Reviews
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
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3">
                  <div className="h-12 w-12 rounded-full bg-[#7C1D23] flex items-center justify-center text-white font-semibold text-lg">
                    {research.students?.[0]?.name?.charAt(0) || 'S'}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-gray-800">{research.students?.[0]?.name || 'Student'}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {research.title} • Stage: {research.stage}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Last updated: {new Date(research.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="mt-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    research.status === "in-progress" 
                      ? "bg-blue-100 text-blue-700" 
                      : research.status === "pending"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-green-100 text-green-700"
                  }`}>
                    {research.status}
                  </span>
                </div>
              </div>
              <div className="flex space-x-2">
                <button 
                  onClick={() => onApprove(research._id, research.forms?.[0]?._id)}
                  disabled={loading}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  <FaCheckCircle className="mr-2 text-sm" />
                  Approve
                </button>
                <button 
                  onClick={() => onReject(research._id, research.forms?.[0]?._id)}
                  disabled={loading}
                  className="flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  <FaTimesCircle className="mr-2 text-sm" />
                  Reject
                </button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  </div>
);

// Feedback Management Component
const FeedbackManagement = () => (
  <div className="space-y-5">
    <h2 className="text-xl font-bold text-gray-800">Feedback Management</h2>
    <div className="bg-gray-50 rounded-lg border border-gray-200 p-8">
      <p className="text-gray-500 text-center text-sm">Feedback management interface coming soon.</p>
    </div>
  </div>
);

// Consultation Schedule Component
const ConsultationSchedule = ({ schedules }) => (
  <div className="space-y-5">
    <h2 className="text-xl font-bold text-gray-800">Consultation Schedule</h2>
    
    <div className="space-y-4">
      {schedules.length === 0 ? (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-8">
          <p className="text-gray-500 text-center text-sm">No consultation schedules yet.</p>
        </div>
      ) : (
        schedules.map((schedule) => (
          <div key={schedule._id} className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-800">{schedule.title}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  with {schedule.participants?.find(p => p.role === 'student')?.user?.name || 'Student'}
                </p>
                <p className="text-sm text-gray-500 mt-1">{schedule.location}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-[#7C1D23]">
                  {new Date(schedule.datetime).toLocaleDateString()}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  {new Date(schedule.datetime).toLocaleTimeString()}
                </p>
                <span className={`mt-2 px-2 py-1 rounded-full text-xs font-medium ${
                  schedule.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                  schedule.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {schedule.status}
                </span>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  </div>
);

// Student List Component
const StudentList = ({ students, onUpdateStatus, loading }) => {
  const [assignedResearch, setAssignedResearch] = useState([]);
  const [detailedView, setDetailedView] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

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
    setDetailedView(true);
  };

  if (detailedView && selectedStudent) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
        <div className="bg-white rounded-lg shadow-lg max-w-3xl w-full p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Research Details</h3>
            <button
              onClick={() => setDetailedView(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <FaClose className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="text-md font-semibold text-gray-800">Research Title</h4>
              <p className="text-gray-700">{selectedStudent.title}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="text-md font-semibold text-gray-800">Student Information</h4>
                {selectedStudent.students.map((student, index) => (
                  <div key={student._id} className="mt-2">
                    <p className="text-gray-700">
                      {student.name} ({student.email})
                    </p>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="text-md font-semibold text-gray-800">Status & Progress</h4>
                <div className="mt-2">
                  <p className="text-gray-700">
                    Status:{" "}
                    <span className={`font-semibold ${
                      selectedStudent.status === 'in-progress' ? 'text-blue-600' :
                      selectedStudent.status === 'pending' ? 'text-yellow-600' :
                      'text-green-600'
                    }`}>
                      {selectedStudent.status}
                    </span>
                  </p>
                  <p className="text-gray-700">
                    Progress: {selectedStudent.progress || 0}%
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  onUpdateStatus(selectedStudent._id, 'in-progress', selectedStudent.stage, selectedStudent.progress);
                  setDetailedView(false);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Update Status
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
                        'bg-green-100 text-green-700'
                      }`}>
                        {research.status}
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
                  View Details
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default FacultyAdviserDashboard;
