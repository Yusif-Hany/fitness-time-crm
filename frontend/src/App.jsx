import React, { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

function App() {
  const [token, setToken] = useState("");
const [username, setUsername] = useState("");
const [role, setRole] = useState("");
  
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [error, setError] = useState("");

  const [activeTab, setActiveTab] = useState("dashboard");

  const [dashboardData, setDashboardData] = useState(null);
  const [analyticsData, setAnalyticsData] = useState([]);
  const [leads, setLeads] = useState([]);
  const [employees, setEmployees] = useState([]);

  // تم إزالة حقل next_followup من نموذج إضافة الـ Lead العادي
  const [leadForm, setLeadForm] = useState({ name: "", phone: "", source: "Facebook", status: "New", sales_man: "Auto (Round Robin)", comment: "" });
  const [editingLeadId, setEditingLeadId] = useState(null);

  const [employeeForm, setEmployeeForm] = useState({ name: "", phone: "", role: "" });
  const [editingEmployeeId, setEditingEmployeeId] = useState(null);

  const [newUserForm, setNewUserForm] = useState({ username: "", password: "", role: "sales" });

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterSalesman, setFilterSalesman] = useState("All");

  const [selectedLeadForNotes, setSelectedLeadForNotes] = useState(null);
  const [newNote, setNewNote] = useState("");
  // حقل مؤقت لتحديد ميعاد المتابعة داخل نافذة الملاحظات/التايملاين
  const [noteNextFollowup, setNoteNextFollowup] = useState("");
  
  const [leadNotes, setLeadNotes] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);

  const sourceOptions = ["Facebook", "Instagram", "Google Ads", "Walk-in", "Referral", "Phone Call"];

  if (token) {
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  }

  useEffect(() => {
    if (token) {
      fetchDashboard();
      fetchLeads();
      fetchEmployees();
      if (role === "admin") fetchAnalytics();
    }
  }, [token]);

  const fetchDashboard = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/dashboard");
      setDashboardData(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/analytics");
      setAnalyticsData(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchLeads = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/leads");
      setLeads(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchEmployees = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/employees");
      setEmployees(res.data);
    } catch (err) { console.error(err); }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const response = await axios.post("http://localhost:5000/api/login", {
        username: loginUsername,
        password: loginPassword,
      });
      const data = response.data;
      localStorage.setItem("token", data.token);
      localStorage.setItem("username", data.username);
      localStorage.setItem("role", data.role);
      setToken(data.token);
      setUsername(data.username);
      setRole(data.role);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to login");
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    setToken("");
    setUsername("");
    setRole("");
    delete axios.defaults.headers.common["Authorization"];
  };

  const handleLeadSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingLeadId) {
        await axios.put(`http://localhost:5000/api/leads/${editingLeadId}`, leadForm);
        setEditingLeadId(null);
      } else {
        await axios.post("http://localhost:5000/api/leads", leadForm);
      }
      setLeadForm({ name: "", phone: "", source: "Facebook", status: "New", sales_man: "Auto (Round Robin)", comment: "" });
      fetchLeads();
      fetchDashboard();
      if (role === "admin") fetchAnalytics();
    } catch (err) { alert("Error saving lead"); }
  };

  const handleDeleteLead = async (id) => {
    if (window.confirm("Delete this lead?")) {
      await axios.delete(`http://localhost:5000/api/leads/${id}`);
      fetchLeads();
      fetchDashboard();
      if (role === "admin") fetchAnalytics();
    }
  };

  const handleEmployeeSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingEmployeeId) {
        await axios.put(`http://localhost:5000/api/employees/${editingEmployeeId}`, employeeForm);
        setEditingEmployeeId(null);
      } else {
        await axios.post("http://localhost:5000/api/employees", employeeForm);
      }
      setEmployeeForm({ name: "", phone: "", role: "" });
      fetchEmployees();
      fetchDashboard();
    } catch (err) { alert("Error saving employee"); }
  };

  const handleDeleteEmployee = async (id) => {
    if (window.confirm("Delete this employee?")) {
      await axios.delete(`http://localhost:5000/api/employees/${id}`);
      fetchEmployees();
      fetchDashboard();
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await axios.post("http://localhost:5000/api/users", newUserForm);
      alert("User login account created successfully!");
      setNewUserForm({ username: "", password: "", role: "sales" });
    } catch (err) {
      alert(err.response?.data?.error || "Error creating user account");
    }
  };

  const exportToCSV = () => {
    const headers = ["ID", "Name", "Phone", "Source", "Status", "Salesman", "Comment"];
    const rows = filteredLeads.map(l => [l.id, `"${l.name}"`, `"${l.phone}"`, `"${l.source || ''}"`, `"${l.status}"`, `"${l.sales_man || ''}"`, `"${l.comment || ''}"`]);
    
    let csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "fitness_time_leads.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openNotesModal = async (lead) => {
    setSelectedLeadForNotes(lead);
    setLeadNotes(lead.comment ? [{ text: lead.comment, date: "Initial" }] : []);
    setNewNote("");
    setNoteNextFollowup(lead.next_followup || "");
    try {
      const res = await axios.get(`http://localhost:5000/api/logs/${lead.id}`);
      setActivityLogs(res.data);
    } catch (err) { console.error(err); }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim() && !noteNextFollowup) return;
    
    let updatedNotes = [...leadNotes];
    if (newNote.trim()) {
      updatedNotes.push({ text: newNote, date: new Date().toLocaleDateString() });
    }
    setLeadNotes(updatedNotes);
    
    const combinedComments = updatedNotes.map(n => `[${n.date}]: ${n.text}`).join(" | ");
    
    await axios.put(`http://localhost:5000/api/leads/${selectedLeadForNotes.id}`, {
      ...selectedLeadForNotes,
      comment: combinedComments,
      next_followup: noteNextFollowup
    });
    
    fetchLeads();
    const res = await axios.get(`http://localhost:5000/api/logs/${selectedLeadForNotes.id}`);
    setActivityLogs(res.data);
    setNewNote("");
    alert("Updated successfully!");
  };

  // تصفية الـ Leads حسب صلاحية المستخدم
  const accessibleLeads = leads.filter(lead => {
    if (role === "admin") return true;
    return lead.sales_man === username || lead.sales_man === "All Users" || !lead.sales_man;
  });

  const filteredLeads = accessibleLeads.filter(lead => {
    const matchesSearch = lead.name.toLowerCase().includes(searchTerm.toLowerCase()) || lead.phone.includes(searchTerm);
    const matchesStatus = filterStatus === "All" || lead.status === filterStatus;
    const matchesSalesman = filterSalesman === "All" || lead.sales_man === filterSalesman;
    return matchesSearch && matchesStatus && matchesSalesman;
  });

  // الـ Leads اللي عندها ميعاد متابعة فقط وتخص المستخدم
  const followupLeads = accessibleLeads.filter(lead => lead.next_followup && lead.next_followup.trim() !== "");

  if (!token) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", backgroundColor: "#000000" }}>
        <form onSubmit={handleLogin} style={{ background: "#0a0a0a", padding: "40px", borderRadius: "10px", boxShadow: "0 4px 25px rgba(0,0,0,0.9)", width: "350px", border: "1px solid #1a1a1a" }}>
          <h2 style={{ textAlign: "center", marginBottom: "25px", color: "#ffcc00", letterSpacing: "1px" }}>FITNESS TIME</h2>
          {error && <div style={{ color: "#ff4d4d", marginBottom: "15px", textAlign: "center", fontSize: "14px" }}>{error}</div>}
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px", color: "#888", fontSize: "14px" }}>Username</label>
            <input type="text" value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} required style={{ width: "100%", padding: "12px", boxSizing: "border-box", borderRadius: "5px", border: "1px solid #222", background: "#121212", color: "#fff", outline: "none" }} />
          </div>
          <div style={{ marginBottom: "25px" }}>
            <label style={{ display: "block", marginBottom: "5px", color: "#888", fontSize: "14px" }}>Password</label>
            <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required style={{ width: "100%", padding: "12px", boxSizing: "border-box", borderRadius: "5px", border: "1px solid #222", background: "#121212", color: "#fff", outline: "none" }} />
          </div>
          <button type="submit" style={{ width: "100%", padding: "12px", backgroundColor: "#ffcc00", color: "#000", border: "none", borderRadius: "5px", cursor: "pointer", fontWeight: "bold", fontSize: "15px" }}>Login</button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "Arial, sans-serif", backgroundColor: "#000000", color: "#fff", margin: 0, overflow: "hidden" }}>
      
      {/* Sidebar */}
      <div style={{ width: "260px", backgroundColor: "#0a0a0a", borderRight: "1px solid #1a1a1a", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "20px" }}>
        <div>
          <h2 style={{ color: "#ffcc00", marginBottom: "40px", fontSize: "22px", letterSpacing: "1px" }}>FITNESS TIME</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <button onClick={() => setActiveTab("dashboard")} style={{ padding: "12px 15px", background: activeTab === "dashboard" ? "#ffcc00" : "transparent", color: activeTab === "dashboard" ? "#000" : "#888", border: "none", borderRadius: "5px", textAlign: "left", cursor: "pointer", fontWeight: "bold", fontSize: "15px" }}>Dashboard</button>
            <button onClick={() => setActiveTab("leads")} style={{ padding: "12px 15px", background: activeTab === "leads" ? "#ffcc00" : "transparent", color: activeTab === "leads" ? "#000" : "#888", border: "none", borderRadius: "5px", textAlign: "left", cursor: "pointer", fontWeight: "bold", fontSize: "15px" }}>Leads</button>
            <button onClick={() => setActiveTab("followups")} style={{ padding: "12px 15px", background: activeTab === "followups" ? "#ffcc00" : "transparent", color: activeTab === "followups" ? "#000" : "#888", border: "none", borderRadius: "5px", textAlign: "left", cursor: "pointer", fontWeight: "bold", fontSize: "15px" }}>📅 Follow-ups</button>
            {role === "admin" && (
              <>
                <button onClick={() => setActiveTab("analytics")} style={{ padding: "12px 15px", background: activeTab === "analytics" ? "#ffcc00" : "transparent", color: activeTab === "analytics" ? "#000" : "#888", border: "none", borderRadius: "5px", textAlign: "left", cursor: "pointer", fontWeight: "bold", fontSize: "15px" }}>Sales Performance</button>
                <button onClick={() => setActiveTab("employees")} style={{ padding: "12px 15px", background: activeTab === "employees" ? "#ffcc00" : "transparent", color: activeTab === "employees" ? "#000" : "#888", border: "none", borderRadius: "5px", textAlign: "left", cursor: "pointer", fontWeight: "bold", fontSize: "15px" }}>Employees & Users</button>
              </>
            )}
          </div>
        </div>

        <div style={{ borderTop: "1px solid #1a1a1a", paddingTop: "15px" }}>
          <div style={{ fontSize: "14px", color: "#888", marginBottom: "5px" }}>User: <strong style={{ color: "#fff" }}>{username}</strong></div>
          <div style={{ fontSize: "12px", color: "#ffcc00", marginBottom: "10px", textTransform: "uppercase" }}>Role: {role}</div>
          <button onClick={handleLogout} style={{ width: "100%", backgroundColor: "#121212", color: "#ff4d4d", border: "1px solid #222", padding: "8px", borderRadius: "5px", cursor: "pointer", fontWeight: "bold" }}>Logout</button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto", backgroundColor: "#000000" }}>
        
        <div style={{ background: "#0a0a0a", padding: "20px 30px", borderBottom: "1px solid #1a1a1a", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, color: "#fff", textTransform: "capitalize", fontSize: "20px" }}>{activeTab === "followups" ? "Follow-ups Schedule" : `${activeTab} Overview`}</h2>
          <span style={{ fontSize: "14px", color: "#666" }}>System Status: <span style={{ color: "#00ff66" }}>● Live</span></span>
        </div>

        <div style={{ padding: "30px" }}>

          {/* DASHBOARD */}
          {activeTab === "dashboard" && (() => {
            const targetLeads = accessibleLeads;
            const total = targetLeads.length > 0 ? targetLeads.length : 1;
            const getCount = (status) => targetLeads.filter(l => l.status === status).length;
            const getPercent = (status) => ((getCount(status) / total) * 100).toFixed(1);

            const wonCount = targetLeads.filter((l) => l.status === "Won").length;
const conversionRate =
  targetLeads.length > 0
    ? ((wonCount / targetLeads.length) * 100).toFixed(1)
    : "0.0";
            const statuses = [
              { name: "New", color: "#ffcc00" },
              { name: "Contacted", color: "#4da6ff" },
              { name: "Interested", color: "#00ff66" },
              { name: "Won", color: "#00ffcc" },
              { name: "Lost", color: "#ff4d4d" },
              { name: "Call Again", color: "#ff9933" }
            ];

            return (
              <div>
                <div style={{ background: "linear-gradient(135deg, #121212 0%, #0a0a0a 100%)", padding: "25px", borderRadius: "10px", border: "1px solid #1a1a1a", marginBottom: "30px" }}>
                  <h2 style={{ margin: "0 0 8px 0", color: "#ffcc00", fontSize: "22px" }}>Welcome back, {username}! 👋</h2>
                  <p style={{ margin: 0, color: "#888", fontSize: "14px" }}>
                    {role === "admin" ? "Here is the overall system performance breakdown." : "Here is your personal leads status breakdown and analytics."}
                  </p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px", marginBottom: "30px" }}>
                  <div style={{ background: "#0a0a0a", color: "#fff", padding: "22px", borderRadius: "8px", border: "1px solid #1a1a1a", borderLeft: "5px solid #ffcc00" }}>
                    <h4 style={{ margin: "0 0 10px 0", color: "#777", fontSize: "13px", textTransform: "uppercase" }}>{role === "admin" ? "Total Leads" : "My Assigned Leads"}</h4>
                    <h2 style={{ margin: 0, color: "#ffcc00", fontSize: "28px" }}>{targetLeads.length}</h2>
                  </div>
                  <div style={{ background: "#0a0a0a", color: "#fff", padding: "22px", borderRadius: "8px", border: "1px solid #1a1a1a", borderLeft: "5px solid #ff4d4d" }}>
                    <h4 style={{ margin: "0 0 10px 0", color: "#777", fontSize: "13px", textTransform: "uppercase" }}>Follow-ups Today</h4>
                    <h2 style={{ margin: 0, color: "#ff4d4d", fontSize: "28px" }}>
                      {targetLeads.filter(l => l.next_followup && l.next_followup.startsWith(new Date().toISOString().split('T')[0])).length}
                    </h2>
                  </div>
                  {role === "admin" && (
                    <div style={{ background: "#0a0a0a", color: "#fff", padding: "22px", borderRadius: "8px", border: "1px solid #1a1a1a", borderLeft: "4px solid #4da6ff" }}>
                      <h4 style={{ margin: "0 0 10px 0", color: "#777", fontSize: "13px", textTransform: "uppercase" }}>Total Employees</h4>
                      <h2 style={{ margin: 0, color: "#4da6ff", fontSize: "28px" }}>{employees.length}</h2>
                    </div>
                  )}
                </div>

                {/* Percentage Analytics Breakdown Cards */}
                <div style={{ background: "#0a0a0a", padding: "25px", borderRadius: "8px", border: "1px solid #1a1a1a" }}>
                  <h3 style={{ margin: "0 0 20px 0", color: "#fff", fontSize: "18px", borderBottom: "1px solid #151515", paddingBottom: "10px" }}>
                    {role === "admin" ? "Leads Status Percentages & Analytics (All)" : "My Leads Status Percentages & Analytics"}
                  </h3>
                  
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
                    {statuses.map((item, idx) => {
                      const count = getCount(item.name);
                      const percent = getPercent(item.name);
                      return (
                        <div key={idx} style={{ background: "#121212", padding: "15px 20px", borderRadius: "6px", border: "1px solid #1a1a1a" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "14px" }}>
                            <span style={{ color: "#aaa" }}>{item.name}</span>
                            <strong style={{ color: item.color }}>{count} Leads ({percent}%)</strong>
                          </div>
                          <div style={{ width: "100%", background: "#1a1a1a", height: "6px", borderRadius: "3px", overflow: "hidden" }}>
                            <div style={{ width: `${percent}%`, background: item.color, height: "100%", transition: "width 0.4s ease" }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* FOLLOW-UPS TAB */}
          {activeTab === "followups" && (
            <div>
              <div style={{ background: "#0a0a0a", padding: "20px", borderRadius: "8px", border: "1px solid #1a1a1a", marginBottom: "20px" }}>
                <h3 style={{ margin: "0 0 5px 0", color: "#ffcc00" }}>📅 Scheduled Follow-ups</h3>
                <p style={{ margin: 0, color: "#888", fontSize: "13px" }}>Here you can see all leads that have upcoming follow-up dates and times assigned to them.</p>
              </div>

              <div style={{ background: "#0a0a0a", borderRadius: "8px", border: "1px solid #1a1a1a", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", color: "#fff" }}>
                  <thead>
                    <tr style={{ background: "#121212", color: "#ffcc00", borderBottom: "1px solid #1a1a1a" }}>
                      <th style={{ padding: "12px 15px" }}>Name</th>
                      <th style={{ padding: "12px 15px" }}>Phone</th>
                      <th style={{ padding: "12px 15px" }}>Status</th>
                      <th style={{ padding: "12px 15px" }}>Assigned To</th>
                      <th style={{ padding: "12px 15px" }}>Follow-up Date & Time</th>
                      <th style={{ padding: "12px 15px" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {followupLeads.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ padding: "25px", textAlign: "center", color: "#666" }}>No upcoming follow-ups found.</td>
                      </tr>
                    ) : (
                      followupLeads.map((lead) => (
                        <tr key={lead.id} style={{ borderBottom: "1px solid #1a1a1a" }}>
                          <td style={{ padding: "12px 15px" }}>{lead.name}</td>
                          <td style={{ padding: "12px 15px" }}>{lead.phone}</td>
                          <td style={{ padding: "12px 15px" }}>
                            <span style={{ padding: "4px 8px", borderRadius: "4px", background: "#151515", color: "#ffcc00", fontSize: "12px", fontWeight: "bold", border: "1px solid #222" }}>{lead.status}</span>
                          </td>
                          <td style={{ padding: "12px 15px" }}>{lead.sales_man || "All Users"}</td>
                          <td style={{ padding: "12px 15px", color: "#ff4d4d", fontWeight: "bold" }}>{lead.next_followup.replace('T', ' ')}</td>
                          <td style={{ padding: "12px 15px" }}>
                            <button onClick={() => openNotesModal(lead)} style={{ background: "transparent", border: "none", color: "#ffcc00", cursor: "pointer", fontWeight: "bold" }}>View / Update</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SALES PERFORMANCE ANALYTICS */}
          {activeTab === "analytics" && role === "admin" && (
            <div>
              <h3 style={{ color: "#ffcc00", marginBottom: "20px" }}>📊 Sales Team Performance & Conversion Rates</h3>
              <div style={{ background: "#0a0a0a", borderRadius: "8px", border: "1px solid #1a1a1a", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", color: "#fff" }}>
                  <thead>
                    <tr style={{ background: "#121212", color: "#ffcc00", borderBottom: "1px solid #1a1a1a" }}>
                      <th style={{ padding: "12px 15px" }}>Salesman Name</th>
                      <th style={{ padding: "12px 15px" }}>Assigned Leads</th>
                      <th style={{ padding: "12px 15px" }}>Won Leads (Converted)</th>
                      <th style={{ padding: "12px 15px" }}>Conversion Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analyticsData.map((stat, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #1a1a1a" }}>
                        <td style={{ padding: "12px 15px", fontWeight: "bold" }}>{stat.name}</td>
                        <td style={{ padding: "12px 15px" }}>{stat.totalAssigned}</td>
                        <td style={{ padding: "12px 15px", color: "#00ff66" }}>{stat.wonLeads}</td>
                        <td style={{ padding: "12px 15px", color: "#ffcc00", fontWeight: "bold" }}>{stat.conversionRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* LEADS */}
          {activeTab === "leads" && (
            <div>
              {role === "admin" && (
                <form onSubmit={handleLeadSubmit} style={{ background: "#0a0a0a", padding: "20px", borderRadius: "8px", marginBottom: "25px", border: "1px solid #1a1a1a" }}>
                  <h3 style={{ margin: "0 0 15px 0", color: "#fff" }}>{editingLeadId ? "Edit Lead" : "Add New Lead"}</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px", marginBottom: "15px" }}>
                    <input type="text" placeholder="Name *" value={leadForm.name} onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })} required style={{ padding: "10px", border: "1px solid #222", borderRadius: "4px", background: "#121212", color: "#fff" }} />
                    <input type="text" placeholder="Phone *" value={leadForm.phone} onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })} required style={{ padding: "10px", border: "1px solid #222", borderRadius: "4px", background: "#121212", color: "#fff" }} />
                    
                    <select value={leadForm.source} onChange={(e) => setLeadForm({ ...leadForm, source: e.target.value })} style={{ padding: "10px", border: "1px solid #222", borderRadius: "4px", background: "#121212", color: "#fff" }}>
                      {sourceOptions.map((src, idx) => (<option key={idx} value={src}>{src}</option>))}
                    </select>

                    <select value={leadForm.status} onChange={(e) => setLeadForm({ ...leadForm, status: e.target.value })} style={{ padding: "10px", border: "1px solid #222", borderRadius: "4px", background: "#121212", color: "#fff" }}>
                      <option value="New">New</option>
                      <option value="Contacted">Contacted</option>
                      <option value="Interested">Interested</option>
                      <option value="Won">Won</option>
                      <option value="Lost">Lost</option>
                      <option value="Call Again">Call Again</option>
                    </select>

                    <select value={leadForm.sales_man} onChange={(e) => setLeadForm({ ...leadForm, sales_man: e.target.value })} style={{ padding: "10px", border: "1px solid #222", borderRadius: "4px", background: "#121212", color: "#ffcc00" }}>
                      <option value="Auto (Round Robin)">⚡ Auto-Assign (Round Robin)</option>
                      <option value="All Users">🌐 Assign to All Users</option>
                      {employees.map((emp) => (<option key={emp.id} value={emp.name}>{emp.name}</option>))}
                    </select>
                  </div>
                  <button type="submit" style={{ backgroundColor: "#ffcc00", color: "#000", border: "none", padding: "10px 20px", borderRadius: "5px", cursor: "pointer", fontWeight: "bold" }}>{editingLeadId ? "Update Lead" : "+ Add New Lead"}</button>
                </form>
              )}

              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "20px", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                  <input type="text" placeholder="🔍 Search name or phone..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ padding: "10px", background: "#0a0a0a", border: "1px solid #222", color: "#fff", borderRadius: "5px", width: "220px" }} />
                  
                  <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ padding: "10px", background: "#0a0a0a", border: "1px solid #222", color: "#fff", borderRadius: "5px" }}>
                    <option value="All">All Statuses</option>
                    <option value="New">New</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Interested">Interested</option>
                    <option value="Won">Won</option>
                    <option value="Lost">Lost</option>
                    <option value="Call Again">Call Again</option>
                  </select>

                  {role === "admin" && (
                    <select value={filterSalesman} onChange={(e) => setFilterSalesman(e.target.value)} style={{ padding: "10px", background: "#0a0a0a", border: "1px solid #222", color: "#fff", borderRadius: "5px" }}>
                      <option value="All">All Salesmen</option>
                      {employees.map((emp) => (<option key={emp.id} value={emp.name}>{emp.name}</option>))}
                    </select>
                  )}
                </div>

                <button onClick={exportToCSV} style={{ backgroundColor: "#121212", color: "#00ff66", border: "1px solid #222", padding: "10px 15px", borderRadius: "5px", cursor: "pointer", fontWeight: "bold" }}>📥 Export CSV</button>
              </div>

              {/* تم إزالة عمود الـ Next Follow-up من هنا لتبقى الواجهة نظيفة */}
              <div style={{ background: "#0a0a0a", borderRadius: "8px", border: "1px solid #1a1a1a", overflow: "hidden" }}>
                <table
  style={{
    width: "100%",
    borderCollapse: "collapse",
    textAlign: "left",
    color: "#fff",
    minWidth: "900px",
  }}
>
                  <thead>
                    <tr style={{ background: "#121212", color: "#ffcc00", borderBottom: "1px solid #1a1a1a" }}>
                      <th style={{ padding: "12px 15px" }}>Name</th>
                      <th style={{ padding: "12px 15px" }}>Phone</th>
                      <th style={{ padding: "12px 15px" }}>Source</th>
                      <th style={{ padding: "12px 15px" }}>Status</th>
                      <th style={{ padding: "12px 15px" }}>Assigned To</th>
                      <th style={{ padding: "12px 15px" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.map((lead) => (
                      <tr key={lead.id} style={{ borderBottom: "1px solid #1a1a1a" }}>
                        <td style={{ padding: "12px 15px" }}>{lead.name}</td>
                        <td style={{ padding: "12px 15px" }}>{lead.phone}</td>
                        <td style={{ padding: "12px 15px", color: "#888" }}>{lead.source || "N/A"}</td>
                        <td style={{ padding: "12px 15px" }}>
                          <span
  style={{
    display: "inline-block",
    padding: "5px 10px",
    borderRadius: "20px",
    fontSize: "11px",
    fontWeight: "700",
    border: "1px solid",
    background:
      lead.status === "New"
        ? "rgba(255, 212, 0, 0.10)"
        : lead.status === "Contacted"
        ? "rgba(77, 166, 255, 0.10)"
        : lead.status === "Interested"
        ? "rgba(0, 230, 118, 0.10)"
        : lead.status === "Won"
        ? "rgba(0, 255, 204, 0.10)"
        : lead.status === "Lost"
        ? "rgba(255, 77, 77, 0.10)"
        : "rgba(255, 153, 51, 0.10)",
    color:
      lead.status === "New"
        ? "#ffd400"
        : lead.status === "Contacted"
        ? "#4da6ff"
        : lead.status === "Interested"
        ? "#00e676"
        : lead.status === "Won"
        ? "#00ffcc"
        : lead.status === "Lost"
        ? "#ff4d4d"
        : "#ff9933",
    borderColor:
      lead.status === "New"
        ? "rgba(255, 212, 0, 0.25)"
        : lead.status === "Contacted"
        ? "rgba(77, 166, 255, 0.25)"
        : lead.status === "Interested"
        ? "rgba(0, 230, 118, 0.25)"
        : lead.status === "Won"
        ? "rgba(0, 255, 204, 0.25)"
        : lead.status === "Lost"
        ? "rgba(255, 77, 77, 0.25)"
        : "rgba(255, 153, 51, 0.25)",
  }}
>
  {lead.status}
</span>
                        </td>
                        <td style={{ padding: "12px 15px" }}>{lead.sales_man || "All Users"}</td>
                        <td style={{ padding: "12px 15px" }}>
                          <button onClick={() => openNotesModal(lead)} style={{ background: "transparent", border: "none", color: "#ffcc00", cursor: "pointer", marginRight: "10px", fontWeight: "bold" }}>Timeline / Notes</button>
                          {role === "admin" && (
                            <>
                              <button onClick={() => { setLeadForm(lead); setEditingLeadId(lead.id); }} style={{ background: "transparent", border: "none", color: "#4da6ff", cursor: "pointer", marginRight: "10px", fontWeight: "bold" }}>Edit</button>
                              <button onClick={() => handleDeleteLead(lead.id)} style={{ background: "transparent", border: "none", color: "#ff4d4d", cursor: "pointer", fontWeight: "bold" }}>Delete</button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* EMPLOYEES & USERS */}
          {activeTab === "employees" && role === "admin" && (
            <div>
              <form onSubmit={handleEmployeeSubmit} style={{ background: "#0a0a0a", padding: "20px", borderRadius: "8px", marginBottom: "25px", border: "1px solid #1a1a1a" }}>
                <h3 style={{ margin: "0 0 15px 0", color: "#fff" }}>{editingEmployeeId ? "Edit Employee" : "Add New Employee"}</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px", marginBottom: "15px" }}>
                  <input type="text" placeholder="Name *" value={employeeForm.name} onChange={(e) => setEmployeeForm({ ...employeeForm, name: e.target.value })} required style={{ padding: "10px", border: "1px solid #222", borderRadius: "4px", background: "#121212", color: "#fff" }} />
                  <input type="text" placeholder="Phone" value={employeeForm.phone} onChange={(e) => setEmployeeForm({ ...employeeForm, phone: e.target.value })} style={{ padding: "10px", border: "1px solid #222", borderRadius: "4px", background: "#121212", color: "#fff" }} />
                  <input type="text" placeholder="Role *" value={employeeForm.role} onChange={(e) => setEmployeeForm({ ...employeeForm, role: e.target.value })} required style={{ padding: "10px", border: "1px solid #222", borderRadius: "4px", background: "#121212", color: "#fff" }} />
                </div>
                <button type="submit" style={{ backgroundColor: "#ffcc00", color: "#000", border: "none", padding: "10px 20px", borderRadius: "5px", cursor: "pointer", fontWeight: "bold" }}>Save Employee</button>
              </form>

              <form onSubmit={handleCreateUser} style={{ background: "#0a0a0a", padding: "20px", borderRadius: "8px", marginBottom: "25px", border: "1px solid #1a1a1a" }}>
                <h3 style={{ margin: "0 0 15px 0", color: "#4da6ff" }}>🔐 Create Login Account for Staff</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px", marginBottom: "15px" }}>
                  <input type="text" placeholder="Username *" value={newUserForm.username} onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })} required style={{ padding: "10px", border: "1px solid #222", borderRadius: "4px", background: "#121212", color: "#fff" }} />
                  <input type="password" placeholder="Password *" value={newUserForm.password} onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })} required style={{ padding: "10px", border: "1px solid #222", borderRadius: "4px", background: "#121212", color: "#fff" }} />
                  <select value={newUserForm.role} onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })} style={{ padding: "10px", border: "1px solid #222", borderRadius: "4px", background: "#121212", color: "#fff" }}>
                    <option value="sales">Sales</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <button type="submit" style={{ backgroundColor: "#4da6ff", color: "#000", border: "none", padding: "10px 20px", borderRadius: "5px", cursor: "pointer", fontWeight: "bold" }}>Create Login Account</button>
              </form>
            </div>
          )}

        </div>
      </div>

      {/* --- Notes & Activity Log & Follow-up Modal --- */}
      {selectedLeadForNotes && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div style={{ background: "#0a0a0a", border: "1px solid #222", padding: "25px", borderRadius: "10px", width: "500px", maxWidth: "90%" }}>
            <div
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "18px",
    gap: "15px",
  }}
>
  <div>
    <h3
      style={{
        margin: "0 0 6px 0",
        color: "#ffd400",
        fontSize: "20px",
      }}
    >
      {selectedLeadForNotes.name}
    </h3>

    <div
      style={{
        color: "#777",
        fontSize: "13px",
      }}
    >
      📞 {selectedLeadForNotes.phone}
    </div>
  </div>

  <span
    style={{
      padding: "6px 11px",
      borderRadius: "20px",
      background: "#151515",
      color:
        selectedLeadForNotes.status === "Won"
          ? "#00ffcc"
          : selectedLeadForNotes.status === "Lost"
          ? "#ff4d4d"
          : "#ffd400",
      border: "1px solid #292929",
      fontSize: "11px",
      fontWeight: "700",
    }}
  >
    {selectedLeadForNotes.status}
  </span>
</div>
            
            <div style={{ maxHeight: "120px", overflowY: "auto", background: "#121212", padding: "10px", borderRadius: "5px", marginBottom: "10px", border: "1px solid #1a1a1a" }}>
              <h4 style={{ margin: "0 0 5px 0", color: "#4da6ff", fontSize: "12px" }}>Activity Log</h4>
              {activityLogs.map((log, idx) => (
                <div key={idx} style={{ fontSize: "12px", color: "#aaa", marginBottom: "4px" }}>
                  <span style={{ color: "#ffcc00" }}>[{new Date(log.date).toLocaleString()}]</span> <strong>{log.username}</strong>: {log.action}
                </div>
              ))}
            </div>

            <div style={{ maxHeight: "120px", overflowY: "auto", background: "#121212", padding: "10px", borderRadius: "5px", marginBottom: "15px", border: "1px solid #1a1a1a" }}>
              <h4 style={{ margin: "0 0 5px 0", color: "#ffcc00", fontSize: "12px" }}>Comments & Notes</h4>
              {leadNotes.map((note, idx) => (
                <div key={idx} style={{ marginBottom: "6px", fontSize: "13px" }}>
                  <span style={{ color: "#888", fontSize: "11px" }}>{note.date}: </span>
                  <span style={{ color: "#fff" }}>{note.text}</span>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddNote}>
              <div style={{ marginBottom: "10px" }}>
                <label style={{ display: "block", fontSize: "12px", color: "#888", marginBottom: "5px" }}>Next Follow-up Date & Time</label>
                <input type="datetime-local" value={noteNextFollowup} onChange={(e) => setNoteNextFollowup(e.target.value)} style={{ width: "100%", padding: "10px", boxSizing: "border-box", background: "#121212", border: "1px solid #222", color: "#ff4d4d", borderRadius: "5px" }} />
              </div>

              <div style={{ marginBottom: "10px" }}>
                <input type="text" placeholder="Type new follow-up note..." value={newNote} onChange={(e) => setNewNote(e.target.value)} style={{ width: "100%", padding: "10px", boxSizing: "border-box", background: "#121212", border: "1px solid #222", color: "#fff", borderRadius: "5px" }} />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" onClick={() => setSelectedLeadForNotes(null)} style={{ background: "#121212", color: "#aaa", border: "1px solid #222", padding: "8px 15px", borderRadius: "5px", cursor: "pointer" }}>Close</button>
                <button type="submit" style={{ background: "#ffcc00", color: "#000", border: "none", padding: "8px 15px", borderRadius: "5px", cursor: "pointer", fontWeight: "bold" }}>Save & Update</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;