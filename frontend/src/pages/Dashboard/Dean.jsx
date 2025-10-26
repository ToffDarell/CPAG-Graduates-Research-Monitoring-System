import React, { useState, useEffect } from 'react';
import { FaUsers, FaFolder, FaArchive, FaChartBar, FaUsersCog, FaFileAlt, FaPlus, FaSearch, FaEdit, FaTrash, FaTimes, FaSignOutAlt, FaBars, FaTimes as FaClose, FaDownload, FaEye, FaToggleOn, FaToggleOff, FaExclamationTriangle, FaHistory, FaCheck  } from 'react-icons/fa';
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
  const [archivedDocuments, setArchivedDocuments] = useState([]);

  // Fetch data on component mount
  useEffect(() => {
      fetchFaculty();
      fetchResearch();
      fetchAnalytics();
      fetchArchivedDocuments();
    },[]);

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

  const fetchArchivedDocuments = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/dean/documents/archived', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setArchivedDocuments(res.data);
    } catch (error) {
      console.error('Error fetching archived documents:', error);
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

      const updateData = {
        name: editingFaculty.name,
        email: editingFaculty.email,
        role: editingFaculty.role
      };

      const res = await axios.put(`/api/dean/faculty/${editingFaculty._id}`, updateData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowEditFacultyModal(false);
      setEditingFaculty(null);
      fetchFaculty();
      alert('Faculty updated successfully!');
    } catch (error) {
      console.error('Update faculty error:', error);
      if (error.response?.data?.errors) {
        alert('Validation errors:\n ' + error.response?.data?.errors.join('\n'));
      } else {
        alert(error.response?.data?.message || 'Error updating faculty');
      } 
    } finally {
      setLoading(false);
    }
  }

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

  const handleArchiveDocument = async (id) => {
    if (!window.confirm('Are you sure you want to archive this document?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.put(`/api/dean/documents/${id}/archive`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchArchivedDocuments();
      alert('Document archived successfully!');
    } catch (error) {
      console.error('Error archiving document:', error);
      alert('Error archiving document');
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

  // Add this function after handleDeleteFaculty
  const handleToggleFacultyStatus = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.put(`/api/dean/faculty/${id}/toggle-status`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchFaculty();
      alert(res.data.message);
    } catch (error) {
      alert(error.response?.data?.message || 'Error updating faculty status');
    }
  };

  // Tabs for different functionalities
  const tabs = [
    { id: 'faculty', label: 'Faculty Management', icon: <FaUsers /> },
    { id: 'research', label: 'Research Records', icon: <FaFolder /> },
    { id: 'archive', label: 'Archived Projects', icon: <FaArchive /> },
    { id: 'monitoring', label: 'Monitoring & Evaluation', icon: <FaChartBar /> },
    { id: 'panels', label: 'Panel Assignment', icon: <FaUsersCog /> },
    { id: 'documents', label: 'Documents', icon: <FaFileAlt /> },
    { id: 'archived-documents', label: 'Archived Documents', icon: <FaArchive /> },
    { id: 'activity-logs', label: 'Activity Logs', icon: <FaHistory /> }
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
          onToggleStatus={handleToggleFacultyStatus} 
        />;
      case 'research':
        return <ResearchRecords 
          stats={researchStats} 
          research={researchList}
          onRefresh={() => {
            fetchResearch();
            fetchAnalytics();
          }}
        />;
      case 'archive':
        return <ArchiveProjects 
          research={researchList.filter(r => r.status === 'archived')}
          onRefresh={() => {
            fetchResearch();
            fetchAnalytics();
          }}
        />;
      case 'monitoring':
        return <MonitoringEvaluation research={researchList} />;
      case 'panels':
        return <PanelAssignment research={researchList} faculty={facultyList} />;
      case 'documents':
        return <DocumentManagement onArchive={fetchArchivedDocuments} />;
      case 'archived-documents':
        return <ArchivedDocuments />;
      case 'activity-logs':
        return <ActivityLogs />;
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
                      value={editingFaculty ? editingFaculty.email : newFaculty.email}
                      onChange={(e) => setNewFaculty({...newFaculty, email: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-[#7C1D23] transition-colors"
                      placeholder="faculty@buksu.edu.ph"
                    />
                    <p className="text-xs text-gray-500 mt-1">An invitation email will be sent to this address</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                    <select
                      value={editingFaculty ? editingFaculty.role : newFaculty.role}
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
const FacultyManagement = ({ faculty, searchQuery, setSearchQuery, onAdd, onEdit, onDelete, onToggleStatus }) => (
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
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
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
              <div key={member._id} className={`bg-white border rounded-lg p-4 flex items-center justify-between hover:shadow-md transition-shadow ${
                member.isActive ? 'border-gray-200' : 'border-red-200 bg-red-50'
              }`}>
                <div className="flex items-center space-x-3">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold ${
                    member.isActive ? 'bg-[#7C1D23]' : 'bg-gray-400'
                  }`}>
                    {member.name?.charAt(0) || 'F'}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-800">{member.name}</h3>
                    <p className="text-xs text-gray-600">{member.email}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                        {member.role}
                      </span>
                      <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${
                        member.isActive 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {member.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => onToggleStatus(member._id)}
                    className={`p-2 transition-colors ${
                      member.isActive 
                        ? 'text-gray-600 hover:text-red-600' 
                        : 'text-gray-600 hover:text-green-600'
                    }`}
                    title={member.isActive ? 'Deactivate Account' : 'Activate Account'}
                  >
                    {member.isActive ? <FaToggleOff className="h-4 w-4" /> : <FaToggleOn className="h-4 w-4" />}
                  </button>
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

// Helper function to determine if project is overdue
const isOverdue = (research) => {
  const now = new Date();
  const expectedCompletion = new Date(research.createdAt);
  expectedCompletion.setFullYear(expectedCompletion.getFullYear() + 2); // 2-year timeline
  
  return research.status !== 'completed' && now > expectedCompletion;
};

// Enhanced research card component
const ResearchMonitoringCard = ({ research, onViewDetails }) => {
  const overdue = isOverdue(research);
  
  return (
    <div className={`border rounded-lg p-4 transition-all duration-200 hover:shadow-md ${
      overdue ? 'border-red-300 bg-red-50' : 'border-gray-200'
    }`}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-gray-800">{research.title}</h4>
            {overdue && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                <FaExclamationTriangle className="mr-1" />
                Overdue
              </span>
            )}
          </div>
          
          <div className="mt-2 space-y-1">
            <p className="text-xs text-gray-600">
              <span className="font-medium">Faculty Adviser:</span> {research.adviser?.name || 'N/A'}
            </p>
            <p className="text-xs text-gray-600">
              <span className="font-medium">Department:</span> {research.adviser?.department || 'N/A'}
            </p>
            <p className="text-xs text-gray-600">
              <span className="font-medium">Student:</span> {research.students?.[0]?.name || 'N/A'}
            </p>
          </div>
          
          <div className="mt-2 flex items-center gap-4">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              research.status === 'completed' ? 'bg-green-100 text-green-700' :
              research.status === 'in-progress' ? 'bg-blue-100 text-blue-700' :
              research.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
              research.status === 'delayed' ? 'bg-red-100 text-red-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {research.status}
            </span>
            <span className="text-xs text-gray-500">
              Last Updated: {new Date(research.updatedAt).toLocaleDateString()}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => onViewDetails(research)}
            className="px-3 py-1 bg-[#7C1D23] text-white rounded-md hover:bg-[#5a1519] transition-colors text-xs font-medium"
          >
            View Details
          </button>
        </div>
      </div>
      
      {/* Progress Bar */}
      <div className="mt-3">
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <span>Progress</span>
          <span>{research.progress || 0}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${
              overdue ? 'bg-red-500' : 'bg-[#7C1D23]'
            }`}
            style={{ width: `${research.progress || 0}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
};


// Detailed progress modal component
const ResearchDetailsModal = ({ research, isOpen, onClose }) => {
  const [remarks, setRemarks] = useState('');
  const [feedback, setFeedback] = useState([]);
  
  useEffect(() => {
    if (isOpen && research) {
      fetchResearchFeedback(research._id);
    }
  }, [isOpen, research]);
  
  const fetchResearchFeedback = async (researchId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/dean/research/${researchId}/feedback`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFeedback(res.data);
    } catch (error) {
      console.error('Error fetching feedback:', error);
    }
  };
  
  const handleSubmitRemarks = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`/api/dean/research/${research._id}/remarks`, {
        message: remarks,
        type: 'dean_feedback'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setRemarks('');
      fetchResearchFeedback(research._id);
      alert('Remarks submitted successfully!');
    } catch (error) {
      alert('Error submitting remarks');
    }
  };
  
  if (!isOpen || !research) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#7C1D23] to-[#5a1519] text-white p-4 rounded-t-lg">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold">{research.title}</h3>
            <button 
              onClick={onClose}
              className="text-white hover:text-gray-200 transition-colors"
            >
              <FaTimes className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        {/* Modal Content */}
        <div className="p-6 space-y-6">
          {/* Research Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Research Information</h4>
              <div className="space-y-2 text-sm">
                <p><span className="font-medium">Student:</span> {research.students?.[0]?.name}</p>
                <p><span className="font-medium">Adviser:</span> {research.adviser?.name}</p>
                <p><span className="font-medium">Department:</span> {research.adviser?.department}</p>
                <p><span className="font-medium">Status:</span> {research.status}</p>
                <p><span className="font-medium">Stage:</span> {research.stage}</p>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Timeline</h4>
              <div className="space-y-2 text-sm">
                <p><span className="font-medium">Started:</span> {new Date(research.createdAt).toLocaleDateString()}</p>
                <p><span className="font-medium">Last Updated:</span> {new Date(research.updatedAt).toLocaleDateString()}</p>
                <p><span className="font-medium">Progress:</span> {research.progress || 0}%</p>
              </div>
            </div>
          </div>
          
          {/* Abstract/Summary */}
          {research.abstract && (
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Abstract</h4>
              <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                {research.abstract}
              </p>
            </div>
          )}
          
          {/* Timeline and Milestones */}
          <div>
            <h4 className="font-semibold text-gray-800 mb-2">Timeline & Milestones</h4>
            <div className="space-y-2">
              {research.timeline?.map((milestone, index) => (
                <div key={index} className="flex items-center gap-3 p-2 bg-gray-50 rounded-md">
                  <div className={`w-3 h-3 rounded-full ${
                    milestone.status === 'completed' ? 'bg-green-500' :
                    milestone.status === 'in-progress' ? 'bg-blue-500' :
                    'bg-gray-300'
                  }`}></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{milestone.stage}</p>
                    <p className="text-xs text-gray-500">
                      {milestone.status} • {new Date(milestone.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Submission History */}
          <div>
            <h4 className="font-semibold text-gray-800 mb-2">Submission History</h4>
            <div className="space-y-2">
              {research.forms?.map((form, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                  <div>
                    <p className="text-sm font-medium">{form.filename}</p>
                    <p className="text-xs text-gray-500">
                      {form.type} • {new Date(form.uploadedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    form.status === 'approved' ? 'bg-green-100 text-green-700' :
                    form.status === 'rejected' ? 'bg-red-100 text-red-700' :
                    form.status === 'revision' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {form.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Comments/Feedback Logs */}
          <div>
            <h4 className="font-semibold text-gray-800 mb-2">Comments & Feedback</h4>
            <div className="space-y-3 max-h-40 overflow-y-auto">
              {feedback.map((item, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded-md">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-sm font-medium">{item.adviser?.name || 'Dean'}</span>
                    <span className="text-xs text-gray-500">{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm text-gray-600">{item.message}</p>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium mt-2 ${
                    item.type === 'approval' ? 'bg-green-100 text-green-700' :
                    item.type === 'rejection' ? 'bg-red-100 text-red-700' :
                    item.type === 'feedback' ? 'bg-blue-100 text-blue-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {item.type}
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Dean Remarks */}
          <div>
            <h4 className="font-semibold text-gray-800 mb-2">Add Remarks</h4>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Add your remarks or feedback for the faculty member..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-[#7C1D23] text-sm"
            />
            <button
              onClick={handleSubmitRemarks}
              disabled={!remarks.trim()}
              className="mt-2 px-4 py-2 bg-[#7C1D23] text-white rounded-md hover:bg-[#5a1519] transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit Remarks
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ResearchRecordDetailsModal = ({ research, isOpen, onClose, onDownload }) => {
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && research) {
      fetchResearchFeedback(research._id);
    }
  }, [isOpen, research]);

  const fetchResearchFeedback = async (researchId) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/dean/research/${researchId}/feedback`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFeedback(res.data);
    } catch (error) {
      console.error('Error fetching feedback:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !research) return null;

  const getStatusColor = (status) => {
    const colors = {
      'approved': 'bg-green-100 text-green-700',
      'pending': 'bg-yellow-100 text-yellow-700',
      'under review': 'bg-blue-100 text-blue-700',
      'rejected': 'bg-red-100 text-red-700',
      'completed': 'bg-purple-100 text-purple-700',
      'archived': 'bg-gray-100 text-gray-700'
    };
    return colors[status?.toLowerCase()] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#7C1D23] to-[#5a1519] text-white p-6 rounded-t-lg sticky top-0 z-10">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h3 className="text-xl font-bold mb-2">{research.title}</h3>
              <div className="flex items-center space-x-3">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(research.status)} border`}>
                  {research.status}
                </span>
                <span className="text-sm text-gray-200">
                  Submitted: {new Date(research.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="text-white hover:text-gray-200 transition-colors ml-4"
            >
              <FaTimes className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6">
          {/* Research Information Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-gray-500 uppercase mb-2">Student Information</h4>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <p className="text-sm"><span className="font-medium">Name:</span> {research.students?.[0]?.name || 'N/A'}</p>
                  <p className="text-sm"><span className="font-medium">Email:</span> {research.students?.[0]?.email || 'N/A'}</p>
                  <p className="text-sm"><span className="font-medium">Department:</span> {research.students?.[0]?.department || 'N/A'}</p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-500 uppercase mb-2">Faculty Adviser</h4>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <p className="text-sm"><span className="font-medium">Name:</span> {research.adviser?.name || 'N/A'}</p>
                  <p className="text-sm"><span className="font-medium">Email:</span> {research.adviser?.email || 'N/A'}</p>
                  <p className="text-sm"><span className="font-medium">Department:</span> {research.adviser?.department || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-gray-500 uppercase mb-2">Research Timeline</h4>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <p className="text-sm"><span className="font-medium">Submission Date:</span> {new Date(research.createdAt).toLocaleDateString()}</p>
                  <p className="text-sm"><span className="font-medium">Last Updated:</span> {new Date(research.updatedAt).toLocaleDateString()}</p>
                  <p className="text-sm"><span className="font-medium">Stage:</span> {research.stage || 'N/A'}</p>
                  <p className="text-sm"><span className="font-medium">Progress:</span> {research.progress || 0}%</p>
                </div>
              </div>

              {/* Panel Members */}
              {research.panel && research.panel.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-500 uppercase mb-2">Panel Members</h4>
                  <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                    {research.panel.map((member, index) => (
                      <p key={index} className="text-sm">• {member.name || 'N/A'}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Abstract/Summary */}
          {research.abstract && (
            <div>
              <h4 className="text-sm font-semibold text-gray-500 uppercase mb-2">Research Abstract</h4>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-700 leading-relaxed">{research.abstract}</p>
              </div>
            </div>
          )}

          {/* Uploaded Documents */}
          <div>
            <h4 className="text-sm font-semibold text-gray-500 uppercase mb-2">Uploaded Documents</h4>
            <div className="bg-gray-50 rounded-lg overflow-hidden">
              {research.forms && research.forms.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {research.forms.map((form, index) => (
                    <div key={index} className="p-4 flex items-center justify-between hover:bg-gray-100 transition-colors">
                      <div className="flex items-center space-x-3">
                        <FaFileAlt className="h-5 w-5 text-[#7C1D23]" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{form.filename || `Document ${index + 1}`}</p>
                          <p className="text-xs text-gray-500">
                            {form.type || 'Document'} • Uploaded {new Date(form.uploadedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => onDownload(research._id, form._id)}
                        className="flex items-center space-x-2 px-3 py-1.5 bg-[#7C1D23] text-white rounded-md hover:bg-[#5a1519] transition-colors text-sm"
                      >
                        <FaDownload className="h-3 w-3" />
                        <span>Download</span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500 text-sm">
                  No documents uploaded yet.
                </div>
              )}
            </div>
          </div>

          {/* Comments/Feedback History */}
          <div>
            <h4 className="text-sm font-semibold text-gray-500 uppercase mb-2">Comments & Feedback History</h4>
            <div className="bg-gray-50 rounded-lg max-h-60 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[#7C1D23]"></div>
                  <p className="mt-2 text-sm text-gray-500">Loading feedback...</p>
                </div>
              ) : feedback && feedback.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {feedback.map((item, index) => (
                    <div key={index} className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-gray-900">
                            {item.adviser?.name || 'Dean'}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(item.type)}`}>
                            {item.type}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{item.message}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500 text-sm">
                  No feedback or comments yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-gray-50 px-6 py-4 rounded-b-lg flex justify-end space-x-3 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const ResearchRecords = ({ stats, research, onRefresh }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [academicYearFilter, setAcademicYearFilter] = useState('all');
  const [filteredResearch, setFilteredResearch] = useState(research);
  const [selectedResearch, setSelectedResearch] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Filter research based on search and filters
  useEffect(() => {
    let filtered = research.filter(item => item.status !== 'archived');
    
    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(item => 
        item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.adviser?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.students?.some(student => 
          student.name?.toLowerCase().includes(searchQuery.toLowerCase())
        ) ||
        item.adviser?.department?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(item => item.status === statusFilter);
    }
    
    // Academic year filter
    if (academicYearFilter !== 'all') {
      filtered = filtered.filter(item => {
        const year = new Date(item.createdAt).getFullYear();
        return year.toString() === academicYearFilter;
      });
    }
    
    setFilteredResearch(filtered);
  }, [research, searchQuery, statusFilter, academicYearFilter]);

  const handleViewDetails = (researchItem) => {
    setSelectedResearch(researchItem);
    setShowDetailsModal(true);
  };

  const handleArchiveResearch = async (id, currentStatus) => {
    const action = currentStatus === 'archived' ? 'unarchive' : 'archive';
    if (!window.confirm(`Are you sure you want to ${action} this research?`)) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.put(`/api/dean/archive/${id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Refresh the research list
      if (onRefresh) onRefresh();
      alert(`Research ${action}d successfully!`);
    } catch (error) {
      console.error(`Error ${action}ing research:`, error);
      alert(`Error ${action}ing research`);
    }
  };

  const handleDownloadDocument = async (researchId, documentId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/dean/research/${researchId}/download/${documentId}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `research_document_${documentId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading document:', error);
      alert('Error downloading document');
    }
  };

  // Get unique academic years from research data
  const academicYears = [...new Set(research.map(r => new Date(r.createdAt).getFullYear()))].sort((a, b) => b - a);

  const getStatusColor = (status) => {
    const colors = {
      'approved': 'bg-green-100 text-green-700 border-green-300',
      'pending': 'bg-yellow-100 text-yellow-700 border-yellow-300',
      'under review': 'bg-blue-100 text-blue-700 border-blue-300',
      'rejected': 'bg-red-100 text-red-700 border-red-300',
      'completed': 'bg-purple-100 text-purple-700 border-purple-300',
      'archived': 'bg-gray-100 text-gray-700 border-gray-300'
    };
    return colors[status?.toLowerCase()] || 'bg-gray-100 text-gray-700 border-gray-300';
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">Research Records</h2>
        <span className="text-sm text-gray-600">{filteredResearch.length} record(s) found</span>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-lg border-l-4 border-[#7C1D23] shadow-sm">
          <h3 className="text-sm font-semibold text-gray-600 uppercase">Total Research</h3>
          <p className="text-3xl font-bold text-gray-800 mt-2">{stats.total || 0}</p>
        </div>
        <div className="bg-white p-5 rounded-lg border-l-4 border-green-500 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-600 uppercase">Approved</h3>
          <p className="text-3xl font-bold text-gray-800 mt-2">{stats.approved || 0}</p>
        </div>
        <div className="bg-white p-5 rounded-lg border-l-4 border-yellow-500 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-600 uppercase">Pending</h3>
          <p className="text-3xl font-bold text-gray-800 mt-2">{stats.pending || 0}</p>
        </div>
        <div className="bg-white p-5 rounded-lg border-l-4 border-gray-500 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-600 uppercase">Archived</h3>
          <p className="text-3xl font-bold text-gray-800 mt-2">{stats.archived || 0}</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search Input */}
          <div className="flex-1">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, faculty name, or department..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-[#7C1D23] text-sm"
              />
            </div>
          </div>
          
          {/* Status Filter */}
          <div className="md:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-[#7C1D23] text-sm"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="under review">Under Review</option>
              <option value="rejected">Rejected</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          
          {/* Academic Year Filter */}
          <div className="md:w-48">
            <select
              value={academicYearFilter}
              onChange={(e) => setAcademicYearFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-[#7C1D23] text-sm"
            >
              <option value="all">All Years</option>
              {academicYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Research Records Table/List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {filteredResearch.length === 0 ? (
          <div className="p-8 text-center">
            <FaFolder className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-gray-500">No research records available.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Research Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Author/Faculty
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submission Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredResearch.map((item) => (
                  <tr key={item._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{item.title}</div>
                      <div className="text-xs text-gray-500">
                        Student: {item.students?.[0]?.name || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{item.adviser?.name || 'N/A'}</div>
                      <div className="text-xs text-gray-500">{item.adviser?.email || ''}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{item.adviser?.department || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleViewDetails(item)}
                          className="text-[#7C1D23] hover:text-[#5a1519] transition-colors"
                          title="View Details"
                        >
                          <FaEye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleArchiveResearch(item._id, item.status)}
                          className={`${item.status === 'archived' ? 'text-green-600 hover:text-green-800' : 'text-gray-600 hover:text-gray-800'} transition-colors`}
                          title={item.status === 'archived' ? 'Unarchive' : 'Archive'}
                        >
                          <FaArchive className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Research Details Modal */}
      {showDetailsModal && selectedResearch && (
        <ResearchRecordDetailsModal
          research={selectedResearch}
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedResearch(null);
          }}
          onDownload={handleDownloadDocument}
        />
      )}
    </div>
  );
};

const ArchiveProjects = ({ research, onRefresh }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredResearch, setFilteredResearch] = useState(research);
  const [selectedResearch, setSelectedResearch] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    let filtered = research;
    
    if (searchQuery) {
      filtered = filtered.filter(item => 
        item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.adviser?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.students?.some(student => 
          student.name?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }
    
    setFilteredResearch(filtered);
  }, [research, searchQuery]);

  const handleUnarchive = async (id) => {
    if (!window.confirm('Are you sure you want to unarchive this research?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.put(`/api/dean/archive/${id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (onRefresh) onRefresh();
      alert('Research unarchived successfully!');
    } catch (error) {
      console.error('Error unarchiving research:', error);
      alert('Error unarchiving research');
    }
  };

  const handleViewDetails = (researchItem) => {
    setSelectedResearch(researchItem);
    setShowDetailsModal(true);
  };

  const handleDownloadDocument = async (researchId, documentId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/dean/research/${researchId}/download/${documentId}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `research_document_${documentId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading document:', error);
      alert('Error downloading document');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">Archived Projects</h2>
        <span className="text-sm text-gray-600">{filteredResearch.length} archived project(s)</span>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="relative">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search archived projects..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-[#7C1D23] text-sm"
          />
        </div>
      </div>

      {/* Archived Projects Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {filteredResearch.length === 0 ? (
          <div className="p-8 text-center">
            <FaArchive className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-gray-500">No archived projects yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Research Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Author/Faculty
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Archived Date
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredResearch.map((item) => (
                  <tr key={item._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{item.title}</div>
                      <div className="text-xs text-gray-500">
                        Student: {item.students?.[0]?.name || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{item.adviser?.name || 'N/A'}</div>
                      <div className="text-xs text-gray-500">{item.adviser?.email || ''}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{item.adviser?.department || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {item.archivedAt ? new Date(item.archivedAt).toLocaleDateString() : new Date(item.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleViewDetails(item)}
                          className="text-[#7C1D23] hover:text-[#5a1519] transition-colors"
                          title="View Details"
                        >
                          <FaEye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleUnarchive(item._id)}
                          className="text-green-600 hover:text-green-800 transition-colors"
                          title="Unarchive"
                        >
                          <FaArchive className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Research Details Modal */}
      {showDetailsModal && selectedResearch && (
        <ResearchRecordDetailsModal
          research={selectedResearch}
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedResearch(null);
          }}
          onDownload={handleDownloadDocument}
        />
      )}
    </div>
  );
};

const MonitoringEvaluation = ({ research }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [filteredResearch, setFilteredResearch] = useState(research);
  const [selectedResearch, setSelectedResearch] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    let filtered = research;
    
    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(item => 
        item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.adviser?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.students?.some(student => 
          student.name?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(item => item.status === statusFilter);
    }
    
    // Department filter
    if (departmentFilter !== 'all') {
      filtered = filtered.filter(item => 
        item.adviser?.department === departmentFilter ||
        item.students?.some(student => student.department === departmentFilter)
      );
    }
    
    setFilteredResearch(filtered);
  }, [research, searchQuery, statusFilter, departmentFilter]);


  const handleViewDetails = (researchItem) => {
    setSelectedResearch(researchItem);
    setShowDetailsModal(true);
  };

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-gray-800">Research Monitoring</h2>
      
      {/* Search and Filter Controls */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search Input */}
          <div className="flex-1">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, author, or department..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-[#7C1D23] text-sm"
              />
            </div>
          </div>
          
          {/* Status Filter */}
          <div className="sm:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-[#7C1D23] text-sm"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="delayed">Delayed</option>
            </select>
          </div>
          
          {/* Department Filter */}
          <div className="sm:w-48">
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-[#7C1D23] text-sm"
            >
              <option value="all">All Departments</option>
              <option value="Computer Science">Computer Science</option>
              <option value="Information Technology">Information Technology</option>
              <option value="Business Administration">Business Administration</option>
            </select>
          </div>
        </div>
      </div>

      {/* Research List */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        {filteredResearch.length === 0 ? (
          <p className="text-gray-500 text-center text-sm py-8">No active research projects to display.</p>
        ) : (
          <div className="space-y-3">
            {filteredResearch.map((item) => (
              <ResearchMonitoringCard key={item._id} research={item} onViewDetails={handleViewDetails} />
            ))}
          </div>
        )}
      </div>

        {/* Details Modal */}
      {showDetailsModal && selectedResearch && (
        <ResearchDetailsModal
          research={selectedResearch}
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedResearch(null);
          }}
        />
      )}
      
    </div>
  );
};

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

const ArchivedDocuments = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    fetchArchivedDocuments();
  }, []);

  const fetchArchivedDocuments = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/dean/documents/archived', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDocuments(res.data);
    } catch (error) {
      console.error('Error fetching archived documents:', error);
      alert('Error fetching archived documents');
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreDocument = async (id) => {
    if (!window.confirm('Are you sure you want to restore this document?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.put(`/api/dean/documents/${id}/restore`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchArchivedDocuments();
      alert('Document restored successfully!');
    } catch (error) {
      console.error('Error restoring document:', error);
      alert('Error restoring document');
    }
  };

  const handlePermanentDelete = async (id) => {
    if (!window.confirm(' WARNING: This will PERMANENTLY delete the document and file. This cannot be undone! Are you sure?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/dean/documents/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchArchivedDocuments();
      alert('Document permanently deleted!');
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Error deleting document');
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         doc.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || doc.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">Archived Documents</h2>
        <span className="text-sm text-gray-600">{documents.length} archived document(s)</span>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search archived documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-[#7C1D23]"
              />
            </div>
          </div>
          <div className="md:w-48">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-[#7C1D23]"
            >
              <option value="all">All Categories</option>
              <option value="form">Form</option>
              <option value="template">Template</option>
              <option value="guideline">Guideline</option>
              <option value="policy">Policy</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </div>

      {/* Documents List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#7C1D23]"></div>
            <p className="mt-2 text-gray-500">Loading archived documents...</p>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="p-8 text-center">
            <FaArchive className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-gray-500">No archived documents found.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredDocuments.map((doc) => (
              <div key={doc._id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <div className="h-10 w-10 rounded-lg bg-gray-400 flex items-center justify-center">
                        <FaFileAlt className="h-5 w-5 text-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-800 truncate">
                        {doc.title}
                      </h3>
                      <p className="text-xs text-gray-600 mt-1">
                        {doc.description || 'No description'}
                      </p>
                      <div className="flex items-center space-x-4 mt-2">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(doc.category)}`}>
                          {doc.category}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatFileSize(doc.fileSize)}
                        </span>
                        <span className="text-xs text-gray-500">
                          Archived: {new Date(doc.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleRestoreDocument(doc._id)}
                      className="p-2 text-green-600 hover:text-green-800 transition-colors"
                      title="Restore document"
                    >
                      <FaArchive className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handlePermanentDelete(doc._id)}
                      className="p-2 text-red-600 hover:text-red-800 transition-colors"
                      title="Permanently delete"
                    >
                      <FaTrash className="h-4 w-4" />
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

const DocumentManagement = ({ onArchive }) => {
  const [documents, setDocuments] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [newDocument, setNewDocument] = useState({
    title: '',
    description: '',
    category: 'form',
    accessibleTo: ['dean']
  });
  const [selectedFile, setSelectedFile] = useState(null);
  
  // Add these state variables for document viewer
  const [viewingDocument, setViewingDocument] = useState(null);
  const [showDocumentViewer, setShowDocumentViewer] = useState(false); 

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/dean/documents', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDocuments(res.data);
    } catch (error) {
      console.error('Error fetching documents:', error);
      alert('Error fetching documents');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      alert('Please select a file to upload');
      return;
    }

    try {
      setUploadLoading(true);
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('title', newDocument.title);
      formData.append('description', newDocument.description);
      formData.append('category', newDocument.category);
      formData.append('accessibleTo', JSON.stringify(newDocument.accessibleTo));

      console.log('Uploading document:', {
        title: newDocument.title,
        category: newDocument.category,
        accessibleTo: newDocument.accessibleTo,
        fileName: selectedFile.name,
        fileSize: selectedFile.size
      }); // Debug log

      const res = await axios.post('/api/dean/documents', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setShowUploadModal(false);
      setNewDocument({
        title: '',
        description: '',
        category: 'form',
        accessibleTo: ['dean']
      });
      setSelectedFile(null);
      fetchDocuments();
      alert('Document uploaded successfully!');
    } catch (error) {
      console.error('Error uploading document:', error);
      console.error('Error response:', error.response?.data); // Debug log
      alert(error.response?.data?.message || 'Error uploading document');
    } finally {
      setUploadLoading(false);
    }
  };

// Handle delete with simple confirm dialogs
const handleDeleteDocument = async (doc) => {
  const choice = window.confirm(
    'Do you want to ARCHIVE this document (can be restored later)?\n\n' +
    'Click OK to Archive\n' +
    'Click Cancel to see Permanent Delete option'
  );

  if (choice) {
    // User chose to archive
    try {
      const token = localStorage.getItem('token');
      await axios.put(`/api/dean/documents/${doc._id}/archive`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchDocuments();
      if (onArchive) onArchive();
      alert('Document archived successfully!');
    } catch (error) {
      console.error('Error archiving document:', error);
      alert(error.response?.data?.message || 'Error archiving document');
    }
  } else {
    // Ask if they want to permanently delete
    const confirmDelete = window.confirm(
      'WARNING: This will PERMANENTLY delete the document and file. This cannot be undone! Are you sure?'
    );
    
    if (confirmDelete) {
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`/api/dean/documents/${doc._id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        fetchDocuments();
        alert('Document permanently deleted!');
      } catch (error) {
        console.error('Error deleting document:', error);
        alert('Error deleting document');
      }
    }
  }
};

  const handleDownload = async (doc) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/dean/documents/${doc._id}/download`, {
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
      console.error('Error response:', error.response?.data);
      alert('Error downloading document: ' + (error.response?.data?.message || error.message));
    }
  };

  //  function to handle viewing documents
  const handleViewDocument = (document) => {
    setViewingDocument(document);
    setShowDocumentViewer(true); 
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         doc.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || doc.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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



  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">Document Management</h2>
        <button 
          onClick={() => setShowUploadModal(true)}
          className="flex items-center px-4 py-2 bg-[#7C1D23] text-white rounded-md hover:bg-[#5a1519] transition-colors text-sm font-medium"
        >
          <FaPlus className="mr-2 text-sm" />
          Upload Document
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-[#7C1D23] text-sm"
              />
            </div>
          </div>
          <div className="sm:w-48">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-[#7C1D23] text-sm"
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
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#7C1D23]"></div>
            <p className="mt-2 text-gray-500">Loading documents...</p>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="p-8 text-center">
            <FaFileAlt className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-gray-500">No documents uploaded yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredDocuments.map((doc) => (
              <div key={doc._id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <div className="h-10 w-10 rounded-lg bg-[#7C1D23] flex items-center justify-center">
                        <FaFileAlt className="h-5 w-5 text-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-800 truncate">
                        {doc.title}
                      </h3>
                      <p className="text-xs text-gray-600 mt-1">
                        {doc.description || 'No description'}
                      </p>
                      <div className="flex items-center space-x-4 mt-2">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(doc.category)}`}>
                          {doc.category}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatFileSize(doc.fileSize)}
                        </span>
                        <span className="text-xs text-gray-500">
                          Uploaded by {doc.uploadedBy?.name || 'Unknown'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleViewDocument(doc)}
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
                    <button
                      onClick={() => handleDeleteDocument(doc)}
                      className="p-2 text-gray-600 hover:text-red-600 transition-colors"
                      title="Delete"
                    >
                      <FaTrash className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-gray-50 bg-opacity-95 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full border border-gray-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#7C1D23] to-[#5a1519] text-white p-4 rounded-t-lg">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold">Upload Document</h3>
                <button 
                  onClick={() => setShowUploadModal(false)} 
                  className="text-white hover:text-gray-200 transition-colors"
                >
                  <FaTimes className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <form onSubmit={handleUpload}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Document Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={newDocument.title}
                      onChange={(e) => setNewDocument({...newDocument, title: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-[#7C1D23] transition-colors"
                      placeholder="Enter document title"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={newDocument.description}
                      onChange={(e) => setNewDocument({...newDocument, description: e.target.value})}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-[#7C1D23] transition-colors"
                      placeholder="Enter document description (optional)"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category *
                    </label>
                    <select
                      required
                      value={newDocument.category}
                      onChange={(e) => setNewDocument({...newDocument, category: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-[#7C1D23] transition-colors"
                    >
                      <option value="form">Form</option>
                      <option value="template">Template</option>
                      <option value="guideline">Guideline</option>
                      <option value="policy">Policy</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Accessible To
                    </label>
                    <div className="space-y-2">
                      {['program head', 'faculty adviser', 'graduate student'].map(role => (
                        <label key={role} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={newDocument.accessibleTo.includes(role)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewDocument({
                                  ...newDocument,
                                  accessibleTo: [...newDocument.accessibleTo, role]
                                });
                              } else {
                                setNewDocument({
                                  ...newDocument,
                                  accessibleTo: newDocument.accessibleTo.filter(r => r !== role)
                                });
                              }
                            }}
                            className="rounded border-gray-300 text-[#7C1D23] focus:ring-[#7C1D23]"
                          />
                          <span className="ml-2 text-sm text-gray-700 capitalize">
                            {role.replace('/', ' / ')}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select File * (Max 10MB)
                    </label>
                    <input
                      type="file"
                      required
                      onChange={handleFileSelect}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-[#7C1D23] transition-colors"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                    />
                    {selectedFile && (
                      <p className="mt-1 text-sm text-gray-600">
                        Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                      </p>
                    )}
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="flex space-x-3 mt-6 pt-4 border-t border-gray-200">
                  <button
                    type="submit"
                    disabled={uploadLoading}
                    className="flex-1 bg-[#7C1D23] text-white py-2 px-4 rounded-md hover:bg-[#5a1519] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploadLoading ? 'Uploading...' : 'Upload Document'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
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

      {/* Document Viewer Modal */}
      {showDocumentViewer && viewingDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full h-full flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#7C1D23] to-[#5a1519] text-white p-4 rounded-t-lg flex justify-between items-center">
              <h3 className="text-lg font-bold">{viewingDocument.title}</h3>
              <button 
                onClick={() => setShowDocumentViewer(false)} 
                className="text-white hover:text-gray-200 transition-colors"
              >
                <FaTimes className="h-5 w-5" />
              </button>
            </div>
            
            {/* Document Content */}
            <div className="flex-1 p-4">
              {viewingDocument.mimeType === 'application/pdf' ? (
                <iframe
                  src={`/api/dean/documents/${viewingDocument._id}`}
                  className="w-full h-full border-0"
                  title={viewingDocument.title}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500">
                    Document preview not available for this file type. 
                    <button 
                      onClick={() => handleDownload(viewingDocument)}
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

// Activity Logs Component
const ActivityLogs = () => {
  const [activities, setActivities] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionFilter, setActionFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  useEffect(() => {
    fetchActivityLogs();
    fetchActivityStats();
  }, [actionFilter, entityFilter, currentPage]);

  const fetchActivityLogs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: currentPage,
        limit: 50,
        ...(actionFilter !== 'all' && { action: actionFilter }),
        ...(entityFilter !== 'all' && { entityType: entityFilter })
      });

      const res = await axios.get(`/api/dean/activity-logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setActivities(res.data.activities);
      setPagination(res.data.pagination);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      alert('Error fetching activity logs');
    } finally {
      setLoading(false);
    }
  };

  const fetchActivityStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/dean/activity-stats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(res.data);
    } catch (error) {
      console.error('Error fetching activity stats:', error);
    }
  };

  const getActionColor = (action) => {
    const colors = {
      create: 'bg-green-100 text-green-700',
      update: 'bg-blue-100 text-blue-700',
      delete: 'bg-red-100 text-red-700',
      upload: 'bg-purple-100 text-purple-700',
      download: 'bg-indigo-100 text-indigo-700',
      view: 'bg-gray-100 text-gray-700',
      approve: 'bg-green-100 text-green-700',
      reject: 'bg-red-100 text-red-700',
      archive: 'bg-yellow-100 text-yellow-700',
      restore: 'bg-blue-100 text-blue-700',
      activate: 'bg-green-100 text-green-700',
      deactivate: 'bg-orange-100 text-orange-700',
      invite: 'bg-purple-100 text-purple-700',
      assign: 'bg-blue-100 text-blue-700',
      send_email: 'bg-cyan-100 text-cyan-700',
      add_remark: 'bg-indigo-100 text-indigo-700',
    };
    return colors[action] || 'bg-gray-100 text-gray-700';
  };

  const getEntityIcon = (entityType) => {
    const icons = {
      document: <FaFileAlt />,
      research: <FaFolder />,
      user: <FaUsers />,
      panel: <FaUsersCog />,
      email: <FaFileAlt />,
      settings: <FaEdit />,
    };
    return icons[entityType] || <FaFileAlt />;
  };

  const filteredActivities = activities.filter(activity => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return (
      activity.description?.toLowerCase().includes(searchLower) ||
      activity.entityName?.toLowerCase().includes(searchLower) ||
      activity.user?.name?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">Activity Logs</h2>
        <button 
          onClick={fetchActivityLogs}
          className="flex items-center px-4 py-2 bg-[#7C1D23] text-white rounded-md hover:bg-[#5a1519] transition-colors text-sm font-medium"
        >
          <FaDownload className="mr-2 text-sm" />
          Refresh
        </button>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Total Activities</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{stats.total}</p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <FaHistory className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Today</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{stats.today}</p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                <FaCheck className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">This Week</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{stats.thisWeek}</p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <FaChartBar className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Most Active</p>
                <p className="text-sm font-bold text-gray-800 mt-1">
                  {stats.recentUsers?.[0]?.user || 'N/A'}
                </p>
              </div>
              <div className="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <FaUsers className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search activities..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-[#7C1D23] text-sm"
              />
            </div>
          </div>
          
          <div className="sm:w-48">
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-[#7C1D23] text-sm"
            >
              <option value="all">All Actions</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
              <option value="upload">Upload</option>
              <option value="download">Download</option>
              <option value="view">View</option>
              <option value="approve">Approve</option>
              <option value="archive">Archive</option>
              <option value="restore">Restore</option>
              <option value="invite">Invite</option>
            </select>
          </div>
          
          <div className="sm:w-48">
            <select
              value={entityFilter}
              onChange={(e) => {
                setEntityFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-[#7C1D23] text-sm"
            >
              <option value="all">All Types</option>
              <option value="document">Documents</option>
              <option value="research">Research</option>
              <option value="user">Users</option>
              <option value="panel">Panels</option>
              <option value="email">Emails</option>
            </select>
          </div>
        </div>
      </div>

      {/* Activity List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#7C1D23]"></div>
            <p className="mt-2 text-gray-500">Loading activities...</p>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="p-8 text-center">
            <FaHistory className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-gray-500">No activities found.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredActivities.map((activity) => (
              <div key={activity._id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-1">
                    <div className="h-10 w-10 rounded-lg bg-[#7C1D23]/10 flex items-center justify-center text-[#7C1D23]">
                      {getEntityIcon(activity.entityType)}
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getActionColor(activity.action)}`}>
                        {activity.action.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-500">
                        {activity.entityType}
                      </span>
                    </div>
                    
                    <p className="text-sm font-medium text-gray-800">
                      {activity.description}
                    </p>
                    
                    {activity.entityName && (
                      <p className="text-sm text-gray-600 mt-1">
                        <span className="font-medium">Entity:</span> {activity.entityName}
                      </p>
                    )}
                    
                    <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                      <span>
                        <FaUsers className="inline mr-1" />
                        {activity.user?.name || 'Unknown'}
                      </span>
                      <span>
                        {new Date(activity.createdAt).toLocaleString()}
                      </span>
                      {activity.ipAddress && (
                        <span>IP: {activity.ipAddress}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 sm:px-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing page <span className="font-medium">{pagination.page}</span> of{' '}
                <span className="font-medium">{pagination.pages}</span>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(Math.min(pagination.pages, currentPage + 1))}
                  disabled={currentPage === pagination.pages}
                  className="px-3 py-1 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeanDashboard;
