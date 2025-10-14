import React, { useState, useEffect } from 'react';
import { FaUsers, FaFolder, FaArchive, FaChartBar, FaUsersCog, FaFileAlt, FaPlus, FaSearch, FaEdit, FaTrash, FaTimes, FaSignOutAlt, FaBars, FaTimes as FaClose } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const DeanDashboard = () => {
  const navigate = useNavigate();
  const [facultyList, setFacultyList] = useState([]);
  const [researchList, setResearchList] = useState([]);
  const [researchStats, setResearchStats] = useState({
    total: 0,
    approved: 0,
    pending: 0,
    archived: 0
  });
  const [selectedTab, setSelectedTab] = useState('faculty');
  const [loading, setLoading] = useState(false);
  const [showAddFacultyModal, setShowAddFacultyModal] = useState(false);
  const [showEditFacultyModal, setShowEditFacultyModal] = useState(false);
  const [editingFaculty, setEditingFaculty] = useState(null);
  const [newFaculty, setNewFaculty] = useState({
    name: '',
    email: '',
    role: 'faculty adviser'
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Fetch data on component mount
  useEffect(() => {
    fetchFaculty();
    fetchResearch();
    fetchAnalytics();
  }, []);

  const fetchFaculty = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/dean/faculty', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFacultyList(res.data);
    } catch (error) {
      console.error('Error fetching faculty:', error);
    }
  };

  const fetchResearch = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/dean/research', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResearchList(res.data);
    } catch (error) {
      console.error('Error fetching research:', error);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/dean/analytics', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResearchStats(res.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const handleAddFaculty = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('/api/dean/invite-faculty', newFaculty, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowAddFacultyModal(false);
      setNewFaculty({ name: '', email: '', role: 'faculty adviser' });
      fetchFaculty();
      alert(res.data.message || 'Invitation sent successfully! Faculty member will receive an email to complete registration.');
    } catch (error) {
      alert(error.response?.data?.message || 'Error sending invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleEditFaculty = (faculty) => {
    setEditingFaculty(faculty);
    setShowEditFacultyModal(true);
  };

  const handleUpdateFaculty = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.put(`/api/dean/faculty/${editingFaculty._id}`, editingFaculty, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowEditFacultyModal(false);
      setEditingFaculty(null);
      fetchFaculty();
      alert('Faculty updated successfully!');
    } catch (error) {
      alert(error.response?.data?.message || 'Error updating faculty');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFaculty = async (id) => {
    if (!window.confirm('Are you sure you want to remove this faculty member?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/dean/faculty/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchFaculty();
      alert('Faculty removed successfully!');
    } catch (error) {
      alert('Error removing faculty');
    }
  };

  const handleArchiveResearch = async (id) => {
    if (!window.confirm('Are you sure you want to archive this research?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.put(`/api/dean/archive/${id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchResearch();
      fetchAnalytics();
      alert('Research archived successfully!');
    } catch (error) {
      alert('Error archiving research');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('selectedRole');
    navigate('/');
  };

  const filteredFaculty = facultyList.filter(faculty =>
    faculty.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faculty.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Tabs for different functionalities
  const tabs = [
    { id: 'faculty', label: 'Faculty Management', icon: <FaUsers /> },
    { id: 'research', label: 'Research Records', icon: <FaFolder /> },
    { id: 'archive', label: 'Archive', icon: <FaArchive /> },
    { id: 'monitoring', label: 'Monitoring', icon: <FaChartBar /> },
    { id: 'panels', label: 'Panel Assignment', icon: <FaUsersCog /> },
    { id: 'documents', label: 'Documents', icon: <FaFileAlt /> }
  ];

  const renderContent = () => {
    switch(selectedTab) {
      case 'faculty':
        return <FacultyManagement 
          faculty={filteredFaculty} 
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onAdd={() => setShowAddFacultyModal(true)}
          onEdit={handleEditFaculty}
          onDelete={handleDeleteFaculty}
        />;
      case 'research':
        return <ResearchRecords stats={researchStats} research={researchList} />;
      case 'archive':
        return <ArchiveProjects research={researchList.filter(r => r.status === 'archived')} />;
      case 'monitoring':
        return <MonitoringEvaluation research={researchList} />;
      case 'panels':
        return <PanelAssignment research={researchList} faculty={facultyList} />;
      case 'documents':
        return <DocumentManagement />;
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
              <h2 className="text-lg font-bold text-white">Dean</h2>
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
                  <h1 className="text-3xl font-bold mb-1">Dean Dashboard</h1>
                  <p className="text-gray-100 text-sm">Manage faculty, research records, and system operations</p>
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

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <StatCard
            title="Total Faculty"
            value={facultyList.length}
            icon={<FaUsers className="h-6 w-6" />}
            color="maroon"
          />
          <StatCard
            title="Active Research"
            value={researchStats.approved || 0}
            icon={<FaFolder className="h-6 w-6" />}
            color="blue"
          />
          <StatCard
            title="Archived Projects"
            value={researchStats.archived || 0}
            icon={<FaArchive className="h-6 w-6" />}
            color="gold"
          />
          <StatCard
            title="Pending Reviews"
            value={researchStats.pending || 0}
            icon={<FaFileAlt className="h-6 w-6" />}
            color="gray"
          />
        </div>

        {/* Main Content Card */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
          {/* Content Area */}
          <div className="p-6 bg-white">
            {renderContent()}
          </div>
        </div>
      </div>

      {/* Add Faculty Modal */}
      {showAddFacultyModal && (
        <div className="fixed inset-0 bg-gray-50 bg-opacity-95 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full border border-gray-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#7C1D23] to-[#5a1519] text-white p-4 rounded-t-lg">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold">Add New Faculty</h3>
                <button 
                  onClick={() => setShowAddFacultyModal(false)} 
                  className="text-white hover:text-gray-200 transition-colors"
                >
                  <FaTimes className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <form onSubmit={handleAddFaculty}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                    <input
                      type="text"
                      required
                      value={newFaculty.name}
                      onChange={(e) => setNewFaculty({...newFaculty, name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-[#7C1D23] transition-colors"
                      placeholder="Enter faculty name"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Institutional Email</label>
                    <input
                      type="email"
                      required
                      value={newFaculty.email}
                      onChange={(e) => setNewFaculty({...newFaculty, email: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-[#7C1D23] transition-colors"
                      placeholder="faculty@buksu.edu.ph"
                    />
                    <p className="text-xs text-gray-500 mt-1">An invitation email will be sent to this address</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                    <select
                      value={newFaculty.role}
                      onChange={(e) => setNewFaculty({...newFaculty, role: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-[#7C1D23] transition-colors"
                    >
                      <option value="faculty adviser">Faculty Adviser</option>
                      <option value="program head">Program Head</option>
                    </select>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="flex space-x-3 mt-6 pt-4 border-t border-gray-200">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-[#7C1D23] text-white py-2 px-4 rounded-md hover:bg-[#5a1519] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Sending Invitation...' : 'Send Invitation'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddFacultyModal(false)}
                    className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-300 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Faculty Modal */}
      {showEditFacultyModal && editingFaculty && (
        <div className="fixed inset-0 bg-gray-50 bg-opacity-95 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full border border-gray-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#7C1D23] to-[#5a1519] text-white p-4 rounded-t-lg">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold">Edit Faculty</h3>
                <button 
                  onClick={() => setShowEditFacultyModal(false)} 
                  className="text-white hover:text-gray-200 transition-colors"
                >
                  <FaTimes className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <form onSubmit={handleUpdateFaculty}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                    <input
                      type="text"
                      required
                      value={editingFaculty.name}
                      onChange={(e) => setEditingFaculty({...editingFaculty, name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-[#7C1D23] transition-colors"
                      placeholder="Enter faculty name"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <input
                      type="email"
                      required
                      value={editingFaculty.email}
                      onChange={(e) => setEditingFaculty({...editingFaculty, email: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-[#7C1D23] transition-colors"
                      placeholder="faculty@buksu.edu.ph"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                    <select
                      value={editingFaculty.role}
                      onChange={(e) => setEditingFaculty({...editingFaculty, role: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-[#7C1D23] transition-colors"
                    >
                      <option value="faculty adviser">Faculty Adviser</option>
                      <option value="program head">Program Head</option>
                    </select>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="flex space-x-3 mt-6 pt-4 border-t border-gray-200">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-[#7C1D23] text-white py-2 px-4 rounded-md hover:bg-[#5a1519] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Updating...' : 'Update Faculty'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEditFacultyModal(false)}
                    className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-300 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

// Enhanced Stat Card Component
const StatCard = ({ title, value, icon, color, trend }) => {
  const colorClasses = {
    maroon: { bg: 'bg-[#7C1D23]', text: 'text-[#7C1D23]', border: 'border-[#7C1D23]' },
    blue: { bg: 'bg-[#1E3A8A]', text: 'text-[#1E3A8A]', border: 'border-[#1E3A8A]' },
    gold: { bg: 'bg-[#D4AF37]', text: 'text-[#D4AF37]', border: 'border-[#D4AF37]' },
    gray: { bg: 'bg-gray-600', text: 'text-gray-600', border: 'border-gray-600' }
  };

  return (
    <div className="bg-white overflow-hidden rounded-lg shadow-md hover:shadow-lg transition-all duration-300 border border-gray-200">
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</p>
            <p className="mt-2 text-2xl font-bold text-gray-800">{value}</p>
            {trend && (
              <p className={`mt-1 text-xs font-medium ${trend.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                {trend} from last month
              </p>
            )}
          </div>
          <div className={`p-3 rounded-lg ${colorClasses[color].bg}`}>
            <div className="text-white">{icon}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Placeholder components for different sections
const FacultyManagement = ({ faculty, searchQuery, setSearchQuery, onAdd, onEdit, onDelete }) => (
  <div className="space-y-5">
    <div className="flex justify-between items-center">
      <h2 className="text-xl font-bold text-gray-800">Faculty Management</h2>
      <button 
        onClick={onAdd}
        className="flex items-center px-4 py-2 bg-[#7C1D23] text-white rounded-md hover:bg-[#5a1519] transition-colors text-sm font-medium"
      >
        <FaPlus className="mr-2 text-sm" />
        Add Faculty
      </button>
    </div>
    <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
      <div className="p-4 bg-white border-b border-gray-200">
        <div className="relative">
          <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search faculty..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-[#7C1D23] text-sm"
          />
        </div>
      </div>
      <div className="p-4">
        {faculty.length === 0 ? (
          <p className="text-gray-500 text-center text-sm py-8">No faculty members found.</p>
        ) : (
          <div className="space-y-3">
            {faculty.map((member) => (
              <div key={member._id} className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between hover:shadow-md transition-shadow">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-full bg-[#7C1D23] flex items-center justify-center text-white font-semibold">
                    {member.name?.charAt(0) || 'F'}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-800">{member.name}</h3>
                    <p className="text-xs text-gray-600">{member.email}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                      {member.role}
                    </span>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => onEdit(member)}
                    className="p-2 text-gray-600 hover:text-[#7C1D23] transition-colors"
                  >
                    <FaEdit className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => onDelete(member._id)}
                    className="p-2 text-gray-600 hover:text-red-600 transition-colors"
                  >
                    <FaTrash className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
);

const ResearchRecords = ({ stats, research }) => (
  <div className="space-y-5">
    <h2 className="text-xl font-bold text-gray-800">Research Records</h2>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-white p-5 rounded-lg border-l-4 border-[#7C1D23] shadow-sm">
        <h3 className="text-sm font-semibold text-gray-600 uppercase">Total Research</h3>
        <p className="text-3xl font-bold text-gray-800 mt-2">{stats.total || 0}</p>
      </div>
      <div className="bg-white p-5 rounded-lg border-l-4 border-[#1E3A8A] shadow-sm">
        <h3 className="text-sm font-semibold text-gray-600 uppercase">Approved</h3>
        <p className="text-3xl font-bold text-gray-800 mt-2">{stats.approved || 0}</p>
      </div>
      <div className="bg-white p-5 rounded-lg border-l-4 border-[#D4AF37] shadow-sm">
        <h3 className="text-sm font-semibold text-gray-600 uppercase">Pending</h3>
        <p className="text-3xl font-bold text-gray-800 mt-2">{stats.pending || 0}</p>
      </div>
    </div>
    <div className="bg-white rounded-lg border border-gray-200 p-4 mt-4">
      <h3 className="text-base font-semibold text-gray-800 mb-4">All Research Projects</h3>
      {research.length === 0 ? (
        <p className="text-gray-500 text-center text-sm py-8">No research projects yet.</p>
      ) : (
        <div className="space-y-3">
          {research.map((item) => (
            <div key={item._id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-sm font-semibold text-gray-800">{item.title}</h4>
                  <p className="text-xs text-gray-600 mt-1">
                    Student: {item.students?.[0]?.name || 'N/A'} • Adviser: {item.adviser?.name || 'N/A'}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  item.status === 'approved' ? 'bg-green-100 text-green-700' :
                  item.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                  item.status === 'archived' ? 'bg-gray-100 text-gray-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {item.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);

const ArchiveProjects = ({ research }) => (
  <div className="space-y-5">
    <h2 className="text-xl font-bold text-gray-800">Archived Projects</h2>
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      {research.length === 0 ? (
        <p className="text-gray-500 text-center text-sm py-8">No archived projects yet.</p>
      ) : (
        <div className="space-y-3">
          {research.map((item) => (
            <div key={item._id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <h4 className="text-sm font-semibold text-gray-800">{item.title}</h4>
              <p className="text-xs text-gray-600 mt-1">
                Student: {item.students?.[0]?.name || 'N/A'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Archived: {new Date(item.updatedAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);

const MonitoringEvaluation = ({ research }) => (
  <div className="space-y-5">
    <h2 className="text-xl font-bold text-gray-800">Monitoring & Evaluation</h2>
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      {research.length === 0 ? (
        <p className="text-gray-500 text-center text-sm py-8">No research to monitor.</p>
      ) : (
        <div className="space-y-3">
          {research.map((item) => (
            <div key={item._id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-sm font-semibold text-gray-800">{item.title}</h4>
                  <p className="text-xs text-gray-600 mt-1">Status: {item.status} • Stage: {item.stage || 'N/A'}</p>
                </div>
                <div className="text-xs text-gray-500">
                  Updated: {new Date(item.updatedAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);

const PanelAssignment = ({ research, faculty }) => (
  <div className="space-y-5">
    <h2 className="text-xl font-bold text-gray-800">Panel Assignment</h2>
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      {research.length === 0 ? (
        <p className="text-gray-500 text-center text-sm py-8">No research available for panel assignment.</p>
      ) : (
        <div className="space-y-3">
          {research.filter(r => r.status === 'approved').map((item) => (
            <div key={item._id} className="border border-gray-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-800">{item.title}</h4>
              <p className="text-xs text-gray-600 mt-1">
                Panel: {item.panel?.length > 0 ? item.panel.map(p => p.name).join(', ') : 'Not assigned'}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);

const DocumentManagement = () => (
  <div className="space-y-5">
    <div className="flex justify-between items-center">
      <h2 className="text-xl font-bold text-gray-800">Document Management</h2>
      <button className="flex items-center px-4 py-2 bg-[#7C1D23] text-white rounded-md hover:bg-[#5a1519] transition-colors text-sm font-medium">
        <FaPlus className="mr-2 text-sm" />
        Upload Document
      </button>
    </div>
    <div className="bg-gray-50 rounded-lg border border-gray-200 p-8">
      <p className="text-gray-500 text-center text-sm">No documents uploaded yet.</p>
    </div>
  </div>
);

export default DeanDashboard;
