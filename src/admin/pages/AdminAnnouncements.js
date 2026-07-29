import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Calendar, Clock, Edit, Globe, MapPin, Megaphone, Trash2 , Loader2} from 'lucide-react';
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
  const [editingId, setEditingId] = useState(null);
  const [template, setTemplate] = useState('banner');
  const [showPosted, setShowPosted] = useState(false);
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
    if (!window.confirm('Delete this announcement?')) return;
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API}/api/admin/announcements/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Announcement deleted');
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

  return (
    <div className="flex flex-col h-full bg-slate-100 dark:bg-[#161922] p-6 max-w-[1400px] mx-auto w-full gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <h1 className="m-0 font-inter text-2xl font-bold text-slate-800 dark:text-white">Announcements</h1>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-y-auto custom-scrollbar pb-6">

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

        {/* ── RIGHT: Compact List ── */}
        <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl shadow-sm flex flex-col transition-all hover:shadow-md h-[calc(100vh-200px)]">

          {/* Live Preview */}
          <div className="p-4 flex justify-between items-center bg-slate-50 dark:bg-black/20 rounded-t-xl">
            <p className="m-0 font-inter text-sm font-bold text-slate-800 dark:text-white line-clamp-1">Live Preview</p>
          </div>
          <div className="p-5 flex-1 overflow-y-auto custom-scrollbar">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col bg-white dark:bg-[#161922] border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden shadow-sm">
                {template === 'banner' && (
                  <div className="w-full h-32 bg-slate-100 dark:bg-white/5 relative">
                    {form.images.length > 0
                      ? (
                        <div className="w-full h-full flex overflow-x-auto snap-x snap-mandatory">
                          {form.images.map((img, i) => (
                            <img key={i} src={img} alt="" onClick={() => window.open(img, '_blank')} />
                          ))}
                        </div>
                      )
                      : <div className="w-full h-full flex items-center justify-center opacity-30"><Megaphone size={24} color="#1E3A8A" /></div>
                    }
                  </div>
                )}
                {template === 'side' && (
                  <div className="hidden">
                    {form.images.length > 0
                      ? (
                        <div className="w-full h-full flex overflow-x-auto snap-x snap-mandatory">
                          {form.images.map((img, i) => (
                            <img key={i} src={img} alt="" onClick={() => window.open(img, '_blank')} />
                          ))}
                        </div>
                      )
                      : <div className="w-full h-full flex items-center justify-center opacity-30"><Megaphone size={20} color="#1E3A8A" /></div>
                    }
                  </div>
                )}
                <div className="p-4 flex flex-col gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">{form.category === 'Other' ? (form.customCategory || 'Custom Category') : form.category}</span>
                  <p className="m-0 font-inter text-base font-bold text-slate-800 dark:text-white leading-tight">
                    {form.title || <span className="italic opacity-70">Announcement title...</span>}
                  </p>
                  <p className="m-0 font-inter text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {form.body || <span className="italic opacity-70">Your message will appear here.</span>}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-medium">
                    <span><Calendar size={10} /> {previewDate}</span>
                    <span><Globe size={10} /> {previewAudience}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="h-[1px] bg-slate-200 dark:bg-white/10 mx-4" />

          {/* Stats Bar */}
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-black/20 rounded-xl mb-4">
            <div className="flex flex-col items-center flex-1">
              <span className="font-inter font-bold text-xl text-slate-800 dark:text-white">{items.length}</span>
              <span className="font-inter text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total</span>
            </div>
            <div className="w-[1px] h-8 bg-slate-200 dark:bg-white/10" />
            <div className="flex flex-col items-center flex-1">
              <span className="font-inter font-bold text-xl text-slate-800 dark:text-white">{items.filter(a => !isExpired(a.expiresAt)).length}</span>
              <span className="font-inter text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Active</span>
            </div>
            <div className="w-[1px] h-8 bg-slate-200 dark:bg-white/10" />
            <div className="flex flex-col items-center flex-1">
              <span className="font-inter font-bold text-xl text-slate-800 dark:text-white">{items.filter(a => isExpired(a.expiresAt)).length}</span>
              <span className="font-inter text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Expired</span>
            </div>
          </div>

          <div className="p-4 flex justify-between items-center bg-slate-50 dark:bg-black/20 rounded-t-xl border-b border-slate-200 dark:border-white/10" style={{ borderBottom: showPosted ? '' : 'none' }}>
            <div>
              <p className="m-0 font-inter text-[13px] font-bold text-slate-800 dark:text-white">Recent Announcements</p>
              <p className="m-0 font-inter text-[11px] text-slate-500 dark:text-slate-400">Manage active and expired announcements</p>
            </div>
            <button 
              type="button"
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors border-none cursor-pointer text-slate-600 dark:text-slate-400"
              onClick={() => setShowPosted(!showPosted)}
            >
              {showPosted ? 'Hide List' : 'View List'}
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400">
                {items.filter(a => !isExpired(a.expiresAt)).length} active
              </span>
            </button>
          </div>

          <div className={`transition-all duration-300 ease-in-out overflow-hidden flex flex-col ${showPosted ? 'h-full opacity-100' : 'h-0 opacity-0'}`}>
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex items-center gap-2 p-3 border-b border-slate-100 dark:border-white/5">
                {['All', 'Divine Service', 'Bible Study', 'Youth Fellowship', 'Men’s Fellowship', 'Women’s Fellowship'].map(cat => (
                  <button
                    key={cat}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border-none cursor-pointer ${categoryFilter === cat ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/20'}`}
                    onClick={() => setCategoryFilter(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-3 flex flex-col gap-3">
                {loading ? (
                  [1, 2, 3].map(i => (
                    <div key={i} className="flex flex-col p-4 bg-white dark:bg-[#161922] border border-slate-200 dark:border-white/10 rounded-xl hover:border-blue-300 dark:hover:border-white/20 transition-all group relative overflow-hidden">
                      <div className="flex-1">
                        <div className="h-4 bg-slate-200 dark:bg-white/10 rounded w-3/4 mb-2 animate-pulse" />
                        <div className="h-3 bg-slate-200 dark:bg-white/10 rounded w-full mt-2 animate-pulse" />
                      </div>
                    </div>
                  ))
                ) : (filteredItems => filteredItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center">
                    <Megaphone size={28} color="#cbd5e1" className="mb-3 opacity-50" />
                    <p>{items.length === 0 ? 'No announcements yet. Post one!' : `No ${categoryFilter} announcements.`}</p>
                  </div>
                ) : (
                  filteredItems.map(a => (
                      <div key={a._id} className={`flex flex-col p-4 bg-white dark:bg-[#161922] border border-slate-200 dark:border-white/10 rounded-xl transition-all group relative overflow-hidden ${isExpired(a.expiresAt) ? 'opacity-60' : 'hover:border-blue-300 dark:hover:border-white/20'}`}>
                        <div className="flex flex-col gap-2 relative z-10">
                          <p className="m-0 font-inter text-sm font-bold text-slate-800 dark:text-white pr-16 line-clamp-2">{a.title}</p>
                          <p className="m-0 font-inter text-[13px] text-slate-600 dark:text-slate-400 line-clamp-2">{a.body}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold tracking-wider uppercase bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400">{a.category}</span>
                            {a.eventDate && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold tracking-wider uppercase bg-blue-50 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                                <Calendar size={9} /> {fmtDateTime(a.eventDate)}
                              </span>
                            )}
                            {a.expiresAt && (
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold tracking-wider uppercase ${isExpired(a.expiresAt) ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400'}`}>
                                <Clock size={9} /> {isExpired(a.expiresAt) ? 'Expired' : `Expires ${fmtDate(a.expiresAt)}`}
                              </span>
                            )}
                            <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold tracking-wider uppercase bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-500/20 dark:text-fuchsia-400">
                              <Globe size={9} /> {getVisibilityLabel(a)}
                            </span>
                          </div>
                          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/10 flex items-center justify-between text-[11px] font-inter font-semibold text-slate-400 tracking-wide">
                            <span>{fmtDate(a.createdAt)}</span>
                            {a.createdBy && <span>· by {a.createdBy}</span>}
                          </div>
                        </div>
                        <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                          <button className="w-7 h-7 rounded bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 flex items-center justify-center text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 cursor-pointer shadow-sm transition-colors" onClick={() => handleEdit(a)} title="Edit">
                            <Edit size={14} />
                          </button>
                          <button className="w-7 h-7 rounded bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 flex items-center justify-center text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer shadow-sm transition-colors" onClick={() => handleDelete(a._id)} title="Delete">
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

      </div>
    </div>
  );
}
