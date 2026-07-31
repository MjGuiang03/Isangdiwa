
import { useAuth } from '../../context/AuthContext';
import { useState, useMemo, useEffect, useRef, Suspense, lazy } from 'react';
import useSWR from 'swr';
import { MapPin, Search, X, ChevronDown, Check, Map, List, Calendar } from 'lucide-react';
import { branchData, REGION_ORDER, REGION_LABELS, DAY_COLORS, COMMUNITY_MAP } from '../components/branchData';
import { useNavigate } from 'react-router-dom';
import API from '../../utils/api';
import useSwipeToClose, { DragHandle } from '../hooks/useSwipeToClose';

const BranchMap = lazy(() => import('../components/BranchMap'));

export default function Branches() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [drawerBranch, setDrawerBranch] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerMounted, setDrawerMounted] = useState(false);
  const [openRegions, setOpenRegions] = useState(new Set(['CAR']));
  const [activeBranch, setActiveBranch] = useState(null);
  const [mobileTab, setMobileTab] = useState('map'); // 'map' | 'list'
  const flyToRef = useRef(null);

  const token = localStorage.getItem('token');
  const fetcher = (url) => fetch(url).then(res => res.json());
  const authFetcher = async (url) => {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.json();
  };

  const { data: branchesData } = useSWR(`${API}/api/public/branches`, fetcher, { revalidateOnFocus: false });
  const { data: eventsData } = useSWR(`${API}/api/admin/announcements`, fetcher, { revalidateOnFocus: false });
  const { data: visitedData } = useSWR(token ? `${API}/api/attendance/visited-stats` : null, authFetcher, { revalidateOnFocus: false });

  const visitedStats = useMemo(() => {
    return visitedData?.success ? visitedData.visited : {};
  }, [visitedData]);

  const branchStats = useMemo(() => {
    const stats = {};
    if (branchesData?.success) {
      branchesData.branches.forEach(b => {
        stats[b.name] = { members: Number(b.members) || 0, officers: Number(b.officers) || 0 };
      });
    }
    return stats;
  }, [branchesData]);

  const events = useMemo(() => {
    return eventsData?.success && Array.isArray(eventsData.announcements) ? eventsData.announcements : [];
  }, [eventsData]);

  const branchEvents = useMemo(() => {
    if (!drawerBranch || !events) return [];
    return events.filter(ev => {
      if (!ev.targetBranches || ev.targetBranches.length === 0 || ev.targetBranches === 'all') return true;
      if (Array.isArray(ev.targetBranches)) return ev.targetBranches.includes(drawerBranch.name);
      return ev.targetBranches === drawerBranch.name;
    });
  }, [drawerBranch, events]);

  const toggleRegion = (key) => {
    setOpenRegions(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // Resolve user's community branch
  const userBranch = useMemo(() => {
    const rawBranch = profile?.branch || profile?.community;
    if (!rawBranch) return null;

    const normalizedUserBranch = rawBranch.toLowerCase().replace(/\s*city\s*/gi, '').trim();

    let match = branchData.find(b => {
      const normalizedName = b.name.toLowerCase().replace(/\s*city\s*/gi, '').trim();
      return normalizedName.includes(normalizedUserBranch) || normalizedUserBranch.includes(normalizedName);
    });

    if (!match) {
      const mappedName = COMMUNITY_MAP[rawBranch];
      if (mappedName) {
        match = branchData.find(b => b.name.toLowerCase() === mappedName.toLowerCase());
      }
    }

    return match || null;
  }, [profile]);

  const userBranchName = userBranch?.name || null;

  const openDrawer = (branch) => {
    setDrawerBranch(branch);
    setDrawerMounted(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setDrawerVisible(true)));
  };

  const closeDrawer = () => {
    setDrawerVisible(false);
    setTimeout(() => { setDrawerMounted(false); setDrawerBranch(null); }, 300);
  };

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') closeDrawer(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-24px)] sm:h-[calc(100vh-40px)] lg:h-[calc(100vh-48px)] w-[calc(100%+24px)] sm:w-[calc(100%+40px)] lg:w-[calc(100%+48px)] -ml-3 sm:-ml-5 lg:-ml-6 -mr-3 sm:-mr-5 lg:-mr-6 -mt-3 sm:-mt-5 lg:-mt-6 -mb-3 sm:-mb-5 lg:-mb-6 font-inter relative overflow-hidden bg-slate-50 dark:bg-[#151722]">
      {/* Mobile Top View Switcher */}
      <div className="lg:hidden flex items-center justify-between p-2.5 bg-white dark:bg-[#1E2130] border-b border-slate-200 dark:border-white/10 shrink-0 z-10 shadow-xs">
        <div className="flex items-center gap-2">
          <MapPin size={16} className="text-blue-600 dark:text-blue-400" />
          <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-dm">Communities</span>
        </div>

        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setMobileTab('map')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border-none ${
              mobileTab === 'map'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-transparent'
            }`}
          >
            <Map size={13} />
            <span>Map</span>
          </button>
          <button
            onClick={() => setMobileTab('list')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border-none ${
              mobileTab === 'list'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-transparent'
            }`}
          >
            <List size={13} />
            <span>List</span>
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col lg:flex-row w-full h-full relative overflow-hidden">
        {/* Left Sidebar / List View */}
        <div className={`w-full lg:w-80 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-white/10 bg-white dark:bg-[#1E2130] shrink-0 h-full overflow-hidden ${
          mobileTab === 'list' ? 'flex' : 'hidden lg:flex'
        }`}>
          {/* Home branch banner */}
          {userBranch && (
            <div 
              className="p-3.5 bg-gradient-to-r from-blue-50 to-indigo-50/50 dark:from-blue-950/30 dark:to-indigo-950/20 border-b border-slate-200 dark:border-white/10 space-y-1 cursor-pointer hover:bg-blue-100/60 dark:hover:bg-blue-900/40 transition-colors"
              onClick={() => { flyToRef.current?.(userBranch); setActiveBranch(userBranch); openDrawer(userBranch); }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-blue-600 dark:text-blue-400 font-inter">Your Home Community</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">Active</span>
              </div>
              <div className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white font-dm">{userBranch.name}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-inter">{userBranch.region} · {userBranch.province}</div>
            </div>
          )}

          {/* Search */}
          <div className="p-3 border-b border-slate-200 dark:border-white/10 shrink-0 bg-white dark:bg-[#1E2130]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input 
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-600 placeholder-slate-400" 
                placeholder="Search communities…"
                value={search} 
                onChange={e => setSearch(e.target.value)} 
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Region accordion list */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5">
            {REGION_ORDER.map(regionKey => {
              const regionBranches = branchData.filter(b => b.region === regionKey);
              const filtered = search
                ? regionBranches.filter(b => b.name.toLowerCase().includes(search.toLowerCase()))
                : regionBranches;
              if (filtered.length === 0) return null;
              const isOpen = openRegions.has(regionKey) || !!search;
              return (
                <div key={regionKey} className="space-y-1">
                  <button 
                    className="w-full p-3 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-left transition-colors cursor-pointer border-none bg-transparent"
                    onClick={() => toggleRegion(regionKey)}
                  >
                    <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold rounded text-[10px]">{regionKey}</span>
                    <span className="text-xs font-bold text-slate-900 dark:text-white flex-1 truncate">{REGION_LABELS[regionKey]}</span>
                    <span className="text-[11px] text-slate-400 font-medium px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">{filtered.length}</span>
                    <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="pl-4 pr-2 pb-2 space-y-1">
                      {filtered.map((branch, i) => {
                        const isVisited = visitedStats[branch.name]?.count > 0;
                        const isSelected = activeBranch?.name === branch.name;
                        const isMine = userBranch?.name === branch.name;
                        return (
                          <button 
                            key={i}
                            className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 text-left transition-all cursor-pointer border-none ${
                              isSelected
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 bg-transparent'
                            }`}
                            onClick={() => { 
                              flyToRef.current?.(branch); 
                              setActiveBranch(branch); 
                              openDrawer(branch); 
                            }}
                          >
                            <MapPin size={13} className={isSelected ? 'text-white' : 'text-blue-500'} />
                            <span className="flex-1 truncate">{branch.name}</span>
                            {isMine && <span className={`px-1.5 py-0.2 text-[9px] font-bold rounded uppercase ${isSelected ? 'bg-white text-blue-600' : 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400'}`}>Mine</span>}
                            {isVisited && <span className={`text-[10px] font-bold ${isSelected ? 'text-emerald-200' : 'text-emerald-600 dark:text-emerald-400'}`}>✓ Visited</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Map View */}
        <div className={`flex-1 relative h-full w-full bg-slate-100 dark:bg-slate-900 ${
          mobileTab === 'map' ? 'flex' : 'hidden lg:flex'
        }`}>
          <Suspense fallback={<div className="flex justify-center items-center h-full w-full text-slate-400 text-xs font-semibold">Loading Map...</div>}>
            <BranchMap
              branches={branchData}
              userBranch={userBranch}
              onBranchClick={(branch) => { openDrawer(branch); }}
              flyToRef={flyToRef}
            />
          </Suspense>
        </div>
      </div>

      {/* ── Community Details Drawer ── */}
      {drawerMounted && (
        <CommunityDetailDrawer
          isOpen={drawerVisible}
          onClose={closeDrawer}
          drawerBranch={drawerBranch}
          userBranchName={userBranchName}
          branchStats={branchStats}
          visitedStats={visitedStats}
          branchEvents={branchEvents}
          navigate={navigate}
        />
      )}
    </div>
  );
}

function CommunityDetailDrawer({
  isOpen,
  onClose,
  drawerBranch,
  userBranchName,
  branchStats,
  visitedStats,
  branchEvents,
  navigate
}) {
  const { modalStyle, touchHandlers } = useSwipeToClose(onClose);
  if (!drawerBranch) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 z-[9998] bg-black/50 backdrop-blur-xs transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={onClose} 
      />

      {/* Responsive Drawer Sheet */}
      <div 
        className={`fixed z-[9999] bg-white dark:bg-[#1E2130] shadow-2xl flex flex-col transition-all duration-300 ease-out font-inter
          bottom-0 left-0 right-0 h-[85vh] max-h-[85vh] w-full rounded-t-3xl border-t border-slate-200 dark:border-white/10
          lg:top-0 lg:bottom-0 lg:left-auto lg:right-0 lg:h-full lg:max-h-full lg:w-full lg:max-w-md lg:rounded-none lg:border-t-0 lg:border-l
          ${isOpen ? 'translate-y-0 lg:translate-x-0' : 'translate-y-full lg:translate-x-full'}
        `}
        style={modalStyle}
        {...touchHandlers}
        onClick={e => e.stopPropagation()}
      >
        <div className="lg:hidden">
          <DragHandle />
        </div>

        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-white/10 flex items-start gap-4 shrink-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${userBranchName && drawerBranch?.name === userBranchName
              ? 'bg-blue-600 text-white'
              : 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
            }`}>
            <MapPin size={20} />
          </div>
          <div className="flex-1 space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight font-dm truncate">{drawerBranch?.name}</h2>
              {userBranchName && drawerBranch?.name === userBranchName && (
                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold rounded text-[10px] shrink-0">My Community</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold rounded text-[10px]">{drawerBranch?.region}</span>
              {drawerBranch?.province !== drawerBranch?.region && (
                <span className="text-slate-400 truncate">{drawerBranch?.province}</span>
              )}
            </div>
          </div>
          <button className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-full transition-colors cursor-pointer border-none bg-transparent shrink-0" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Contact Information */}
          <div className="space-y-2">
            <p className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-inter">Contact Information</p>
            <div className="space-y-2 text-xs">
              {[
                { icon: '📍', val: `${drawerBranch?.name}, ${drawerBranch?.province}` },
                { icon: '📞', val: '+63 90 000 0000' },
                { icon: '✉️', val: 'isangdiwa@gmail.com' },
              ].map(({ icon, val }) => (
                <div key={val} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl flex items-center gap-3 border border-slate-100 dark:border-white/5">
                  <span className="text-sm">{icon}</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Service Times */}
          <div className="space-y-2">
            <p className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-inter">Service Times</p>
            <div className="space-y-2">
              {drawerBranch?.serviceTimes.map((s, i) => (
                <div key={i} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl flex items-center justify-between text-xs border border-slate-100 dark:border-white/5">
                  <span className="px-2.5 py-1 rounded-lg font-bold text-[11px]" style={DAY_COLORS[s.day] || {}}>{s.day}</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{s.time}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Statistics */}
          <div className="space-y-2">
            <p className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-inter">Community Statistics</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-center space-y-1 border border-slate-100 dark:border-white/5">
                <div className="text-xl font-bold font-dm text-slate-900 dark:text-white">
                  {branchStats[drawerBranch?.name]?.members || 0}
                </div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">MEMBERS</div>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-center space-y-1 border border-slate-100 dark:border-white/5">
                <div className="text-xl font-bold font-dm text-slate-900 dark:text-white">
                  {branchStats[drawerBranch?.name]?.officers || 0}
                </div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">OFFICERS</div>
              </div>
            </div>
          </div>

          {/* Visited History */}
          {visitedStats[drawerBranch?.name] && (
            <div className="space-y-2">
              <p className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-inter">Your Visit History</p>
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-xl space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold flex items-center gap-1">
                    <Check size={10} strokeWidth={3} />
                    Visited
                  </span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">
                    {visitedStats[drawerBranch.name].count} {visitedStats[drawerBranch.name].count === 1 ? 'visit' : 'visits'}
                  </span>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  Last visited on <strong className="font-bold">{visitedStats[drawerBranch.name].lastVisited}</strong>
                </div>

                <button
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer border-none"
                  onClick={() => navigate('/attendance', { state: { highlightBranch: drawerBranch.name } })}
                >
                  View Visit History
                </button>
              </div>
            </div>
          )}

          {/* Upcoming Events */}
          <div className="space-y-2 pb-4">
            <p className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-inter">Upcoming Events</p>
            {branchEvents.length > 0 ? (
              <div className="space-y-2">
                {branchEvents.slice(0, 3).map((ev, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl flex items-start gap-3 border border-slate-100 dark:border-white/5">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <Calendar size={18} />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {ev.title}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2">
                        <span>{new Date(ev.createdAt).toLocaleDateString()}</span>
                        {ev.category && (
                          <>
                            <span>•</span>
                            <span className="font-semibold text-blue-600 dark:text-blue-400">{ev.category}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-white/5">
                <span className="text-xs text-slate-400 font-medium">No upcoming events scheduled.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}