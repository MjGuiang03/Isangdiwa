import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { Filter, X } from 'lucide-react';

const BASE_COMMUNITIES = [
  'Tabuk', 'Zapote', 'Bliss', 'Libanon', 'Batong Buhay', 'Balatoc', 'Lat-nog',
  'Lamao', 'Lingey', 'Cabaruyan', 'Ducligan', 'Gangal', 'Bila-Bila', 'Naguillian',
  'Ud-udiao', 'Villa Conchita', 'Ay-yeng Manabo', 'Dao-angan', 'Kilong-olao', 'Bao-yan',
  'Amti', 'Danac', 'Bengued', 'Sappaac', 'Saccaang', 'Baguio', 'Santiago City',
  'Dagupan', 'Mangatarem', 'Laoak Langka', 'Orbiztondo', 'Malasique, Bolaoit',
  'Taloyan', 'Binmaley', 'San Carlos', 'Manaoag', 'Pozorrobio', 'Alcala',
  'Meycauayan City', 'Camalig', 'San Jose Del Monte', 'Pacpaco, San Manuel',
  'Victoria', 'Bambanaba, Cuyapo', 'Valenzuela City', 'Tandang Sora, Quezon City',
  'COA, Quezon City', 'Payatas, Quezon City', 'Malaria, Caloocan', 'Montalban',
  'Mandaue', 'Li-loan', 'Calero', 'Compostela', 'Butuan City', 'RTR',
  'Jabonga, Bangonay', 'Kasiklan', 'San Mateo', 'Fatima Kim.13', 'Bayugan',
  'Ibuan', 'Balubo', 'Alegria', 'Bonifacio', 'Matin-ao', 'Ipil', 'Kinabigtasan Tago'
];

const baseColors = ['#1e3a5f','#2d5282','#3a6ba3','#4a90c8','#6aaed6','#92c5e3','#b8d8ed','#0f6e56','#1d9e75','#5dcaa5','#854f0b','#ba7517','#ef9f27'];
const getColor = (i) => baseColors[i % baseColors.length];

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 shadow-lg rounded-xl p-3 flex flex-col gap-1">
        <p className="m-0 font-inter text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{payload[0].payload.name}</p>
        <p className="m-0 font-inter text-[15px] font-bold text-slate-800 dark:text-white">₱{payload[0].value.toLocaleString()}</p>
      </div>
    );
  }
  return null;
};

export default function CommunityDonationChart({ communityBreakdown = {} }) {
  // Dynamically map base communities to their actual amounts from the backend
  const allCommunities = useMemo(() => {
    const list = BASE_COMMUNITIES.map(name => ({
      name,
      amount: communityBreakdown[name] || 0
    }));
    // Sort descending by amount so top givers are first
    return list.sort((a, b) => b.amount - a.amount);
  }, [communityBreakdown]);

  const [chartType, setChartType] = useState('bar');
  const [selected, setSelected] = useState(new Set(BASE_COMMUNITIES));
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredCommunities = useMemo(() => {
    return allCommunities.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [searchQuery, allCommunities]);

  const toggleComm = (name) => {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setSelected(next);
  };

  const selectAll = () => {
    const next = new Set(selected);
    filteredCommunities.forEach(c => next.add(c.name));
    setSelected(next);
  };

  const clearAll = () => {
    const next = new Set(selected);
    filteredCommunities.forEach(c => next.delete(c.name));
    setSelected(next);
  };

  const chartData = useMemo(() => {
    return allCommunities.filter(c => selected.has(c.name));
  }, [selected, allCommunities]);

  const toggleDropdown = () => setDropdownOpen(!dropdownOpen);

  return (
    <div className="bg-white dark:bg-[#1E2130] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm p-6 flex flex-col h-full relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <span className="m-0 font-inter text-base font-bold text-slate-900 dark:text-white">Donations by community</span>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative" ref={dropdownRef}>
            <button className="h-9 px-3 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-slate-700 dark:text-slate-300 font-inter text-sm font-medium flex items-center gap-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" onClick={toggleDropdown}>
              <Filter size={14} />
              Filter communities
              <span className="bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 px-1.5 py-0.5 rounded text-[10px] font-bold">{selected.size === allCommunities.length ? 'All' : selected.size}</span>
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 sm:right-auto sm:left-0 top-11 w-[300px] bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 shadow-xl rounded-xl p-4 flex flex-col gap-3 z-50">
                <input 
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500" 
                  type="text" 
                  placeholder="Search community..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-white/5 pb-2">
                  <button className="text-xs font-inter font-medium text-blue-600 hover:text-blue-700 bg-transparent border-none cursor-pointer" onClick={selectAll}>Select all</button>
                  <button className="text-xs font-inter font-medium text-blue-600 hover:text-blue-700 bg-transparent border-none cursor-pointer" onClick={clearAll}>Clear all</button>
                  <span className="text-[11px] font-inter text-slate-400">{filteredCommunities.length} communities</span>
                </div>
                <div className="max-h-[200px] overflow-y-auto custom-scrollbar flex flex-col gap-1 pr-1">
                  {filteredCommunities.map(c => (
                    <label key={c.name} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-white/5 rounded-md cursor-pointer">
                      <input type="checkbox" checked={selected.has(c.name)} onChange={() => toggleComm(c.name)} />
                      <span className="font-inter text-[13px] text-slate-700 dark:text-slate-300 truncate" title={c.name}>{c.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#161922] p-1 rounded-lg border border-slate-200 dark:border-white/5">
            <button 
              className={`px-3 py-1.5 rounded-md text-xs font-semibold font-inter transition-all cursor-pointer border-none ${chartType === 'bar' ? 'bg-white dark:bg-[#1E2130] text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-white/10' : 'bg-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`} 
              onClick={() => setChartType('bar')}
            >
              Bar
            </button>
            <button 
              className={`px-3 py-1.5 rounded-md text-xs font-semibold font-inter transition-all cursor-pointer border-none ${chartType === 'line' ? 'bg-white dark:bg-[#1E2130] text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-white/10' : 'bg-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`} 
              onClick={() => setChartType('line')}
            >
              Trend
            </button>
          </div>
        </div>
      </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {chartData.length > 0 && chartData.length < allCommunities.length && (
            <>
              {chartData.slice(0, 8).map(c => (
                <span key={c.name} className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 font-inter text-[11px] font-medium">
                  {c.name}
                  <button onClick={() => toggleComm(c.name)}><X size={12}/></button>
                </span>
              ))}
              {chartData.length > 8 && (
                <span className="inline-flex items-center px-2 py-1 rounded-md bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-400 font-inter text-[11px] font-medium">+{chartData.length - 8} more</span>
              )}
            </>
          )}
        </div>

        <div className="flex-1 w-full mt-2">
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm font-inter text-slate-500 dark:text-slate-400 text-center px-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5 border-dashed">No communities selected. Use the filter to choose communities.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              {chartType === 'bar' ? (
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} minTickGap={15} tickFormatter={(val) => val.length > 12 ? val.substring(0, 10) + '...' : val} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(val) => val >= 1000 ? `₱${(val/1000).toFixed(0)}k` : `₱${val}`} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(229, 231, 235, 0.4)' }} />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getColor(index)} />
                    ))}
                  </Bar>
                </BarChart>
              ) : (
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} minTickGap={15} tickFormatter={(val) => val.length > 12 ? val.substring(0, 10) + '...' : val} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(val) => val >= 1000 ? `₱${(val/1000).toFixed(0)}k` : `₱${val}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="amount" stroke="#1e3a5f" strokeWidth={2} dot={{ r: 3, fill: '#1e3a5f' }} activeDot={{ r: 5 }} />
                </LineChart>
              )}
            </ResponsiveContainer>
          )}
        </div>

        {chartData.length > 0 && (
          <div className="flex flex-wrap justify-center gap-3 mt-4 pt-3 border-t border-slate-100 dark:border-white/5">
            {chartData.slice(0, 12).map((c, i) => (
              <span key={c.name} className="flex items-center gap-1.5 font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getColor(i) }}></span>
                {c.name}
              </span>
            ))}
            {chartData.length > 12 && (
              <span className="flex items-center gap-1.5 font-inter text-[11px] font-medium text-slate-600 dark:text-slate-400" style={{ color: '#9CA3AF' }}>+{chartData.length - 12} more</span>
            )}
          </div>
        )}
    </div>
  );
}
