import { useState, useEffect, useRef, useMemo } from 'react';
import useSWR from 'swr';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Search, MoreVertical, Edit, Trash2, Eye, CreditCard, User, UserPlus, Users as UsersIcon, XCircle, X, EyeOff, CheckCircle2, Loader2, Lock } from 'lucide-react';
import Pagination from '../../components/Pagination';
import useDebounce from '../../hooks/useDebounce';
import React from 'react';

import API from '../../utils/api';
/* ─── query-string builder ──────────────────────────────────────────────── */
function buildQuery(params) {
  return Object.entries(params)
    .filter(([, v]) => v !== '' && v !== 'all' && v != null && v !== false)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

/* ─── Pencil (Edit) icon ────────────────────────────────────────────────── */
const IconEdit = () => (
  <Edit size={17} color="#155DFC" />
);

/* ─── Trash (Delete) icon ───────────────────────────────────────────────── */
const IconTrash = () => (
  <Trash2 size={17} color="#F04438" />
);

/* ═══════════════════════════════════════════════════════════════════════════
   EDIT MODAL
═══════════════════════════════════════════════════════════════════════════ */
function EditModal({ member, onClose, onSave }) {
  const [form, setForm] = useState({
    fullName: member.fullName || member.name || '',
    email:    member.email    || '',
    phone:    member.phone    || '',
    branch:   member.branch   || '',
    position: member.position || 'Member',
    churchId: member.churchId || '',
    newPassword: '', // Added for editing password
  });
  const [errors, setErrors] = useState({});
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword,  setShowPassword]  = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [saving,        setSaving]        = useState(false);

  const validateField = (name, value, position) => {
    let error = '';
    if (name === 'newPassword' && value) {
      if (value.length < 8) error = 'At least 8 characters';
      else if (!/[A-Z]/.test(value)) error = 'At least one uppercase letter';
      else if (!/[a-z]/.test(value)) error = 'At least one lowercase letter';
      else if (!/[0-9]/.test(value)) error = 'At least one number';
      else if (!/[^A-Za-z0-9]/.test(value)) error = 'At least one symbol';
    } else if (name === 'churchId' && position !== 'Member') {
      if (!value) error = 'Church ID is required';
      else if (!/^\d{2}-\d{2}-\d{2}$/.test(value)) error = 'Format XX-XX-XX';
      else {
        const POSITION_RANGES = {
          'Deacon': { prefix: '00-00' }, 'Local Evangelist': { prefix: '00-01' },
          'District Evangelist': { prefix: '00-02' }, 'National Evangelist': { prefix: '00-03' },
          'Assistant Priest': { prefix: '00-04' }, 'Priest': { prefix: '00-05' },
          'Elder': { prefix: '00-06' }, 'District Elder': { prefix: '00-06' },
          'Bishop': { prefix: '00-07' }, 'District Bishop': { prefix: '00-08' },
          'National Bishop': { prefix: '00-09' }, 'Apostle': { prefix: '00-10' },
        };
        const range = POSITION_RANGES[position];
        if (range) {
          const parts = value.split('-');
          const idPrefix = parts[0] + '-' + parts[1];
          if (idPrefix !== range.prefix) error = `Must start with ${range.prefix} for ${position}`;
        }
      }
    }
    return error;
  };

  const handleChange = e => {
    const { name, value } = e.target;
    let sanitized = value;
    if (name === 'churchId') sanitized = value.replace(/[^\d-]/g, '').slice(0, 8);
    setForm(f => ({ ...f, [name]: sanitized }));

    const error = validateField(name, sanitized, name === 'position' ? sanitized : form.position);
    setErrors(prev => ({ ...prev, [name]: error }));

    if (name === 'position' && sanitized !== 'Member') {
      const cidError = validateField('churchId', form.churchId, sanitized);
      setErrors(prev => ({ ...prev, churchId: cidError }));
    }
  };

  const handleSubmit = async () => {
    if (!form.fullName.trim()) { toast.error('Full name is required'); return; }
    if (!adminPassword.trim()) { setPasswordError('Admin password is required'); return; }

    const newErrors = {};
    if (form.newPassword) newErrors.newPassword = validateField('newPassword', form.newPassword);
    if (form.position !== 'Member') newErrors.churchId = validateField('churchId', form.churchId, form.position);
    setErrors(newErrors);

    if (Object.values(newErrors).some(err => err)) {
      return toast.error('Please fix the errors in the form');
    }

    setPasswordError('');
    setSaving(true);
    try {
      const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
      const res   = await fetch(`${API}/api/admin/update-member`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ originalEmail: member.email, adminPassword, ...form })
      });
      const data = await res.json();
      if (!data.success) {
        if (data.wrongPassword) { setPasswordError('Incorrect admin password'); return; }
        throw new Error(data.message || 'Update failed');
      }
      toast.success('Member updated successfully');
      onSave();
    } catch (err) {
      toast.error(err.message || 'Failed to update member');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[600px] shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-4 p-5 border-b border-slate-200 dark:border-white/10 shrink-0 relative">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-blue-100 dark:bg-blue-500/20"><IconEdit /></div>
          <div className="flex flex-col">
            <p className="m-0 font-inter text-lg font-bold text-slate-800 dark:text-white">Edit Member</p>
            <p className="m-0 font-inter text-[13px] text-slate-500 dark:text-slate-400">Update information for {member.fullName || member.name}</p>
          </div>
          <button className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer border-none" onClick={onClose}>
            <X size={20} color="#6a7282" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 flex flex-col gap-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-inter text-[13px] font-semibold text-slate-700 dark:text-slate-300">Full Name</label>
              <input className="h-10 px-3 bg-white dark:bg-[#1E2130] border border-slate-300 dark:border-white/10 rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all w-full" name="fullName" value={form.fullName} onChange={handleChange} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-inter text-[13px] font-semibold text-slate-700 dark:text-slate-300">Email Address</label>
              <input className="h-10 px-3 bg-white dark:bg-[#1E2130] border border-slate-300 dark:border-white/10 rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all w-full" type="email" name="email" value={form.email} onChange={handleChange} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-inter text-[13px] font-semibold text-slate-700 dark:text-slate-300">Phone Number</label>
              <input className="h-10 px-3 bg-white dark:bg-[#1E2130] border border-slate-300 dark:border-white/10 rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all w-full" name="phone" value={form.phone} onChange={handleChange} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-inter text-[13px] font-semibold text-slate-700 dark:text-slate-300">Community</label>
              <select className="h-10 px-3 bg-white dark:bg-[#1E2130] border border-slate-300 dark:border-white/10 rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all w-full" name="branch" value={form.branch} onChange={handleChange}>
                <optgroup label="Kalinga">
                  <option>Tabuk</option><option>Zapote</option><option>Bliss</option>
                  <option>Libanon</option><option>Batong Buhay</option><option>Balatoc</option><option>Lat-nog</option>
                </optgroup>
                <optgroup label="Isabela"><option>Santiago City</option></optgroup>
                <optgroup label="Abra">
                  <option>Lamao</option><option>Lingey</option><option>Cabaruyan</option><option>Ducligan</option>
                  <option>Gangal</option><option>Bila-Bila</option><option>Naguillian</option><option>Ud-udiao</option>
                  <option>Villa Conchita</option><option>Ay-yeng Manabo</option><option>Dao-angan</option>
                  <option>Kilong-olao</option><option>Bao-yan</option><option>Amti</option><option>Danac</option>
                  <option>Bengued</option><option>Sappaac</option><option>Saccaang</option>
                </optgroup>
                <optgroup label="Benguet"><option>Baguio</option></optgroup>
                <optgroup label="Rizal"><option>Montalban</option></optgroup>
                <optgroup label="NCR">
                  <option>Valenzuela City</option><option>Tandang Sora, Quezon City</option>
                  <option>COA, Quezon City</option><option>Payatas, Quezon City</option><option>Malaria, Caloocan</option>
                </optgroup>
                <optgroup label="Bulacan">
                  <option>Meycauayan City</option><option>Camalig</option><option>San Jose Del Monte</option>
                </optgroup>
                <optgroup label="Tarlac">
                  <option>Pacpaco, San Manuel</option><option>Victoria</option>
                </optgroup>
                <optgroup label="Nueva Ecija"><option>Bambanaba,巧Cuyapo</option></optgroup>
                <optgroup label="Pangasinan">
                  <option>Dagupan</option><option>Mangatarem</option><option>Laoak Langka</option>
                  <option>Orbiztondo</option><option>Malasiqui, Bolaoit</option><option>Taloyan</option>
                  <option>Binmaley</option><option>San Carlos</option><option>Manaoag</option>
                  <option>Pozorrubio</option><option>Alcala</option>
                </optgroup>
                <optgroup label="Agusan Del Norte">
                  <option>Butuan City</option><option>RTR</option><option>Jabonga, Bangonay</option>
                  <option>Kasiklan</option><option>San Mateo</option><option>Fatima Kim.13</option>
                  <option>Bayugan</option><option>Ibuan</option><option>Balubo</option>
                </optgroup>
                <optgroup label="Cebu">
                  <option>Mandaue</option><option>Liloan</option><option>Calero</option><option>Compostela</option>
                </optgroup>
                <optgroup label="Surigao Del Norte">
                  <option>Alegria</option><option>Bonifacio</option><option>Matin-ao</option><option>Ipil</option>
                </optgroup>
                <optgroup label="Surigao Del Sur"><option>Kinabigtasan, Tago</option></optgroup>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-inter text-[13px] font-semibold text-slate-700 dark:text-slate-300">Church Position</label>
              <select className="h-10 px-3 bg-white dark:bg-[#1E2130] border border-slate-300 dark:border-white/10 rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all w-full" name="position" value={form.position} onChange={handleChange}>
                <option value="Member">Member</option>
                <option value="Deacon">Deacon</option>
                <option value="Local Evangelist">Local Evangelist</option>
                <option value="District Evangelist">District Evangelist</option>
                <option value="National Evangelist">National Evangelist</option>
                <option value="Assistant Priest">Assistant Priest</option>
                <option value="Priest">Priest</option>
                <option value="Elder">Elder</option>
                <option value="District Elder">District Elder</option>
                <option value="Bishop">Bishop</option>
                <option value="District Bishop">District Bishop</option>
                <option value="National Bishop">National Bishop</option>
                <option value="Apostle">Apostle</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-inter text-[13px] font-semibold text-slate-700 dark:text-slate-300">Church ID</label>
              <input 
                className={`h-10 px-3 bg-white dark:bg-[#161922] border rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-all w-full ${errors.churchId ? 'border-rose-500 ring-1 ring-rose-500/50' : 'border-slate-300 dark:border-white/10'}`} 
                name="churchId" 
                value={form.churchId} 
                onChange={handleChange} 
                disabled={form.position === 'Member'} 
              />
              {errors.churchId && <p className="m-0 font-inter text-xs text-rose-500 font-medium" >{errors.churchId}</p>}
            </div>
          </div>
          <div className="flex flex-col gap-1.5 mb-5">
            <label className="font-inter text-[13px] font-semibold text-slate-700 dark:text-slate-300">New Password (optional)</label>
            <input
              className={`h-10 px-3 bg-white dark:bg-[#161922] border rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-all w-full ${errors.newPassword ? 'border-rose-500 ring-1 ring-rose-500/50' : 'border-slate-300 dark:border-white/10'}`}
              type="text"
              name="newPassword"
              value={form.newPassword}
              onChange={handleChange}
              placeholder="Enter new password to change"
            />
            {errors.newPassword && <p className="m-0 font-inter text-xs text-rose-500 font-medium" >{errors.newPassword}</p>}
          </div>
          <p className="font-inter text-[13px] font-bold uppercase tracking-wider text-slate-400 mt-2 mb-1">Confirm Changes</p>
          <div className="flex flex-col gap-1.5 !mb-0">
            <label className="font-inter text-[13px] font-semibold text-slate-700 dark:text-slate-300">Admin Password</label>
            <div className="relative flex items-center">
              <input
                className={`h-10 px-3 bg-white dark:bg-[#161922] border rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-all w-full ${passwordError ? 'border-rose-500 ring-1 ring-rose-500/50' : 'border-slate-300 dark:border-white/10'}`}
                type={showPassword ? 'text' : 'password'}
                value={adminPassword}
                onChange={e => { setAdminPassword(e.target.value); setPasswordError(''); }}
                placeholder="Enter your admin password"
              />
              <button className="absolute right-3 bg-transparent border-none cursor-pointer p-1 flex items-center justify-center hover:opacity-80 transition-opacity" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? (
                  <Lock size={18} color="#99A1AF" />
                ) : (
                  <XCircle size={18} color="#99A1AF" />
                )}
              </button>
            </div>
            {passwordError && <p className="m-0 font-inter text-xs text-rose-500 font-medium">{passwordError}</p>}
          </div>
        </div>

        <div className="p-5 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 flex items-center justify-end gap-3 shrink-0">
          <button className="h-10 px-4 w-24 rounded-lg font-inter text-sm font-semibold transition-all border border-slate-300 dark:border-white/10 bg-white dark:bg-[#1E2130] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer flex items-center justify-center gap-2" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="h-10 px-4 rounded-lg font-inter text-sm font-semibold transition-all border-none bg-blue-600 text-white hover:bg-blue-700 cursor-pointer flex items-center justify-center gap-2" onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" size={16} /> : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   DELETE MODAL
═══════════════════════════════════════════════════════════════════════════ */
function DeleteModal({ member, onClose, onConfirm }) {
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword,  setShowPassword]  = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [deleting,      setDeleting]      = useState(false);

  const handleDelete = async () => {
    if (!adminPassword.trim()) { setPasswordError('Admin password is required'); return; }
    setPasswordError('');
    setDeleting(true);
    try {
      const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
      const res   = await fetch(`${API}/api/admin/delete-member-permanent`, {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ email: member.email, adminPassword })
      });
      const data = await res.json();
      if (!data.success) {
        if (data.wrongPassword) { setPasswordError('Incorrect admin password'); return; }
        throw new Error(data.message || 'Delete failed');
      }
      toast.success('Member permanently deleted');
      onConfirm();
    } catch (err) {
      toast.error(err.message || 'Failed to delete member');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[400px] shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-4 p-5 border-b border-slate-200 dark:border-white/10 shrink-0 relative">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-rose-100 dark:bg-rose-500/20"><IconTrash /></div>
          <div className="flex flex-col">
            <p className="m-0 font-inter text-lg font-bold text-slate-800 dark:text-white">Delete Member</p>
            <p className="m-0 font-inter text-[13px] text-slate-500 dark:text-slate-400">This action cannot be undone</p>
          </div>
          <button className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer border-none" onClick={onClose}>
            <X size={20} color="#6a7282" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 flex flex-col gap-5">
          <div className="flex items-center gap-4 p-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 mb-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center shrink-0">
              <User size={20} color="#155DFC" />
            </div>
            <div>
              <p className="m-0 font-inter text-base font-bold text-rose-900 dark:text-rose-100">{member.fullName || member.name}</p>
              <p className="m-0 font-inter text-sm text-rose-700 dark:text-rose-300">{member.email}</p>
            </div>
          </div>
          <p className="m-0 font-inter text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
            Are you sure you want to permanently delete this member? All associated data including loans, donations, and attendance records may be affected.
          </p>

          <div className="flex items-center text-center text-xs font-semibold uppercase tracking-wider text-slate-400 before:flex-1 before:border-t before:border-slate-200 dark:before:border-white/10 before:mr-4 after:flex-1 after:border-t after:border-slate-200 dark:after:border-white/10 after:ml-4 mb-4">
            <span>Confirm your identity to delete</span>
          </div>
          <div className="flex flex-col gap-1.5 !mb-0">
            <label className="font-inter text-[13px] font-semibold text-slate-700 dark:text-slate-300">Admin Password</label>
            <div className="relative flex items-center">
              <input
                className={`h-10 px-3 bg-white dark:bg-[#161922] border rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-all w-full ${passwordError ? 'border-rose-500 ring-1 ring-rose-500/50' : 'border-slate-300 dark:border-white/10'}`}
                type={showPassword ? 'text' : 'password'}
                value={adminPassword}
                onChange={e => { setAdminPassword(e.target.value); setPasswordError(''); }}
                placeholder="Enter your admin password"
              />
              <button className="absolute right-3 bg-transparent border-none cursor-pointer p-1 flex items-center justify-center hover:opacity-80 transition-opacity" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? (
                  <Lock size={18} color="#99A1AF" />
                ) : (
                  <XCircle size={18} color="#99A1AF" />
                )}
              </button>
            </div>
            {passwordError && <p className="m-0 font-inter text-xs text-rose-500 font-medium">{passwordError}</p>}
          </div>
        </div>

        <div className="p-5 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 flex items-center justify-end gap-3 shrink-0">
          <button className="h-10 px-4 w-24 rounded-lg font-inter text-sm font-semibold transition-all border border-slate-300 dark:border-white/10 bg-white dark:bg-[#1E2130] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer flex items-center justify-center gap-2" onClick={onClose} disabled={deleting}>Cancel</button>
          <button className="h-10 px-4 rounded-lg font-inter text-sm font-semibold transition-all border-none bg-rose-600 text-white hover:bg-rose-700 cursor-pointer flex items-center justify-center gap-2" onClick={handleDelete} disabled={deleting}>
            {deleting ? <Loader2 className="animate-spin" size={16} /> : 'Delete Member'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ADD MEMBER MODAL
═══════════════════════════════════════════════════════════════════════════ */
function AddMemberModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    fullName: '', email: '', password: '', phone: '', branch: '', position: 'Member', churchId: ''
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const validateField = (name, value, position) => {
    let error = '';
    if (name === 'phone') {
      if (!value) error = 'Phone number is required';
      else if (!/^\d{10}$/.test(value)) error = 'Exactly 10 digits required';
      else if (!/^9/.test(value)) error = 'Must start with 9';
      else if (value.startsWith('0')) error = 'Enter 10 digits (no leading 0)';
    } else if (name === 'password') {
      if (!value) error = 'Password is required';
      else if (value.length < 8) error = 'At least 8 characters';
      else if (!/[A-Z]/.test(value)) error = 'At least one uppercase letter';
      else if (!/[a-z]/.test(value)) error = 'At least one lowercase letter';
      else if (!/[0-9]/.test(value)) error = 'At least one number';
      else if (!/[^A-Za-z0-9]/.test(value)) error = 'At least one symbol';
    } else if (name === 'churchId' && position !== 'Member') {
      if (!value) error = 'Church ID is required';
      else if (!/^\d{2}-\d{2}-\d{2}$/.test(value)) error = 'Format XX-XX-XX';
      else {
        const POSITION_RANGES = {
          'Deacon': { prefix: '00-00' }, 'Local Evangelist': { prefix: '00-01' },
          'District Evangelist': { prefix: '00-02' }, 'National Evangelist': { prefix: '00-03' },
          'Assistant Priest': { prefix: '00-04' }, 'Priest': { prefix: '00-05' },
          'Elder': { prefix: '00-06' }, 'District Elder': { prefix: '00-06' },
          'Bishop': { prefix: '00-07' }, 'District Bishop': { prefix: '00-08' },
          'National Bishop': { prefix: '00-09' }, 'Apostle': { prefix: '00-10' },
        };
        const range = POSITION_RANGES[position];
        if (range) {
          const parts = value.split('-');
          const idPrefix = parts[0] + '-' + parts[1];
          if (idPrefix !== range.prefix) error = `Must start with ${range.prefix} for ${position}`;
        }
      }
    } else if (name === 'branch') {
      if (!value) error = 'Please select a community';
    }
    return error;
  };

  const handleChange = e => {
    const { name, value } = e.target;
    let sanitized = value;
    if (name === 'phone') sanitized = value.replace(/\D/g, '').slice(0, 10);
    if (name === 'churchId') sanitized = value.replace(/[^\d-]/g, '').slice(0, 8);

    setForm(f => ({ ...f, [name]: sanitized }));
    
    const error = validateField(name, sanitized, name === 'position' ? sanitized : form.position);
    setErrors(prev => ({ ...prev, [name]: error }));

    if (name === 'position' && sanitized !== 'Member') {
      const cidError = validateField('churchId', form.churchId, sanitized);
      setErrors(prev => ({ ...prev, churchId: cidError }));
    }
  };

  const handleSubmit = async () => {
    const newErrors = {};
    newErrors.fullName = !form.fullName.trim() ? 'Required' : '';
    newErrors.email = !form.email.trim() ? 'Required' : '';
    newErrors.password = validateField('password', form.password);
    newErrors.phone = validateField('phone', form.phone);
    newErrors.branch = validateField('branch', form.branch);
    if (form.position !== 'Member') {
      newErrors.churchId = validateField('churchId', form.churchId, form.position);
    }
    setErrors(newErrors);

    if (Object.values(newErrors).some(err => err)) {
      return toast.error('Please fix the errors in the form');
    }
    setSaving(true);
    try {
      const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
      const payload = {
        ...form,
        phone: `+63${form.phone}`
      };
      const res = await fetch(`${API}/api/admin/create-member`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Registration failed');
      toast.success('Member added successfully');
      onSave();
    } catch (err) { toast.error(err.message || 'Failed to add member'); } 
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[600px] shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-4 p-5 border-b border-slate-200 dark:border-white/10 shrink-0 relative">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400"><UserPlus size={20} /></div>
          <div className="flex flex-col">
            <p className="m-0 font-inter text-lg font-bold text-slate-800 dark:text-white">Add New Member</p>
            <p className="m-0 font-inter text-[13px] text-slate-500 dark:text-slate-400">Register a new member directly</p>
          </div>
          <button className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer border-none" onClick={onClose}>
            <X size={20} color="#6a7282" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 flex flex-col gap-5">
          <div className="flex flex-col gap-1.5 mb-4">
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="font-inter text-[13px] font-semibold text-slate-700 dark:text-slate-300">Full Name</label>
              <input className="h-10 px-3 bg-white dark:bg-[#1E2130] border border-slate-300 dark:border-white/10 rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all w-full" type="text" name="fullName" value={form.fullName} onChange={handleChange} placeholder="e.g. Juan De La Cruz" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-inter text-[13px] font-semibold text-slate-700 dark:text-slate-300">Email Address</label>
              <input className="h-10 px-3 bg-white dark:bg-[#1E2130] border border-slate-300 dark:border-white/10 rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all w-full" type="email" name="email" value={form.email} onChange={handleChange} placeholder="juan@example.com" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-inter text-[13px] font-semibold text-slate-700 dark:text-slate-300">Default Password</label>
              <div className="relative flex items-center">
                <input 
                  className={`h-10 px-3 bg-white dark:bg-[#161922] border rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-all w-full ${errors.password ? 'border-rose-500 ring-1 ring-rose-500/50' : 'border-slate-300 dark:border-white/10'}`} 
                  type={showPassword ? 'text' : 'password'} 
                  name="password" 
                  value={form.password} 
                  onChange={handleChange} 
                  placeholder="Create a password" 
                />
                <button type="button" className="absolute right-3 bg-transparent border-none cursor-pointer p-1 flex items-center justify-center hover:opacity-80 transition-opacity" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff size={18} color="#99A1AF" /> : <Eye size={18} color="#99A1AF" />}
                </button>
              </div>
              {errors.password && <p className="m-0 font-inter text-xs text-rose-500 font-medium" >{errors.password}</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-inter text-[13px] font-semibold text-slate-700 dark:text-slate-300">Phone Number</label>
              <input className={`h-10 px-3 bg-white dark:bg-[#161922] border rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-all w-full ${errors.phone ? 'border-rose-500 ring-1 ring-rose-500/50' : 'border-slate-300 dark:border-white/10'}`} type="text" name="phone" value={form.phone} onChange={handleChange} placeholder="9171234567" />
              {errors.phone && <p className="m-0 font-inter text-xs text-rose-500 font-medium" >{errors.phone}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-inter text-[13px] font-semibold text-slate-700 dark:text-slate-300">Community</label>
              <select className={`h-10 px-3 bg-white dark:bg-[#161922] border rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-all w-full ${errors.branch ? 'border-rose-500 ring-1 ring-rose-500/50' : 'border-slate-300 dark:border-white/10'}`} name="branch" value={form.branch} onChange={handleChange}>
                <option value="">Select your Community</option>
                <optgroup label="Kalinga">
                  <option>Tabuk</option><option>Zapote</option><option>Bliss</option>
                  <option>Libanon</option><option>Batong Buhay</option><option>Balatoc</option><option>Lat-nog</option>
                </optgroup>
                <optgroup label="Isabela"><option>Santiago City</option></optgroup>
                <optgroup label="Abra">
                  <option>Lamao</option><option>Lingey</option><option>Cabaruyan</option><option>Ducligan</option>
                  <option>Gangal</option><option>Bila-Bila</option><option>Naguillian</option><option>Ud-udiao</option>
                  <option>Villa Conchita</option><option>Ay-yeng Manabo</option><option>Dao-angan</option>
                  <option>Kilong-olao</option><option>Bao-yan</option><option>Amti</option><option>Danac</option>
                  <option>Bengued</option><option>Sappaac</option><option>Saccaang</option>
                </optgroup>
                <optgroup label="Benguet"><option>Baguio</option></optgroup>
                <optgroup label="Rizal"><option>Montalban</option></optgroup>
                <optgroup label="NCR">
                  <option>Valenzuela City</option><option>Tandang Sora, Quezon City</option>
                  <option>COA, Quezon City</option><option>Payatas, Quezon City</option><option>Malaria, Caloocan</option>
                </optgroup>
                <optgroup label="Bulacan">
                  <option>Meycauayan City</option><option>Camalig</option><option>San Jose Del Monte</option>
                </optgroup>
                <optgroup label="Tarlac">
                  <option>Pacpaco, San Manuel</option><option>Victoria</option>
                </optgroup>
                <optgroup label="Nueva Ecija"><option>Bambanaba,巧Cuyapo</option></optgroup>
                <optgroup label="Pangasinan">
                  <option>Dagupan</option><option>Mangatarem</option><option>Laoak Langka</option>
                  <option>Orbiztondo</option><option>Malasiqui, Bolaoit</option><option>Taloyan</option>
                  <option>Binmaley</option><option>San Carlos</option><option>Manaoag</option>
                  <option>Pozorrubio</option><option>Alcala</option>
                </optgroup>
                <optgroup label="Agusan Del Norte">
                  <option>Butuan City</option><option>RTR</option><option>Jabonga, Bangonay</option>
                  <option>Kasiklan</option><option>San Mateo</option><option>Fatima Kim.13</option>
                  <option>Bayugan</option><option>Ibuan</option><option>Balubo</option>
                </optgroup>
                <optgroup label="Cebu">
                  <option>Mandaue</option><option>Liloan</option><option>Calero</option><option>Compostela</option>
                </optgroup>
                <optgroup label="Surigao Del Norte">
                  <option>Alegria</option><option>Bonifacio</option><option>Matin-ao</option><option>Ipil</option>
                </optgroup>
                <optgroup label="Surigao Del Sur"><option>Kinabigtasan, Tago</option></optgroup>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-inter text-[13px] font-semibold text-slate-700 dark:text-slate-300">Position / Role</label>
              <select className="h-10 px-3 bg-white dark:bg-[#1E2130] border border-slate-300 dark:border-white/10 rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all w-full" name="position" value={form.position} onChange={handleChange}>
                <option value="Member">Member</option>
                <option value="Deacon">Deacon</option>
                <option value="Local Evangelist">Local Evangelist</option>
                <option value="District Evangelist">District Evangelist</option>
                <option value="National Evangelist">National Evangelist</option>
                <option value="Assistant Priest">Assistant Priest</option>
                <option value="Priest">Priest</option>
                <option value="Elder">Elder</option>
                <option value="District Elder">District Elder</option>
                <option value="Bishop">Bishop</option>
                <option value="District Bishop">District Bishop</option>
                <option value="National Bishop">National Bishop</option>
                <option value="Apostle">Apostle</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-inter text-[13px] font-semibold text-slate-700 dark:text-slate-300">Church ID</label>
              <input 
                className={`h-10 px-3 bg-white dark:bg-[#161922] border rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-all w-full ${errors.churchId ? 'border-rose-500 ring-1 ring-rose-500/50' : 'border-slate-300 dark:border-white/10'}`} 
                type="text" 
                name="churchId" 
                value={form.churchId} 
                onChange={handleChange} 
                placeholder="e.g. 00-00-01" 
                disabled={form.position === 'Member'}
              />
              {errors.churchId && <p className="m-0 font-inter text-xs text-rose-500 font-medium" >{errors.churchId}</p>}
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 flex items-center justify-end gap-3 shrink-0">
          <button className="h-10 px-4 w-24 rounded-lg font-inter text-sm font-semibold transition-all border border-slate-300 dark:border-white/10 bg-white dark:bg-[#1E2130] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer flex items-center justify-center gap-2" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="h-10 px-4 rounded-lg font-inter text-sm font-semibold transition-all border-none bg-blue-600 text-white hover:bg-blue-700 cursor-pointer flex items-center justify-center gap-2" onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" size={16} /> : 'Add Member'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LINK RFID MODAL
═══════════════════════════════════════════════════════════════════════════ */
function LinkRFIDModal({ member, onClose, onSave }) {
  const [rfidCode, setRfidCode] = useState('');
  const [saving, setSaving] = useState(false);
  const rfidBuffer = useRef('');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.key === 'Enter') {
        const code = rfidBuffer.current.trim();
        rfidBuffer.current = '';
        if (code) setRfidCode(code);
      } else if (e.key.length === 1) {
        rfidBuffer.current += e.key;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLink = async () => {
    if (!rfidCode) return toast.error('Please scan an RFID card first');
    setSaving(true);
    try {
      const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
      const res = await fetch(`${API}/api/admin/update-member-rfid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: member.email, rfidCardId: rfidCode })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      toast.success(data.message);
      onSave();
    } catch (err) {
      toast.error(err.message || 'Failed to link RFID card');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[400px] shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-4 p-5 border-b border-slate-200 dark:border-white/10 shrink-0 relative">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400"><CreditCard size={20} /></div>
          <div className="flex flex-col">
            <p className="m-0 font-inter text-lg font-bold text-slate-800 dark:text-white">Link RFID Card</p>
            <p className="m-0 font-inter text-[13px] text-slate-500 dark:text-slate-400">Assign card to {member.fullName || member.name}</p>
          </div>
          <button className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer border-none" onClick={onClose}><X size={20} color="#6a7282" /></button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 flex flex-col gap-5 items-center text-center">
          {rfidCode ? (
            <div className="flex flex-col items-center justify-center py-6">
              <div className="text-emerald-500 mb-4 mx-auto"><CheckCircle2 size={48} /></div>
              <p className="m-0 font-inter text-lg font-bold text-slate-800 dark:text-white mb-2">Card Detected!</p>
              <p className="font-mono text-lg font-bold bg-slate-100 dark:bg-white/5 px-4 py-2 rounded-lg text-slate-800 dark:text-white mb-4">{rfidCode}</p>
              <p className="m-0 font-inter text-sm text-slate-500 dark:text-slate-400">Click "Link Card" to confirm assignment.</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div className="relative flex items-center justify-center w-24 h-24 mb-2">
                <div className="w-full h-full rounded-full border-4 border-blue-500/30 border-t-blue-500 animate-spin"></div>
              </div>
              <p className="m-0 font-inter text-base font-semibold text-slate-700 dark:text-slate-300">Waiting for RFID Scan...</p>
              <p className="m-0 font-inter text-sm text-slate-500 dark:text-slate-400 text-center max-w-[250px]">Please tap the physical card on the reader now.</p>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 flex items-center justify-end gap-3 shrink-0">
          <button className="h-10 px-4 rounded-lg font-inter text-sm font-semibold transition-all border border-slate-300 dark:border-white/20 bg-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer flex items-center justify-center gap-2" onClick={onClose} disabled={saving}>Cancel</button>
          <button 
            className="h-10 px-4 rounded-lg font-inter text-sm font-semibold transition-all border-none bg-blue-600 text-white hover:bg-blue-700 cursor-pointer flex items-center justify-center gap-2" 
            onClick={handleLink} 
            disabled={saving || !rfidCode}
            
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : 'Link Card'}
          </button>
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════════════ */
const ITEMS_PER_PAGE = 10;

export default function AdminMembers() {
  const navigate = useNavigate();

  const [searchMembers,  setSearchMembers]  = useState('');
  const [roleFilter,     setRoleFilter]     = useState('all');
  const [currentPage,    setCurrentPage]    = useState(1);
  const [editMember,     setEditMember]     = useState(null);
  const [deleteMember,   setDeleteMember]   = useState(null);
  const [viewMember,     setViewMember]     = useState(null);
  const [showAddModal,   setShowAddModal]   = useState(false);
  const [enrollRFIDMember, setEnrollRFIDMember] = useState(null);
  const [openDropdownId, setOpenDropdownId] = useState(null);

  useEffect(() => {
    const handleClickOutside = () => setOpenDropdownId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const debouncedSearchMembers  = useDebounce(searchMembers,  400);

  const getToken = () =>
    localStorage.getItem('adminToken') ||
    localStorage.getItem('admin_token') ||
    localStorage.getItem('token');

  useEffect(() => { if (!getToken()) navigate('/'); }, [navigate]);

  const fetcherSingle = (url) => fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } }).then(res => {
    if (res.status === 401 || res.status === 403) { navigate('/'); return { success: false }; }
    return res.json();
  });

  const queryParams = useMemo(() => {
    let isOfficerVal = undefined;
    let statusVal = undefined;
    let isNewVal = undefined;

    if (roleFilter === 'officer') isOfficerVal = 'true';
    else if (roleFilter === 'member') isOfficerVal = 'false';
    else if (roleFilter === 'active') statusVal = 'active';
    else if (roleFilter === 'inactive') statusVal = 'inactive';
    else if (roleFilter === 'new') isNewVal = 'true';

    return buildQuery({ search: debouncedSearchMembers.trim(), page: currentPage, limit: ITEMS_PER_PAGE, isOfficer: isOfficerVal, status: statusVal, isNew: isNewVal });
  }, [debouncedSearchMembers, currentPage, roleFilter]);

  const { data, isValidating: loadingMembers, mutate: fetchMembers } = useSWR(
    `${API}/api/admin/members?${queryParams}`,
    fetcherSingle,
    { 
      revalidateOnFocus: false, 
      revalidateIfStale: true,
      dedupingInterval: 30000,
      keepPreviousData: true
    }
  );

  const members = useMemo(() => data?.members || [], [data]);
  const stats = useMemo(() => data?.stats || { total: 0, active: 0, inactive: 0, officers: 0 }, [data]);
  const pagination = useMemo(() => data?.pagination || { page: 1, totalPages: 1, totalMembers: 0 }, [data]);

  useEffect(() => {
    if (data && data.success === false && data.message) {
      toast.error(data.message);
    }
  }, [data]);

  useEffect(() => { setCurrentPage(1); }, [debouncedSearchMembers, roleFilter]);

  return (
    <div className="flex flex-col h-full bg-slate-100 dark:bg-[#161922] p-6 max-w-[1400px] mx-auto w-full gap-6">

      {editMember   && <EditModal   member={editMember}   onClose={() => setEditMember(null)}   onSave={()    => { setEditMember(null);   fetchMembers(); }} />}
      {deleteMember && <DeleteModal member={deleteMember} onClose={() => setDeleteMember(null)} onConfirm={() => { setDeleteMember(null); fetchMembers(); }} />}
      {showAddModal && <AddMemberModal onClose={() => setShowAddModal(false)} onSave={() => { setShowAddModal(false); fetchMembers(); }} />}
      {enrollRFIDMember && <LinkRFIDModal member={enrollRFIDMember} onClose={() => setEnrollRFIDMember(null)} onSave={() => { setEnrollRFIDMember(null); fetchMembers(); }} />}

      {viewMember   && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={() => setViewMember(null)}>
          <div className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[600px] shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-4 p-5 border-b border-slate-200 dark:border-white/10 shrink-0 relative bg-slate-50 dark:bg-black/20">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-white dark:bg-white/10 shadow-sm text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-white/5">
                <Eye size={22} strokeWidth={2.5} />
              </div>
              <div className="flex flex-col">
                <h2 className="m-0 font-inter text-lg font-bold text-slate-800 dark:text-white">Member Details</h2>
                <p className="m-0 font-inter text-[13px] text-slate-500 dark:text-slate-400 mt-0.5">View complete profile information</p>
              </div>
              <button className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-lg bg-transparent text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer border-none" onClick={() => setViewMember(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 flex flex-col gap-6">
              {/* Profile Header Card */}
              <div className="flex items-start gap-4 p-5 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-500/10 dark:to-blue-500/5 border border-blue-100 dark:border-blue-500/20 relative overflow-hidden">
                <div className="w-16 h-16 rounded-full bg-white dark:bg-white/10 flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-400 text-2xl font-bold shadow-sm border border-blue-200 dark:border-blue-500/30">
                  {(viewMember.fullName || viewMember.name || 'M').charAt(0)}
                </div>
                <div className="flex flex-col pt-1 z-10">
                  <h3 className="m-0 font-inter text-xl font-bold text-slate-800 dark:text-white">{viewMember.fullName || viewMember.name}</h3>
                  <p className="m-0 font-inter text-[13px] text-slate-500 dark:text-slate-400 mt-1">{viewMember.email}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase bg-blue-100/50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border border-blue-200/50 dark:border-blue-500/30">
                      {viewMember.position || 'Member'}
                    </span>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase border ${viewMember.status?.toLowerCase() === 'active' ? 'bg-emerald-50/50 text-emerald-700 border-emerald-200/50 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' : 'bg-slate-100/50 text-slate-600 border-slate-200/50 dark:bg-white/5 dark:text-slate-400 dark:border-white/10'}`}>
                      {viewMember.status || 'Active'}
                    </span>
                  </div>
                </div>
                <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>
              </div>

              {/* Structured Details Sections */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-5">
                  <div>
                    <p className="font-inter text-[11px] uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400 mb-2 pl-1">Contact Details</p>
                    <div className="bg-slate-50 dark:bg-[#252836] rounded-xl p-4 border border-slate-100 dark:border-white/5">
                      <div className="flex flex-col gap-4">
                        <div>
                          <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium m-0">Phone Number</p>
                          <p className="text-[13px] font-semibold text-slate-800 dark:text-white m-0 mt-1">{viewMember.phone || '—'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="font-inter text-[11px] uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400 mb-2 pl-1">Affiliation</p>
                    <div className="bg-slate-50 dark:bg-[#252836] rounded-xl p-4 border border-slate-100 dark:border-white/5">
                      <div className="flex flex-col gap-4">
                        <div>
                          <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium m-0">Community Branch</p>
                          <p className="text-[13px] font-semibold text-slate-800 dark:text-white m-0 mt-1">{viewMember.branch || '—'}</p>
                        </div>
                        {(viewMember.churchId || (viewMember.position !== 'member' && viewMember.position !== 'Member')) && (
                          <div>
                            <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium m-0">Church ID</p>
                            <p className="text-[13px] font-semibold text-slate-800 dark:text-white m-0 mt-1">{viewMember.churchId || '—'}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-5">
                  <div>
                    <p className="font-inter text-[11px] uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400 mb-2 pl-1">System Identification</p>
                    <div className="bg-slate-50 dark:bg-[#252836] rounded-xl p-4 border border-slate-100 dark:border-white/5">
                      <div className="flex flex-col gap-4">
                        <div>
                          <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium m-0">Member ID</p>
                          <p className="text-[13px] font-mono font-semibold text-slate-800 dark:text-white m-0 mt-1">{viewMember.memberId || '—'}</p>
                        </div>
                        <div>
                          <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium m-0">RFID Card ID</p>
                          <p className="text-[13px] font-mono font-semibold text-slate-800 dark:text-white m-0 mt-1">{viewMember.rfidCardId || 'Not Linked'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 font-inter text-2xl font-bold text-slate-800 dark:text-white">Member Management</h1>

        </div>
        <button className="h-10 px-4 bg-blue-600 text-white font-inter text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors border-none cursor-pointer flex items-center gap-2" onClick={() => setShowAddModal(true)}>
          <UserPlus size={20} />
          <span>Add Member</span>
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 mb-5 mt-2">
        {/* Total Members */}
        <div className={`group relative rounded-2xl p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] overflow-hidden transition-all duration-300 hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_12px_32px_rgba(0,0,0,0.3)] hover:-translate-y-1 cursor-pointer flex flex-col justify-between ${roleFilter === 'all' ? 'ring-2 ring-blue-500 border-transparent shadow-md bg-blue-50/50 dark:bg-blue-500/10' : 'bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10'}`} onClick={() => setRoleFilter('all')}>
          <div className="absolute top-0 right-0 w-28 h-28 bg-blue-500/10 rounded-full blur-2xl -mr-8 -mt-8 transition-transform duration-500 group-hover:scale-150"></div>
          
          <div className="flex items-start justify-between relative z-10 mb-3">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 font-inter uppercase tracking-wider leading-tight pr-2 mt-1">Total Members</span>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 shadow-sm ${roleFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-500/20 dark:to-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-500/30'}`}>
              <UsersIcon size={20} strokeWidth={2.2} />
            </div>
          </div>
          <h3 className="text-[28px] font-extrabold text-slate-900 dark:text-white font-inter tracking-tight m-0 relative z-10 mt-auto">{stats.total ?? 0}</h3>
        </div>

        {/* Officers */}
        <div className={`group relative rounded-2xl p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] overflow-hidden transition-all duration-300 hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_12px_32px_rgba(0,0,0,0.3)] hover:-translate-y-1 cursor-pointer flex flex-col justify-between ${roleFilter === 'officer' ? 'ring-2 ring-purple-500 border-transparent shadow-md bg-purple-50/50 dark:bg-purple-500/10' : 'bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10'}`} onClick={() => setRoleFilter('officer')}>
          <div className="absolute top-0 right-0 w-28 h-28 bg-purple-500/10 rounded-full blur-2xl -mr-8 -mt-8 transition-transform duration-500 group-hover:scale-150"></div>
          
          <div className="flex items-start justify-between relative z-10 mb-3">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 font-inter uppercase tracking-wider leading-tight pr-2 mt-1">Officers</span>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 shadow-sm ${roleFilter === 'officer' ? 'bg-purple-600 text-white' : 'bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-500/20 dark:to-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-200/60 dark:border-purple-500/30'}`}>
              <Lock size={20} strokeWidth={2.2} />
            </div>
          </div>
          <h3 className="text-[28px] font-extrabold text-slate-900 dark:text-white font-inter tracking-tight m-0 relative z-10 mt-auto">{stats.officers ?? 0}</h3>
        </div>

        {/* Active Members */}
        <div className={`group relative rounded-2xl p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] overflow-hidden transition-all duration-300 hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_12px_32px_rgba(0,0,0,0.3)] hover:-translate-y-1 cursor-pointer flex flex-col justify-between ${roleFilter === 'active' ? 'ring-2 ring-emerald-500 border-transparent shadow-md bg-emerald-50/50 dark:bg-emerald-500/10' : 'bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10'}`} onClick={() => setRoleFilter('active')}>
          <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-500/10 rounded-full blur-2xl -mr-8 -mt-8 transition-transform duration-500 group-hover:scale-150"></div>
          
          <div className="flex items-start justify-between relative z-10 mb-3">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 font-inter uppercase tracking-wider leading-tight pr-2 mt-1">Active</span>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 shadow-sm ${roleFilter === 'active' ? 'bg-emerald-600 text-white' : 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-500/20 dark:to-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-500/30'}`}>
              <CheckCircle2 size={20} strokeWidth={2.2} />
            </div>
          </div>
          <h3 className="text-[28px] font-extrabold text-emerald-600 dark:text-emerald-400 font-inter tracking-tight m-0 relative z-10 mt-auto">{stats.active ?? 0}</h3>
        </div>

        {/* Inactive Members */}
        <div className={`group relative rounded-2xl p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] overflow-hidden transition-all duration-300 hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_12px_32px_rgba(0,0,0,0.3)] hover:-translate-y-1 cursor-pointer flex flex-col justify-between ${roleFilter === 'inactive' ? 'ring-2 ring-amber-500 border-transparent shadow-md bg-amber-50/50 dark:bg-amber-500/10' : 'bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10'}`} onClick={() => setRoleFilter('inactive')}>
          <div className="absolute top-0 right-0 w-28 h-28 bg-amber-500/10 rounded-full blur-2xl -mr-8 -mt-8 transition-transform duration-500 group-hover:scale-150"></div>
          
          <div className="flex items-start justify-between relative z-10 mb-3">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 font-inter uppercase tracking-wider leading-tight pr-2 mt-1">Inactive</span>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 shadow-sm ${roleFilter === 'inactive' ? 'bg-amber-500 text-white' : 'bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-500/20 dark:to-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-500/30'}`}>
              <XCircle size={20} strokeWidth={2.2} />
            </div>
          </div>
          <h3 className="text-[28px] font-extrabold text-amber-500 dark:text-amber-400 font-inter tracking-tight m-0 relative z-10 mt-auto">{stats.inactive ?? 0}</h3>
        </div>

        {/* New This Month */}
        <div className={`group relative rounded-2xl p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] overflow-hidden transition-all duration-300 hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_12px_32px_rgba(0,0,0,0.3)] hover:-translate-y-1 cursor-pointer flex flex-col justify-between ${roleFilter === 'new' ? 'ring-2 ring-indigo-500 border-transparent shadow-md bg-indigo-50/50 dark:bg-indigo-500/10' : 'bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10'}`} onClick={() => setRoleFilter('new')}>
          <div className="absolute top-0 right-0 w-28 h-28 bg-indigo-500/10 rounded-full blur-2xl -mr-8 -mt-8 transition-transform duration-500 group-hover:scale-150"></div>
          
          <div className="flex items-start justify-between relative z-10 mb-3">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 font-inter uppercase tracking-wider leading-tight pr-2 mt-1">New This Month</span>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 shadow-sm ${roleFilter === 'new' ? 'bg-indigo-600 text-white' : 'bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-500/20 dark:to-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-500/30'}`}>
              <UserPlus size={20} strokeWidth={2.2} />
            </div>
          </div>
          <h3 className="text-[28px] font-extrabold text-slate-900 dark:text-white font-inter tracking-tight m-0 relative z-10 mt-auto">{stats.newThisMonth ?? 0}</h3>
        </div>
      </div>



      {/* Regular Members Section */}
      <div className="flex-1 flex flex-col bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl shadow-sm overflow-hidden min-h-[500px]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 shrink-0">
          <div className="flex items-center gap-3">
            <UsersIcon size={24} color="#155DFC" strokeWidth={2} />
            <h2 className="m-0 font-inter text-base font-bold text-slate-800 dark:text-white">All Members</h2>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 max-w-[400px]">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search members..."
                value={searchMembers}
                onChange={e => setSearchMembers(e.target.value)}
                className="w-full h-10 pl-10 pr-4 bg-white dark:bg-[#161922] border border-slate-300 dark:border-white/10 rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              />
            </div>
            <select
              className="h-10 px-4 pr-10 appearance-none bg-white dark:bg-[#161922] border border-slate-300 dark:border-white/10 rounded-lg text-sm font-inter font-medium text-slate-700 dark:text-slate-300 outline-none cursor-pointer focus:border-blue-500 transition-colors bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236B7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[position:right_12px_center] bg-no-repeat"
              onChange={e => setRoleFilter(e.target.value)}
              value={roleFilter}
            >
              <option value="all">All Members</option>
              <option value="officer">Officers</option>
              <option value="member">Regular Members</option>
              <option value="active">Active Members</option>
              <option value="inactive">Inactive</option>
              <option value="new">New</option>
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b-2 border-slate-200 dark:border-white/10 text-left">
                <th className="px-4 py-3 font-inter text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider sticky top-0 bg-white dark:bg-[#1E2130] z-10">Member ID</th>
                <th className="px-4 py-3 font-inter text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider sticky top-0 bg-white dark:bg-[#1E2130] z-10">Name</th>
                <th className="px-4 py-3 font-inter text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider sticky top-0 bg-white dark:bg-[#1E2130] z-10">Contact</th>
                <th className="px-4 py-3 font-inter text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider sticky top-0 bg-white dark:bg-[#1E2130] z-10">Community</th>
                <th className="px-4 py-3 font-inter text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider sticky top-0 bg-white dark:bg-[#1E2130] z-10">Position</th>
                <th className="px-4 py-3 font-inter text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider sticky top-0 bg-white dark:bg-[#1E2130] z-10">Status</th>
                <th className="px-4 py-3 font-inter text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider sticky top-0 bg-white dark:bg-[#1E2130] z-10 text-right pr-6">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingMembers ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border-b border-slate-100 dark:border-white/5">
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j}><div className="h-5 bg-slate-200 dark:bg-white/10 rounded animate-pulse w-3/4" /></td>
                    ))}
                  </tr>
                ))
              ) : members.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">No members found</td></tr>
              ) : (
                members.map(m => (
                  <tr key={m._id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border-b border-slate-100 dark:border-white/5">
                    <td className="px-4 py-2 text-[13px] font-inter font-semibold text-slate-800 dark:text-white">{m.memberId || '—'}</td>
                    <td>
                      <div className="px-4 py-2 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 font-bold text-xs">{(m.fullName || m.name || 'M').charAt(0)}</div>
                        <span className="m-0 text-[13px] font-semibold text-slate-800 dark:text-white truncate max-w-[150px]">{m.fullName || m.name}</span>
                      </div>
                    </td>
                    <td>
                      <div className="px-4 py-2 flex flex-col gap-0.5">
                        <span className="text-[13px] font-inter text-slate-700 dark:text-slate-300 truncate max-w-[160px]" title={m.email}>{m.email}</span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">{m.phone}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-[13px] font-inter text-slate-700 dark:text-slate-300">{m.branch || 'Bulacan Main'}</td>
                    <td className="px-4 py-2 text-[13px] font-inter text-slate-700 dark:text-slate-300">{m.position || 'Member'}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${m.status?.toLowerCase() === 'active' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-400'}`}>
                        {m.status || 'Active'}
                      </span>
                    </td>
                    <td className="px-4 py-2 relative text-right">
                      <div className="flex items-center justify-end">
                        <button 
                          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 transition-colors border-none bg-transparent cursor-pointer" 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setOpenDropdownId(openDropdownId === m._id ? null : m._id); 
                          }}
                        >
                          <MoreVertical size={20} color="#6B7280" />
                        </button>
                        {openDropdownId === m._id && (
                          <div className="absolute right-8 top-1/2 -translate-y-1/2 w-32 bg-white dark:bg-[#1E2130] rounded-xl shadow-lg border border-slate-200 dark:border-white/10 py-1 z-50 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                            <button className="w-full flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border-none bg-transparent cursor-pointer text-left" onClick={() => { setOpenDropdownId(null); setViewMember(m); }}>
                              <Eye size={16} /> View
                            </button>
                            <button className="w-full flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border-none bg-transparent cursor-pointer text-left" onClick={() => { setOpenDropdownId(null); setEditMember(m); }}>
                              <Edit size={16} /> Edit
                            </button>
                            <button className="w-full flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border-none bg-transparent cursor-pointer text-left" onClick={() => { setOpenDropdownId(null); setEnrollRFIDMember(m); }}>
                              <CreditCard size={16} /> Link RFID
                            </button>
                            <button className="w-full flex items-center gap-2 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors border-none bg-transparent cursor-pointer text-left" onClick={() => { setOpenDropdownId(null); setDeleteMember(m); }}>
                              <Trash2 size={16} /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="border-t border-slate-200 dark:border-white/10 shrink-0 bg-white dark:bg-[#1E2130]">
            <Pagination
              currentPage={currentPage}
              totalPages={pagination.totalPages}
              onPageChange={setCurrentPage}
              totalItems={pagination.totalMembers}
              itemsPerPage={ITEMS_PER_PAGE}
              itemName="members"
            />
          </div>
        )}
      </div>
    </div>
  );
}
