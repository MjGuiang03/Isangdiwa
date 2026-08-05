/* eslint-disable no-unused-vars */
import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { CalendarDays, Circle, MapPin, Search, Users, TrendingUp , Loader2} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList } from 'recharts';
import useDebounce from '../../hooks/useDebounce';

import API from '../../utils/api';
import { Plus, XCircle, MoreVertical, Edit2, Trash2 } from 'lucide-react';

function EditCommunityModal({ branch, onClose, onSave }) {
  const [name, setName] = useState(branch.name || '');
  const [address, setAddress] = useState(branch.address || '');
  const [pastor, setPastor] = useState(branch.pastor || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Community name is required');

    setSaving(true);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API}/api/admin/branches/${branch._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim(), address: address.trim(), pastor: pastor.trim() })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      toast.success('Community updated successfully');
      onSave();
    } catch (err) {
      toast.error(err.message || 'Failed to update community');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[400px] shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-4 p-5 border-b border-slate-200 dark:border-white/10 shrink-0 relative">
           <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
             <Edit2 size={20} />
           </div>
          <div className="flex flex-col">
            <h2 className="m-0 font-inter text-lg font-bold text-slate-800 dark:text-white">Edit Community</h2>
            <p className="m-0 font-inter text-[13px] text-slate-500 dark:text-slate-400">Update branch information</p>
          </div>
          <button className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer border-none" onClick={onClose}><XCircle size={20} color="#6B7280" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto custom-scrollbar flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
             <label className="font-inter text-[13px] font-semibold text-slate-700 dark:text-slate-300">Branch Name</label>
             <input type="text" className="h-10 px-3 bg-white dark:bg-[#1E2130] border border-slate-300 dark:border-white/10 rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all w-full" autoFocus placeholder="e.g. San Pedro" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
             <label className="font-inter text-[13px] font-semibold text-slate-700 dark:text-slate-300">Address</label>
             <input type="text" className="h-10 px-3 bg-white dark:bg-[#1E2130] border border-slate-300 dark:border-white/10 rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all w-full" placeholder="Branch Address" value={address} onChange={e => setAddress(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
             <label className="font-inter text-[13px] font-semibold text-slate-700 dark:text-slate-300">Pastor</label>
             <input type="text" className="h-10 px-3 bg-white dark:bg-[#1E2130] border border-slate-300 dark:border-white/10 rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all w-full" placeholder="Lead Pastor" value={pastor} onChange={e => setPastor(e.target.value)} />
          </div>
        </form>
        <div className="p-5 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 flex items-center justify-end gap-3 shrink-0">
          <button type="button" className="h-10 px-4 rounded-lg font-inter text-sm font-semibold transition-all border border-slate-300 dark:border-white/10 bg-white dark:bg-[#1E2130] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer flex-1 sm:flex-none" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="h-10 px-6 rounded-lg font-inter text-sm font-semibold transition-all border-none bg-blue-600 text-white hover:bg-blue-700 cursor-pointer flex items-center justify-center min-w-[100px] flex-1 sm:flex-none" onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" size={16} /> : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddCommunityModal({ onClose, onSave }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [pastor, setPastor] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Community name is required');

    setSaving(true);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API}/api/admin/branches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim(), address: address.trim(), pastor: pastor.trim() })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      toast.success('Community added successfully');
      onSave();
    } catch (err) {
      toast.error(err.message || 'Failed to add community');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[400px] shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-4 p-5 border-b border-slate-200 dark:border-white/10 shrink-0 relative">
           <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
             <Plus size={20} />
           </div>
          <div className="flex flex-col">
            <h2 className="m-0 font-inter text-lg font-bold text-slate-800 dark:text-white">Add Community</h2>
            <p className="m-0 font-inter text-[13px] text-slate-500 dark:text-slate-400">Create a new church branch</p>
          </div>
          <button className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer border-none" onClick={onClose}><XCircle size={20} color="#6B7280" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto custom-scrollbar flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
             <label className="font-inter text-[13px] font-semibold text-slate-700 dark:text-slate-300">Branch Name</label>
             <input type="text" className="h-10 px-3 bg-white dark:bg-[#1E2130] border border-slate-300 dark:border-white/10 rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all w-full" autoFocus placeholder="e.g. San Pedro" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
             <label className="font-inter text-[13px] font-semibold text-slate-700 dark:text-slate-300">Address</label>
             <input type="text" className="h-10 px-3 bg-white dark:bg-[#1E2130] border border-slate-300 dark:border-white/10 rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all w-full" placeholder="Branch Address" value={address} onChange={e => setAddress(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
             <label className="font-inter text-[13px] font-semibold text-slate-700 dark:text-slate-300">Pastor</label>
             <input type="text" className="h-10 px-3 bg-white dark:bg-[#1E2130] border border-slate-300 dark:border-white/10 rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all w-full" placeholder="Lead Pastor" value={pastor} onChange={e => setPastor(e.target.value)} />
          </div>
        </form>
        <div className="p-5 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 flex items-center justify-end gap-3 shrink-0">
          <button type="button" className="h-10 px-4 rounded-lg font-inter text-sm font-semibold transition-all border border-slate-300 dark:border-white/10 bg-white dark:bg-[#1E2130] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer flex-1 sm:flex-none" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="h-10 px-6 rounded-lg font-inter text-sm font-semibold transition-all border-none bg-blue-600 text-white hover:bg-blue-700 cursor-pointer flex items-center justify-center min-w-[100px] flex-1 sm:flex-none" onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" size={16} /> : 'Add Community'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CommunityInfoModal({ branch, onClose, onEdit, totalAllDonations }) {
  if (!branch) return null;

  const sameCommunity = branch.sameCommunityAmount || 0;
  const otherCommunities = branch.otherCommunityAmount || 0;
  const totalShare = sameCommunity + otherCommunities;

  const pieData = [
    { name: 'Within Community', value: sameCommunity, fill: '#2563EB' },
    { name: 'Outside Community', value: otherCommunities, fill: '#60A5FA' }
  ];

  const attHistory = branch.attendanceHistory || [];
  const allMonthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  const currentYear = now.getFullYear();
  const monthsCount = Math.max(now.getMonth() + 1, 6);
  const monthNames = allMonthNames.slice(0, monthsCount);

  const barData = monthNames.map((name, index) => {
    const monthNum = index + 1;
    const match = attHistory.find(a => a.month === monthNum && a.year === currentYear);
    return {
      name,
      attendance: match ? match.count : 0
    };
  });

  const isActive = (branch.members || 0) > 0;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
      <div 
        className="bg-white dark:bg-[#1E2130] rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col max-h-[90vh] overflow-hidden" 
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between bg-slate-50/50 dark:bg-black/20 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20 shadow-xs">
              <MapPin size={22} strokeWidth={2.2} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="m-0 font-inter text-xl font-bold text-slate-900 dark:text-white tracking-tight">{branch.name}</h2>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase ${
                  isActive 
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                    : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400'
                }`}>
                  {isActive ? 'Active Community' : 'Idle'}
                </span>
              </div>
              <p className="m-0 font-inter text-xs text-slate-500 dark:text-slate-400 mt-0.5">{branch.province || branch.location || 'Branch Community Overview'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => onEdit(branch)} 
              className="h-9 px-3.5 bg-white dark:bg-[#161922] border border-slate-200 dark:border-white/10 rounded-xl text-xs font-inter font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-2 shadow-xs" 
              title="Edit Details"
            >
              <Edit2 size={14} />
              <span className="hidden sm:inline">Edit Details</span>
            </button>
            <button 
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer border-none" 
              onClick={onClose}
            >
              <XCircle size={20} />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6 flex-1">
          {/* Top Quick Stats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50/60 dark:bg-black/20 flex items-center justify-between">
              <div>
                <span className="block font-inter text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Members</span>
                <span className="font-inter text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1 block">
                  {(branch.members || 0).toLocaleString()}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Users size={20} />
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50/60 dark:bg-black/20 flex items-center justify-between">
              <div>
                <span className="block font-inter text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Donations</span>
                <span className="font-inter text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight mt-1 block">
                  ₱{(branch.totalDonations || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <TrendingUp size={20} />
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50/60 dark:bg-black/20 flex items-center justify-between">
              <div>
                <span className="block font-inter text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Lead Pastor</span>
                <span className="font-inter text-sm font-bold text-slate-800 dark:text-white truncate mt-1 block max-w-[170px]">
                  {branch.pastor || 'Not assigned'}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 flex items-center justify-center shrink-0">
                <Users size={20} />
              </div>
            </div>
          </div>

          {/* Details & Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Charts Column (7 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              {/* Attendance Bar Chart */}
              <div className="bg-slate-50/50 dark:bg-black/20 rounded-2xl border border-slate-200/80 dark:border-white/10 p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarDays size={16} className="text-blue-600 dark:text-blue-400" />
                    <span className="font-inter text-sm font-bold text-slate-800 dark:text-white">Attendance Performance</span>
                  </div>
                  <span className="font-inter text-xs text-slate-500 dark:text-slate-400">{currentYear} Monthly</span>
                </div>
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} margin={{ top: 15, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.5} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
                      <Tooltip cursor={{ fill: '#F1F5F9' }} contentStyle={{ fontSize: '12px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                      <Bar dataKey="attendance" fill="#2563EB" radius={[6, 6, 0, 0]} maxBarSize={28} name="Attendees">
                        <LabelList dataKey="attendance" position="top" style={{ fontSize: '10px', fill: '#64748B', fontWeight: 600 }} formatter={(val) => val > 0 ? val : ''} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Donation Share Chart */}
              <div className="bg-slate-50/50 dark:bg-black/20 rounded-2xl border border-slate-200/80 dark:border-white/10 p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={16} className="text-emerald-600 dark:text-emerald-400" />
                    <span className="font-inter text-sm font-bold text-slate-800 dark:text-white">Donation Share</span>
                  </div>
                  <span className="font-inter text-xs text-slate-500 dark:text-slate-400">Source Breakdown</span>
                </div>
                <div className="h-[180px] w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={totalShare > 0 ? pieData : [{ name: 'No Data', value: 1, fill: '#E2E8F0' }]} 
                        cx="50%" cy="45%" innerRadius={28} outerRadius={55} paddingAngle={3} dataKey="value" stroke="none"
                        labelLine={false}
                        label={totalShare > 0 ? ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                          if (percent < 0.05) return null;
                          const RADIAN = Math.PI / 180;
                          const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
                          const x = cx + radius * Math.cos(-midAngle * RADIAN);
                          const y = cy + radius * Math.sin(-midAngle * RADIAN);
                          return (
                            <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={700}>
                              {`${(percent * 100).toFixed(0)}%`}
                            </text>
                          );
                        } : false}
                      >
                        {(totalShare > 0 ? pieData : [{ name: 'No Data', value: 1, fill: '#E2E8F0' }]).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => totalShare > 0 ? `₱${value.toLocaleString()}` : 'No donations'} />
                      <Legend 
                        payload={[
                          { id: 'within', type: 'circle', value: `Within Community (₱${sameCommunity.toLocaleString()})`, color: '#2563EB' },
                          { id: 'outside', type: 'circle', value: `Outside Community (₱${otherCommunities.toLocaleString()})`, color: '#60A5FA' }
                        ]}
                        verticalAlign="bottom" height={30} wrapperStyle={{ fontSize: '12px', color: '#64748B', marginTop: '10px' }} 
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Information Column (5 cols) */}
            <div className="lg:col-span-5 bg-slate-50/50 dark:bg-black/20 rounded-2xl border border-slate-200/80 dark:border-white/10 p-5 flex flex-col justify-between gap-6">
              <div>
                <h3 className="m-0 font-inter text-base font-bold text-slate-800 dark:text-white mb-4">Community Details</h3>
                
                <div className="flex flex-col gap-4">
                  <div className="p-3.5 rounded-xl bg-white dark:bg-[#1E2130] border border-slate-200/60 dark:border-white/5 flex flex-col gap-1">
                    <span className="font-inter text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Lead Pastor</span>
                    <span className="font-inter text-sm font-semibold text-slate-800 dark:text-white">{branch.pastor || 'Not assigned'}</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white dark:bg-[#1E2130] border border-slate-200/60 dark:border-white/5 flex flex-col gap-1">
                    <span className="font-inter text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Full Address</span>
                    <span className="font-inter text-sm font-semibold text-slate-800 dark:text-white">{branch.address || branch.location || 'No address provided'}</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white dark:bg-[#1E2130] border border-slate-200/60 dark:border-white/5 flex flex-col gap-1">
                    <span className="font-inter text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Province / Region</span>
                    <span className="font-inter text-sm font-semibold text-slate-800 dark:text-white">{branch.province || 'CAR'}</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white dark:bg-[#1E2130] border border-slate-200/60 dark:border-white/5 flex flex-col gap-1">
                    <span className="font-inter text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Status</span>
                    <div>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold tracking-wide uppercase ${
                        isActive 
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' 
                          : 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300'
                      }`}>
                        {isActive ? 'Active Community' : 'Idle'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminBranches() {
  const navigate = useNavigate();

  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [viewingBranch, setViewingBranch] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  
  // Track visible count per province for "View More" pagination
  const [visibleCounts, setVisibleCounts] = useState({});
  const [filterActive, setFilterActive] = useState(false);
  const [totalServices, setTotalServices] = useState(0);
  const [growthRate, setGrowthRate] = useState(0);
  const LIMIT = 68;

  const token = localStorage.getItem('adminToken');

  const fetcherSingle = (url) => fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(res => res.json());

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', page);
    params.set('limit', LIMIT);
    if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
    return params.toString();
  }, [page, debouncedSearch]);

  const { data: branchesData, isValidating: loadingBranches, mutate: fetchBranches } = useSWR(
    token ? `${API}/api/admin/branches?${queryParams}` : null,
    fetcherSingle,
    { revalidateOnFocus: false, revalidateIfStale: true }
  );

  useEffect(() => {
    if (branchesData && branchesData.success) {
      setBranches(branchesData.branches || []);
      setTotalCount(branchesData.totalCount || 0);
      setTotalServices(branchesData.totalServices || 0);
      setGrowthRate(branchesData.growthRate || 0);
    }
  }, [branchesData]);

  useEffect(() => {
    setLoading(loadingBranches);
  }, [loadingBranches]);

  const handleDeleteBranch = async (id) => {
    if (!window.confirm('Are you sure you want to remove this community? This will not delete the members associated with it.')) return;
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API}/api/admin/branches/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Community removed');
        fetchBranches();
      }
    } catch (err) { toast.error('Failed to remove community'); }
  };

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/');
    }
  }, [navigate]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  // Compute stats from fetched branches using useMemo for max performance
  const { totalMembers, totalAllDonations } = useMemo(() => {
    const members = (branches || []).reduce((s, b) => s + (b.members || 0), 0);
    const donations = (branches || []).reduce((sum, b) => sum + (b.totalDonations || 0), 0);
    return { totalMembers: members, totalAllDonations: donations };
  }, [branches]);

  const { groupedBranches, provinceOrder } = useMemo(() => {
    const grouped = (branches || []).reduce((acc, b) => {
      if (filterActive && (b.members || 0) === 0) return acc;
      
      // Parse province from address if not explicitly present
      let province = b.province;
      if (!province && b.address) {
        const parts = b.address.split(', ');
        if (parts.length > 0) province = parts[0];
      }
      province = province || 'Other Provinces';
      if (!acc[province]) acc[province] = [];
      acc[province].push(b);
      return acc;
    }, {});

    const order = Object.keys(grouped).sort();
    return { groupedBranches: grouped, provinceOrder: order };
  }, [branches, filterActive]);


  if (!branchesData && loadingBranches) {
    return (
      <div className="flex flex-col gap-6 p-6 max-w-[1400px] mx-auto w-full min-h-full bg-slate-100 dark:bg-[#161922] animate-pulse">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div className="flex flex-col gap-2">
            <div className="h-8 w-44 bg-slate-200 dark:bg-slate-700/80 rounded-lg"></div>
            <div className="h-4 w-72 bg-slate-200 dark:bg-slate-700/80 rounded-md"></div>
          </div>
          <div className="flex items-center gap-4 bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 p-4 rounded-xl shadow-sm">
            <div className="h-10 w-64 bg-slate-200 dark:bg-slate-700/80 rounded-lg"></div>
            <div className="h-10 w-36 bg-slate-200 dark:bg-slate-700/80 rounded-lg"></div>
          </div>
        </div>

        {/* 4 Stat Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm flex flex-col justify-between h-[138px]">
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-2">
                  <div className="h-3.5 w-24 bg-slate-200 dark:bg-slate-700/80 rounded"></div>
                  <div className="h-8 w-20 bg-slate-200 dark:bg-slate-700/80 rounded-lg"></div>
                </div>
                <div className="w-12 h-12 rounded-[14px] bg-slate-200 dark:bg-slate-700/80"></div>
              </div>
              <div className="h-4 w-28 bg-slate-200 dark:bg-slate-700/80 rounded mt-2"></div>
            </div>
          ))}
        </div>

        {/* Province Group Cards Skeleton */}
        {[1, 2].map((group) => (
          <div key={group} className="flex flex-col bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-slate-50/80 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
              <div className="h-6 w-36 bg-slate-200 dark:bg-slate-700/80 rounded-md"></div>
              <div className="h-6 w-20 bg-slate-200 dark:bg-slate-700/80 rounded-full"></div>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-white/5 p-4">
              {[1, 2, 3].map((row) => (
                <div key={row} className="flex items-center justify-between py-3.5 gap-4">
                  <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700/80 rounded"></div>
                  <div className="h-4 w-28 bg-slate-200 dark:bg-slate-700/80 rounded"></div>
                  <div className="h-4 w-48 bg-slate-200 dark:bg-slate-700/80 rounded"></div>
                  <div className="h-6 w-12 bg-slate-200 dark:bg-slate-700/80 rounded-md"></div>
                  <div className="h-6 w-16 bg-slate-200 dark:bg-slate-700/80 rounded-full"></div>
                  <div className="h-6 w-8 bg-slate-200 dark:bg-slate-700/80 rounded"></div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-[1400px] mx-auto w-full min-h-full bg-slate-100 dark:bg-[#161922]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="m-0 font-inter text-2xl font-bold text-slate-800 dark:text-white">Communities</h1>
          <p className="m-0 font-inter text-sm text-slate-500 dark:text-slate-400 mt-1">Manage church communities by province</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 p-4 rounded-xl shadow-sm shrink-0">
          <div className="relative flex-1 max-w-[400px]">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by province or branch..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-4 bg-slate-50 dark:bg-[#161922] border border-slate-300 dark:border-white/10 rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-all"
            />
          </div>
          <button className="h-10 px-4 bg-blue-600 text-white font-inter text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors border-none cursor-pointer flex items-center gap-2" onClick={() => setShowAddModal(true)}>
            <Plus size={18} />
            Add Community
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Communities */}
        <div 
          className={`group relative bg-white dark:bg-[#1E2130] border rounded-2xl p-6 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_12px_32px_rgba(0,0,0,0.3)] hover:-translate-y-1 ${!filterActive ? 'border-blue-500/50 ring-1 ring-blue-500/20' : 'border-slate-200 dark:border-white/10'}`}
          onClick={() => setFilterActive(false)}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform duration-500 group-hover:scale-150"></div>
          <div className="flex items-start justify-between relative z-10 mb-4">
            <div className="flex flex-col">
              <span className="font-inter font-semibold text-[13px] tracking-wider uppercase text-slate-500 dark:text-slate-400 mb-1">Total Communities</span>
              <div className="font-inter font-extrabold text-[32px] text-slate-900 dark:text-white tracking-tight leading-none">{loading ? '—' : totalCount}</div>
            </div>
            <div className={`w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 shadow-sm ${!filterActive ? 'bg-blue-600 text-white' : 'bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-500/20 dark:to-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-500/30'}`}>
              <MapPin size={24} strokeWidth={2.2} />
            </div>
          </div>
          <div className="flex items-center gap-2 relative z-10 mt-1">
            <div className="flex items-center gap-1 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md text-xs font-bold border border-blue-100 dark:border-blue-500/20">
              <MapPin size={14} strokeWidth={2.5} />
              <span>All</span>
            </div>
            <span className="font-inter text-xs font-medium text-slate-500 dark:text-slate-400">branches tracked</span>
          </div>
        </div>

        {/* Total Members */}
        <div 
          className={`group relative bg-white dark:bg-[#1E2130] border rounded-2xl p-6 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_12px_32px_rgba(0,0,0,0.3)] hover:-translate-y-1 ${filterActive ? 'border-indigo-500/50 ring-1 ring-indigo-500/20' : 'border-slate-200 dark:border-white/10'}`}
          onClick={() => setFilterActive(true)}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform duration-500 group-hover:scale-150"></div>
          <div className="flex items-start justify-between relative z-10 mb-4">
            <div className="flex flex-col">
              <span className="font-inter font-semibold text-[13px] tracking-wider uppercase text-slate-500 dark:text-slate-400 mb-1">Total Members</span>
              <div className="font-inter font-extrabold text-[32px] text-slate-900 dark:text-white tracking-tight leading-none">{loading ? '—' : totalMembers.toLocaleString()}</div>
            </div>
            <div className={`w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 shadow-sm ${filterActive ? 'bg-indigo-600 text-white' : 'bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-500/20 dark:to-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-500/30'}`}>
              <Users size={24} strokeWidth={2.2} />
            </div>
          </div>
          <div className="flex items-center gap-2 relative z-10 mt-1">
            <div className="flex items-center gap-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-md text-xs font-bold border border-indigo-100 dark:border-indigo-500/20">
              <span>{(branches || []).filter(b => (b.members || 0) > 0).length}</span>
            </div>
            <span className="font-inter text-xs font-medium text-slate-500 dark:text-slate-400">active communities</span>
          </div>
        </div>

        {/* Total Services */}
        <div className="group relative bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] overflow-hidden transition-all duration-300 hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_12px_32px_rgba(0,0,0,0.3)] hover:-translate-y-1">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform duration-500 group-hover:scale-150"></div>
          <div className="flex items-start justify-between relative z-10 mb-4">
            <div className="flex flex-col">
              <span className="font-inter font-semibold text-[13px] tracking-wider uppercase text-slate-500 dark:text-slate-400 mb-1">Total Services</span>
              <div className="font-inter font-extrabold text-[32px] text-slate-900 dark:text-white tracking-tight leading-none">{loading ? '—' : totalServices.toLocaleString()}</div>
            </div>
            <div className="w-12 h-12 rounded-[14px] bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-500/20 dark:to-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 border border-purple-200/60 dark:border-purple-500/30 transition-transform duration-300 group-hover:scale-110 shadow-sm">
              <CalendarDays size={24} strokeWidth={2.2} />
            </div>
          </div>
          <div className="flex items-center gap-2 relative z-10 mt-1">
            <div className="flex items-center gap-1 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-md text-xs font-bold border border-purple-100 dark:border-purple-500/20">
              <CalendarDays size={14} strokeWidth={2.5} />
              <span>YTD</span>
            </div>
            <span className="font-inter text-xs font-medium text-slate-500 dark:text-slate-400">services held</span>
          </div>
        </div>

        {/* Growth Rate */}
        <div className="group relative bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] overflow-hidden transition-all duration-300 hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_12px_32px_rgba(0,0,0,0.3)] hover:-translate-y-1">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform duration-500 group-hover:scale-150"></div>
          <div className="flex items-start justify-between relative z-10 mb-4">
            <div className="flex flex-col">
              <span className="font-inter font-semibold text-[13px] tracking-wider uppercase text-slate-500 dark:text-slate-400 mb-1">Growth Rate</span>
              <div className="font-inter font-extrabold text-[32px] text-slate-900 dark:text-white tracking-tight leading-none">{loading ? '—' : `+${growthRate}%`}</div>
            </div>
            <div className="w-12 h-12 rounded-[14px] bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-500/20 dark:to-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200/60 dark:border-emerald-500/30 transition-transform duration-300 group-hover:scale-110 shadow-sm">
              <TrendingUp size={24} strokeWidth={2.2} />
            </div>
          </div>
          <div className="flex items-center gap-2 relative z-10 mt-1">
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold border ${growthRate > 0 ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20' : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10'}`}>
              <TrendingUp size={14} strokeWidth={2.5} />
              <span>{growthRate > 0 ? 'Trending Up' : 'Steady'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grouped Table View */}
      <div className="flex flex-col gap-6 pb-6">
        {loading ? (
           <div className="flex flex-col items-center justify-center gap-4 py-20">
             <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white animate-spin"></div>
             <p>Loading communities...</p>
           </div>
        ) : branches.length === 0 ? (
          <div className="px-4 py-8 text-center text-slate-500 dark:text-slate-400 text-sm font-inter">No communities found.</div>
        ) : (
          provinceOrder.map(province => {
            const list = groupedBranches[province];
            if (!list || list.length === 0) return null;
            
            const visibleLimit = visibleCounts[province] || 5;
            const displayedList = list.slice(0, visibleLimit);
            const hasMore = list.length > visibleLimit;

            return (
              <div key={province} className="flex flex-col bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md">
                {/* Header */}
                <div className="px-6 py-4 bg-slate-50/80 dark:bg-black/20 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200/50 dark:border-blue-500/30">
                      <MapPin size={18} strokeWidth={2.2} />
                    </div>
                    <div className="flex items-center gap-2">
                      <h3 className="m-0 font-inter text-base font-bold text-slate-800 dark:text-white tracking-tight">{province}</h3>
                    </div>
                  </div>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-wide bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20">
                    {list.length} {list.length === 1 ? 'Branch' : 'Branches'}
                  </span>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[850px]" style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: '22%' }} />
                      <col style={{ width: '20%' }} />
                      <col style={{ width: '28%' }} />
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '10%' }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th className="px-5 py-3.5 bg-slate-50/50 dark:bg-black/10 border-b border-slate-200/60 dark:border-white/10 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap">Branch Name</th>
                        <th className="px-5 py-3.5 bg-slate-50/50 dark:bg-black/10 border-b border-slate-200/60 dark:border-white/10 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap">Lead Pastor</th>
                        <th className="px-5 py-3.5 bg-slate-50/50 dark:bg-black/10 border-b border-slate-200/60 dark:border-white/10 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap">Full Address</th>
                        <th className="px-5 py-3.5 bg-slate-50/50 dark:bg-black/10 border-b border-slate-200/60 dark:border-white/10 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap">Members</th>
                        <th className="px-5 py-3.5 bg-slate-50/50 dark:bg-black/10 border-b border-slate-200/60 dark:border-white/10 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap">Status</th>
                        <th className="px-5 py-3.5 bg-slate-50/50 dark:bg-black/10 border-b border-slate-200/60 dark:border-white/10 font-inter font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {displayedList.map(branch => (
                        <tr 
                          key={branch._id} 
                          onClick={() => setViewingBranch(branch)} 
                          className="hover:bg-slate-50/80 dark:hover:bg-white/[0.03] transition-colors cursor-pointer group"
                        >
                          <td className="px-5 py-3.5 font-inter text-sm font-semibold text-slate-800 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {branch.name}
                          </td>
                          <td className="px-5 py-3.5 font-inter text-sm text-slate-600 dark:text-slate-300 truncate">
                            {branch.pastor || '—'}
                          </td>
                          <td className="px-5 py-3.5 font-inter text-sm text-slate-500 dark:text-slate-400 truncate">
                            {branch.address || branch.location || '—'}
                          </td>
                          <td className="px-5 py-3.5 font-inter text-sm font-bold text-slate-700 dark:text-slate-300">
                            <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-md bg-slate-100 dark:bg-white/10 text-xs text-slate-700 dark:text-slate-300 font-bold">
                              {branch.members || 0}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 font-inter text-sm">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase ${
                              branch.members > 0 
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' 
                                : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400'
                            }`}>
                              {branch.members > 0 ? 'Active' : 'Idle'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right relative" onClick={(e) => e.stopPropagation()}>
                            <button 
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors border-none bg-transparent cursor-pointer ml-auto"
                              onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === branch._id ? null : branch._id); }}
                            >
                              <MoreVertical size={16} />
                            </button>
                            
                            {openMenuId === branch._id && (
                              <div className="absolute right-4 top-12 z-50 w-44 bg-white dark:bg-[#1A1D2C] border border-slate-200 dark:border-white/10 rounded-xl shadow-xl py-1 text-left">
                                <button 
                                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border-none bg-transparent cursor-pointer" 
                                  onClick={() => { setOpenMenuId(null); setEditingBranch(branch); }}
                                >
                                  <Edit2 size={14} className="text-blue-500" /> Edit Details
                                </button>
                                <button 
                                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors border-none bg-transparent cursor-pointer" 
                                  onClick={() => { setOpenMenuId(null); handleDeleteBranch(branch._id); }}
                                >
                                  <Trash2 size={14} /> Remove Branch
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Card Footer */}
                {hasMore && (
                  <div className="p-3 text-center border-t border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-black/10">
                    <button 
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all border border-blue-200/60 dark:border-blue-500/30 cursor-pointer"
                      onClick={() => setVisibleCounts(prev => ({ ...prev, [province]: (prev[province] || 5) + 5 }))}
                    >
                      View More ({list.length - visibleLimit} remaining)
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {showAddModal && <AddCommunityModal onClose={() => setShowAddModal(false)} onSave={() => { setShowAddModal(false); fetchBranches(); }} />}
      {editingBranch && <EditCommunityModal branch={editingBranch} onClose={() => setEditingBranch(null)} onSave={() => { setEditingBranch(null); fetchBranches(); }} />}
      {viewingBranch && (
        <CommunityInfoModal 
          branch={viewingBranch} 
          totalAllDonations={totalAllDonations}
          onClose={() => setViewingBranch(null)} 
          onEdit={(b) => {
            setViewingBranch(null);
            setEditingBranch(b);
          }}
        />
      )}
    </div>
  );
}
