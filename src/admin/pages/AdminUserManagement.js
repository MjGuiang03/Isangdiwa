/* eslint-disable no-unused-vars */
import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { UserPlus, Search, Edit2, Trash2, Shield, Loader2, X, Info, Eye, EyeOff, Users, KeyRound, UserCog } from 'lucide-react';
import useDebounce from '../../hooks/useDebounce';
import API from '../../utils/api';

const ROLE_LABELS = {
  admin: 'Main Admin',
  loanAdmin: 'Loan Officer',
  secretaryAdmin: 'Secretary',
};

const ROLE_COLORS = {
  admin: '#155DFC',
  loanAdmin: '#F59E0B',
  secretaryAdmin: '#10b981',
};

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

/* ══════════════════════════════════════════════════════
   PASSWORD CONFIRMATION MODAL
══════════════════════════════════════════════════════ */
function PasswordModal({ title, description, onConfirm, onClose, loading, variant = 'default' }) {
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const isDelete = title.toLowerCase().includes('delete');

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[440px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header with icon */}
        <div className="p-6 pb-0 flex flex-col items-center text-center gap-3">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm ${isDelete ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'}`}>
            {isDelete ? <Trash2 size={24} /> : <Shield size={24} />}
          </div>
          <h3 className="m-0 font-inter text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
          <p className="m-0 font-inter text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed">{description}</p>
        </div>

        {/* Password input */}
        <div className="p-6 flex flex-col gap-2">
          <label className="font-inter text-[12px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Verify Your Identity</label>
          <div className="relative">
            <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type={showPw ? "text" : "password"}
              className="h-11 pl-10 pr-10 bg-slate-50 dark:bg-[#161922] border border-slate-300 dark:border-white/10 rounded-xl text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all w-full"
              placeholder="Enter your admin password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && password) onConfirm(password); }}
              autoFocus
            />
            <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 bg-transparent border-none text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer" onClick={() => setShowPw(!showPw)}>
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex items-center gap-3">
          <button className="h-10 flex-1 rounded-xl font-inter text-sm font-semibold transition-all border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10 cursor-pointer" onClick={onClose} disabled={loading}>Cancel</button>
          <button
            className={`h-10 flex-1 rounded-xl font-inter text-sm font-semibold transition-all border-none text-white cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${isDelete ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'}`}
            onClick={() => onConfirm(password)}
            disabled={!password || loading}
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : isDelete ? 'Delete Account' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════ */
export default function AdminUserManagement() {
  const navigate = useNavigate();
  const [adminList, setAdminList] = useState([]);
  const [stats, setStats] = useState({ total: 0, admins: 0, loanAdmins: 0, secretaryAdmins: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 400);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editRole, setEditRole] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  // Create form
  const [createForm, setCreateForm] = useState({ email: '', password: '', role: 'loanAdmin' });
  const [createLoading, setCreateLoading] = useState(false);

  const token = localStorage.getItem('adminToken');
  const superAdminEmail = localStorage.getItem('adminEmail');

  const fetcherSingle = (url) => fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(res => res.json());

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
    return params.toString();
  }, [debouncedSearch]);

  const { data: adminsData, isValidating: loadingAdmins, mutate: fetchAdmins } = useSWR(
    token ? `${API}/api/admin/admins?limit=100&${queryParams}` : null,
    fetcherSingle,
    { revalidateOnFocus: false, revalidateIfStale: true }
  );

  useEffect(() => {
    if (adminsData && adminsData.success) {
        setAdminList(adminsData.admins || []);
        setStats(adminsData.stats || { total: 0, admins: 0, loanAdmins: 0, secretaryAdmins: 0 });
    }
  }, [adminsData]);

  useEffect(() => {
    setLoading(loadingAdmins && !adminsData);
  }, [loadingAdmins, adminsData]);

  useEffect(() => {
    const role = localStorage.getItem('adminRole');
    if (role !== 'admin') {
      toast.error('Access denied. Only Main Admin can manage users.');
      navigate('/admin/dashboard');
    }
  }, [navigate]);

  /* ── Create ── */
  const handleCreate = async (e) => {
    e.preventDefault();

    setCreateLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/create-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(createForm)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Account created for ${createForm.email}`);
        setCreateForm({ email: '', password: '', role: 'loanAdmin' });
        setShowAddModal(false);
        fetchAdmins();
      } else {
        toast.error(data.message || 'Failed to create account');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setCreateLoading(false);
    }
  };

  /* ── Edit Role ── */
  const handleEditRole = async (adminPassword) => {
    if (!editTarget || !editRole) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/update-admin`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: editTarget.email, newEmail: editEmail, role: editRole, newPassword: editPassword, adminPassword })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message);
        if (data.newToken && data.newEmail) {
          localStorage.setItem('adminToken', data.newToken);
          localStorage.setItem('adminEmail', data.newEmail);
          // Optional: Force reload to refresh sidebar and other state if they change their own email
          window.location.reload();
        }
        setEditTarget(null);
        fetchAdmins();
      } else {
        toast.error(data.message || 'Failed to update role');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setActionLoading(false);
    }
  };

  /* ── Delete ── */
  const handleDelete = async (adminPassword) => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/delete-admin`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: deleteTarget.email, adminPassword })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message);
        setDeleteTarget(null);
        fetchAdmins();
      } else {
        toast.error(data.message || 'Failed to delete');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setActionLoading(false);
    }
  };

  const isSuperAdmin = (email) => email === superAdminEmail;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-[1400px] mx-auto w-full min-h-screen bg-slate-100 dark:bg-[#161922]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="m-0 font-inter text-2xl font-bold text-slate-800 dark:text-white">User Management</h1>
        </div>
        <button className="h-10 px-4 bg-blue-600 text-white font-inter text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors border-none cursor-pointer flex items-center gap-2" onClick={() => { setShowAddModal(true); setShowCreatePassword(false); }}>
          <UserPlus size={18} />
          <span>Add User</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="group relative bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-5 flex flex-col gap-1 overflow-hidden cursor-default transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
          <div className="flex items-center justify-between relative z-10">
            <span className="font-inter font-bold text-[11px] tracking-widest text-slate-500 dark:text-slate-400 uppercase">Total Accounts</span>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-500/20 dark:to-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-500/30">
              <Users size={20} strokeWidth={2.2} />
            </div>
          </div>
          <p className="font-inter font-extrabold text-[28px] tracking-tight text-slate-900 dark:text-white m-0 mt-2 relative z-10">{loading ? '—' : stats.total}</p>
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        </div>

        <div className="group relative bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-5 flex flex-col gap-1 overflow-hidden cursor-default transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
          <div className="flex items-center justify-between relative z-10">
            <span className="font-inter font-bold text-[11px] tracking-widest text-slate-500 dark:text-slate-400 uppercase">Main Admins</span>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 shadow-sm bg-gradient-to-br from-rose-50 to-rose-100/50 dark:from-rose-500/20 dark:to-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-500/30">
              <Shield size={20} strokeWidth={2.2} />
            </div>
          </div>
          <p className="font-inter font-extrabold text-[28px] tracking-tight text-slate-900 dark:text-white m-0 mt-2 relative z-10">{loading ? '—' : stats.admins}</p>
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-rose-500/10 rounded-full blur-3xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        </div>

        <div className="group relative bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-5 flex flex-col gap-1 overflow-hidden cursor-default transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
          <div className="flex items-center justify-between relative z-10">
            <span className="font-inter font-bold text-[11px] tracking-widest text-slate-500 dark:text-slate-400 uppercase">Loan Officers</span>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-500/20 dark:to-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-500/30">
              <KeyRound size={20} strokeWidth={2.2} />
            </div>
          </div>
          <p className="font-inter font-extrabold text-[28px] tracking-tight text-slate-900 dark:text-white m-0 mt-2 relative z-10">{loading ? '—' : stats.loanAdmins}</p>
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        </div>

        <div className="group relative bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-5 flex flex-col gap-1 overflow-hidden cursor-default transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
          <div className="flex items-center justify-between relative z-10">
            <span className="font-inter font-bold text-[11px] tracking-widest text-slate-500 dark:text-slate-400 uppercase">Secretaries</span>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-500/20 dark:to-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-500/30">
              <UserCog size={20} strokeWidth={2.2} />
            </div>
          </div>
          <p className="font-inter font-extrabold text-[28px] tracking-tight text-slate-900 dark:text-white m-0 mt-2 relative z-10">{loading ? '—' : stats.secretaryAdmins}</p>
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl shadow-sm shrink-0">
        <div className="relative flex-1 max-w-[400px]">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by email..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-slate-50 dark:bg-[#161922] border border-slate-300 dark:border-white/10 rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-all"
          />
        </div>
      </div>

      {/* Table */}
      <div className="w-full bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500 dark:text-slate-400 font-inter text-sm"><Loader2 className="animate-spin" size={18} /> Loading accounts...</div>
        ) : (
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr>
                <th className="px-5 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Account</th>
                <th className="px-5 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Role</th>
                <th className="px-5 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Created</th>
                <th className="px-5 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {adminList.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-12 text-center text-slate-500 dark:text-slate-400 font-inter text-sm">{searchQuery ? 'No results found.' : 'No accounts yet.'}</td></tr>
              ) : (
                adminList.map(a => (
                  <tr key={a._id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3 border-b border-slate-100 dark:border-white/5">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${a.role === 'admin' ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400' : a.role === 'loanAdmin' ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'}`}>
                          <Shield size={14} />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-inter text-sm font-semibold text-slate-800 dark:text-white">{a.email}</span>
                          {isSuperAdmin(a.email) && <span className="inline-flex items-center w-fit px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 uppercase mt-0.5">Super Admin</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 border-b border-slate-100 dark:border-white/5">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase ${a.role === 'admin' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400' : a.role === 'loanAdmin' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'}`}>
                        {ROLE_LABELS[a.role] || a.role}
                      </span>
                    </td>
                    <td className="px-5 py-3 border-b border-slate-100 dark:border-white/5 font-inter text-xs text-slate-500 dark:text-slate-400">{fmtDate(a.createdAt)}</td>
                    <td className="px-5 py-3 border-b border-slate-100 dark:border-white/5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-white/5 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors border-none cursor-pointer"
                          title="Edit Account"
                          onClick={() => { setEditTarget(a); setEditRole(a.role); setEditEmail(a.email); setEditPassword(''); setShowEditPassword(false); }}
                        >
                          <Edit2 size={14} />
                        </button>
                        {a.role !== 'admin' && (
                          <button
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-white/5 text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors border-none cursor-pointer"
                            title="Delete"
                            onClick={() => setDeleteTarget(a)}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
        </div>
      </div>

      {/* Info */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10">
        <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center shrink-0">
          <Info size={16} className="text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="font-inter text-[13px] font-semibold text-slate-700 dark:text-slate-300">Access Policy</span>
          <span className="font-inter text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed">Only the Main Super Admin can create, edit, or delete accounts. The Super Admin account cannot be deleted, but you can update your own email and password.</span>
        </div>
      </div>

      {/* ── Add User Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[460px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="p-6 pb-4 flex flex-col items-center text-center gap-3">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                <UserPlus size={24} />
              </div>
              <div>
                <h3 className="m-0 font-inter text-lg font-bold text-slate-900 dark:text-white">Create New Account</h3>
                <p className="m-0 mt-1 font-inter text-[13px] text-slate-500 dark:text-slate-400">Add a new admin, loan officer, or secretary</p>
              </div>
            </div>

            <form className="flex-1 overflow-y-auto custom-scrollbar flex flex-col" onSubmit={handleCreate}>
              <div className="px-6 pb-6 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="font-inter text-[12px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Email Address</label>
                  <input
                    type="email" className="h-11 px-3 bg-slate-50 dark:bg-[#161922] border border-slate-300 dark:border-white/10 rounded-xl text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all w-full" placeholder="example@email.com"
                    value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-inter text-[12px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Password</label>
                  <div className="relative">
                    <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type={showCreatePassword ? "text" : "password"} className="h-11 pl-10 pr-10 bg-slate-50 dark:bg-[#161922] border border-slate-300 dark:border-white/10 rounded-xl text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all w-full" placeholder="••••••••"
                      value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} required
                    />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 bg-transparent border-none text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer" onClick={() => setShowCreatePassword(!showCreatePassword)}>
                      {showCreatePassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-inter text-[12px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Account Role</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[{ value: 'admin', label: 'Main Admin', color: 'rose' }, { value: 'loanAdmin', label: 'Loan Officer', color: 'amber' }, { value: 'secretaryAdmin', label: 'Secretary', color: 'emerald' }].map(r => (
                      <button key={r.value} type="button"
                        className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${createForm.role === r.value ? `border-${r.color}-500 bg-${r.color}-50 dark:bg-${r.color}-500/10 text-${r.color}-700 dark:text-${r.color}-400 ring-2 ring-${r.color}-500/20` : 'border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-500 hover:border-slate-300 dark:hover:border-white/20'}`}
                        onClick={() => setCreateForm(f => ({ ...f, role: r.value }))}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="px-6 pb-6 flex items-center gap-3">
                <button type="button" className="h-10 flex-1 rounded-xl font-inter text-sm font-semibold transition-all border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10 cursor-pointer" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="h-10 flex-1 rounded-xl font-inter text-sm font-semibold transition-all border-none bg-blue-600 text-white hover:bg-blue-700 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50" disabled={createLoading}>
                  {createLoading ? <Loader2 className="animate-spin" size={16} /> : <><UserPlus size={16} /> Create Account</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Account Modal ── */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={() => setEditTarget(null)}>
          <div className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[460px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="p-6 pb-4 flex flex-col items-center text-center gap-3">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                <Edit2 size={24} />
              </div>
              <div>
                <h3 className="m-0 font-inter text-lg font-bold text-slate-900 dark:text-white">Edit Account</h3>
                <p className="m-0 mt-1 font-inter text-[13px] text-slate-500 dark:text-slate-400">Modify details for <strong className="text-slate-700 dark:text-slate-200">{editTarget.email}</strong></p>
              </div>
            </div>

            <div className="px-6 pb-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-inter text-[12px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Email Address</label>
                <input
                  type="email" className="h-11 px-3 bg-slate-50 dark:bg-[#161922] border border-slate-300 dark:border-white/10 rounded-xl text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all w-full" 
                  value={editEmail} onChange={e => setEditEmail(e.target.value)} required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-inter text-[12px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Role</label>
                <div className="grid grid-cols-3 gap-2">
                  {[{ value: 'admin', label: 'Main Admin', color: 'rose' }, { value: 'loanAdmin', label: 'Loan Officer', color: 'amber' }, { value: 'secretaryAdmin', label: 'Secretary', color: 'emerald' }].map(r => (
                    <button key={r.value} type="button"
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${editRole === r.value ? `border-${r.color}-500 bg-${r.color}-50 dark:bg-${r.color}-500/10 text-${r.color}-700 dark:text-${r.color}-400 ring-2 ring-${r.color}-500/20` : 'border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-500 hover:border-slate-300 dark:hover:border-white/20'}`}
                      onClick={() => setEditRole(r.value)}
                      disabled={editTarget.email === superAdminEmail}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-inter text-[12px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">New Password <span className="normal-case text-slate-400 dark:text-slate-500">(optional)</span></label>
                <div className="relative">
                  <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type={showEditPassword ? "text" : "password"} className="h-11 pl-10 pr-10 bg-slate-50 dark:bg-[#161922] border border-slate-300 dark:border-white/10 rounded-xl text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all w-full" placeholder="Leave blank to keep current"
                    value={editPassword} onChange={e => setEditPassword(e.target.value)}
                  />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 bg-transparent border-none text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer" onClick={() => setShowEditPassword(!showEditPassword)}>
                    {showEditPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 pb-6 flex items-center gap-3">
              <button className="h-10 flex-1 rounded-xl font-inter text-sm font-semibold transition-all border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10 cursor-pointer" onClick={() => setEditTarget(null)}>Cancel</button>
              <button className="h-10 flex-1 rounded-xl font-inter text-sm font-semibold transition-all border-none bg-blue-600 text-white hover:bg-blue-700 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed" onClick={() => {
                setEditTarget({ ...editTarget, confirmStep: true });
              }} disabled={(editRole === editTarget.role && editEmail === editTarget.email && !editPassword.trim())}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {editTarget?.confirmStep && (
        <PasswordModal
          title="Confirm Role Change"
          description={`Changing ${editTarget.email} to ${ROLE_LABELS[editRole]}.`}
          onConfirm={handleEditRole}
          onClose={() => setEditTarget(null)}
          loading={actionLoading}
        />
      )}

      {/* ── Delete Modal ── */}
      {deleteTarget && (
        <PasswordModal
          title="Delete Account"
          description={`Are you sure you want to permanently delete ${deleteTarget.email}?`}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
          loading={actionLoading}
        />
      )}
    </div>
  );
}
