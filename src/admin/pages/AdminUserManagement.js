/* eslint-disable no-unused-vars */
import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { UserPlus, Search, Edit2, Trash2, Shield, Loader2, X, Info, Eye, EyeOff, Users, KeyRound, UserCog, MoreVertical, AlertCircle, CheckCircle2 } from 'lucide-react';
import useDebounce from '../../hooks/useDebounce';
import API from '../../utils/api';
import Pagination from '../../components/Pagination';

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
  const isCreate = title.toLowerCase().includes('create');

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[440px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header with icon */}
        <div className="p-6 pb-0 flex flex-col items-center text-center gap-3">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm ${isDelete ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'}`}>
            {isDelete ? <Trash2 size={24} /> : isCreate ? <UserPlus size={24} /> : <Shield size={24} />}
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
  const [page, setPage] = useState(1);
  const PER_PAGE = 5;

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [editRole, setEditRole] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  // Create form
  const [createForm, setCreateForm] = useState({ email: '', password: '', role: 'loanAdmin' });
  const [createLoading, setCreateLoading] = useState(false);
  const [showCreateConfirmModal, setShowCreateConfirmModal] = useState(false);

  /* ── Real-time Validations ── */
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const createEmailError = useMemo(() => {
    if (!createForm.email) return '';
    if (!EMAIL_REGEX.test(createForm.email.trim())) return 'Please enter a valid email address';
    if (adminList.some(a => a.email.toLowerCase() === createForm.email.trim().toLowerCase())) {
      return 'An account with this email already exists';
    }
    return '';
  }, [createForm.email, adminList]);

  const createPasswordError = useMemo(() => {
    if (!createForm.password) return '';
    if (createForm.password.length < 8) return 'Password must be at least 8 characters';
    return '';
  }, [createForm.password]);

  const isCreateFormValid = useMemo(() => {
    return (
      createForm.email.trim() !== '' &&
      createForm.password.trim() !== '' &&
      !createEmailError &&
      !createPasswordError
    );
  }, [createForm.email, createForm.password, createEmailError, createPasswordError]);

  const editEmailError = useMemo(() => {
    if (!editEmail) return '';
    if (!EMAIL_REGEX.test(editEmail.trim())) return 'Please enter a valid email address';
    if (
      editTarget &&
      editEmail.trim().toLowerCase() !== editTarget.email.toLowerCase() &&
      adminList.some(a => a.email.toLowerCase() === editEmail.trim().toLowerCase())
    ) {
      return 'An account with this email already exists';
    }
    return '';
  }, [editEmail, editTarget, adminList]);

  const editPasswordError = useMemo(() => {
    if (!editPassword) return '';
    if (editPassword.length < 8) return 'Password must be at least 8 characters';
    return '';
  }, [editPassword]);

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
  const handleCreate = async (adminPassword) => {
    setActionLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/create-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...createForm, adminPassword })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Account created for ${createForm.email}`);
        setCreateForm({ email: '', password: '', role: 'loanAdmin' });
        setShowAddModal(false);
        setShowCreateConfirmModal(false);
        fetchAdmins();
      } else {
        toast.error(data.message || 'Failed to create account');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setActionLoading(false);
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

  if (!adminsData && loadingAdmins) {
    return (
      <div className="flex flex-col gap-6 p-6 max-w-[1400px] mx-auto w-full min-h-screen bg-slate-100 dark:bg-[#161922] animate-pulse">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div className="flex flex-col gap-2">
            <div className="h-8 w-52 bg-slate-200 dark:bg-slate-700/80 rounded-lg"></div>
            <div className="h-4 w-80 bg-slate-200 dark:bg-slate-700/80 rounded-md"></div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-64 bg-slate-200 dark:bg-slate-700/80 rounded-lg"></div>
            <div className="h-10 w-32 bg-slate-200 dark:bg-slate-700/80 rounded-lg"></div>
          </div>
        </div>

        {/* 4 Stat Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm flex flex-col justify-between h-[138px]">
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-2">
                  <div className="h-3.5 w-24 bg-slate-200 dark:bg-slate-700/80 rounded"></div>
                  <div className="h-8 w-16 bg-slate-200 dark:bg-slate-700/80 rounded-lg"></div>
                </div>
                <div className="w-12 h-12 rounded-[14px] bg-slate-200 dark:bg-slate-700/80"></div>
              </div>
              <div className="h-4 w-28 bg-slate-200 dark:bg-slate-700/80 rounded mt-2"></div>
            </div>
          ))}
        </div>

        {/* Table Skeleton */}
        <div className="w-full bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl shadow-sm overflow-hidden p-4">
          <div className="h-10 bg-slate-50 dark:bg-black/20 rounded-lg mb-4"></div>
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 bg-slate-100 dark:bg-slate-800/50 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-[1400px] mx-auto w-full min-h-screen bg-slate-100 dark:bg-[#161922]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="m-0 font-inter text-2xl font-bold text-slate-800 dark:text-white">User Management</h1>
          <p className="m-0 font-inter text-sm text-slate-500 dark:text-slate-400 mt-1">Manage administrator accounts, roles, and security permissions</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by email..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
              className="w-full sm:w-[260px] h-10 pl-10 pr-4 bg-white dark:bg-[#1E2130] border border-slate-300 dark:border-white/10 rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-all"
            />
          </div>
          <button className="h-10 px-4 bg-blue-600 text-white font-inter text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors border-none cursor-pointer flex items-center gap-2 shrink-0" onClick={() => { setShowAddModal(true); setShowCreatePassword(false); }}>
            <UserPlus size={18} />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Accounts */}
        <div className="group relative bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] overflow-hidden cursor-default transition-all duration-300 hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_12px_32px_rgba(0,0,0,0.3)] hover:-translate-y-1">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform duration-500 group-hover:scale-150"></div>
          <div className="flex items-start justify-between relative z-10 mb-4">
            <div className="flex flex-col">
              <span className="font-inter font-semibold text-[13px] tracking-wider uppercase text-slate-500 dark:text-slate-400 mb-1">Total Accounts</span>
              <div className="font-inter font-extrabold text-[32px] text-slate-900 dark:text-white tracking-tight leading-none">{loading ? '—' : stats.total}</div>
            </div>
            <div className="w-12 h-12 rounded-[14px] bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-500/20 dark:to-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200/60 dark:border-blue-500/30 transition-transform duration-300 group-hover:scale-110 shadow-sm">
              <Users size={24} strokeWidth={2.2} />
            </div>
          </div>
          <div className="flex items-center gap-2 relative z-10 mt-1">
            <div className="flex items-center gap-1 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md text-xs font-bold border border-blue-100 dark:border-blue-500/20">
              <Users size={14} strokeWidth={2.5} />
              <span>All</span>
            </div>
            <span className="font-inter text-xs font-medium text-slate-500 dark:text-slate-400">admin accounts</span>
          </div>
        </div>

        {/* Main Admins */}
        <div className="group relative bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] overflow-hidden cursor-default transition-all duration-300 hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_12px_32px_rgba(0,0,0,0.3)] hover:-translate-y-1">
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform duration-500 group-hover:scale-150"></div>
          <div className="flex items-start justify-between relative z-10 mb-4">
            <div className="flex flex-col">
              <span className="font-inter font-semibold text-[13px] tracking-wider uppercase text-slate-500 dark:text-slate-400 mb-1">Main Admins</span>
              <div className="font-inter font-extrabold text-[32px] text-slate-900 dark:text-white tracking-tight leading-none">{loading ? '—' : stats.admins}</div>
            </div>
            <div className="w-12 h-12 rounded-[14px] bg-gradient-to-br from-rose-50 to-rose-100/50 dark:from-rose-500/20 dark:to-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-200/60 dark:border-rose-500/30 transition-transform duration-300 group-hover:scale-110 shadow-sm">
              <Shield size={24} strokeWidth={2.2} />
            </div>
          </div>
          <div className="flex items-center gap-2 relative z-10 mt-1">
            <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-md text-xs font-bold border border-rose-100 dark:border-rose-500/20">
              <Shield size={14} strokeWidth={2.5} />
              <span>Admin</span>
            </div>
            <span className="font-inter text-xs font-medium text-slate-500 dark:text-slate-400">full access</span>
          </div>
        </div>

        {/* Loan Officers */}
        <div className="group relative bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] overflow-hidden cursor-default transition-all duration-300 hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_12px_32px_rgba(0,0,0,0.3)] hover:-translate-y-1">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform duration-500 group-hover:scale-150"></div>
          <div className="flex items-start justify-between relative z-10 mb-4">
            <div className="flex flex-col">
              <span className="font-inter font-semibold text-[13px] tracking-wider uppercase text-slate-500 dark:text-slate-400 mb-1">Loan Officers</span>
              <div className="font-inter font-extrabold text-[32px] text-slate-900 dark:text-white tracking-tight leading-none">{loading ? '—' : stats.loanAdmins}</div>
            </div>
            <div className="w-12 h-12 rounded-[14px] bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-500/20 dark:to-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-200/60 dark:border-amber-500/30 transition-transform duration-300 group-hover:scale-110 shadow-sm">
              <KeyRound size={24} strokeWidth={2.2} />
            </div>
          </div>
          <div className="flex items-center gap-2 relative z-10 mt-1">
            <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-md text-xs font-bold border border-amber-100 dark:border-amber-500/20">
              <KeyRound size={14} strokeWidth={2.5} />
              <span>Loan</span>
            </div>
            <span className="font-inter text-xs font-medium text-slate-500 dark:text-slate-400">loan management</span>
          </div>
        </div>

        {/* Secretaries */}
        <div className="group relative bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] overflow-hidden cursor-default transition-all duration-300 hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_12px_32px_rgba(0,0,0,0.3)] hover:-translate-y-1">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform duration-500 group-hover:scale-150"></div>
          <div className="flex items-start justify-between relative z-10 mb-4">
            <div className="flex flex-col">
              <span className="font-inter font-semibold text-[13px] tracking-wider uppercase text-slate-500 dark:text-slate-400 mb-1">Secretaries</span>
              <div className="font-inter font-extrabold text-[32px] text-slate-900 dark:text-white tracking-tight leading-none">{loading ? '—' : stats.secretaryAdmins}</div>
            </div>
            <div className="w-12 h-12 rounded-[14px] bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-500/20 dark:to-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200/60 dark:border-emerald-500/30 transition-transform duration-300 group-hover:scale-110 shadow-sm">
              <UserCog size={24} strokeWidth={2.2} />
            </div>
          </div>
          <div className="flex items-center gap-2 relative z-10 mt-1">
            <div className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md text-xs font-bold border border-emerald-100 dark:border-emerald-500/20">
              <UserCog size={14} strokeWidth={2.5} />
              <span>Secretary</span>
            </div>
            <span className="font-inter text-xs font-medium text-slate-500 dark:text-slate-400">limited access</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="w-full bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto" style={{ minHeight: '310px' }}>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500 dark:text-slate-400 font-inter text-sm"><Loader2 className="animate-spin" size={18} /> Loading accounts...</div>
        ) : (
          <table className="w-full text-left border-collapse min-w-[700px]" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '40%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '20%' }} />
            </colgroup>
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
                adminList.slice((page - 1) * PER_PAGE, page * PER_PAGE).map(a => (
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
                    <td className="px-5 py-3 border-b border-slate-100 dark:border-white/5 text-right relative" onClick={(e) => e.stopPropagation()}>
                      <button 
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors border-none bg-transparent cursor-pointer ml-auto"
                        title="Actions"
                        onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === a._id ? null : a._id); }}
                      >
                        <MoreVertical size={16} />
                      </button>
                      
                      {openMenuId === a._id && (
                        <div className="absolute right-4 top-10 z-50 w-44 bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl shadow-xl py-1 text-left">
                          <button 
                            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border-none bg-transparent cursor-pointer" 
                            onClick={() => { 
                              setOpenMenuId(null); 
                              setEditTarget(a); 
                              setEditRole(a.role); 
                              setEditEmail(a.email); 
                              setEditPassword(''); 
                              setShowEditPassword(false); 
                            }}
                          >
                            <Edit2 size={14} className="text-blue-500" /> Edit Account
                          </button>
                          {a.role !== 'admin' && (
                            <button 
                              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors border-none bg-transparent cursor-pointer" 
                              onClick={() => { setOpenMenuId(null); setDeleteTarget(a); }}
                            >
                              <Trash2 size={14} /> Delete Account
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
        </div>
        {adminList.length > PER_PAGE && (
          <div className="border-t border-slate-200 dark:border-white/10 bg-white dark:bg-[#1E2130]">
            <Pagination
              currentPage={page}
              totalPages={Math.ceil(adminList.length / PER_PAGE)}
              onPageChange={setPage}
              totalItems={adminList.length}
              itemsPerPage={PER_PAGE}
              itemName="accounts"
            />
          </div>
        )}
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

            <form className="flex-1 overflow-y-auto custom-scrollbar flex flex-col" onSubmit={(e) => {
              e.preventDefault();
              if (!isCreateFormValid) {
                if (createEmailError) return toast.error(createEmailError);
                if (createPasswordError) return toast.error(createPasswordError);
                return toast.error('Please complete all fields correctly');
              }
              setShowCreateConfirmModal(true);
            }}>
              <div className="px-6 pb-6 flex flex-col gap-4">
                {/* Email Address */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-inter text-[12px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Email Address</label>
                    {createForm.email && !createEmailError && (
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 size={12} /> Valid email
                      </span>
                    )}
                  </div>
                  <input
                    type="email" 
                    className={`h-11 px-3 bg-slate-50 dark:bg-[#161922] border rounded-xl text-sm font-inter text-slate-800 dark:text-white outline-none transition-all w-full ${
                      createEmailError 
                        ? 'border-rose-500 text-rose-600 dark:text-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20' 
                        : createForm.email && !createEmailError 
                        ? 'border-emerald-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20' 
                        : 'border-slate-300 dark:border-white/10 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                    }`} 
                    placeholder="example@email.com"
                    value={createForm.email} 
                    onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} 
                    required
                  />
                  {createEmailError && (
                    <span className="text-[11px] text-rose-500 font-medium flex items-center gap-1 mt-0.5">
                      <AlertCircle size={12} /> {createEmailError}
                    </span>
                  )}
                </div>

                {/* Password */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-inter text-[12px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Password</label>
                    {createForm.password && !createPasswordError && (
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 size={12} /> Password ok
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type={showCreatePassword ? "text" : "password"} 
                      className={`h-11 pl-10 pr-10 bg-slate-50 dark:bg-[#161922] border rounded-xl text-sm font-inter text-slate-800 dark:text-white outline-none transition-all w-full ${
                        createPasswordError 
                          ? 'border-rose-500 text-rose-600 dark:text-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20' 
                          : createForm.password && !createPasswordError 
                          ? 'border-emerald-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20' 
                          : 'border-slate-300 dark:border-white/10 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                      }`} 
                      placeholder="••••••••"
                      value={createForm.password} 
                      onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} 
                      required
                    />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 bg-transparent border-none text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer" onClick={() => setShowCreatePassword(!showCreatePassword)}>
                      {showCreatePassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {createPasswordError ? (
                    <span className="text-[11px] text-rose-500 font-medium flex items-center gap-1 mt-0.5">
                      <AlertCircle size={12} /> {createPasswordError}
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400 font-normal">Must be at least 8 characters</span>
                  )}
                </div>

                {/* Account Role */}
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
                <button type="submit" className="h-10 flex-1 rounded-xl font-inter text-sm font-semibold transition-all border-none bg-blue-600 text-white hover:bg-blue-700 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed" disabled={!isCreateFormValid || actionLoading}>
                  {actionLoading ? <Loader2 className="animate-spin" size={16} /> : <><UserPlus size={16} /> Create Account</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreateConfirmModal && (
        <PasswordModal
          title="Confirm Account Creation"
          description={`Creating a new ${ROLE_LABELS[createForm.role] || createForm.role} account for ${createForm.email}.`}
          onConfirm={handleCreate}
          onClose={() => setShowCreateConfirmModal(false)}
          loading={actionLoading}
        />
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
                <div className="flex items-center justify-between">
                  <label className="font-inter text-[12px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Email Address</label>
                  {editEmail && !editEmailError && (
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 size={12} /> Valid email
                    </span>
                  )}
                </div>
                <input
                  type="email" 
                  className={`h-11 px-3 bg-slate-50 dark:bg-[#161922] border rounded-xl text-sm font-inter text-slate-800 dark:text-white outline-none transition-all w-full ${
                    editEmailError 
                      ? 'border-rose-500 text-rose-600 dark:text-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20' 
                      : editEmail && !editEmailError 
                      ? 'border-emerald-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20' 
                      : 'border-slate-300 dark:border-white/10 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                  }`} 
                  value={editEmail} 
                  onChange={e => setEditEmail(e.target.value)} 
                  required
                />
                {editEmailError && (
                  <span className="text-[11px] text-rose-500 font-medium flex items-center gap-1 mt-0.5">
                    <AlertCircle size={12} /> {editEmailError}
                  </span>
                )}
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
                <div className="flex items-center justify-between">
                  <label className="font-inter text-[12px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">New Password <span className="normal-case text-slate-400 dark:text-slate-500">(optional)</span></label>
                  {editPassword && !editPasswordError && (
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 size={12} /> Password ok
                    </span>
                  )}
                </div>
                <div className="relative">
                  <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type={showEditPassword ? "text" : "password"} 
                    className={`h-11 pl-10 pr-10 bg-slate-50 dark:bg-[#161922] border rounded-xl text-sm font-inter text-slate-800 dark:text-white outline-none transition-all w-full ${
                      editPasswordError 
                        ? 'border-rose-500 text-rose-600 dark:text-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20' 
                        : editPassword && !editPasswordError 
                        ? 'border-emerald-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20' 
                        : 'border-slate-300 dark:border-white/10 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                    }`} 
                    placeholder="Leave blank to keep current"
                    value={editPassword} 
                    onChange={e => setEditPassword(e.target.value)}
                  />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 bg-transparent border-none text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer" onClick={() => setShowEditPassword(!showEditPassword)}>
                    {showEditPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {editPasswordError && (
                  <span className="text-[11px] text-rose-500 font-medium flex items-center gap-1 mt-0.5">
                    <AlertCircle size={12} /> {editPasswordError}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 pb-6 flex items-center gap-3">
              <button className="h-10 flex-1 rounded-xl font-inter text-sm font-semibold transition-all border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10 cursor-pointer" onClick={() => setEditTarget(null)}>Cancel</button>
              <button className="h-10 flex-1 rounded-xl font-inter text-sm font-semibold transition-all border-none bg-blue-600 text-white hover:bg-blue-700 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed" onClick={() => {
                setEditTarget({ ...editTarget, confirmStep: true });
              }} disabled={!editEmail.trim() || !!editEmailError || !!editPasswordError || (editRole === editTarget.role && editEmail === editTarget.email && !editPassword.trim())}>
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
