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
    { name: 'Within Community', value: sameCommunity, fill: '#1E3A8A' },
    { name: 'Outside Community', value: otherCommunities, fill: '#60A5FA' }
  ];

  // Process Attendance History for Jan-Dec (Current Year)
  const attHistory = branch.attendanceHistory || [];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentYear = new Date().getFullYear();
  
  const barData = monthNames.map((name, index) => {
    const monthNum = index + 1;
    const match = attHistory.find(a => a.month === monthNum && a.year === currentYear);
    return {
      name,
      attendance: match ? match.count : 0
    };
  });

  const hasAttendanceData = barData.some(d => d.attendance > 0);
  const hasDonationData = totalShare > 0;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[900px] shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col md:flex-row max-h-[90vh] overflow-hidden relative" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-4 p-5 border-b border-slate-200 dark:border-white/10 shrink-0 relative">
           <div className="w-16 h-16 rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 flex items-center justify-center shadow-sm">
             <MapPin size={20} />
           </div>
          <div className="flex flex-col">
            <h2 className="m-0 font-inter text-lg font-bold text-slate-800 dark:text-white">{branch.name}</h2>
            <p className="m-0 font-inter text-[13px] text-slate-500 dark:text-slate-400">{branch.province || 'Community Info'}</p>
          </div>
          <button className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer border-none" onClick={onClose}><XCircle size={20} color="#6B7280" /></button>
        </div>

        <div className="flex flex-col gap-4 mt-6">
          <div className="h-[150px] w-full bg-slate-50 dark:bg-black/20 rounded-xl border border-slate-200 dark:border-white/10 p-4 flex items-end gap-2 justify-between">
            <span className="flex items-center justify-between">Attendance Performance</span>
            <div className="h-[200px] w-full bg-slate-50 dark:bg-black/20 rounded-xl border border-slate-200 dark:border-white/10 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} allowDecimals={false} />
                  <Tooltip cursor={{ fill: '#F1F5F9' }} contentStyle={{ fontSize: '12px', borderRadius: '6px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="attendance" fill="#155DFC" radius={[4, 4, 0, 0]} maxBarSize={30} name="Attendees">
                    <LabelList dataKey="attendance" position="top" style={{ fontSize: '9px', fill: '#64748B' }} formatter={(val) => val > 0 ? val : ''} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row w-full flex-1">
          
          {/* Left Column (Charts and Cards) */}
          <div className="w-full md:w-1/3 bg-slate-50 dark:bg-black/20 border-r border-slate-200 dark:border-white/10 p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
            {/* Main Stats */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 flex flex-col gap-1">
                 <span className="font-inter text-[13px] font-semibold text-slate-500 dark:text-slate-400">Total Members</span>
                 <span className="font-inter text-2xl font-bold text-blue-600 dark:text-blue-400">{branch.members || 0}</span>
              </div>
              <div className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 flex flex-col gap-1">
                 <span className="font-inter text-[13px] font-semibold text-slate-500 dark:text-slate-400">Total Donations</span>
                 <span className="font-inter text-2xl font-bold text-emerald-600 dark:text-emerald-400">₱{(branch.totalDonations || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Chart */}
            <div className="h-[200px] w-full bg-slate-50 dark:bg-black/20 rounded-xl border border-slate-200 dark:border-white/10 p-4 mt-2">
              <span className="font-inter text-sm font-bold text-slate-800 dark:text-white">Donation Share</span>
              <div className="flex flex-col gap-4 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={totalShare > 0 ? pieData : [{ name: 'No Data', value: 1, fill: '#E2E8F0' }]} 
                      cx="50%" cy="45%" innerRadius={15} outerRadius={38} paddingAngle={2} dataKey="value" stroke="none"
                      labelLine={false}
                      label={totalShare > 0 ? ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                        if (percent < 0.05) return null;
                        const RADIAN = Math.PI / 180;
                        const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
                        const x = cx + radius * Math.cos(-midAngle * RADIAN);
                        const y = cy + radius * Math.sin(-midAngle * RADIAN);
                        return (
                          <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={8} fontWeight={700}>
                            {`${(percent * 100).toFixed(0)}%`}
                          </text>
                        );
                      } : false}
                    >
                      {(totalShare > 0 ? pieData : [{ name: 'No Data', value: 1, fill: '#E2E8F0' }]).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => totalShare > 0 ? `₱${value.toLocaleString()}` : 'No donations'} />
                    <Legend 
                      payload={[
                        { id: 'within', type: 'circle', value: 'Within Community', color: '#1E3A8A' },
                        { id: 'outside', type: 'circle', value: 'Outside Community', color: '#60A5FA' }
                      ]}
                      verticalAlign="bottom" height={24} wrapperStyle={{ fontSize: '11px', color: '#64748B', marginTop: '10px' }} 
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Right Column (Info) */}
          <div className="w-full md:w-2/3 p-6 flex flex-col overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between mb-6">
              <span className="m-0 font-inter text-lg font-bold text-slate-800 dark:text-white">Community Details</span>
              <button onClick={() => onEdit(branch)} className="h-9 px-3 bg-white dark:bg-[#161922] border border-slate-200 dark:border-white/10 rounded-lg text-sm font-inter font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-2" title="Edit Details">
                <Edit2 size={14} />
              </button>
            </div>
            
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <span className="font-inter text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Lead Pastor</span>
                <span className="font-inter text-sm font-medium text-slate-800 dark:text-white">{branch.pastor || 'Not assigned'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-inter text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Address</span>
                <span className="font-inter text-sm font-medium text-slate-800 dark:text-white">{branch.address || branch.location || 'No address provided'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-inter text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Status</span>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase ${branch.members > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300'}`}>{branch.members > 0 ? 'Active Community' : 'Idle'}</span>
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


  return (
    <div className="flex flex-col gap-6 p-6 max-w-[1400px] mx-auto w-full h-full bg-slate-100 dark:bg-[#161922]">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Communities */}
        <div 
          className={`group relative bg-white dark:bg-[#1E2130] border rounded-2xl p-5 flex flex-col gap-1 overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${!filterActive ? 'border-blue-500/50 shadow-md ring-1 ring-blue-500/20' : 'border-slate-200 dark:border-white/10 hover:border-blue-500/30'}`}
          onClick={() => setFilterActive(false)}
        >
          <div className="flex items-center justify-between relative z-10">
            <span className="font-inter font-bold text-[11px] tracking-widest text-slate-500 dark:text-slate-400 uppercase">Total Communities</span>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 shadow-sm ${!filterActive ? 'bg-blue-600 text-white' : 'bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-500/20 dark:to-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-500/30'}`}>
              <MapPin size={20} strokeWidth={2.2} />
            </div>
          </div>
          <p className="font-inter font-extrabold text-[28px] tracking-tight text-slate-900 dark:text-white m-0 mt-2 relative z-10">{loading ? '—' : totalCount}</p>
          <div className={`absolute -right-6 -bottom-6 w-32 h-32 rounded-full blur-3xl pointer-events-none transition-opacity duration-300 ${!filterActive ? 'bg-blue-500/20 opacity-100' : 'bg-blue-500/10 opacity-0 group-hover:opacity-100'}`}></div>
        </div>

        {/* Total Members */}
        <div 
          className={`group relative bg-white dark:bg-[#1E2130] border rounded-2xl p-5 flex flex-col gap-1 overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${filterActive ? 'border-indigo-500/50 shadow-md ring-1 ring-indigo-500/20' : 'border-slate-200 dark:border-white/10 hover:border-indigo-500/30'}`}
          onClick={() => setFilterActive(true)}
        >
          <div className="flex items-center justify-between relative z-10">
            <span className="font-inter font-bold text-[11px] tracking-widest text-slate-500 dark:text-slate-400 uppercase">Total Members</span>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 shadow-sm ${filterActive ? 'bg-indigo-600 text-white' : 'bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-500/20 dark:to-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-500/30'}`}>
              <Users size={20} strokeWidth={2.2} />
            </div>
          </div>
          <p className="font-inter font-extrabold text-[28px] tracking-tight text-slate-900 dark:text-white m-0 mt-2 relative z-10 flex items-center gap-2">
            {loading ? '—' : totalMembers.toLocaleString()}
            {!loading && <span className="text-[12px] font-medium text-slate-500 dark:text-slate-400 tracking-normal mt-1">({(branches || []).filter(b => (b.members || 0) > 0).length} active)</span>}
          </p>
          <div className={`absolute -right-6 -bottom-6 w-32 h-32 rounded-full blur-3xl pointer-events-none transition-opacity duration-300 ${filterActive ? 'bg-indigo-500/20 opacity-100' : 'bg-indigo-500/10 opacity-0 group-hover:opacity-100'}`}></div>
        </div>

        {/* Total Services */}
        <div className="group relative bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-5 flex flex-col gap-1 overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-purple-500/30">
          <div className="flex items-center justify-between relative z-10">
            <span className="font-inter font-bold text-[11px] tracking-widest text-slate-500 dark:text-slate-400 uppercase">Total Services</span>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 shadow-sm bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-500/20 dark:to-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-200/60 dark:border-purple-500/30">
              <CalendarDays size={20} strokeWidth={2.2} />
            </div>
          </div>
          <p className="font-inter font-extrabold text-[28px] tracking-tight text-slate-900 dark:text-white m-0 mt-2 relative z-10">{loading ? '—' : totalServices.toLocaleString()}</p>
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        </div>

        {/* Growth Rate */}
        <div className="group relative bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-2xl p-5 flex flex-col gap-1 overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-emerald-500/30">
          <div className="flex items-center justify-between relative z-10">
            <span className="font-inter font-bold text-[11px] tracking-widest text-slate-500 dark:text-slate-400 uppercase">Growth Rate</span>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-500/20 dark:to-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-500/30">
              <TrendingUp size={20} strokeWidth={2.2} />
            </div>
          </div>
          <p className="font-inter font-extrabold text-[28px] tracking-tight text-slate-900 dark:text-white m-0 mt-2 relative z-10 flex items-center gap-2">
            {loading ? '—' : `+${growthRate}%`}
            {!loading && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase mt-1 ${growthRate > 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-400'}`}>
                {growthRate > 0 ? 'Trending Up' : 'Steady'}
              </span>
            )}
          </p>
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        </div>
      </div>

      {/* Grouped Table View */}
      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-6 pb-6">
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
              <div key={province} className="flex flex-col gap-4 bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 flex items-center justify-between cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
                  <div className="adm-reg-icon"><MapPin size={16} color="white" /></div>
                  <span className="adm-reg-name">{province}</span>
                  <span className="adm-reg-count">{list.length} {list.length === 1 ? 'Branch' : 'Branches'}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                      <tr>
                        <th className="px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Branch Name</th>
                        <th className="px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Lead Pastor</th>
                        <th className="px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Full Address</th>
                        <th className="px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Members</th>
                        <th className="px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10">Status</th>
                        <th className="px-4 py-3 bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10 font-semibold text-[11px] tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap sticky top-0 z-10" style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedList.map(branch => (
                        <tr key={branch._id} onClick={() => setViewingBranch(branch)} style={{ cursor: 'pointer' }} className="adm-branch-row-hover">
                          <td className="adm-br-name-cell">{branch.name}</td>
                          <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-sm font-inter text-slate-700 dark:text-slate-300">{branch.pastor || '—'}</td>
                          <td className="adm-br-addr-cell">{branch.address || branch.location || '—'}</td>
                          <td className="adm-td-members">{branch.members || 0}</td>
                          <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-sm font-inter text-slate-700 dark:text-slate-300">
                            <span className={`adm-status-pill ${branch.members > 0 ? 'adm-status-active' : 'adm-status-idle'}`}>
                              {branch.members > 0 ? 'Active' : 'Idle'}
                            </span>
                          </td>
                          <td className="px-4 py-3 border-b border-slate-100 dark:border-white/5 text-sm font-inter text-slate-700 dark:text-slate-300" style={{ textAlign: 'right', position: 'relative' }}>
                            <button 
                              className="adm-action-menu-btn" 
                              onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === branch._id ? null : branch._id); }}
                            >
                              <MoreVertical size={18} />
                            </button>
                            
                            {openMenuId === branch._id && (
                              <div className="adm-action-dropdown">
                                <button className="adm-action-item" onClick={() => setEditingBranch(branch)}>
                                  <Edit2 size={14} /> Edit Details
                                </button>
                                <button className="adm-action-item adm-action-delete" onClick={() => handleDeleteBranch(branch._id)}>
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
                {hasMore && (
                  <div className="p-3 text-center border-t border-slate-100 dark:border-white/5">
                    <button 
                      className="text-sm font-inter font-semibold text-blue-600 hover:text-blue-700 bg-transparent border-none cursor-pointer"
                      onClick={() => setVisibleCounts(prev => ({ ...prev, [province]: (prev[province] || 5) + 5 }))}
                    >
                      View More ({list.length - visibleLimit} left)
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
