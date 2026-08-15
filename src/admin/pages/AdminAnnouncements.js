import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Calendar, Clock, Edit, Globe, MapPin, Megaphone, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import API from '../../utils/api';

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

const isExpired = (d) => d && new Date(d) < new Date();

export default function AdminAnnouncements() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState([]);
  const [branches, setBranches] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [deletingAnnouncement, setDeletingAnnouncement] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [template, setTemplate] = useState('banner');
  const [form, setForm] = useState({
    title: '', body: '', category: 'Divine Service',
    customCategory: '', // Added for 'Other' option
    eventDate: '', expiresAt: '',
    visibility: 'all', targetBranches: [],
    images: [] // Changed from imageBase64 to images array
  });

  const token = localStorage.getItem('adminToken');
  const fetcherSingle = (url) => fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(res => res.json());

  const { data: announcementsData, isValidating: loadingAnnouncements, mutate: fetchAnnouncements } = useSWR(
    token ? `${API}/api/admin/announcements?admin=true` : null,
    fetcherSingle,
    { revalidateOnFocus: false, revalidateIfStale: true }
  );

  useEffect(() => {
    if (announcementsData && announcementsData.success) {
      setItems(announcementsData.announcements || []);
    }
  }, [announcementsData]);

  const { data: branchesData } = useSWR(
    token ? `${API}/api/admin/branches` : null,
    fetcherSingle,
    { revalidateOnFocus: false }
  );

  useEffect(() => {
    if (branchesData && branchesData.success) {
      setBranches((branchesData.branches || []).map(b => b.name));
    }
  }, [branchesData]);

  useEffect(() => {
    setLoading(loadingAnnouncements && !announcementsData);
  }, [loadingAnnouncements, announcementsData]);

  useEffect(() => {
    if (!token) { navigate('/'); }
  }, [navigate, token]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => {
      const updated = { ...prev, [name]: value };
      // Reset custom category if choosing a fixed one
      if (name === 'category' && value !== 'Other') {
        updated.customCategory = '';
      }
      return updated;
    });
  };

  const toggleBranch = (branch) => {
    setForm(prev => ({
      ...prev,
      targetBranches: prev.targetBranches.includes(branch)
        ? prev.targetBranches.filter(b => b !== branch)
        : [...prev.targetBranches, branch]
    }));
  };

  const handleEdit = (a) => {
    setEditingId(a._id);
    setTemplate(a.template || 'banner');
    
    const predefined = [
      'General', 'Events', 'Services', 'Donations', 'Urgent',
      'Divine Service', 'Bible Study', 'Summer Youth Camp', 'Bible School',
      'Vacation Bible School', 'Annual Thanksgiving Anniversary', 'Youth Fellowship',
      'Men’s Fellowship', 'Women’s Fellowship', 'Children’s Fellowship'
    ];
    const isCustom = a.category && !predefined.includes(a.category);

    setForm({
      title: a.title || '',
      body: a.body || '',
      category: isCustom ? 'Other' : (a.category || 'Divine Service'),
      customCategory: isCustom ? a.category : '',
      eventDate: a.eventDate ? new Date(new Date(a.eventDate).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '',
      expiresAt: a.expiresAt ? new Date(a.expiresAt).toISOString().slice(0, 16) : '',
      visibility: a.visibility || 'all',
      targetBranches: a.targetBranches || [],
      images: Array.isArray(a.images) ? a.images : (a.image ? [a.image] : [])
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setTemplate('banner');
    setForm({
      title: '', body: '', category: 'Divine Service',
      customCategory: '', eventDate: '', expiresAt: '',
      visibility: 'all', targetBranches: [],
      images: []
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) {
      toast.error('Title and message are required');
      return;
    }
    if (form.visibility === 'branches' && form.targetBranches.length === 0) {
      toast.error('Please select at least one branch');
      return;
    }

    const now = new Date();
    if (form.eventDate && new Date(form.eventDate) < now) {
      toast.error('Event date cannot be in the past');
      return;
    }
    if (form.expiresAt && new Date(form.expiresAt) < now) {
      toast.error('Auto-disappear date cannot be in the past');
      return;
    }
    setSubmitting(true);
    try {
      const token = localStorage.getItem('adminToken');
      const payload = {
        ...form,
        category: form.category === 'Other' ? form.customCategory : form.category,
        template,
        eventDate: form.eventDate || null,
        expiresAt: form.expiresAt || null,
      };
      // Remove helper field before sending
      delete payload.customCategory;
      const url = editingId ? `${API}/api/admin/announcements/${editingId}` : `${API}/api/admin/announcements`;
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(editingId ? 'Announcement updated!' : 'Announcement posted!');
        cancelEdit();
        fetchAnnouncements();
      } else {
        toast.error(data.message || (editingId ? 'Failed to update' : 'Failed to post'));
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleImageChange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const currentCount = form.images.length;
    const remaining = 8 - currentCount;
    if (remaining <= 0) {
      toast.error('Maximum 8 images allowed');
      e.target.value = '';
      return;
    }

    const filesToProcess = files.slice(0, remaining);
    if (files.length > remaining) {
      toast.info(`Only the first ${remaining} images were added (limit 8).`);
    }

    setSubmitting(true);
    try {
      const newImages = await Promise.all(
        filesToProcess.map(file => {
          return new Promise((resolve, reject) => {
            if (file.size > 2 * 1024 * 1024) {
              toast.error(`${file.name} is too large (>2MB)`);
              return resolve(null);
            }
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Read failed'));
            reader.readAsDataURL(file);
          });
        })
      );

      const filtered = newImages.filter(img => img !== null);
      setForm(prev => ({ ...prev, images: [...prev.images, ...filtered] }));
    } catch {
      toast.error('Failed to process some images');
    } finally {
      setSubmitting(false);
      e.target.value = ''; // Reset for same file selection
    }
  };

  const removeImage = (index) => {
    setForm(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API}/api/admin/announcements/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Announcement deleted');
        setDeletingAnnouncement(null);
        setItems(prev => prev.filter(a => a._id !== id));
      } else {
        toast.error(data.message || 'Failed to delete');
      }
    } catch {
      toast.error('Network error');
    }
  };

  const getVisibilityLabel = (a) => {
    if (!a.visibility || a.visibility === 'all') return 'All Branches';
    if (a.visibility === 'branches' && Array.isArray(a.targetBranches)) {
      return a.targetBranches.join(', ');
    }
    return a.visibility;
  };

  const previewDate = form.eventDate
    ? new Date(form.eventDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'No date set';

  const previewAudience = form.visibility === 'all'
    ? 'All Branches'
    : form.targetBranches.join(', ') || 'No branch selected';

  if (!announcementsData && loadingAnnouncements) {
    return (
      <div className="flex flex-col min-h-full bg-slate-100 dark:bg-[#161922] p-6 max-w-[1400px] mx-auto w-full gap-6 animate-pulse">
        {/* Header Skeleton */}
        <div className="flex flex-col gap-2">
          <div className="h-8 w-52 bg-slate-200 dark:bg-slate-700/80 rounded-lg"></div>
          <div className="h-4 w-80 bg-slate-200 dark:bg-slate-700/80 rounded-md"></div>
        </div>

        {/* 2 Column Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
          {/* Left Form Skeleton */}
          <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl p-6 shadow-sm flex flex-col gap-5">
            <div className="h-6 w-44 bg-slate-200 dark:bg-slate-700/80 rounded-md"></div>
            <div className="h-10 w-full bg-slate-200 dark:bg-slate-700/80 rounded-lg"></div>
            <div className="h-28 w-full bg-slate-200 dark:bg-slate-700/80 rounded-lg"></div>
            <div className="h-10 w-full bg-slate-200 dark:bg-slate-700/80 rounded-lg"></div>
            <div className="h-10 w-36 bg-slate-200 dark:bg-slate-700/80 rounded-lg mt-2"></div>
          </div>

          {/* Right Preview & List Skeleton */}
          <div className="flex flex-col gap-6">
            <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl p-5 h-44 shadow-sm">
              <div className="h-5 w-32 bg-slate-200 dark:bg-slate-700/80 rounded mb-4"></div>
              <div className="h-4 w-full bg-slate-200 dark:bg-slate-700/80 rounded mb-2"></div>
              <div className="h-4 w-2/3 bg-slate-200 dark:bg-slate-700/80 rounded"></div>
            </div>
            <div className="grid grid-cols-3 gap-3 p-4 bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 bg-slate-200 dark:bg-slate-700/80 rounded-lg"></div>
              ))}
            </div>
            <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl p-5 shadow-sm flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-slate-200 dark:bg-slate-700/80 rounded-xl"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-slate-100 dark:bg-[#161922] p-6 max-w-[1400px] mx-auto w-full gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="m-0 font-inter text-2xl font-bold text-slate-800 dark:text-white">Announcements</h1>
          <p className="m-0 font-inter text-sm text-slate-500 dark:text-slate-400 mt-1">Create, manage, and broadcast church announcements and events</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">

        {/* ── LEFT: Create / Edit Form ── */}
        <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-md hover:-translate-y-1 relative">
          <div className="p-4 border-b border-slate-200 dark:border-white/10 flex justify-between items-center bg-slate-50 dark:bg-black/20">
            <p className="m-0 font-inter text-sm font-bold text-slate-800 dark:text-white line-clamp-1">{editingId ? 'Edit Announcement' : 'Post New Announcement'}</p>
            {editingId && (
              <button type="button" onClick={cancelEdit} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '13px' }}>
                Cancel Edit
              </button>
            )}
          </div>

          <form className="flex flex-col gap-6 p-6" onSubmit={handleSubmit}>

            {/* Template Picker */}
            <div className="flex flex-col gap-1.5">
              <label className="font-inter text-[13px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">Template</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { id: 'banner', label: 'Banner top' },
                  { id: 'side', label: 'Side image' },
                  { id: 'text', label: 'Text only' },
                ].map(t => (
                  <button
                    key={t.id}
                    type="button"
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all cursor-pointer ${template === t.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400' : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-slate-500 hover:border-blue-300 dark:hover:border-white/20'}`}
                    onClick={() => setTemplate(t.id)}
                  >
                    <div className="w-full h-12 bg-slate-200 dark:bg-white/10 rounded-md flex items-center justify-center text-xs opacity-50" />
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-inter text-[13px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">Title</label>
              <input
                type="text"
                name="title"
                className="h-10 px-3 bg-white dark:bg-[#161922] border border-slate-300 dark:border-white/10 rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-all w-full"
                placeholder="Announcement title..."
                value={form.title}
                onChange={handleChange}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-inter text-[13px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">Message</label>
              <textarea
                name="body"
                className="min-h-[120px] p-3 bg-white dark:bg-[#161922] border border-slate-300 dark:border-white/10 rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-all w-full resize-none custom-scrollbar"
                placeholder="Write the announcement message..."
                value={form.body}
                onChange={handleChange}
                required
              />
            </div>

            {template !== 'text' && (
              <div className="flex flex-col gap-1.5">
                <label className="font-inter text-[13px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">Images / Banner (Max 8)</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageChange}
                  className="h-10 px-3 bg-white dark:bg-[#161922] border border-slate-300 dark:border-white/10 rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-all w-full"
                  disabled={form.images.length >= 8}
                />
                
                {form.images.length > 0 && (
                  <div className="flex flex-wrap gap-3 mt-3">
                    {form.images.map((img, idx) => (
                      <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200 dark:border-white/10">
                        <button type="button" className="absolute top-1 right-1 w-5 h-5 rounded bg-black/50 text-white flex items-center justify-center text-xs cursor-pointer hover:bg-black/70 border-none" onClick={() => removeImage(idx)}>×</button>
                        <img src={img} alt="Preview" />
                      </div>
                    ))}
                  </div>
                )}
                <p className="m-0 mt-2 font-inter text-[11px] text-slate-500 dark:text-slate-400 text-right">{form.images.length} / 8 images added</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-inter text-[13px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">Category</label>
                <select name="category" className="h-10 px-3 pr-8 appearance-none bg-white dark:bg-[#161922] border border-slate-300 dark:border-white/10 rounded-lg text-sm font-inter text-slate-700 dark:text-slate-300 outline-none focus:border-blue-500 transition-colors bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236B7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[position:right_12px_center] bg-no-repeat w-full" value={form.category} onChange={handleChange}>
                  <option value="Divine Service">Divine Service</option>
                  <option value="Bible Study">Bible Study</option>
                  <option value="Summer Youth Camp">Summer Youth Camp</option>
                  <option value="Bible School">Bible School</option>
                  <option value="Vacation Bible School">Vacation Bible School</option>
                  <option value="Annual Thanksgiving Anniversary">Annual Thanksgiving Anniversary</option>
                  <option value="Youth Fellowship">Youth Fellowship</option>
                  <option value="Men’s Fellowship">Men’s Fellowship</option>
                  <option value="Women’s Fellowship">Women’s Fellowship</option>
                  <option value="Children’s Fellowship">Children’s Fellowship</option>
                  <option disabled>──────────</option>
                  <option value="Other">Other (Type manually)</option>
                </select>

                {form.category === 'Other' && (
                  <input
                    type="text"
                    name="customCategory"
                    className="h-10 px-3 mt-2 bg-white dark:bg-[#161922] border border-slate-300 dark:border-white/10 rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-all w-full"
                    placeholder="Enter custom category..."
                    value={form.customCategory}
                    onChange={handleChange}
                    required
                  />
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-inter text-[13px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">Target Audience</label>
                <div className="flex flex-col gap-2 mt-1">
                  {[
                    { value: 'all', label: 'All Branches' },
                    { value: 'branches', label: 'Selected' },
                  ].map(opt => (
                    <label key={opt.value} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${form.visibility === opt.value ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400' : 'border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                      <input type="radio" name="visibility" value={opt.value} checked={form.visibility === opt.value} onChange={handleChange} />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-inter text-[13px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Calendar size={13} className="mt-[-1px]" />
                  Event Date &amp; Time
                </label>
                <input 
                  type="datetime-local" 
                  name="eventDate" 
                  className="h-10 px-3 bg-white dark:bg-[#161922] border border-slate-300 dark:border-white/10 rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-all w-full" 
                  value={form.eventDate} 
                  onChange={handleChange} 
                  min={new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-inter text-[13px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Clock size={13} className="mt-[-1px]" />
                  Auto-Disappear Date
                </label>
                <input 
                  type="datetime-local" 
                  name="expiresAt" 
                  className="h-10 px-3 bg-white dark:bg-[#161922] border border-slate-300 dark:border-white/10 rounded-lg text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-all w-full" 
                  value={form.expiresAt} 
                  onChange={handleChange} 
                  min={new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                />
              </div>
            </div>

            {form.visibility === 'branches' && (
              <div className="flex flex-col gap-1.5">
                <label className="font-inter text-[13px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">Select Branches</label>
                <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto custom-scrollbar p-3 border border-slate-200 dark:border-white/10 rounded-lg bg-slate-50 dark:bg-black/20">
                  {branches.length === 0 ? (
                    <p className="m-0 text-sm text-slate-500 italic">No branches found.</p>
                  ) : (
                    branches.map(b => (
                      <label key={b} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer border transition-colors ${form.targetBranches.includes(b) ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30' : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'}`}>
                        <input type="checkbox" checked={form.targetBranches.includes(b)} onChange={() => toggleBranch(b)} />
                        <MapPin size={11} />
                        <span>{b}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}

            <button type="submit" className="h-10 px-6 rounded-lg font-inter text-sm font-semibold transition-all border-none bg-blue-600 text-white hover:bg-blue-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[120px]" disabled={submitting}>
              {submitting
                ? <Loader2 className="animate-spin" size={16} />
                : <><Megaphone size={16} /> {editingId ? 'Update Announcement' : 'Post Announcement'}</>}
            </button>
          </form>
        </div>

        {/* ── RIGHT: Preview & Announcements List ── */}
        <div className="flex flex-col gap-6">
          
          {/* Live Preview Card */}
          <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 flex items-center justify-between">
              <span className="font-inter text-sm font-bold text-slate-800 dark:text-white">Live Preview</span>
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">How users will see this</span>
            </div>
            <div className="p-5 bg-slate-50/50 dark:bg-black/10">
              <div className="flex flex-col bg-white dark:bg-[#161922] border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden shadow-sm">
                {template === 'banner' && (
                  <div className="w-full h-36 bg-slate-100 dark:bg-white/5 relative overflow-hidden">
                    {form.images.length > 0 ? (
                      <div className="w-full h-full flex overflow-x-auto snap-x snap-mandatory">
                        {form.images.map((img, i) => (
                          <img key={i} src={img} alt="Preview" className="w-full h-full object-cover shrink-0 snap-center" />
                        ))}
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center opacity-30 text-slate-400">
                        <Megaphone size={28} />
                      </div>
                    )}
                  </div>
                )}
                <div className="p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-100 dark:border-blue-500/30">
                      {form.category === 'Other' ? (form.customCategory || 'Custom Category') : form.category}
                    </span>
                  </div>
                  <p className="m-0 font-inter text-base font-bold text-slate-800 dark:text-white leading-tight">
                    {form.title || <span className="italic opacity-50">Announcement title...</span>}
                  </p>
                  <p className="m-0 font-inter text-sm text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                    {form.body || <span className="italic opacity-50">Your message will appear here.</span>}
                  </p>
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/10 flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 font-medium">
                    <span className="flex items-center gap-1.5"><Calendar size={12} className="text-slate-400" /> {previewDate}</span>
                    <span className="flex items-center gap-1.5"><Globe size={12} className="text-slate-400" /> {previewAudience}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-3 p-4 bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl shadow-sm">
            <div className="flex flex-col items-center p-2 rounded-lg bg-slate-50 dark:bg-black/20">
              <span className="font-inter font-extrabold text-2xl text-slate-900 dark:text-white">{items.length}</span>
              <span className="font-inter text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total</span>
            </div>
            <div className="flex flex-col items-center p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
              <span className="font-inter font-extrabold text-2xl text-emerald-600 dark:text-emerald-400">{items.filter(a => !isExpired(a.expiresAt)).length}</span>
              <span className="font-inter text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Active</span>
            </div>
            <div className="flex flex-col items-center p-2 rounded-lg bg-rose-50 dark:bg-rose-500/10">
              <span className="font-inter font-extrabold text-2xl text-rose-600 dark:text-rose-400">{items.filter(a => isExpired(a.expiresAt)).length}</span>
              <span className="font-inter text-[11px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider">Expired</span>
            </div>
          </div>

          {/* Published Announcements List */}
          <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="m-0 font-inter text-sm font-bold text-slate-800 dark:text-white">Recent Announcements</p>
                <p className="m-0 font-inter text-[11px] text-slate-500 dark:text-slate-400">Manage active and expired announcements</p>
              </div>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 w-fit">
                {items.filter(a => !isExpired(a.expiresAt)).length} Active
              </span>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 p-3 overflow-x-auto custom-scrollbar border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-black/10">
              {['All', 'Divine Service', 'Bible Study', 'Youth Fellowship', 'Men’s Fellowship', 'Women’s Fellowship'].map(cat => (
                <button
                  key={cat}
                  type="button"
                  className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all border-none cursor-pointer ${categoryFilter === cat ? 'bg-blue-600 text-white shadow-xs' : 'bg-white dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/20'}`}
                  onClick={() => setCategoryFilter(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Items Container */}
            <div className="p-4 flex flex-col gap-3 max-h-[460px] overflow-y-auto custom-scrollbar">
              {loading ? (
                [1, 2, 3].map(i => (
                  <div key={i} className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl animate-pulse flex flex-col gap-2">
                    <div className="h-4 bg-slate-200 dark:bg-white/10 rounded w-2/3" />
                    <div className="h-3 bg-slate-200 dark:bg-white/10 rounded w-full" />
                  </div>
                ))
              ) : (filteredItems => filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
                  <Megaphone size={32} className="mb-2 opacity-40" />
                  <p className="m-0 font-inter text-sm font-medium text-slate-500 dark:text-slate-400">{items.length === 0 ? 'No announcements yet. Post one!' : `No ${categoryFilter} announcements.`}</p>
                </div>
              ) : (
                filteredItems.map(a => (
                  <div key={a._id} className={`flex flex-col p-4 bg-slate-50 dark:bg-[#161922] border border-slate-200 dark:border-white/10 rounded-xl transition-all group relative ${isExpired(a.expiresAt) ? 'opacity-65' : 'hover:border-blue-400 dark:hover:border-white/20'}`}>
                    <div className="flex flex-col gap-1.5 pr-16">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-white dark:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10">{a.category}</span>
                        {a.expiresAt && (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${isExpired(a.expiresAt) ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'}`}>
                            <Clock size={10} /> {isExpired(a.expiresAt) ? 'Expired' : `Expires ${fmtDate(a.expiresAt)}`}
                          </span>
                        )}
                      </div>
                      <p className="m-0 font-inter text-sm font-bold text-slate-800 dark:text-white leading-snug">{a.title}</p>
                      <p className="m-0 font-inter text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">{a.body}</p>
                      
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        {a.eventDate && (
                          <span className="flex items-center gap-1"><Calendar size={11} /> {fmtDateTime(a.eventDate)}</span>
                        )}
                        <span className="flex items-center gap-1"><Globe size={11} /> {getVisibilityLabel(a)}</span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="absolute top-3 right-3 flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="w-8 h-8 rounded-lg bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 flex items-center justify-center text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/20 cursor-pointer shadow-xs transition-colors" onClick={() => handleEdit(a)} title="Edit">
                        <Edit size={14} />
                      </button>
                      <button className="w-8 h-8 rounded-lg bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 flex items-center justify-center text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/20 cursor-pointer shadow-xs transition-colors" onClick={() => setDeletingAnnouncement(a)} title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              ))(items.filter(a => categoryFilter === 'All' || a.category === categoryFilter))}
            </div>
          </div>

        </div>

      </div>
      {deletingAnnouncement && (
        <DeleteAnnouncementModal
          announcement={deletingAnnouncement}
          onClose={() => setDeletingAnnouncement(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

function DeleteAnnouncementModal({ announcement, onClose, onConfirm }) {
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await onConfirm(announcement._id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1E2130] rounded-2xl w-full max-w-[400px] shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex flex-col items-center gap-4 p-6 pt-8">
          <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <AlertTriangle size={28} strokeWidth={2.2} />
          </div>
          <div className="text-center">
            <h2 className="m-0 font-inter text-lg font-bold text-slate-800 dark:text-white">Delete Announcement</h2>
            <p className="m-0 font-inter text-[13px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-slate-700 dark:text-slate-200">"{announcement.title}"</span>? This action cannot be undone.
            </p>
          </div>
        </div>
        <div className="p-5 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 flex items-center justify-end gap-3">
          <button type="button" className="h-10 px-4 rounded-lg font-inter text-sm font-semibold transition-all border border-slate-300 dark:border-white/10 bg-white dark:bg-[#1E2130] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer flex-1 sm:flex-none" onClick={onClose} disabled={deleting}>Cancel</button>
          <button type="button" className="h-10 px-6 rounded-lg font-inter text-sm font-semibold transition-all border-none bg-rose-600 text-white hover:bg-rose-700 cursor-pointer flex items-center justify-center min-w-[100px] flex-1 sm:flex-none" onClick={handleConfirm} disabled={deleting}>
            {deleting ? <Loader2 className="animate-spin" size={16} /> : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
