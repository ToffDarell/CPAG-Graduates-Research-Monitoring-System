import React, { useState, useEffect } from "react";
import { FaUsersCog, FaCalendarAlt, FaClipboardCheck, FaChartLine, FaFileAlt, FaBell, FaSignOutAlt, FaBars, FaTimes as FaClose } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const ProgramHeadDashboard = ({setUser}) => {
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState("panels");
  const [panelMembers, setPanelMembers] = useState([
    { id: 1, name: "Dr. Smith", role: "Chair", status: "Assigned" },
    { id: 2, name: "Dr. Johnson", role: "Member", status: "Pending" },
  ]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    { id: "panels", label: "Panel Selection", icon: <FaUsersCog /> },
    { id: "advisers", label: "Faculty Adviser Assignment", icon: <FaUsersCog /> },
    { id: "schedules", label: "Schedule Management", icon: <FaCalendarAlt /> },
    { id: "monitoring", label: "Process Monitoring", icon: <FaChartLine /> },
    { id: "forms", label: "Forms & Documents", icon: <FaFileAlt /> },
    { id: "records", label: "Research Records", icon: <FaClipboardCheck /> },
  ];

  const renderContent = () => {
    switch (selectedTab) {
      case "panels":
        return <PanelSelection members={panelMembers} />;
      case "advisers":
        return <FacultyAdviserAssignment />;
      case "schedules":
        return <ScheduleManagement />;
      case "monitoring":
        return <ProcessMonitoring />;
      case "forms":
        return <FormsManagement />;
      case "records":
        return <ResearchRecords />;
      default:
        return null 
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
              <h2 className="text-lg font-bold text-white">Program Head</h2>
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
                  <h1 className="text-3xl font-bold mb-1">Program Head Dashboard</h1>
                  <p className="text-gray-100 text-sm">Coordinate panels, schedules, and monitor research progress</p>
                </div>
                <div className="hidden md:block">
                  <div className="bg-white/10 rounded-lg p-3">
                    <FaUsersCog className="h-12 w-12 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <StatCard
            title="Panel Members"
            value={panelMembers.length}
            icon={<FaUsersCog className="h-6 w-6 " />}
            color="maroon"
          />
          <StatCard
            title="Scheduled Defenses"
            value="8"
            icon={<FaCalendarAlt className="h-6 w-6" />}
            color="blue"
          />
          <StatCard
            title="Pending Approvals"
            value="4"
            icon={<FaClipboardCheck className="h-6 w-6" />}
            color="gold"
          />
          <StatCard
            title="Active Research"
            value="15"
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

// Panel Selection Component
const PanelSelection = ({ members }) => (
  <div className="space-y-5">
    <div className="flex justify-between items-center">
      <h2 className="text-xl font-bold text-gray-800">Panel Member Selection</h2>
      <button className="flex items-center px-4 py-2 bg-[#7C1D23] text-white rounded-md hover:bg-[#5a1519] transition-colors text-sm font-medium">
        <FaUsersCog className="mr-2 text-sm" />
        Assign Panel
      </button>
    </div>

    <div className="grid gap-4">
      {members.map((member) => (
        <div key={member.id} className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="h-12 w-12 rounded-full bg-[#7C1D23] flex items-center justify-center text-white font-semibold text-lg">
                {member.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-800">{member.name}</h3>
                <p className="text-sm text-gray-600">{member.role}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                member.status === "Assigned" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
              }`}>
                {member.status}
              </span>
              <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-sm font-medium">
                Edit
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>

    <div className="bg-gray-50 rounded-lg border border-gray-200 p-5">
      <h3 className="text-base font-semibold text-gray-800 mb-4">Add New Panel Member</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <input
          type="text"
          placeholder="Faculty Name"
          className="px-4 py-2 rounded-md border border-gray-300 focus:border-[#7C1D23] focus:ring-2 focus:ring-[#7C1D23]/20 transition-all text-sm"
        />
        <select className="px-4 py-2 rounded-md border border-gray-300 focus:border-[#7C1D23] focus:ring-2 focus:ring-[#7C1D23]/20 transition-all text-sm">
          <option>Select Role</option>
          <option>Chair</option>
          <option>Member</option>
          <option>External Examiner</option>
        </select>
        <button className="bg-[#7C1D23] text-white px-6 py-2 rounded-md font-medium hover:bg-[#5a1519] transition-all text-sm">
          Add Member
        </button>
      </div>
    </div>
  </div>
  
);

// Schedule Management Component
const ScheduleManagement = () => (
  <div className="space-y-5">
    <div className="flex justify-between items-center">
      <h2 className="text-xl font-bold text-gray-800">Schedule Management</h2>
      <button className="flex items-center px-4 py-2 bg-[#7C1D23] text-white rounded-md hover:bg-[#5a1519] transition-colors text-sm font-medium">
        <FaCalendarAlt className="mr-2 text-sm" />
        Create Schedule
      </button>
    </div>

    <div className="grid gap-4">
      <div className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="text-base font-semibold text-gray-800">Thesis Defense - John Doe</h3>
            <p className="text-sm text-gray-600 mt-1">Panel: Dr. Smith (Chair), Dr. Johnson, Dr. Williams</p>
            <p className="text-sm text-gray-500 mt-1">Room 301, Research Building</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-[#7C1D23]">March 25, 2024</p>
            <p className="text-sm text-gray-600 mt-1">2:00 PM - 4:00 PM</p>
            <div className="mt-3 flex space-x-2">
              <button className="px-3 py-1 bg-green-600 text-white rounded-md text-xs font-medium hover:bg-green-700 transition-colors">
                Approve
              </button>
              <button className="px-3 py-1 bg-gray-600 text-white rounded-md text-xs font-medium hover:bg-gray-700 transition-colors">
                Reschedule
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="text-base font-semibold text-gray-800">Proposal Defense - Jane Smith</h3>
            <p className="text-sm text-gray-600 mt-1">Panel: Dr. Brown (Chair), Dr. Davis</p>
            <p className="text-sm text-gray-500 mt-1">Online via Zoom</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-[#1E3A8A]">March 28, 2024</p>
            <p className="text-sm text-gray-600 mt-1">10:00 AM - 12:00 PM</p>
            <div className="mt-3 flex space-x-2">
              <button className="px-3 py-1 bg-green-600 text-white rounded-md text-xs font-medium hover:bg-green-700 transition-colors">
                Approve
              </button>
              <button className="px-3 py-1 bg-gray-600 text-white rounded-md text-xs font-medium hover:bg-gray-700 transition-colors">
                Reschedule
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// Process Monitoring Component
const ProcessMonitoring = () => (
  <div className="space-y-5">
    <h2 className="text-xl font-bold text-gray-800">Research Process Monitoring</h2>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      <div className="bg-white rounded-lg border-l-4 border-green-600 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-600 uppercase">Completed</h3>
          <FaClipboardCheck className="h-6 w-6 text-green-600" />
        </div>
        <p className="text-3xl font-bold text-gray-800">8</p>
        <p className="text-xs text-gray-500 mt-1">Research projects</p>
      </div>

      <div className="bg-white rounded-lg border-l-4 border-[#D4AF37] p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-600 uppercase">In Progress</h3>
          <FaChartLine className="h-6 w-6 text-[#D4AF37]" />
        </div>
        <p className="text-3xl font-bold text-gray-800">15</p>
        <p className="text-xs text-gray-500 mt-1">Research projects</p>
      </div>

      <div className="bg-white rounded-lg border-l-4 border-[#1E3A8A] p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-600 uppercase">Pending</h3>
          <FaBell className="h-6 w-6 text-[#1E3A8A]" />
        </div>
        <p className="text-3xl font-bold text-gray-800">4</p>
        <p className="text-xs text-gray-500 mt-1">Awaiting approval</p>
      </div>
    </div>

    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h3 className="text-base font-semibold text-gray-800 mb-4">Recent Activities</h3>
      <div className="space-y-2">
        <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-md">
          <div className="h-2 w-2 bg-green-500 rounded-full flex-shrink-0"></div>
          <p className="text-sm text-gray-700 flex-1">John Doe submitted Chapter 3 for review</p>
          <span className="text-xs text-gray-500">2 hours ago</span>
        </div>
        <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-md">
          <div className="h-2 w-2 bg-blue-500 rounded-full flex-shrink-0"></div>
          <p className="text-sm text-gray-700 flex-1">Defense schedule approved for Jane Smith</p>
          <span className="text-xs text-gray-500">5 hours ago</span>
        </div>
        <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-md">
          <div className="h-2 w-2 bg-yellow-500 rounded-full flex-shrink-0"></div>
          <p className="text-sm text-gray-700 flex-1">New panel member assigned to Research #12</p>
          <span className="text-xs text-gray-500">1 day ago</span>
        </div>
      </div>
    </div>
  </div>
);

// Forms Management Component
const FormsManagement = () => (
  <div className="space-y-5">
    <div className="flex justify-between items-center">
      <h2 className="text-xl font-bold text-gray-800">Forms & Documents</h2>
      <button className="flex items-center px-4 py-2 bg-[#7C1D23] text-white rounded-md hover:bg-[#5a1519] transition-colors text-sm font-medium">
        <FaFileAlt className="mr-2 text-sm" />
        Upload Form
      </button>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {[
        { name: "Research Proposal Form", count: 12, color: "[#1E3A8A]" },
        { name: "Ethics Clearance Form", count: 8, color: "green-600" },
        { name: "Defense Schedule Form", count: 5, color: "[#7C1D23]" },
        { name: "Compliance Certificate", count: 15, color: "[#D4AF37]" },
      ].map((form, index) => (
        <div key={index} className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-800">{form.name}</h3>
              <p className="text-sm text-gray-600 mt-1">{form.count} documents</p>
            </div>
            <FaFileAlt className={`h-7 w-7 text-${form.color}`} />
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Faculty Adviser Assignment Component
const FacultyAdviserAssignment = () => {
  const [researchTitles, setResearchTitles] = useState([]);
  const [availableAdvisers, setAvailableAdvisers] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newResearch, setNewResearch] = useState({
    title: '',
    selectedStudents: []
  });

  // Fetch data on component mount
  useEffect(() => {
    fetchResearchTitles();
    fetchAvailableAdvisers();
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      console.log("Fetching students...");
      const res = await axios.get('/api/programhead/students', {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log("API Response:", res.data);
      setStudents(res.data);
    } catch (error) {
      console.error('Error fetching students:', error.response || error);
      alert('Error fetching students: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchResearchTitles = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/programhead/research', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResearchTitles(res.data);
    } catch (error) {
      console.error('Error fetching research titles:', error);
    }
  };

  const fetchAvailableAdvisers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/programhead/advisers', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAvailableAdvisers(res.data);
    } catch (error) {
      console.error('Error fetching advisers:', error);
    }
  };

  const handleCreateResearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/programhead/research', {
        title: newResearch.title,
        studentIds: newResearch.selectedStudents
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Reset form and refresh data
      setNewResearch({ title: '', selectedStudents: [] });
      fetchResearchTitles();
      alert('Research title created successfully!');
    } catch (error) {
      console.error('Error creating research:', error);
      alert('Error creating research title');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignAdviser = async (researchId, adviserId) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/programhead/assign-adviser', {
        researchId,
        adviserId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Refresh data to get updated information
      fetchResearchTitles();
      alert('Adviser assigned successfully!');
    } catch (error) {
      console.error('Error assigning adviser:', error);
      alert('Error assigning adviser');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAdviser = async (researchId) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/programhead/remove-adviser', {
        researchId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Refresh data to get updated information
      fetchResearchTitles();
      alert('Adviser removed successfully!');
    } catch (error) {
      console.error('Error removing adviser:', error);
      alert('Error removing adviser');
    } finally {
      setLoading(false);
    }
  };

  const handleAddStudents = async (researchId, studentIds) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/programhead/research/add-students', {
        researchId,
        studentIds
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      fetchResearchTitles();
      alert('Students added successfully!');
    } catch (error) {
      console.error('Error adding students:', error);
      alert('Error adding students');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteResearch = async (researchId) => {
    if (!window.confirm('Are you sure you want to delete this research title? This action cannot be undone.')) {
      return;
    }
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/programhead/research/${researchId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      fetchResearchTitles();
      alert('Research title deleted successfully!');
    } catch (error) {
      console.error('Error deleting research:', error);
      alert('Error deleting research title: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // Update the select element in the form
  return (
    <div className="space-y-5">
      {/* Create New Research Title Form */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Create New Research Title</h3>
        <form onSubmit={handleCreateResearch} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Research Title</label>
            <input
              type="text"
              value={newResearch.title}
              onChange={(e) => setNewResearch(prev => ({ ...prev, title: e.target.value }))}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#7C1D23] focus:ring-[#7C1D23]"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Select Students</label>
            <div className="mt-1">
              {loading ? (
                <p className="text-sm text-gray-500">Loading students...</p>
              ) : students.length === 0 ? (
                <p className="text-sm text-red-500">No graduate students found</p>
              ) : (
                <select
                  multiple
                  value={newResearch.selectedStudents}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value);
                    console.log("Selected students:", selected);
                    setNewResearch(prev => ({
                      ...prev,
                      selectedStudents: selected
                    }));
                  }}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#7C1D23] focus:ring-[#7C1D23] min-h-[100px]"
                >
                  {students.length === 0 ? (
                    <option disabled>No students found</option>
                  ) : (
                    students.map(student => (
                      <option 
                        key={student._id} 
                        value={student._id}
                        className="py-1"
                      >
                        {student.name} ({student.email})
                      </option>
                    ))
                  )
                  }
                </select>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Hold Ctrl (Windows) or Command (Mac) to select multiple students
              </p>
            </div>
          </div>

          {/* Show selected students */}
          {newResearch.selectedStudents.length > 0 && (
            <div className="mt-2">
              <p className="text-sm font-medium text-gray-700">Selected Students:</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {newResearch.selectedStudents.map(studentId => {
                  const student = students.find(s => s._id === studentId);
                  return student ? (
                    <span 
                      key={studentId}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-[#7C1D23] text-white"
                    >
                      {student.name}
                    </span>
                  ) : null;
                })}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#7C1D23] text-white px-4 py-2 rounded-md hover:bg-[#5a1519] transition-colors disabled:opacity-50"
          >
            Create Research Title
          </button>
        </form>
      </div>

      {/* Existing Research Titles List */}
      <div className="space-y-4">
        {researchTitles.length === 0 ? (
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-8">
            <p className="text-gray-500 text-center text-sm">No research titles found.</p>
          </div>
        ) : (
          researchTitles.map((research) => (
            <div key={research._id} className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <div className="h-12 w-12 rounded-full bg-[#7C1D23] flex items-center justify-center text-white font-semibold text-lg">
                      {research.students?.[0]?.name?.charAt(0) || 'S'}
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-gray-800">{research.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Student: {research.students?.[0]?.name || 'No student assigned'}
                      </p>
                      {research.adviser && (
                        <p className="text-sm text-green-600 mt-1">Adviser: {research.adviser.name}</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      research.adviser 
                        ? "bg-green-100 text-green-700" 
                        : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {research.adviser ? "Adviser Assigned" : "Pending Assignment"}
                    </span>
                  </div>
                </div>
                <div className="flex space-x-2">
                  {!research.adviser ? (
                    <select
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:border-[#7C1D23] focus:ring-2 focus:ring-[#7C1D23]/20"
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAssignAdviser(research._id, e.target.value);
                        }
                      }}
                      disabled={loading}
                    >
                      <option value="">Select Adviser</option>
                      {availableAdvisers.map((adviser) => (
                        <option key={adviser._id} value={adviser._id}>
                          {adviser.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <button 
                      onClick={() => handleRemoveAdviser(research._id)}
                      disabled={loading}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
                    >
                      Remove Adviser
                    </button>
                  )}
                  <button 
                    onClick={() => handleDeleteResearch(research._id)}
                    disabled={loading}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Available Advisers Info */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-5">
        <h3 className="text-base font-semibold text-gray-800 mb-4">Available Faculty Advisers</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {availableAdvisers.length === 0 ? (
            <div className="col-span-2 bg-white rounded-lg p-4 border border-gray-200">
              <p className="text-gray-500 text-center text-sm">No faculty advisers available.</p>
            </div>
          ) : (
            availableAdvisers.map((adviser) => (
              <div key={adviser._id} className="bg-white rounded-lg p-4 border border-gray-200">
                <h4 className="text-sm font-semibold text-gray-800">{adviser.name}</h4>
                <p className="text-xs text-gray-500 mt-1">{adviser.email}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// Research Records Component
const ResearchRecords = () => {
  const [researchRecords, setResearchRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch research records on component mount
  useEffect(() => {
    fetchResearchRecords();
  }, []);

  const fetchResearchRecords = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/programhead/research', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResearchRecords(res.data);
    } catch (error) {
      console.error('Error fetching research records:', error);
    }
  };

  const handleShareWithDean = async (researchId) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/programhead/share-with-dean', {
        researchId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert('Research record shared with Dean successfully!');
    } catch (error) {
      console.error('Error sharing with Dean:', error);
      alert('Error sharing research record with Dean');
    } finally {
      setLoading(false);
    }
  };

  const handleArchiveResearch = async (researchId) => {
    if (!window.confirm('Are you sure you want to archive this research?')) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(`/api/programhead/archive/${researchId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      fetchResearchRecords();
      alert('Research archived successfully!');
    } catch (error) {
      console.error('Error archiving research:', error);
      alert('Error archiving research');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">Research Records Management</h2>
        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
          {researchRecords.length} Total Records
        </span>
      </div>

      {/* Research Records List */}
      <div className="space-y-4">
        {researchRecords.length === 0 ? (
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-8">
            <p className="text-gray-500 text-center text-sm">No research records found.</p>
          </div>
        ) : (
          researchRecords.map((research) => (
            <div key={research._id} className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-start space-x-4">
                    <div className="h-12 w-12 rounded-full bg-[#7C1D23] flex items-center justify-center text-white font-semibold text-lg">
                      {research.students?.[0]?.name?.charAt(0) || 'R'}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-800">{research.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Student: {research.students?.[0]?.name || 'No student assigned'}
                      </p>
                      {research.adviser && (
                        <p className="text-sm text-green-600 mt-1">Adviser: {research.adviser.name}</p>
                      )}
                      <div className="mt-2 flex items-center space-x-4">
                        <span className="text-xs text-gray-500">Stage: {research.stage}</span>
                        <span className="text-xs text-gray-500">Progress: {research.progress}%</span>
                        <span className="text-xs text-gray-500">
                          Created: {new Date(research.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="mt-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          research.status === 'completed' ? 'bg-green-100 text-green-700' :
                          research.status === 'in-progress' ? 'bg-blue-100 text-blue-700' :
                          research.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {research.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col space-y-2">
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Last Updated</p>
                    <p className="text-sm font-medium text-gray-600">
                      {new Date(research.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => handleShareWithDean(research._id)}
                      disabled={loading}
                      className="px-3 py-1 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      Share with Dean
                    </button>
                    <button 
                      onClick={() => handleArchiveResearch(research._id)}
                      disabled={loading}
                      className="px-3 py-1 bg-gray-600 text-white rounded-md text-xs font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
                    >
                      Archive
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Summary Statistics */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-5">
        <h3 className="text-base font-semibold text-gray-800 mb-4">Research Records Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4 text-center border border-gray-200">
            <p className="text-2xl font-bold text-blue-600">
              {researchRecords.filter(r => r.status === 'in-progress').length}
            </p>
            <p className="text-xs text-gray-600 mt-1 uppercase font-semibold">In Progress</p>
          </div>
          <div className="bg-white rounded-lg p-4 text-center border border-gray-200">
            <p className="text-2xl font-bold text-green-600">
              {researchRecords.filter(r => r.status === 'completed').length}
            </p>
            <p className="text-xs text-gray-600 mt-1 uppercase font-semibold">Completed</p>
          </div>
          <div className="bg-white rounded-lg p-4 text-center border border-gray-200">
            <p className="text-2xl font-bold text-yellow-600">
              {researchRecords.filter(r => r.status === 'pending').length}
            </p>
            <p className="text-xs text-gray-600 mt-1 uppercase font-semibold">Pending</p>
          </div>
          <div className="bg-white rounded-lg p-4 text-center border border-gray-200">
            <p className="text-2xl font-bold text-gray-600">
              {researchRecords.filter(r => r.adviser).length}
            </p>
            <p className="text-xs text-gray-600 mt-1 uppercase font-semibold">With Adviser</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgramHeadDashboard;
