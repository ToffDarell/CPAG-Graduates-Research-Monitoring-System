import React, { useState, useEffect } from "react";
import { FaUsersCog, FaCalendarAlt, FaClipboardCheck, FaChartLine, FaFileAlt, FaBell, FaSignOutAlt, FaBars, FaTimes as FaClose, FaUpload, FaDownload, FaTrash, FaHistory, FaFilePdf, FaFileWord, FaSearch, FaCheck, FaUsers, FaEdit, FaChartBar, FaClock, FaMapMarkerAlt, FaExclamationTriangle, FaGoogle } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = momentLocalizer(moment);

const ProgramHeadDashboard = ({setUser}) => {
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState("panels");
  const [panelMembers, setPanelMembers] = useState([
    { id: 1, name: "Dr. Smith", role: "Chair", status: "Assigned" },
    { id: 2, name: "Dr. Johnson", role: "Member", status: "Pending" },
  ]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Google Calendar state
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);

  // Check for calendar connection callback on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const calendarParam = urlParams.get('calendar');
    if (calendarParam === 'connected') {
      setCalendarConnected(true);
      setSelectedTab('schedules'); // Auto-switch to schedules tab
      checkCalendarStatus();
      // Clean up URL without refreshing
      window.history.replaceState({}, document.title, '/dashboard/program-head');
    } else if (calendarParam === 'error') {
      alert('Failed to connect Google Calendar. Please try again.');
      setSelectedTab('schedules'); // Still switch to schedules tab
      // Clean up URL
      window.history.replaceState({}, document.title, '/dashboard/program-head');
    } else {
      checkCalendarStatus();
    }
  }, []);

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
    { id: "panel-records", label: "Panel Records", icon: <FaChartBar /> },
    { id: "activity-logs", label: "Activity Logs", icon: <FaHistory /> },
  ];

  const renderContent = () => {
    switch (selectedTab) {
      case "panels":
        return <PanelSelection members={panelMembers} />;
      case "advisers":
        return <FacultyAdviserAssignment />;
      case "schedules":
        return <ScheduleManagement 
          calendarConnected={calendarConnected}
          onConnectCalendar={connectGoogleCalendar}
          onDisconnectCalendar={disconnectGoogleCalendar}
          calendarLoading={calendarLoading}
        />;
      case "monitoring":
        return <ProcessMonitoring />;
      case "forms":
        return <FormsManagement />;
      case "records":
        return <ResearchRecords />;
      case "panel-records":
        return <PanelRecords />;
      case "activity-logs":
        return <ActivityLogs />;
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
const PanelSelection = () => {
  const [panelForm, setPanelForm] = useState({
    name: '',
    description: '',
    type: 'oral_defense',
    researchId: '',
  });
  const [availablePanelists, setAvailablePanelists] = useState([]);
  const [availableResearch, setAvailableResearch] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]); // [{faculty, role}]
  const [panels, setPanels] = useState([]);
  const [inviteMode, setInviteMode] = useState(false); // Toggle between select/invite
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'member', reviewDeadline: '' });
  const [inviting, setInviting] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Select Members Modal state
  const [selectModalOpen, setSelectModalOpen] = useState(false);
  const [currentPanel, setCurrentPanel] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [savingSelection, setSavingSelection] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    const fetchAll = async () => {
      try {
        const [panelistsRes, researchRes, panelsRes] = await Promise.all([
          axios.get('/api/programhead/panelists', { headers }),
          axios.get('/api/programhead/research', { headers }),
          axios.get('/api/programhead/panels', { headers }),
        ]);
        setAvailablePanelists(panelistsRes.data || []);
        setAvailableResearch(researchRes.data || []);
        setPanels(panelsRes.data || []);
      } catch (e) {
        console.error(e);
      }
    };
    fetchAll();
  }, []);

  const handleAddMember = (facultyId, role) => {
    if (!facultyId || !role) return;
    if (selectedMembers.find(m => m.faculty === facultyId)) return;
    setSelectedMembers(prev => [...prev, { faculty: facultyId, role }]);
  };

  const handleRemoveMember = (facultyId) => {
    setSelectedMembers(prev => prev.filter(m => m.faculty !== facultyId));
  };

  const handleCreatePanel = async (e) => {
    e.preventDefault();
    if (!panelForm.name || !panelForm.type || !panelForm.researchId || selectedMembers.length === 0) {
      alert('Please complete all required fields and add at least one panelist.');
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      // Separate internal and external members
      const internalMembers = selectedMembers.filter(m => !m.isExternal);
      const externalMembers = selectedMembers.filter(m => m.isExternal);
      
      // Create panel with internal members first
      const res = await axios.post('/api/programhead/panels', {
        name: panelForm.name,
        description: panelForm.description,
        type: panelForm.type,
        researchId: panelForm.researchId,
        members: internalMembers,
      }, { headers });
      
      const panelId = res.data.panel._id;
      
      // Send invitations for external members
      if (externalMembers.length > 0) {
        const invitePromises = externalMembers.map(member =>
          axios.post('/api/programhead/panels/invite', {
            panelId,
            name: member.name,
            email: member.email,
            role: member.role,
            reviewDeadline: member.reviewDeadline || undefined,
          }, { headers })
        );
        
        await Promise.all(invitePromises);
      }
      
      // Refresh panels list
      const panelsRes = await axios.get('/api/programhead/panels', { headers });
      setPanels(panelsRes.data || []);
      
      setPanelForm({ name: '', description: '', type: 'oral_defense', researchId: '' });
      setSelectedMembers([]);
      setInviteMode(false);
      
      alert(`Panel created successfully. ${internalMembers.length} internal panelist(s) assigned. ${externalMembers.length > 0 ? externalMembers.length + ' invitation(s) sent.' : ''}`);
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.message || 'Failed to create panel');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMembers = async (panelId, members) => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.put(`/api/programhead/panels/${panelId}/members`, { members }, { headers });
      setPanels(prev => prev.map(p => p._id === panelId ? res.data.panel : p));
      alert('Panel membership updated.');
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.message || 'Failed to update membership');
    }
  };

  const handleInvitePanelist = async (panelId) => {
    if (!inviteForm.name || !inviteForm.email || !inviteForm.role) {
      alert('Please fill in all required fields: Name, Email, and Role');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteForm.email)) {
      alert('Please enter a valid email address');
      return;
    }

    // Validate institutional email domain
    if (!inviteForm.email.endsWith('@buksu.edu.ph')) {
      alert('Panelist must use @buksu.edu.ph institutional email address');
      return;
    }

    setInviting(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.post('/api/programhead/panels/invite', {
        panelId,
        name: inviteForm.name,
        email: inviteForm.email,
        role: inviteForm.role,
        reviewDeadline: inviteForm.reviewDeadline || undefined,
      }, { headers });

      alert(res.data.message || 'Invitation sent successfully!');
      setInviteForm({ name: '', email: '', role: 'member', reviewDeadline: '' });
      setInviteMode(false);

      // Refresh panels list
      const panelsRes = await axios.get('/api/programhead/panels', { headers });
      setPanels(panelsRes.data || []);
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.message || 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  const handleOpenSelectModal = (panel) => {
    setCurrentPanel(panel);
    // Initialize selectedMemberIds with currently selected members (both internal and external)
    const currentlySelected = panel.members
      .filter(m => m.isSelected)
      .map(m => m.isExternal ? m.email : (m.faculty?._id || m.faculty));
    setSelectedMemberIds(currentlySelected);
    setSearchQuery('');
    setSelectModalOpen(true);
  };

  const handleCloseSelectModal = () => {
    setSelectModalOpen(false);
    setCurrentPanel(null);
    setSelectedMemberIds([]);
    setSearchQuery('');
  };

  const handleToggleMemberSelection = (memberId) => {
    setSelectedMemberIds(prev => 
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleSelectAll = () => {
    if (!currentPanel) return;
    const allMemberIds = currentPanel.members
      .map(m => m.isExternal ? m.email : (m.faculty?._id || m.faculty))
      .filter(Boolean);
    
    // If all are selected, deselect all; otherwise select all
    const allSelected = allMemberIds.length > 0 && allMemberIds.every(id => selectedMemberIds.includes(id));
    setSelectedMemberIds(allSelected ? [] : allMemberIds);
  };

  const handleSaveSelection = async () => {
    if (!currentPanel) return;
    
    setSavingSelection(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.put(
        `/api/programhead/panels/${currentPanel._id}/select-members`,
        { selectedMemberIds },
        { headers }
      );
      
      // Update panels list
      setPanels(prev => prev.map(p => p._id === currentPanel._id ? res.data.panel : p));
      
      // Show confirmation
      alert(`Selection saved successfully! ${res.data.selectedCount} panelist(s) selected.`);
      
      handleCloseSelectModal();
      
      // Refresh panels list
      const panelsRes = await axios.get('/api/programhead/panels', { headers });
      setPanels(panelsRes.data || []);
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.message || 'Failed to save selection');
    } finally {
      setSavingSelection(false);
    }
  };


  const handleDeletePanel = async (panelId, panelName) => {
    if (!window.confirm(`WARNING: Are you sure you want to permanently delete "${panelName}"? This action cannot be undone. All panel data, reviews, and documents will be permanently deleted.`)) {
      return;
    }

    // Double confirmation for permanent deletion
    if (!window.confirm(`This will permanently delete "${panelName}" and all associated data. This action cannot be undone. Click OK to proceed.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      await axios.delete(`/api/programhead/panels/${panelId}`, { headers });
      
      alert('Panel deleted successfully');
      
      // Refresh panels list
      const panelsRes = await axios.get('/api/programhead/panels', { headers });
      setPanels(panelsRes.data || []);
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.message || 'Failed to delete panel');
    }
  };

  const handleRemovePanelMember = async (member) => {
    if (!currentPanel) return;

    const memberName = member.isExternal ? member.name : (member.faculty?.name || 'Unknown');
    if (!window.confirm(`Are you sure you want to remove "${memberName}" from this panel?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      // Determine member identifier
      let memberIdentifier;
      if (member.isExternal) {
        memberIdentifier = member.email;
      } else {
        memberIdentifier = member.faculty?._id || member.faculty;
      }

      await axios.delete(`/api/programhead/panels/${currentPanel._id}/members`, {
        headers,
        data: { memberIdentifier }
      });
      
      alert('Panel member removed successfully');
      
      // Refresh current panel data
      const panelsRes = await axios.get('/api/programhead/panels', { headers });
      const updatedPanel = panelsRes.data.find(p => p._id === currentPanel._id);
      if (updatedPanel) {
        setCurrentPanel(updatedPanel);
        // Update selectedMemberIds to remove the deleted member
        setSelectedMemberIds(prev => prev.filter(id => id !== memberIdentifier));
      }
      
      // Refresh panels list
      setPanels(panelsRes.data || []);
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.message || 'Failed to remove panel member');
    }
  };

  // Filter panel members based on search query
  const filteredMembers = currentPanel?.members?.filter(member => {
    const name = member.isExternal ? member.name : (member.faculty?.name || '');
    const email = member.isExternal ? member.email : (member.faculty?.email || '');
    const role = member.role || '';
    const searchLower = searchQuery.toLowerCase();
    return (
      name.toLowerCase().includes(searchLower) ||
      email.toLowerCase().includes(searchLower) ||
      role.toLowerCase().includes(searchLower)
    );
  }) || [];

  return (
    <div className="space-y-6">
      {/* Panel Management Header */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Panel Management</h2>
            <p className="text-sm text-gray-600 mt-1">Create panels and manage panelists for evaluation sessions</p>
          </div>
        </div>
      </div>

      {/* Create New Panel Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Create New Panel</h3>
        <form onSubmit={handleCreatePanel} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Panel Name</label>
              <input value={panelForm.name} onChange={e => setPanelForm({ ...panelForm, name: e.target.value })} className="w-full px-4 py-2 rounded-md border border-gray-300 focus:border-[#7C1D23] focus:ring-2 focus:ring-[#7C1D23]/20 text-sm" placeholder="e.g., Proposal Defense Panel A" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Panel Type</label>
              <select value={panelForm.type} onChange={e => setPanelForm({ ...panelForm, type: e.target.value })} className="w-full px-4 py-2 rounded-md border border-gray-300 focus:border-[#7C1D23] focus:ring-2 focus:ring-[#7C1D23]/20 text-sm">
                <option value="oral_defense">Oral Defense</option>
                <option value="thesis_review">Thesis Review</option>
                <option value="proposal_defense">Proposal Defense</option>
                <option value="final_defense">Final Defense</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Panel Description</label>
            <textarea value={panelForm.description} onChange={e => setPanelForm({ ...panelForm, description: e.target.value })} rows={3} className="w-full px-4 py-2 rounded-md border border-gray-300 focus:border-[#7C1D23] focus:ring-2 focus:ring-[#7C1D23]/20 text-sm" placeholder="Notes for panelists..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Research</label>
            <select value={panelForm.researchId} onChange={e => setPanelForm({ ...panelForm, researchId: e.target.value })} className="w-full px-4 py-2 rounded-md border border-gray-300 focus:border-[#7C1D23] focus:ring-2 focus:ring-[#7C1D23]/20 text-sm">
              <option value="">Select Research</option>
              {availableResearch.map(r => (
                <option key={r._id} value={r._id}>{r.title}</option>
              ))}
            </select>
          </div>
          {/* Toggle between Select and Invite */}
          <div className="flex items-center gap-4 mb-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={!inviteMode}
                onChange={() => setInviteMode(false)}
                className="text-[#7C1D23] focus:ring-[#7C1D23]"
              />
              <span className="text-sm font-medium text-gray-700">Select Existing Faculty</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={inviteMode}
                onChange={() => setInviteMode(true)}
                className="text-[#7C1D23] focus:ring-[#7C1D23]"
              />
              <span className="text-sm font-medium text-gray-700">Invite New Panelist</span>
            </label>
          </div>

          {!inviteMode ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Available Panelists</label>
                <select id="panelistSelect" className="w-full px-4 py-2 rounded-md border border-gray-300 focus:border-[#7C1D23] focus:ring-2 focus:ring-[#7C1D23]/20 text-sm">
                  <option value="">Select Faculty</option>
                  {availablePanelists.map(p => (
                    <option key={p._id} value={p._id}>{p.name} ({p.email})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select id="roleSelect" className="w-full px-4 py-2 rounded-md border border-gray-300 focus:border-[#7C1D23] focus:ring-2 focus:ring-[#7C1D23]/20 text-sm">
                  <option value="chair">Chair</option>
                  <option value="member">Member</option>
                  <option value="external_examiner">External Examiner</option>
                </select>
              </div>
              <div>
                <button type="button" onClick={() => {
                  const facultyId = document.getElementById('panelistSelect')?.value;
                  const role = document.getElementById('roleSelect')?.value;
                  handleAddMember(facultyId, role);
                }} className="w-full bg-[#7C1D23] text-white px-6 py-2 rounded-md font-medium hover:bg-[#5a1519] transition-all text-sm">Add Panelist</button>
              </div>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <p className="text-sm text-blue-800 font-medium">Invite external panelist via email (no account required)</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={inviteForm.name}
                    onChange={e => setInviteForm({ ...inviteForm, name: e.target.value })}
                    className="w-full px-4 py-2 rounded-md border border-gray-300 focus:border-[#7C1D23] focus:ring-2 focus:ring-[#7C1D23]/20 text-sm"
                    
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Institutional Email <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    value={inviteForm.email}
                    onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })}
                    className="w-full px-4 py-2 rounded-md border border-gray-300 focus:border-[#7C1D23] focus:ring-2 focus:ring-[#7C1D23]/20 text-sm"
                   
                  />
                  <p className="text-xs text-gray-500 mt-1">Must use @buksu.edu.ph email address</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role <span className="text-red-500">*</span></label>
                  <select
                    value={inviteForm.role}
                    onChange={e => setInviteForm({ ...inviteForm, role: e.target.value })}
                    className="w-full px-4 py-2 rounded-md border border-gray-300 focus:border-[#7C1D23] focus:ring-2 focus:ring-[#7C1D23]/20 text-sm"
                  >
                    <option value="chair">Chair</option>
                    <option value="member">Member</option>
                    <option value="external_examiner">External Examiner</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Review Deadline (Optional)</label>
                  <input
                    type="date"
                    value={inviteForm.reviewDeadline}
                    onChange={e => setInviteForm({ ...inviteForm, reviewDeadline: e.target.value })}
                    className="w-full px-4 py-2 rounded-md border border-gray-300 focus:border-[#7C1D23] focus:ring-2 focus:ring-[#7C1D23]/20 text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setInviteForm({ name: '', email: '', role: 'member', reviewDeadline: '' });
                    setInviteMode(false);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors mr-2"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // This will be handled after panel creation - store invite data for now
                    const inviteData = { ...inviteForm, isExternal: true };
                    setSelectedMembers(prev => [...prev, inviteData]);
                    setInviteForm({ name: '', email: '', role: 'member', reviewDeadline: '' });
                    setInviteMode(false);
                  }}
                  className="px-4 py-2 bg-[#7C1D23] text-white rounded-md text-sm font-medium hover:bg-[#5a1519] transition-colors"
                >
                  Add to Panel
                </button>
              </div>
            </div>
          )}
          {selectedMembers.length > 0 && (
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Selected Panelists</h4>
              <div className="flex flex-wrap gap-2">
                {selectedMembers.map((m, idx) => {
                  if (m.isExternal) {
                    return (
                      <span key={`external-${idx}`} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-300 text-sm">
                        {m.name} ({m.email}) — {m.role.replace(/_/g, ' ')} <span className="text-xs text-blue-600">(Invited)</span>
                        <button type="button" onClick={() => setSelectedMembers(prev => prev.filter((mem, i) => i !== idx))} className="text-gray-500 hover:text-gray-700">&times;</button>
                      </span>
                    );
                  }
                  const person = availablePanelists.find(p => p._id === m.faculty);
                  return (
                    <span key={m.faculty} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-gray-300 text-sm">
                      {person?.name || m.faculty} — {m.role.replace(/_/g, ' ')}
                      <button type="button" onClick={() => handleRemoveMember(m.faculty)} className="text-gray-500 hover:text-gray-700">&times;</button>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          <div>
            <button type="submit" disabled={loading} className="bg-[#7C1D23] text-white px-6 py-2 rounded-md font-medium hover:bg-[#5a1519] transition-all text-sm disabled:opacity-60">
              {loading ? 'Creating...' : 'Create Panel'}
            </button>
          </div>
        </form>
      </div>

      {/* All Panels List */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">All Panels</h3>
            <p className="text-sm text-gray-600 mt-1">{panels.length} panel{panels.length !== 1 ? 's' : ''} total</p>
          </div>
        </div>
        
        {panels.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
            <p className="text-gray-500 mb-2">No panels created yet</p>
            <p className="text-sm text-gray-400">Create your first panel above to get started</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {panels.map(panel => (
              <div key={panel._id} className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="text-base font-semibold text-gray-900">{panel.name}</h4>
                      <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-700">
                        {panel.type?.replace(/_/g, ' ')}
                      </span>
                    </div>
                    {panel.description && (
                      <p className="text-sm text-gray-700 mb-2">{panel.description}</p>
                    )}
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Research:</span> {panel.research?.title || 'N/A'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenSelectModal(panel)}
                      className="px-4 py-2 bg-[#7C1D23] text-white rounded-md hover:bg-[#5a1519] transition-colors text-sm font-medium whitespace-nowrap"
                    >
                      Manage Active Panelists
                    </button>
                    <button
                      onClick={() => handleDeletePanel(panel._id, panel.name)}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium whitespace-nowrap"
                      title="Delete Panel (Permanent)"
                    >
                      <FaTrash className="inline mr-1" />
                      Delete
                    </button>
                  </div>
                </div>

                {/* Panel Members Summary */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-sm font-semibold text-gray-700">
                      Panel Members ({panel.members?.length || 0} assigned, {panel.members?.filter(m => m.isSelected).length || 0} active)
                    </h5>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {panel.members?.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">No panelists assigned yet</p>
                    ) : (
                      panel.members?.map((m, idx) => (
                        <span key={m._id || m.faculty || `member-${idx}`} className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm ${
                          m.isSelected 
                            ? 'bg-green-50 border-green-300 text-green-800' 
                            : 'bg-gray-50 border-gray-200 text-gray-600'
                        }`}>
                          {m.isExternal ? `${m.name} (${m.email})` : (m.faculty?.name || 'Unknown')}
                          <span className="text-xs">({m.role.replace(/_/g, ' ')})</span>
                          {m.isExternal && <span className="text-xs text-blue-600">External</span>}
                          {m.isSelected && <span className="text-xs font-semibold">✓ Active</span>}
                          {!m.isSelected && <span className="text-xs text-gray-400">Inactive</span>}
                          {m.status === 'invited' && <span className="text-xs text-orange-600">Invited</span>}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Add New Panelist */}
                <div className="pt-4 border-t border-gray-200">
                  <div className="mb-3 flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name={`add-mode-${panel._id}`}
                        checked={!inviteMode}
                        onChange={() => setInviteMode(false)}
                        className="text-[#7C1D23] focus:ring-[#7C1D23]"
                      />
                      <span className="text-xs font-medium text-gray-700">Select Existing</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name={`add-mode-${panel._id}`}
                        checked={inviteMode}
                        onChange={() => setInviteMode(true)}
                        className="text-[#7C1D23] focus:ring-[#7C1D23]"
                      />
                      <span className="text-xs font-medium text-gray-700">Invite New</span>
                    </label>
                  </div>
                  {!inviteMode ? (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Add Panelist</label>
                        <select id={`panelist-${panel._id}`} className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm">
                          <option value="">Select Faculty</option>
                          {availablePanelists.map(p => (
                            <option key={p._id} value={p._id}>{p.name} ({p.email})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                        <select id={`role-${panel._id}`} className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm">
                          <option value="chair">Chair</option>
                          <option value="member">Member</option>
                          <option value="external_examiner">External Examiner</option>
                        </select>
                      </div>
                      <div className="flex items-end">
                        <button type="button" onClick={() => {
                          const facultyId = document.getElementById(`panelist-${panel._id}`)?.value;
                          const role = document.getElementById(`role-${panel._id}`)?.value;
                          if (!facultyId) return;
                          const next = [...(panel.members || []).map(m => ({ faculty: m.faculty?._id || m.faculty, role: m.role }))];
                          if (!next.find(m => m.faculty === facultyId)) next.push({ faculty: facultyId, role });
                          handleUpdateMembers(panel._id, next);
                        }} className="w-full bg-white border border-gray-300 px-4 py-2 rounded-md text-sm hover:bg-gray-50 transition-colors">
                          Add Panelist
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                          <input
                            type="text"
                            value={inviteForm.name}
                            onChange={e => setInviteForm({ ...inviteForm, name: e.target.value })}
                            className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm"
                            placeholder="Dr. John Doe"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                          <input
                            type="email"
                            value={inviteForm.email}
                            onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })}
                            className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm"
                            placeholder="john.doe@buksu.edu.ph"
                          />
                          <p className="text-xs text-gray-500 mt-1">Must use @buksu.edu.ph</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Role <span className="text-red-500">*</span></label>
                          <select
                            value={inviteForm.role}
                            onChange={e => setInviteForm({ ...inviteForm, role: e.target.value })}
                            className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm"
                          >
                            <option value="chair">Chair</option>
                            <option value="member">Member</option>
                            <option value="external_examiner">External Examiner</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Review Deadline</label>
                          <input
                            type="date"
                            value={inviteForm.reviewDeadline}
                            onChange={e => setInviteForm({ ...inviteForm, reviewDeadline: e.target.value })}
                            className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setInviteForm({ name: '', email: '', role: 'member', reviewDeadline: '' });
                            setInviteMode(false);
                          }}
                          className="px-3 py-1 border border-gray-300 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInvitePanelist(panel._id)}
                          disabled={inviting}
                          className="px-3 py-1 bg-[#7C1D23] text-white rounded-md text-xs font-medium hover:bg-[#5a1519] transition-colors disabled:opacity-60"
                        >
                          {inviting ? 'Sending...' : 'Send Invitation'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Select Members Modal */}
      {selectModalOpen && currentPanel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Manage Active Panelists</h3>
                  <p className="text-sm text-gray-600 mt-1">{currentPanel.name}</p>
                  <p className="text-xs text-gray-500 mt-1">Select which assigned panelists will actively participate in this evaluation</p>
                </div>
                <button
                  onClick={handleCloseSelectModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <FaClose className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Search Bar and Select All */}
            <div className="p-5 border-b border-gray-200">
              <div className="flex gap-3 items-center">
                <input
                  type="text"
                  placeholder="Search panelists by name, email, or role..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 px-4 py-2 rounded-md border border-gray-300 focus:border-[#7C1D23] focus:ring-2 focus:ring-[#7C1D23]/20 text-sm"
                />
                {currentPanel && currentPanel.members?.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap"
                  >
                    {(() => {
                      const allMemberIds = currentPanel.members
                        .map(m => m.faculty?._id || m.faculty)
                        .filter(Boolean);
                      const allSelected = allMemberIds.length > 0 && 
                        allMemberIds.every(id => selectedMemberIds.includes(id));
                      return allSelected ? 'Deselect All' : 'Select All';
                    })()}
                  </button>
                )}
              </div>
            </div>

            {/* Member List */}
            <div className="flex-1 overflow-y-auto p-5">
              {filteredMembers.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No panelists found.</p>
              ) : (
                <div className="space-y-2">
                  {filteredMembers.map((member, index) => {
                    const memberId = member.isExternal ? member.email : (member.faculty?._id || member.faculty);
                    const isSelected = selectedMemberIds.includes(memberId);
                    return (
                      <label
                        key={member._id || index}
                        className={`flex items-center p-3 rounded-lg border cursor-pointer hover:bg-gray-50 transition-colors ${
                          isSelected ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleMemberSelection(memberId)}
                          className="h-4 w-4 text-[#7C1D23] focus:ring-[#7C1D23] border-gray-300 rounded"
                        />
                        <div className="ml-3 flex-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {member.isExternal ? member.name : (member.faculty?.name || 'Unknown')}
                              </p>
                              <p className="text-xs text-gray-500">
                                {member.isExternal ? member.email : (member.faculty?.email || '')}
                                {member.isExternal && <span className="ml-2 text-blue-600">(External)</span>}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="text-right">
                                <span className="inline-block px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-700">
                                  {member.role.replace(/_/g, ' ')}
                                </span>
                                <span className={`ml-2 inline-block px-2 py-1 text-xs rounded ${
                                  member.status === 'confirmed' 
                                    ? 'bg-green-100 text-green-700'
                                    : member.status === 'declined'
                                    ? 'bg-red-100 text-red-700'
                                    : member.status === 'invited'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {member.status}
                                </span>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemovePanelMember(member);
                                }}
                                className="px-2 py-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                                title="Remove Panel Member"
                              >
                                <FaTrash />
                              </button>
                            </div>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  <span className="font-medium">{selectedMemberIds.length}</span> of {currentPanel.members?.length || 0} panelist(s) selected
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleCloseSelectModal}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveSelection}
                    disabled={savingSelection}
                    className="px-4 py-2 bg-[#7C1D23] text-white rounded-md text-sm font-medium hover:bg-[#5a1519] transition-colors disabled:opacity-60"
                  >
                    {savingSelection ? 'Saving...' : 'Save Active Panelists'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Schedule Management Component
const ScheduleManagement = ({ calendarConnected, onConnectCalendar, onDisconnectCalendar, calendarLoading }) => {
  const [activeTab, setActiveTab] = useState("consultations"); // "consultations", "panels", or "calendar"
  const [consultationSchedules, setConsultationSchedules] = useState([]);
  const [panelsWithoutSchedule, setPanelsWithoutSchedule] = useState([]);
  const [createdPanelSchedules, setCreatedPanelSchedules] = useState([]);
  const [finalizedSchedules, setFinalizedSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [selectedPanel, setSelectedPanel] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({
    datetime: '',
    duration: 120,
    location: '',
    description: '',
  });
  const [editForm, setEditForm] = useState({
    datetime: '',
    duration: 120,
    location: '',
    description: '',
    sendNotifications: true,
  });
  const [conflicts, setConflicts] = useState(null);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [calendarView, setCalendarView] = useState("month"); // "month", "week", "day", "agenda"
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    fetchPendingSchedules();
    fetchPanelsWithoutSchedule();
    if (activeTab === "created") {
      fetchCreatedPanelSchedules();
    }
    if (activeTab === "calendar") {
      fetchFinalizedSchedules();
    }
  }, [activeTab]);

  const fetchPendingSchedules = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/programhead/schedules/pending-finalization?type=consultation', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConsultationSchedules(res.data || []);
    } catch (error) {
      console.error('Error fetching consultation schedules:', error);
      alert('Error loading consultation schedules');
    } finally {
      setLoading(false);
    }
  };

  const fetchPanelsWithoutSchedule = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/programhead/panels', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Get all panels with schedules
      const schedulesRes = await axios.get('/api/programhead/schedules', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const scheduledPanelIds = new Set(
        (schedulesRes.data || [])
          .filter(s => s.panel)
          .map(s => s.panel._id || s.panel)
      );

      // Filter panels without schedules and not completed/archived
      const panels = (res.data || []).filter(p => 
        !scheduledPanelIds.has(p._id) && 
        p.status !== 'completed' && 
        p.status !== 'archived'
      );
      setPanelsWithoutSchedule(panels);
    } catch (error) {
      console.error('Error fetching panels:', error);
    }
  };

  const fetchCreatedPanelSchedules = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/programhead/schedules/panel-defense', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCreatedPanelSchedules(res.data || []);
    } catch (error) {
      console.error('Error fetching created panel schedules:', error);
      alert('Error loading panel defense schedules');
    } finally {
      setLoading(false);
    }
  };

  const fetchFinalizedSchedules = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/programhead/schedules', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Filter only finalized schedules
      const finalized = (res.data || []).filter(s => s.status === 'finalized');
      setFinalizedSchedules(finalized);
    } catch (error) {
      console.error('Error fetching finalized schedules:', error);
      alert('Error loading finalized schedules');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllSchedules = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/programhead/schedules', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Filter only finalized schedules
      const finalized = (res.data || []).filter(s => s.status === 'finalized');
      setFinalizedSchedules(finalized);
    } catch (error) {
      console.error('Error fetching schedules:', error);
    }
  };

  const handleFinalizeConsultation = async (scheduleId) => {
    if (!window.confirm('Are you sure you want to finalize this consultation schedule? All participants will be notified.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.put(`/api/programhead/schedules/${scheduleId}/finalize`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Schedule finalized successfully! Participants have been notified.');
      fetchPendingSchedules();
      // Refresh calendar if on calendar tab
      if (activeTab === "calendar") {
        fetchFinalizedSchedules();
      }
    } catch (error) {
      console.error('Error finalizing schedule:', error);
      alert(error.response?.data?.message || 'Error finalizing schedule');
    }
  };

  const handleCheckConflicts = async () => {
    if (!scheduleForm.datetime || !scheduleForm.location) {
      alert('Please fill in date/time and location first');
      return;
    }

    setCheckingConflicts(true);
    try {
      const token = localStorage.getItem('token');
      const panel = panelsWithoutSchedule.find(p => p._id === selectedPanel);
      
      // Get participant IDs (panelists, students, and adviser)
      const participants = [];
      if (panel) {
        // Internal panelists
        const activeMembers = panel.members.filter(m => m.isSelected && !m.isExternal);
        activeMembers.forEach(m => {
          if (m.faculty?._id || m.faculty) {
            participants.push({ userId: m.faculty._id || m.faculty });
          }
        });
        
        // Students
        if (panel.research?.students) {
          const students = Array.isArray(panel.research.students) ? panel.research.students : [panel.research.students];
          students.forEach(student => {
            if (student._id || student) {
              participants.push({ userId: student._id || student });
            }
          });
        }
        
        // Adviser
        if (panel.research?.adviser?._id || panel.research?.adviser) {
          participants.push({ userId: panel.research.adviser._id || panel.research.adviser });
        }
      }

      const res = await axios.post('/api/programhead/schedules/check-conflicts', {
        datetime: scheduleForm.datetime,
        duration: scheduleForm.duration,
        location: scheduleForm.location,
        participants,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setConflicts(res.data);
      if (res.data.hasConflicts) {
        alert('Conflicts detected! Please review and adjust the schedule.');
      } else {
        alert('No conflicts detected. You can proceed with finalization.');
      }
    } catch (error) {
      console.error('Error checking conflicts:', error);
      alert('Error checking conflicts');
    } finally {
      setCheckingConflicts(false);
    }
  };

  const handleCreatePanelSchedule = async () => {
    if (!selectedPanel || !scheduleForm.datetime || !scheduleForm.location) {
      alert('Please fill in all required fields');
      return;
    }

    // Get panel details for confirmation
    const panel = panelsWithoutSchedule.find(p => p._id === selectedPanel);
    const scheduleDate = new Date(scheduleForm.datetime);
    const formattedDate = scheduleDate.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

    // Create detailed confirmation message
    let confirmMessage = `Create and finalize panel schedule?\n\n`;
    if (panel) {
      confirmMessage += `Panel: ${panel.name}\n`;
      confirmMessage += `Research: ${panel.research?.title || 'N/A'}\n`;
    }
    confirmMessage += `Date & Time: ${formattedDate}\n`;
    confirmMessage += `Duration: ${scheduleForm.duration} minutes\n`;
    confirmMessage += `Location: ${scheduleForm.location}\n\n`;
    confirmMessage += `All participants (panelists, students, and adviser) will be notified via email.`;
    
    if (conflicts && conflicts.hasConflicts) {
      confirmMessage += `\n\n⚠️ WARNING: Conflicts detected! Proceed anyway?`;
    }

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      await axios.post(`/api/programhead/panels/${selectedPanel}/schedule`, {
        datetime: scheduleForm.datetime,
        duration: scheduleForm.duration,
        location: scheduleForm.location,
        description: scheduleForm.description,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert('Panel schedule created and finalized successfully! All participants have been notified.');
      setShowCreateModal(false);
      setSelectedPanel(null);
      setScheduleForm({ datetime: '', duration: 120, location: '', description: '' });
      setConflicts(null);
      fetchPanelsWithoutSchedule();
      // Refresh created schedules if on that tab
      if (activeTab === "created") {
        fetchCreatedPanelSchedules();
      }
      // Refresh calendar if on calendar tab
      if (activeTab === "calendar") {
        fetchFinalizedSchedules();
      }
    } catch (error) {
      console.error('Error creating panel schedule:', error);
      alert(error.response?.data?.message || 'Error creating panel schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSchedule = async () => {
    if (!editingSchedule || !editForm.datetime || !editForm.location) {
      alert('Please fill in all required fields');
      return;
    }

    const confirmMessage = `Update this schedule?\n\n${
      editForm.sendNotifications 
        ? 'All participants will be notified via email about the changes.' 
        : 'No email notifications will be sent.'
    }`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      await axios.put(`/api/programhead/schedules/${editingSchedule._id}`, {
        datetime: editForm.datetime,
        duration: editForm.duration,
        location: editForm.location,
        description: editForm.description,
        sendNotifications: editForm.sendNotifications,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert('Schedule updated successfully!');
      setShowEditModal(false);
      setEditingSchedule(null);
      setEditForm({ datetime: '', duration: 120, location: '', description: '', sendNotifications: true });
      fetchCreatedPanelSchedules();
      // Refresh calendar if on calendar tab
      if (activeTab === "calendar") {
        fetchFinalizedSchedules();
      }
    } catch (error) {
      console.error('Error updating schedule:', error);
      alert(error.response?.data?.message || 'Error updating schedule');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (datetime) => {
    const date = new Date(datetime);
    return {
      date: date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      full: date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }),
    };
  };

  // Convert schedules to calendar events
  const calendarEvents = finalizedSchedules.map(schedule => {
    const start = new Date(schedule.datetime);
    const end = new Date(start.getTime() + (schedule.duration || 60) * 60000);
    const scheduleType = schedule.type === "consultation" ? "Consultation" : 
                        schedule.type === "proposal_defense" ? "Proposal Defense" : 
                        "Final Defense";
    
    return {
      id: schedule._id,
      title: schedule.title || `${scheduleType} - ${schedule.research?.title || 'N/A'}`,
      start: start,
      end: end,
      resource: {
        ...schedule,
        scheduleType,
      },
    };
  });

  const handleSelectEvent = (event) => {
    setSelectedEvent(event.resource);
  };

  const handleSelectSlot = ({ start, end }) => {
    // Optional: Allow clicking on calendar to create new schedule
    // For now, just show the selected time
    console.log('Selected slot:', start, end);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Schedule Finalization</h2>
        <p className="text-sm text-gray-600">Finalize consultation schedules and create panel defense schedules</p>
      </div>

      {/* Google Calendar Connection */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
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

      {/* Tabs */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab("consultations")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "consultations"
                ? "text-[#7C1D23] border-b-2 border-[#7C1D23]"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Consultation Schedules
          </button>
          <button
            onClick={() => setActiveTab("panels")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "panels"
                ? "text-[#7C1D23] border-b-2 border-[#7C1D23]"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Create Panel Schedule
          </button>
          <button
            onClick={() => setActiveTab("created")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "created"
                ? "text-[#7C1D23] border-b-2 border-[#7C1D23]"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Created Panel Schedules
          </button>
          <button
            onClick={() => setActiveTab("calendar")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "calendar"
                ? "text-[#7C1D23] border-b-2 border-[#7C1D23]"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Calendar View
          </button>
        </div>

        {/* Consultation Schedules Tab */}
        {activeTab === "consultations" && (
          <div className="p-5">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Pending Finalization</h3>
            {loading ? (
              <p className="text-center py-8 text-gray-500">Loading...</p>
            ) : consultationSchedules.length === 0 ? (
              <p className="text-center py-8 text-gray-500">No consultation schedules pending finalization</p>
            ) : (
              <div className="space-y-4">
                {consultationSchedules.map(schedule => {
                  const dt = formatDateTime(schedule.datetime);
                  const endTime = new Date(new Date(schedule.datetime).getTime() + schedule.duration * 60000);
                  return (
                    <div key={schedule._id} className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="text-base font-semibold text-gray-900 mb-2">{schedule.title}</h4>
                          {schedule.research && (
                            <p className="text-sm text-gray-600 mb-1">
                              <strong>Research:</strong> {schedule.research.title}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <FaCalendarAlt className="text-[#7C1D23]" />
                              <span>{dt.full}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <FaClock className="text-[#7C1D23]" />
                              <span>{schedule.duration} minutes</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <FaMapMarkerAlt className="text-[#7C1D23]" />
                              <span>{schedule.location}</span>
                            </div>
                          </div>
                          {schedule.participants && schedule.participants.length > 0 && (
                            <div className="mt-3">
                              <p className="text-xs text-gray-500 mb-1">Participants:</p>
                              <div className="flex flex-wrap gap-2">
                                {schedule.participants.map((p, idx) => (
                                  <span key={idx} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                                    {p.user?.name || 'Unknown'} ({p.role.replace(/_/g, ' ')})
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleFinalizeConsultation(schedule._id)}
                          className="ml-4 px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition-colors"
                        >
                          Finalize Schedule
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Panel Defense Schedules Tab */}
        {activeTab === "panels" && (
          <div className="p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Panels Without Schedules</h3>
              <button
                onClick={() => {
                  setShowCreateModal(true);
                  setSelectedPanel(null);
                  setScheduleForm({ datetime: '', duration: 120, location: '', description: '' });
                  setConflicts(null);
                }}
                className="flex items-center px-4 py-2 bg-[#7C1D23] text-white rounded-md hover:bg-[#5a1519] transition-colors text-sm font-medium"
              >
                <FaCalendarAlt className="mr-2" />
                Create Panel Schedule
              </button>
            </div>

            {panelsWithoutSchedule.length === 0 ? (
              <p className="text-center py-8 text-gray-500">All panels have schedules assigned</p>
            ) : (
              <div className="space-y-4">
                {panelsWithoutSchedule.map(panel => (
                  <div key={panel._id} className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-base font-semibold text-gray-900 mb-1">{panel.name}</h4>
                        <p className="text-sm text-gray-600 mb-2">{panel.research?.title || 'N/A'}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                            {panel.type.replace(/_/g, ' ')}
                          </span>
                          <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                            {panel.members.filter(m => m.isSelected).length} panelists
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedPanel(panel._id);
                          setShowCreateModal(true);
                          setScheduleForm({ datetime: '', duration: 120, location: '', description: '' });
                          setConflicts(null);
                        }}
                        className="ml-4 px-4 py-2 bg-[#7C1D23] text-white rounded-md text-sm font-medium hover:bg-[#5a1519] transition-colors"
                      >
                        Create Schedule
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Created Panel Schedules Tab */}
        {activeTab === "created" && (
          <div className="p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Created Panel Defense Schedules</h3>
              <button
                onClick={fetchCreatedPanelSchedules}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm font-medium"
              >
                Refresh
              </button>
            </div>

            {loading ? (
              <p className="text-center py-8 text-gray-500">Loading...</p>
            ) : createdPanelSchedules.length === 0 ? (
              <p className="text-center py-8 text-gray-500">No panel defense schedules created yet</p>
            ) : (
              <div className="space-y-4">
                {createdPanelSchedules.map(schedule => (
                  <div key={schedule._id} className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="text-base font-semibold text-gray-900">{schedule.panel?.name || schedule.title}</h4>
                          <span className={`px-2 py-1 text-xs font-medium rounded ${
                            schedule.status === 'finalized' ? 'bg-green-100 text-green-700' :
                            schedule.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                            schedule.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                            schedule.status === 'confirmed' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {schedule.status.charAt(0).toUpperCase() + schedule.status.slice(1)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{schedule.research?.title || schedule.panel?.research?.title || 'N/A'}</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
                          <div className="flex items-center gap-2">
                            <FaCalendarAlt className="text-[#7C1D23]" />
                            <span className="text-gray-700">
                              {new Date(schedule.datetime).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric', 
                                year: 'numeric' 
                              })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <FaClock className="text-[#7C1D23]" />
                            <span className="text-gray-700">
                              {new Date(schedule.datetime).toLocaleTimeString('en-US', { 
                                hour: 'numeric', 
                                minute: '2-digit' 
                              })} ({schedule.duration} min)
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <FaMapMarkerAlt className="text-[#7C1D23]" />
                            <span className="text-gray-700">{schedule.location}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <FaUsers className="text-[#7C1D23]" />
                            <span className="text-gray-700">
                              {schedule.participants?.length || 0} participants
                            </span>
                          </div>
                        </div>
                        {schedule.description && (
                          <p className="text-sm text-gray-600 mt-2">{schedule.description}</p>
                        )}
                        {schedule.finalizedBy && (
                          <p className="text-xs text-gray-500 mt-2">
                            Finalized by: {schedule.finalizedBy?.name || 'Unknown'} on {new Date(schedule.finalizedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {schedule.status !== 'cancelled' && schedule.status !== 'completed' && (
                          <button
                            onClick={() => {
                              const scheduleDate = new Date(schedule.datetime);
                              const dateTimeLocal = new Date(scheduleDate.getTime() - scheduleDate.getTimezoneOffset() * 60000)
                                .toISOString()
                                .slice(0, 16);
                              setEditForm({
                                datetime: dateTimeLocal,
                                duration: schedule.duration,
                                location: schedule.location,
                                description: schedule.description || '',
                                sendNotifications: true,
                              });
                              setEditingSchedule(schedule);
                              setShowEditModal(true);
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Edit"
                          >
                            <FaEdit />
                          </button>
                        )}
                        {schedule.status !== 'cancelled' && (
                          <button
                            onClick={async () => {
                              if (window.confirm('Are you sure you want to cancel/archive this schedule? All participants will be notified.')) {
                                try {
                                  const token = localStorage.getItem('token');
                                  await axios.put(`/api/programhead/schedules/${schedule._id}/archive`, {}, {
                                    headers: { Authorization: `Bearer ${token}` }
                                  });
                                  alert('Schedule cancelled successfully!');
                                  fetchCreatedPanelSchedules();
                                  if (activeTab === "calendar") {
                                    fetchAllSchedules();
                                  }
                                } catch (error) {
                                  console.error('Error cancelling schedule:', error);
                                  alert(error.response?.data?.message || 'Error cancelling schedule');
                                }
                              }
                            }}
                            className="p-2 text-orange-600 hover:bg-orange-50 rounded transition-colors"
                            title="Cancel/Archive"
                          >
                            <FaTrash />
                          </button>
                        )}
                        {schedule.status === 'cancelled' && (
                          <button
                            onClick={async () => {
                              if (window.confirm('Are you sure you want to permanently delete this cancelled schedule? This action cannot be undone.')) {
                                try {
                                  const token = localStorage.getItem('token');
                                  await axios.delete(`/api/programhead/schedules/${schedule._id}`, {
                                    headers: { Authorization: `Bearer ${token}` }
                                  });
                                  alert('Schedule deleted successfully!');
                                  fetchCreatedPanelSchedules();
                                  if (activeTab === "calendar") {
                                    fetchAllSchedules();
                                  }
                                } catch (error) {
                                  console.error('Error deleting schedule:', error);
                                  alert(error.response?.data?.message || 'Error deleting schedule');
                                }
                              }
                            }}
                            className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete Permanently"
                          >
                            <FaTrash />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Calendar View Tab */}
        {activeTab === "calendar" && (
          <div className="p-5">
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
                .rbc-event {
                  padding: 4px 8px !important;
                  border-radius: 4px !important;
                  font-size: 13px !important;
                  cursor: pointer !important;
                }
                .rbc-event:focus {
                  outline: 2px solid #7C1D23 !important;
                  outline-offset: 2px !important;
                }
                .rbc-day-slot .rbc-time-slot {
                  border-top: 1px solid #e5e7eb !important;
                }
                .rbc-time-header-content {
                  border-left: 1px solid #e5e7eb !important;
                }
                .rbc-day-bg {
                  border: 1px solid #e5e7eb !important;
                }
                .rbc-time-content {
                  border-top: 2px solid #e5e7eb !important;
                }
                .rbc-time-view {
                  border: 1px solid #e5e7eb !important;
                }
                .rbc-month-view {
                  border: 1px solid #e5e7eb !important;
                }
                .rbc-agenda-view {
                  border: 1px solid #e5e7eb !important;
                }
                .rbc-agenda-empty {
                  padding: 40px !important;
                  color: #6b7280 !important;
                  font-size: 14px !important;
                }
              `}</style>
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500">Loading calendar...</p>
                </div>
              ) : (
                <>
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
                    selectable
                    views={['month', 'week', 'day', 'agenda']}
                    step={30}
                    showMultiDayTimes
                    popup
                    messages={{
                      date: 'Date',
                      time: 'Time',
                      event: 'Schedule',
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
                      noEventsInRange: 'No schedules finalized in this range.',
                      showMore: total => `+${total} more`
                    }}
                    eventPropGetter={(event) => {
                      const isConsultation = event.resource.type === 'consultation';
                      return {
                        style: {
                          backgroundColor: isConsultation ? '#3b82f6' : '#7C1D23',
                          borderColor: isConsultation ? '#2563eb' : '#5a1519',
                          color: '#fff',
                        }
                      };
                    }}
                    tooltipAccessor={(event) => `${event.title} - ${event.resource.location || 'Location TBD'}`}
                  />
                </>
              )}
            </div>

            {/* Event Details Modal */}
            {selectedEvent && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="p-5 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900">Schedule Details</h3>
                      <button
                        onClick={() => setSelectedEvent(null)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <FaClose className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                  <div className="p-5 space-y-4">
                    <div>
                      <h4 className="text-base font-semibold text-gray-900 mb-2">{selectedEvent.title}</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <FaCalendarAlt className="text-[#7C1D23]" />
                          <span className="text-gray-700">
                            <strong>Date & Time:</strong> {formatDateTime(selectedEvent.datetime).full}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FaClock className="text-[#7C1D23]" />
                          <span className="text-gray-700">
                            <strong>Duration:</strong> {selectedEvent.duration} minutes
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FaMapMarkerAlt className="text-[#7C1D23]" />
                          <span className="text-gray-700">
                            <strong>Location:</strong> {selectedEvent.location}
                          </span>
                        </div>
                        <div>
                          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                            {selectedEvent.type === 'consultation' ? 'Consultation' : 
                             selectedEvent.type === 'proposal_defense' ? 'Proposal Defense' : 
                             'Final Defense'}
                          </span>
                          <span className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-700 rounded">
                            Finalized
                          </span>
                        </div>
                        {selectedEvent.research && (
                          <div>
                            <strong>Research:</strong> {selectedEvent.research.title || 'N/A'}
                          </div>
                        )}
                        {selectedEvent.description && (
                          <div>
                            <strong>Description:</strong> {selectedEvent.description}
                          </div>
                        )}
                        {selectedEvent.participants && selectedEvent.participants.length > 0 && (
                          <div>
                            <strong>Participants:</strong>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {selectedEvent.participants.map((p, idx) => (
                                <span key={idx} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                                  {p.user?.name || 'Unknown'} ({p.role.replace(/_/g, ' ')})
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {selectedEvent.finalizedBy && (
                          <div>
                            <strong>Finalized By:</strong> {selectedEvent.finalizedBy.name || 'Unknown'}
                          </div>
                        )}
                        {selectedEvent.finalizedAt && (
                          <div>
                            <strong>Finalized At:</strong> {new Date(selectedEvent.finalizedAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="p-5 border-t border-gray-200 bg-gray-50">
                    <button
                      onClick={() => setSelectedEvent(null)}
                      className="w-full px-4 py-2 bg-[#7C1D23] text-white rounded-md text-sm font-medium hover:bg-[#5a1519] transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Panel Schedule Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedPanel ? 'Create Panel Schedule' : 'Create Panel Schedule'}
                </h3>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setSelectedPanel(null);
                    setScheduleForm({ datetime: '', duration: 120, location: '', description: '' });
                    setConflicts(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FaClose className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {selectedPanel && (
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-1">Selected Panel:</p>
                  <p className="text-base font-semibold text-gray-900">
                    {panelsWithoutSchedule.find(p => p._id === selectedPanel)?.name || 'N/A'}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {panelsWithoutSchedule.find(p => p._id === selectedPanel)?.research?.title || 'N/A'}
                  </p>
                </div>
              )}

              {!selectedPanel && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Panel <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedPanel || ''}
                    onChange={(e) => {
                      setSelectedPanel(e.target.value);
                      setConflicts(null);
                    }}
                    className="w-full px-4 py-2 rounded-md border border-gray-300 focus:border-[#7C1D23] focus:ring-2 focus:ring-[#7C1D23]/20"
                  >
                    <option value="">-- Select a panel --</option>
                    {panelsWithoutSchedule.map(panel => (
                      <option key={panel._id} value={panel._id}>
                        {panel.name} - {panel.research?.title || 'N/A'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date & Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={scheduleForm.datetime}
                  onChange={(e) => {
                    setScheduleForm({ ...scheduleForm, datetime: e.target.value });
                    setConflicts(null);
                  }}
                  className="w-full px-4 py-2 rounded-md border border-gray-300 focus:border-[#7C1D23] focus:ring-2 focus:ring-[#7C1D23]/20"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Duration (minutes) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={scheduleForm.duration}
                  onChange={(e) => {
                    setScheduleForm({ ...scheduleForm, duration: parseInt(e.target.value) || 120 });
                    setConflicts(null);
                  }}
                  min="30"
                  step="30"
                  className="w-full px-4 py-2 rounded-md border border-gray-300 focus:border-[#7C1D23] focus:ring-2 focus:ring-[#7C1D23]/20"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={scheduleForm.location}
                  onChange={(e) => {
                    setScheduleForm({ ...scheduleForm, location: e.target.value });
                    setConflicts(null);
                  }}
                  placeholder="e.g., Room 301, Research Building"
                  className="w-full px-4 py-2 rounded-md border border-gray-300 focus:border-[#7C1D23] focus:ring-2 focus:ring-[#7C1D23]/20"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={scheduleForm.description}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 rounded-md border border-gray-300 focus:border-[#7C1D23] focus:ring-2 focus:ring-[#7C1D23]/20"
                  placeholder="Additional notes or instructions..."
                />
              </div>

              {/* Conflict Check */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCheckConflicts}
                  disabled={!scheduleForm.datetime || !scheduleForm.location || !selectedPanel || checkingConflicts}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-md text-sm font-medium hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {checkingConflicts ? 'Checking...' : 'Check Conflicts'}
                </button>
                {conflicts && (
                  <div className="flex-1">
                    {conflicts.hasConflicts ? (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-red-800">
                          <FaExclamationTriangle />
                          <span className="font-medium">Conflicts Detected</span>
                        </div>
                        <ul className="mt-2 text-sm text-red-700 space-y-1">
                          {conflicts.conflicts.map((conflict, idx) => (
                            <li key={idx}>• {conflict.message}</li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-green-800">
                          <FaCheck />
                          <span className="font-medium">No Conflicts Detected</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={handleCreatePanelSchedule}
                  disabled={!selectedPanel || !scheduleForm.datetime || !scheduleForm.location || loading}
                  className={`flex-1 px-4 py-2 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    conflicts && conflicts.hasConflicts
                      ? 'bg-orange-600 hover:bg-orange-700'
                      : 'bg-[#7C1D23] hover:bg-[#5a1519]'
                  }`}
                >
                  {loading ? 'Creating...' : conflicts && conflicts.hasConflicts ? 'Create & Finalize (Override Conflicts)' : 'Create & Finalize Schedule'}
                </button>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setSelectedPanel(null);
                    setScheduleForm({ datetime: '', duration: 120, location: '', description: '' });
                    setConflicts(null);
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Schedule Modal */}
      {showEditModal && editingSchedule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Edit Panel Schedule</h3>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingSchedule(null);
                    setEditForm({ datetime: '', duration: 120, location: '', description: '', sendNotifications: true });
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FaClose className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-sm font-medium text-gray-700 mb-1">Panel:</p>
                <p className="text-base font-semibold text-gray-900">
                  {editingSchedule.panel?.name || editingSchedule.title || 'N/A'}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  {editingSchedule.research?.title || editingSchedule.panel?.research?.title || 'N/A'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date & Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={editForm.datetime}
                  onChange={(e) => {
                    setEditForm({ ...editForm, datetime: e.target.value });
                  }}
                  className="w-full px-4 py-2 rounded-md border border-gray-300 focus:border-[#7C1D23] focus:ring-2 focus:ring-[#7C1D23]/20"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Duration (minutes) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={editForm.duration}
                  onChange={(e) => {
                    setEditForm({ ...editForm, duration: parseInt(e.target.value) || 120 });
                  }}
                  min="30"
                  step="30"
                  className="w-full px-4 py-2 rounded-md border border-gray-300 focus:border-[#7C1D23] focus:ring-2 focus:ring-[#7C1D23]/20"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editForm.location}
                  onChange={(e) => {
                    setEditForm({ ...editForm, location: e.target.value });
                  }}
                  placeholder="e.g., Room 301, Research Building"
                  className="w-full px-4 py-2 rounded-md border border-gray-300 focus:border-[#7C1D23] focus:ring-2 focus:ring-[#7C1D23]/20"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 rounded-md border border-gray-300 focus:border-[#7C1D23] focus:ring-2 focus:ring-[#7C1D23]/20"
                  placeholder="Additional notes or instructions..."
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="sendNotifications"
                  checked={editForm.sendNotifications}
                  onChange={(e) => setEditForm({ ...editForm, sendNotifications: e.target.checked })}
                  className="w-4 h-4 text-[#7C1D23] border-gray-300 rounded focus:ring-[#7C1D23]"
                />
                <label htmlFor="sendNotifications" className="text-sm text-gray-700">
                  Send email notifications to participants about the changes
                </label>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={handleUpdateSchedule}
                  disabled={!editForm.datetime || !editForm.location || loading}
                  className="flex-1 px-4 py-2 bg-[#7C1D23] text-white rounded-md text-sm font-medium hover:bg-[#5a1519] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Updating...' : 'Update Schedule'}
                </button>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingSchedule(null);
                    setEditForm({ datetime: '', duration: 120, location: '', description: '', sendNotifications: true });
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Process Monitoring Component
const ProcessMonitoring = () => {
  const [panels, setPanels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [panelDetails, setPanelDetails] = useState(null);
  const [filters, setFilters] = useState({
    status: 'all',
    startDate: '',
    endDate: '',
  });
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    fetchPanels();
  }, [filters]);

  const fetchPanels = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const params = new URLSearchParams();
      if (filters.status !== 'all') params.append('status', filters.status);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      
      const res = await axios.get(`/api/programhead/panels/monitoring?${params.toString()}`, { headers });
      setPanels(res.data || []);
    } catch (error) {
      console.error('Error fetching panels:', error);
      alert('Error loading panel monitoring data');
    } finally {
      setLoading(false);
    }
  };

  const fetchPanelDetails = async (panelId) => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`/api/programhead/panels/${panelId}/details`, { headers });
      setPanelDetails(res.data);
      setShowDetailsModal(true);
    } catch (error) {
      console.error('Error fetching panel details:', error);
      alert('Error loading panel details');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      confirmed: 'bg-blue-100 text-blue-800 border-blue-300',
      in_progress: 'bg-purple-100 text-purple-800 border-purple-300',
      completed: 'bg-green-100 text-green-800 border-green-300',
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const stats = {
    total: panels.length,
    pending: panels.filter(p => p.status === 'pending').length,
    inProgress: panels.filter(p => p.status === 'in_progress').length,
    completed: panels.filter(p => p.status === 'completed').length,
    withAlerts: panels.filter(p => p.hasAlerts).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Panel Review Process Monitoring</h2>
        <p className="text-sm text-gray-600">Track panel review progress and intervene when necessary</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border-l-4 border-blue-500 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-600 uppercase">Total Panels</h3>
            <FaUsersCog className="h-5 w-5 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg border-l-4 border-yellow-500 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-600 uppercase">Pending</h3>
            <FaBell className="h-5 w-5 text-yellow-500" />
          </div>
          <p className="text-2xl font-bold text-gray-800">{stats.pending}</p>
        </div>
        <div className="bg-white rounded-lg border-l-4 border-purple-500 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-600 uppercase">In Progress</h3>
            <FaChartLine className="h-5 w-5 text-purple-500" />
          </div>
          <p className="text-2xl font-bold text-gray-800">{stats.inProgress}</p>
        </div>
        <div className="bg-white rounded-lg border-l-4 border-red-500 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-600 uppercase">Alerts</h3>
            <FaBell className="h-5 w-5 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-gray-800">{stats.withAlerts}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h3 className="text-base font-semibold text-gray-800 mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setFilters({ status: 'all', startDate: '', endDate: '' })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Panels List */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h3 className="text-base font-semibold text-gray-800 mb-4">Panels</h3>
        {loading ? (
          <p className="text-center py-8 text-gray-500">Loading...</p>
        ) : panels.length === 0 ? (
          <p className="text-center py-8 text-gray-500">No panels found</p>
        ) : (
          <div className="space-y-4">
            {panels.map(panel => (
              <div
                key={panel._id}
                className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${
                  panel.hasAlerts ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-base font-semibold text-gray-900">{panel.name}</h4>
                      <span className={`px-2 py-1 text-xs font-medium rounded border ${getStatusColor(panel.status)}`}>
                        {panel.status.replace(/_/g, ' ')}
                      </span>
                      {panel.hasAlerts && (
                        <span className="px-2 py-1 text-xs font-medium rounded bg-red-100 text-red-800 border border-red-300">
                           Alerts
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-1">{panel.research?.title || 'N/A'}</p>
                    {/* Research Status and Stage */}
                    {panel.research && (
                      <div className="flex items-center gap-2 mt-1 mb-1">
                        {panel.research.stage && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                            {panel.research.stage === 'chapter1' ? 'Chapter 1' :
                             panel.research.stage === 'chapter2' ? 'Chapter 2' :
                             panel.research.stage === 'chapter3' ? 'Chapter 3' :
                             panel.research.stage.charAt(0).toUpperCase() + panel.research.stage.slice(1)}
                          </span>
                        )}
                        {panel.research.status && (
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                            panel.research.status === 'completed' ? 'bg-green-100 text-green-700' :
                            panel.research.status === 'in-progress' ? 'bg-blue-100 text-blue-700' :
                            panel.research.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            panel.research.status === 'for-revision' ? 'bg-orange-100 text-orange-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {panel.research.status.replace(/-/g, ' ')}
                          </span>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-gray-500">
                      {panel.type?.replace(/_/g, ' ')} • {panel.totalActiveMembers || 0} active panelists
                    </p>
                  </div>
                  <button
                    onClick={() => fetchPanelDetails(panel._id)}
                    className="px-4 py-2 bg-[#7C1D23] text-white rounded-md hover:bg-[#5a1519] transition-colors text-sm font-medium"
                  >
                    View Details
                  </button>
                </div>

                {/* Progress Bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">Review Progress</span>
                    <span className="text-sm text-gray-600">{panel.progress || 0}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full transition-all ${
                        panel.progress === 100 ? 'bg-green-500' : panel.progress >= 50 ? 'bg-blue-500' : 'bg-yellow-500'
                      }`}
                      style={{ width: `${panel.progress || 0}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {panel.submittedReviewsCount || 0} of {panel.totalActiveMembers || 0} reviews submitted
                  </p>
                </div>

                {/* Alerts */}
                {panel.hasAlerts && (
                  <div className="mt-3 pt-3 border-t border-red-200">
                    <div className="flex items-center gap-4 text-sm">
                      {panel.overdueCount > 0 && (
                        <span className="text-red-700 font-medium">
                           {panel.overdueCount} overdue review{panel.overdueCount !== 1 ? 's' : ''}
                        </span>
                      )}
                      {panel.missingCount > 0 && (
                        <span className="text-orange-700 font-medium">
                           {panel.missingCount} missing review{panel.missingCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Panel Details Modal */}
      {showDetailsModal && panelDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{panelDetails.panel.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{panelDetails.panel.research?.title}</p>
                  {/* Research Status and Stage in Modal */}
                  {panelDetails.panel.research && (
                    <div className="flex items-center gap-2 mt-2">
                      {panelDetails.panel.research.stage && (
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                          Stage: {panelDetails.panel.research.stage === 'chapter1' ? 'Chapter 1' :
                                   panelDetails.panel.research.stage === 'chapter2' ? 'Chapter 2' :
                                   panelDetails.panel.research.stage === 'chapter3' ? 'Chapter 3' :
                                   panelDetails.panel.research.stage.charAt(0).toUpperCase() + panelDetails.panel.research.stage.slice(1)}
                        </span>
                      )}
                      {panelDetails.panel.research.status && (
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          panelDetails.panel.research.status === 'completed' ? 'bg-green-100 text-green-700' :
                          panelDetails.panel.research.status === 'in-progress' ? 'bg-blue-100 text-blue-700' :
                          panelDetails.panel.research.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          panelDetails.panel.research.status === 'for-revision' ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          Status: {panelDetails.panel.research.status.replace(/-/g, ' ')}
                        </span>
                      )}
                      {panelDetails.panel.research.progress !== undefined && (
                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                          Progress: {panelDetails.panel.research.progress}%
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setPanelDetails(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FaClose className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Progress Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-base font-semibold text-gray-800 mb-3">Review Progress</h4>
                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                    <span className="text-sm text-gray-600">{panelDetails.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full ${
                        panelDetails.progress === 100 ? 'bg-green-500' : panelDetails.progress >= 50 ? 'bg-blue-500' : 'bg-yellow-500'
                      }`}
                      style={{ width: `${panelDetails.progress}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Alerts */}
              {(panelDetails.overdueReviews?.length > 0 || panelDetails.missingReviews?.length > 0) && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="text-base font-semibold text-red-800 mb-3"> Alerts</h4>
                  {panelDetails.overdueReviews?.length > 0 && (
                    <div className="mb-3">
                      <p className="text-sm font-medium text-red-700 mb-2">
                        Overdue Reviews ({panelDetails.overdueReviews.length})
                      </p>
                      <ul className="space-y-1">
                        {panelDetails.overdueReviews.map((review, idx) => (
                          <li key={idx} className="text-sm text-red-600">
                            • {review.isExternal ? review.panelistName : (review.panelist?.name || 'Unknown')} - Due: {review.dueDate ? new Date(review.dueDate).toLocaleDateString() : 'N/A'}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {panelDetails.missingReviews?.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-red-700 mb-2">
                        Missing Reviews ({panelDetails.missingReviews.length})
                      </p>
                      <ul className="space-y-1">
                        {panelDetails.missingReviews.map((member, idx) => (
                          <li key={idx} className="text-sm text-red-600">
                            • {member.isExternal ? (member.name || member.email || 'Unknown') : (member.faculty?.name || 'Unknown')} - No review entry created
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Panelist Reviews */}
              <div>
                <h4 className="text-base font-semibold text-gray-800 mb-3">Panelist Reviews</h4>
                <div className="space-y-3">
                  {panelDetails.panel.reviews?.length === 0 ? (
                    <p className="text-sm text-gray-500">No reviews submitted yet</p>
                  ) : (
                    panelDetails.panel.reviews?.map((review, idx) => {
                      const panelistName = review.isExternal 
                        ? review.panelistName 
                        : (review.panelist?.name || 'Unknown');
                      const panelistEmail = review.isExternal 
                        ? review.panelistEmail 
                        : (review.panelist?.email || '');
                      return (
                        <div key={idx} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <span className="font-medium text-gray-900">{panelistName}</span>
                              {review.isExternal && (
                                <span className="ml-2 text-xs text-blue-600">(External)</span>
                              )}
                              {panelistEmail && (
                                <p className="text-xs text-gray-500 mt-0.5">{panelistEmail}</p>
                              )}
                            </div>
                            <span className={`px-2 py-1 text-xs rounded ${
                              review.status === 'submitted' ? 'bg-green-100 text-green-700' :
                              review.status === 'overdue' ? 'bg-red-100 text-red-700' :
                              review.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {review.status?.replace(/_/g, ' ')}
                            </span>
                          </div>
                          {review.comments && (
                            <p className="text-sm text-gray-700 mb-2">{review.comments}</p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>Recommendation: {review.recommendation?.replace(/_/g, ' ') || 'Pending'}</span>
                            {review.submittedAt && (
                              <span>Submitted: {new Date(review.submittedAt).toLocaleDateString()}</span>
                            )}
                            {review.dueDate && (
                              <span>Due: {new Date(review.dueDate).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Resources/Documents */}
              {panelDetails.panel.documents && panelDetails.panel.documents.filter(d => d.isActive).length > 0 && (
                <div>
                  <h4 className="text-base font-semibold text-gray-800 mb-3">Resources</h4>
                  <div className="space-y-2">
                    {panelDetails.panel.documents.filter(d => d.isActive).map(doc => (
                      <div key={doc._id} className="border border-gray-200 rounded-lg p-3 flex items-center justify-between">
                        <div className="flex items-center space-x-3 flex-1">
                          {doc.mimeType === 'application/pdf' ? (
                            <FaFilePdf className="text-red-500 text-xl" />
                          ) : (
                            <FaFileWord className="text-blue-500 text-xl" />
                          )}
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{doc.title}</p>
                            <p className="text-xs text-gray-500">{doc.filename} • v{doc.version}</p>
                          </div>
                        </div>
                        <a
                          href={`/api/programhead/panels/${panelDetails.panel._id}/documents/${doc._id}/download`}
                          download
                          className="text-blue-600 hover:text-blue-700 text-sm"
                        >
                          <FaDownload />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Schedules */}
              {panelDetails.schedules && panelDetails.schedules.length > 0 && (
                <div>
                  <h4 className="text-base font-semibold text-gray-800 mb-3">Upcoming Schedules</h4>
                  <div className="space-y-2">
                    {panelDetails.schedules.map(schedule => (
                      <div key={schedule._id} className="border border-gray-200 rounded-lg p-3">
                        <p className="font-medium text-gray-900">{schedule.title}</p>
                        <p className="text-sm text-gray-600">
                          {new Date(schedule.datetime).toLocaleString()} • {schedule.location}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-gray-200 bg-gray-50">
              <div className="flex gap-3">
                {panelDetails.panel.status !== 'completed' && panelDetails.panel.status !== 'archived' && (
                  <>
                    <button
                      onClick={async () => {
                        if (window.confirm('Mark this panel as completed? This will move it to Panel Records.')) {
                          try {
                            const token = localStorage.getItem('token');
                            await axios.put(`/api/programhead/panels/${panelDetails.panel._id}/status`, 
                              { status: 'completed' },
                              { headers: { Authorization: `Bearer ${token}` } }
                            );
                            alert('Panel marked as completed successfully!');
                            setShowDetailsModal(false);
                            setPanelDetails(null);
                            fetchPanels();
                          } catch (error) {
                            console.error('Error marking panel as completed:', error);
                            alert('Error marking panel as completed');
                          }
                        }
                      }}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition-colors"
                    >
                      Mark as Completed
                    </button>
                    <button
                      onClick={async () => {
                        if (window.confirm('Archive this panel? This will move it to Panel Records.')) {
                          try {
                            const token = localStorage.getItem('token');
                            await axios.put(`/api/programhead/panels/${panelDetails.panel._id}/status`, 
                              { status: 'archived' },
                              { headers: { Authorization: `Bearer ${token}` } }
                            );
                            alert('Panel archived successfully!');
                            setShowDetailsModal(false);
                            setPanelDetails(null);
                            fetchPanels();
                          } catch (error) {
                            console.error('Error archiving panel:', error);
                            alert('Error archiving panel');
                          }
                        }
                      }}
                      className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-md text-sm font-medium hover:bg-gray-700 transition-colors"
                    >
                      Archive Panel
                    </button>
                  </>
                )}
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setPanelDetails(null);
                  }}
                  className="flex-1 px-4 py-2 bg-[#7C1D23] text-white rounded-md text-sm font-medium hover:bg-[#5a1519] transition-colors"
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

// Forms Management Component
const FormsManagement = () => {
  const [panels, setPanels] = useState([]);
  const [selectedPanel, setSelectedPanel] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    title: '',
    description: '',
    file: null,
  });
  const [dragActive, setDragActive] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(null);
  const [replacingDoc, setReplacingDoc] = useState(null);

  useEffect(() => {
    fetchPanels();
  }, []);

  useEffect(() => {
    if (selectedPanel) {
      fetchPanelDocuments(selectedPanel);
    }
  }, [selectedPanel]);

  const fetchPanels = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/programhead/panels', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPanels(res.data || []);
    } catch (error) {
      console.error('Error fetching panels:', error);
    }
  };

  const fetchPanelDocuments = async (panelId) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/programhead/panels/${panelId}/documents`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDocuments(res.data.documents || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      alert('Error fetching documents');
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
      const file = e.dataTransfer.files[0];
      if (validateFile(file)) {
        setUploadForm({ ...uploadForm, file });
      }
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (validateFile(file)) {
        setUploadForm({ ...uploadForm, file });
      }
    }
  };

  const validateFile = (file) => {
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    if (!allowedTypes.includes(file.type)) {
      alert('Only PDF and DOCX files are allowed');
      return false;
    }
    
    if (file.size > maxSize) {
      alert('File size must be less than 10MB');
      return false;
    }
    
    return true;
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    
    if (!selectedPanel) {
      alert('Please select a panel first');
      return;
    }
    
    if (!uploadForm.title || !uploadForm.file) {
      alert('Please provide a title and select a file');
      return;
    }

    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', uploadForm.file);
      formData.append('title', uploadForm.title);
      formData.append('description', uploadForm.description || '');

      const res = await axios.post(`/api/programhead/panels/${selectedPanel}/documents`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        }
      });

      alert(res.data.message || 'Document uploaded successfully!');
      setUploadForm({ title: '', description: '', file: null });
      fetchPanelDocuments(selectedPanel);
    } catch (error) {
      console.error('Error uploading document:', error);
      alert(error.response?.data?.message || 'Error uploading document');
    } finally {
      setUploading(false);
    }
  };

  const handleReplace = async (documentId) => {
    if (!replacingDoc?.file) {
      alert('Please select a file to replace');
      return;
    }

    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', replacingDoc.file);
      formData.append('description', replacingDoc.description || '');

      const res = await axios.put(`/api/programhead/panels/${selectedPanel}/documents/${documentId}/replace`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        }
      });

      alert(res.data.message || 'Document replaced successfully!');
      setReplacingDoc(null);
      fetchPanelDocuments(selectedPanel);
    } catch (error) {
      console.error('Error replacing document:', error);
      alert(error.response?.data?.message || 'Error replacing document');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async (documentId) => {
    if (!window.confirm('Are you sure you want to remove this document?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await axios.delete(`/api/programhead/panels/${selectedPanel}/documents/${documentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert(res.data.message || 'Document removed successfully!');
      fetchPanelDocuments(selectedPanel);
    } catch (error) {
      console.error('Error removing document:', error);
      alert(error.response?.data?.message || 'Error removing document');
    }
  };

  const handleDownload = async (doc) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/programhead/panels/${selectedPanel}/documents/${doc._id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', doc.filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error downloading document:', error);
      alert('Error downloading document');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType) => {
    if (mimeType === 'application/pdf') {
      return <FaFilePdf className="text-red-500" />;
    } else if (mimeType.includes('word') || mimeType.includes('document')) {
      return <FaFileWord className="text-blue-500" />;
    }
    return <FaFileAlt className="text-gray-500" />;
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">Upload Forms & Documents</h2>
      </div>

      {/* Panel Selection */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Panel <span className="text-red-500">*</span>
        </label>
        <select
          value={selectedPanel || ''}
          onChange={(e) => setSelectedPanel(e.target.value)}
          className="w-full px-4 py-2 rounded-md border border-gray-300 focus:border-[#7C1D23] focus:ring-2 focus:ring-[#7C1D23]/20"
        >
          <option value="">-- Select a panel --</option>
          {panels.map(panel => (
            <option key={panel._id} value={panel._id}>
              {panel.name} - {panel.type.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>

      {selectedPanel && (
        <>
          {/* Upload Form */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Upload New Document</h3>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Document Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                  className="w-full px-4 py-2 rounded-md border border-gray-300 focus:border-[#7C1D23] focus:ring-2 focus:ring-[#7C1D23]/20"
                  placeholder="e.g., Evaluation Rubric"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                  className="w-full px-4 py-2 rounded-md border border-gray-300 focus:border-[#7C1D23] focus:ring-2 focus:ring-[#7C1D23]/20"
                  rows={3}
                  placeholder="Brief description of the document..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  File <span className="text-red-500">*</span> (PDF, DOCX - Max 10MB)
                </label>
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    dragActive
                      ? 'border-[#7C1D23] bg-[#7C1D23]/5'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  {uploadForm.file ? (
                    <div className="space-y-2">
                      <FaFileAlt className="mx-auto text-4xl text-[#7C1D23]" />
                      <p className="text-sm font-medium text-gray-700">{uploadForm.file.name}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(uploadForm.file.size)}</p>
                      <button
                        type="button"
                        onClick={() => setUploadForm({ ...uploadForm, file: null })}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <FaUpload className="mx-auto text-4xl text-gray-400" />
                      <p className="text-sm text-gray-600">
                        Drag and drop a file here, or{' '}
                        <label className="text-[#7C1D23] cursor-pointer hover:underline">
                          click to browse
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx"
                            onChange={handleFileSelect}
                            className="hidden"
                          />
                        </label>
                      </p>
                      <p className="text-xs text-gray-500">PDF, DOCX files only (max 10MB)</p>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={uploading || !uploadForm.title || !uploadForm.file}
                className="w-full px-4 py-2 bg-[#7C1D23] text-white rounded-md hover:bg-[#5a1519] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? 'Uploading...' : 'Upload Document'}
              </button>
            </form>
          </div>

          {/* Documents List */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Panel Resources</h3>
            {loading ? (
              <p className="text-sm text-gray-500 text-center py-4">Loading documents...</p>
            ) : documents.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No documents uploaded yet</p>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div key={doc._id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <div className="mt-1">
                          {getFileIcon(doc.mimeType)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h4 className="font-medium text-gray-900">{doc.title}</h4>
                            <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                              v{doc.version}
                            </span>
                          </div>
                          {doc.description && (
                            <p className="text-sm text-gray-600 mt-1">{doc.description}</p>
                          )}
                          <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                            <span>{doc.filename}</span>
                            <span>{formatFileSize(doc.fileSize)}</span>
                            <span>Uploaded: {new Date(doc.uploadedAt).toLocaleDateString()}</span>
                            {doc.uploadedBy && (
                              <span>By: {doc.uploadedBy.name || 'Unknown'}</span>
                            )}
                          </div>
                          {doc.versions && doc.versions.length > 1 && (
                            <button
                              onClick={() => setShowVersionHistory(showVersionHistory === doc._id ? null : doc._id)}
                              className="text-xs text-[#7C1D23] hover:underline mt-1 flex items-center space-x-1"
                            >
                              <FaHistory />
                              <span>View version history ({doc.versions.length} versions)</span>
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => handleDownload(doc)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Download"
                        >
                          <FaDownload />
                        </button>
                        <button
                          onClick={() => setReplacingDoc(replacingDoc?.docId === doc._id ? null : { docId: doc._id, file: null, description: '' })}
                          className="p-2 text-yellow-600 hover:bg-yellow-50 rounded transition-colors"
                          title="Replace"
                        >
                          <FaUpload />
                        </button>
                        <button
                          onClick={() => handleRemove(doc._id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Remove"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </div>

                    {/* Replace Form */}
                    {replacingDoc?.docId === doc._id && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Replace Document</h5>
                        <div className="space-y-2">
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx"
                            onChange={(e) => {
                              if (e.target.files[0] && validateFile(e.target.files[0])) {
                                setReplacingDoc({ docId: doc._id, file: e.target.files[0], description: replacingDoc?.description || '' });
                              }
                            }}
                            className="text-sm"
                          />
                          <input
                            type="text"
                            placeholder="Change description (optional)"
                            value={replacingDoc?.description || ''}
                            onChange={(e) => setReplacingDoc({ docId: doc._id, file: replacingDoc?.file, description: e.target.value })}
                            className="w-full px-3 py-2 text-sm rounded-md border border-gray-300"
                          />
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleReplace(doc._id)}
                              disabled={uploading || !replacingDoc?.file}
                              className="px-3 py-1 text-sm bg-[#7C1D23] text-white rounded hover:bg-[#5a1519] disabled:opacity-50"
                            >
                              Replace
                            </button>
                            <button
                              onClick={() => setReplacingDoc(null)}
                              className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Version History */}
                    {showVersionHistory === doc._id && doc.versions && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Version History</h5>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {doc.versions.map((version, idx) => (
                            <div key={idx} className="bg-gray-50 rounded p-2 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">Version {version.version}</span>
                                <span className="text-gray-500">
                                  {new Date(version.uploadedAt).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-gray-600 mt-1">{version.filename}</p>
                              {version.changeDescription && (
                                <p className="text-gray-500 mt-1 italic">{version.changeDescription}</p>
                              )}
                              {version.uploadedBy && (
                                <p className="text-gray-500 mt-1">By: {version.uploadedBy.name || 'Unknown'}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Dean's Documents Section */}
      <DeanDocumentsSection />
    </div>
  );
};

// Dean's Documents Section Component
const DeanDocumentsSection = () => {
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
      const response = await axios.get('/api/programhead/documents', {
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
      const response = await axios.get(`/api/programhead/documents/${doc._id}/download`, {
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
      const response = await axios.get(`/api/programhead/documents/${doc._id}`, {
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
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Documents from Dean</h3>
        <div className="flex items-center justify-center py-8">
          <div className="text-gray-500">Loading documents...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Documents from Dean</h3>
        <span className="text-sm text-gray-600">{filteredDocuments.length} document(s)</span>
      </div>

      {/* Search and Filter */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-transparent text-sm"
          />
        </div>
        <div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7C1D23] focus:border-transparent text-sm"
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

      {/* Documents List */}
      {filteredDocuments.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          No documents available from dean
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDocuments.map((doc) => (
            <div key={doc._id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <FaFileAlt className="text-[#7C1D23] h-4 w-4" />
                    <h4 className="text-sm font-semibold text-gray-900">{doc.title}</h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(doc.category)}`}>
                      {doc.category}
                    </span>
                  </div>
                  {doc.description && (
                    <p className="text-xs text-gray-600 mb-2">{doc.description}</p>
                  )}
                  <div className="flex items-center space-x-3 text-xs text-gray-500">
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
  );
};

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

// Panel Records Component (PROGRAM HEAD – 0006)
const PanelRecords = () => {
  const [panels, setPanels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPanel, setSelectedPanel] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    panelType: 'all',
    startDate: '',
    endDate: '',
    researchId: '',
    minRecommendationRate: '',
  });
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchPanelRecords();
  }, [filters]);

  const fetchPanelRecords = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      
      if (filters.status !== 'all') params.append('status', filters.status);
      if (filters.panelType !== 'all') params.append('panelType', filters.panelType);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.researchId) params.append('researchId', filters.researchId);
      if (filters.minRecommendationRate) params.append('minRecommendationRate', filters.minRecommendationRate);
      
      const res = await axios.get(`/api/programhead/panel-records?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPanels(res.data || []);
    } catch (error) {
      console.error('Error fetching panel records:', error);
      alert('Error loading panel records');
    } finally {
      setLoading(false);
    }
  };

  const fetchPanelDetails = async (panelId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/programhead/panel-records/${panelId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedPanel(res.data);
      setShowDetailsModal(true);
    } catch (error) {
      console.error('Error fetching panel details:', error);
      alert('Error loading panel details');
    }
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      
      if (filters.status !== 'all') params.append('status', filters.status);
      if (filters.panelType !== 'all') params.append('panelType', filters.panelType);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.researchId) params.append('researchId', filters.researchId);
      if (filters.minRecommendationRate) params.append('minRecommendationRate', filters.minRecommendationRate);
      
      const res = await axios.get(`/api/programhead/panel-records/export/csv?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `panel-records-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      alert('Panel records exported successfully!');
    } catch (error) {
      console.error('Error exporting panel records:', error);
      alert('Error exporting panel records');
    } finally {
      setExporting(false);
    }
  };

  const getRecommendationColor = (rate) => {
    if (rate >= 70) return 'text-green-600';
    if (rate >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Panel Records</h2>
          <p className="text-sm text-gray-600 mt-1">Historical panel evaluation data and analytics</p>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={exporting || panels.length === 0}
          className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
        >
          <FaDownload className="mr-2" />
          {exporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h3 className="text-base font-semibold text-gray-800 mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Panel Type</label>
            <select
              value={filters.panelType}
              onChange={(e) => setFilters({ ...filters, panelType: e.target.value })}
              className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm"
            >
              <option value="all">All Types</option>
              <option value="oral_defense">Oral Defense</option>
              <option value="thesis_review">Thesis Review</option>
              <option value="proposal_defense">Proposal Defense</option>
              <option value="final_defense">Final Defense</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Min Approval Rate (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              value={filters.minRecommendationRate}
              onChange={(e) => setFilters({ ...filters, minRecommendationRate: e.target.value })}
              placeholder="e.g., 70"
              className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setFilters({
                status: 'all',
                panelType: 'all',
                startDate: '',
                endDate: '',
                researchId: '',
                minRecommendationRate: '',
              })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border-l-4 border-blue-500 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-600 uppercase">Total Panels</h3>
            <FaUsersCog className="h-5 w-5 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-gray-800">{panels.length}</p>
        </div>
        <div className="bg-white rounded-lg border-l-4 border-green-500 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-600 uppercase">Avg Approval Rate</h3>
            <FaChartBar className="h-5 w-5 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-gray-800">
            {panels.length > 0
              ? (panels.reduce((sum, p) => sum + (p.approvalRate || 0), 0) / panels.length).toFixed(1)
              : 0}%
          </p>
        </div>
        <div className="bg-white rounded-lg border-l-4 border-purple-500 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-600 uppercase">Avg Score</h3>
            <FaChartLine className="h-5 w-5 text-purple-500" />
          </div>
          <p className="text-2xl font-bold text-gray-800">
            {panels.length > 0
              ? (panels.reduce((sum, p) => sum + (p.averageScore || 0), 0) / panels.length).toFixed(2)
              : 0}
          </p>
        </div>
        <div className="bg-white rounded-lg border-l-4 border-yellow-500 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-600 uppercase">Total Reviews</h3>
            <FaClipboardCheck className="h-5 w-5 text-yellow-500" />
          </div>
          <p className="text-2xl font-bold text-gray-800">
            {panels.reduce((sum, p) => sum + (p.totalReviews || 0), 0)}
          </p>
        </div>
      </div>

      {/* Panels List */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h3 className="text-base font-semibold text-gray-800 mb-4">Historical Panels</h3>
        {loading ? (
          <p className="text-center py-8 text-gray-500">Loading panel records...</p>
        ) : panels.length === 0 ? (
          <p className="text-center py-8 text-gray-500">No panel records found</p>
        ) : (
          <div className="space-y-4">
            {panels.map(panel => (
              <div
                key={panel._id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => fetchPanelDetails(panel._id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-base font-semibold text-gray-900">{panel.name}</h4>
                      <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800 border border-blue-300">
                        {panel.type?.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">{panel.research?.title || 'N/A'}</p>
                    <p className="text-xs text-gray-500">
                      Date Conducted: {new Date(panel.dateConducted).toLocaleDateString()} • 
                      Panelists: {panel.totalPanelists || 0} • 
                      Reviews: {panel.totalReviews || 0}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${getRecommendationColor(panel.approvalRate || 0)}`}>
                      {panel.approvalRate || 0}%
                    </p>
                    <p className="text-xs text-gray-500">Approval Rate</p>
                    <p className="text-sm font-medium text-gray-700 mt-1">
                      Avg Score: {panel.averageScore || 0}
                    </p>
                  </div>
                </div>

                {/* Recommendation Distribution */}
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-green-600 font-medium">
                    Approve: {panel.recommendations?.approve || 0}
                  </span>
                  <span className="text-yellow-600 font-medium">
                    Revision: {panel.recommendations?.revision || 0}
                  </span>
                  <span className="text-red-600 font-medium">
                    Reject: {panel.recommendations?.reject || 0}
                  </span>
                </div>

                {/* Panelist Roster Preview */}
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">Panelists:</p>
                  <div className="flex flex-wrap gap-2">
                    {panel.panelistRoster?.slice(0, 5).map((panelist, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded"
                      >
                        {panelist.name}
                        {panelist.isExternal && (
                          <span className="ml-1 text-blue-600">(External)</span>
                        )}
                      </span>
                    ))}
                    {panel.panelistRoster?.length > 5 && (
                      <span className="px-2 py-1 text-xs text-gray-500">
                        +{panel.panelistRoster.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Panel Details Modal */}
      {showDetailsModal && selectedPanel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{selectedPanel.panel.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{selectedPanel.panel.research?.title}</p>
                </div>
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedPanel(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FaClose className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Analytics Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-base font-semibold text-gray-800 mb-3">Analytics Summary</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Approval Rate</p>
                    <p className={`text-2xl font-bold ${getRecommendationColor(selectedPanel.analytics.approvalRate)}`}>
                      {selectedPanel.analytics.approvalRate}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Average Score</p>
                    <p className="text-2xl font-bold text-gray-800">
                      {selectedPanel.analytics.averageScore}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Total Panelists</p>
                    <p className="text-2xl font-bold text-gray-800">
                      {selectedPanel.analytics.totalPanelists}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Total Reviews</p>
                    <p className="text-2xl font-bold text-gray-800">
                      {selectedPanel.analytics.totalReviews}
                    </p>
                  </div>
                </div>
              </div>

              {/* Recommendation Distribution */}
              <div>
                <h4 className="text-base font-semibold text-gray-800 mb-3">Recommendation Distribution</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-green-50 rounded-lg p-4 text-center border border-green-200">
                    <p className="text-2xl font-bold text-green-700">
                      {selectedPanel.analytics.recommendations.approve}
                    </p>
                    <p className="text-sm text-green-600 mt-1">Approve</p>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-4 text-center border border-yellow-200">
                    <p className="text-2xl font-bold text-yellow-700">
                      {selectedPanel.analytics.recommendations.revision}
                    </p>
                    <p className="text-sm text-yellow-600 mt-1">Revision</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4 text-center border border-red-200">
                    <p className="text-2xl font-bold text-red-700">
                      {selectedPanel.analytics.recommendations.reject}
                    </p>
                    <p className="text-sm text-red-600 mt-1">Reject</p>
                  </div>
                </div>
              </div>

              {/* Panelist Roster */}
              <div>
                <h4 className="text-base font-semibold text-gray-800 mb-3">Panelist Roster</h4>
                <div className="space-y-2">
                  {selectedPanel.panelistRoster?.map((panelist, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{panelist.name}</p>
                          <p className="text-sm text-gray-500">{panelist.email}</p>
                        </div>
                        <div className="text-right">
                          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                            {panelist.role?.replace(/_/g, ' ')}
                          </span>
                          {panelist.isExternal && (
                            <span className="ml-2 px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded">
                              External
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Individual Panelist Reviews */}
              <div>
                <h4 className="text-base font-semibold text-gray-800 mb-3">Individual Evaluations</h4>
                <div className="space-y-3">
                  {selectedPanel.panel.reviews?.filter(r => r.status === 'submitted').map((review, idx) => {
                    const panelistName = review.isExternal 
                      ? review.panelistName 
                      : (review.panelist?.name || 'Unknown');
                    return (
                      <div key={idx} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="font-medium text-gray-900">{panelistName}</span>
                            {review.isExternal && (
                              <span className="ml-2 text-xs text-blue-600">(External)</span>
                            )}
                          </div>
                          <span className={`px-2 py-1 text-xs rounded ${
                            review.recommendation === 'approve' ? 'bg-green-100 text-green-700' :
                            review.recommendation === 'revision' ? 'bg-yellow-100 text-yellow-700' :
                            review.recommendation === 'reject' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {review.recommendation?.replace(/_/g, ' ').toUpperCase() || 'Pending'}
                          </span>
                        </div>
                        {review.comments && (
                          <p className="text-sm text-gray-700 mt-2">{review.comments}</p>
                        )}
                        {review.submittedAt && (
                          <p className="text-xs text-gray-500 mt-2">
                            Submitted: {new Date(review.submittedAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedPanel(null);
                }}
                className="w-full px-4 py-2 bg-[#7C1D23] text-white rounded-md text-sm font-medium hover:bg-[#5a1519] transition-colors"
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

      const res = await axios.get(`/api/programhead/activity-logs?${params}`, {
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
      const res = await axios.get('/api/programhead/activity-stats', {
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
      remove: 'bg-red-100 text-red-700',
      share: 'bg-cyan-100 text-cyan-700',
      send_email: 'bg-cyan-100 text-cyan-700',
      add_remark: 'bg-indigo-100 text-indigo-700',
    };
    return colors[action] || 'bg-gray-100 text-gray-700';
  };

  const getEntityIcon = (entityType) => {
    const icons = {
      document: <FaFileAlt />,
      research: <FaClipboardCheck />,
      user: <FaUsers />,
      panel: <FaUsersCog />,
      email: <FaFileAlt />,
      settings: <FaEdit />,
      schedule: <FaCalendarAlt />,
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
              <option value="assign">Assign</option>
              <option value="remove">Remove</option>
              <option value="share">Share</option>
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
              <option value="schedule">Schedules</option>
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

export default ProgramHeadDashboard;
