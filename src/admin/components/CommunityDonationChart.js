import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { Filter } from 'lucide-react';

import useDebounce from '../../hooks/useDebounce';

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

const COMMUNITY_TO_PROVINCE_MAP = {
  'Tabuk': 'Kalinga', 'Bliss': 'Kalinga', 'Libanon': 'Kalinga', 'Batong Buhay': 'Kalinga',
  'Balatoc': 'Kalinga', 'Lat-nog': 'Kalinga', 'Lamao': 'Kalinga', 'Lingey': 'Kalinga',
  'Cabaruyan': 'Kalinga', 'Ducligan': 'Kalinga', 'Gangal': 'Kalinga', 'Bila-Bila': 'Kalinga',
  'Naguillian': 'Kalinga', 'Ud-udiao': 'Kalinga', 'Villa Conchita': 'Kalinga', 'Ay-yeng Manabo': 'Kalinga',
  'Dao-angan': 'Kalinga', 'Kilong-olao': 'Kalinga', 'Bao-yan': 'Kalinga', 'Amti': 'Kalinga', 'Danac': 'Kalinga',
  'Bengued': 'Abra', 'Sappaac': 'Abra', 'Saccaang': 'Abra',
  'Baguio': 'Benguet',
  'Santiago City': 'Isabela',
  'Dagupan': 'Pangasinan', 'Mangatarem': 'Pangasinan', 'Laoak Langka': 'Pangasinan', 'Orbiztondo': 'Pangasinan',
  'Malasique, Bolaoit': 'Pangasinan', 'Taloyan': 'Pangasinan', 'Binmaley': 'Pangasinan', 'San Carlos': 'Pangasinan',
  'Manaoag': 'Pangasinan', 'Pozorrobio': 'Pangasinan', 'Alcala': 'Pangasinan', 'Pacpaco, San Manuel': 'Pangasinan',
  'Meycauayan City': 'Bulacan', 'San Jose Del Monte': 'Bulacan',
  'Camalig': 'Albay',
  'Victoria': 'Tarlac', 'Bambanaba, Cuyapo': 'Tarlac',
  'Zapote': 'Cavite', 'Valenzuela City': 'Metro Manila', 'Tandang Sora, Quezon City': 'Metro Manila',
  'COA, Quezon City': 'Metro Manila', 'Payatas, Quezon City': 'Metro Manila', 'Malaria, Caloocan': 'Metro Manila',
  'Montalban': 'Rizal',
  'Mandaue': 'Cebu', 'Li-loan': 'Cebu', 'Calero': 'Cebu', 'Compostela': 'Cebu',
  'Butuan City': 'Agusan del Norte', 'RTR': 'Agusan del Norte', 'Jabonga, Bangonay': 'Agusan del Norte',
  'Kasiklan': 'Agusan del Sur', 'San Mateo': 'Agusan del Sur', 'Fatima Kim.13': 'Agusan del Sur',
  'Bayugan': 'Agusan del Sur', 'Ibuan': 'Agusan del Sur', 'Balubo': 'Agusan del Sur', 'Alegria': 'Agusan del Sur',
  'Bonifacio': 'Agusan del Sur', 'Matin-ao': 'Agusan del Sur', 'Ipil': 'Agusan del Sur', 'Kinabigtasan Tago': 'Surigao del Sur'
};

const getProvince = (comm) => COMMUNITY_TO_PROVINCE_MAP[comm] || 'Other Provinces';

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

  const allProvinces = useMemo(() => {
    const set = new Set(BASE_COMMUNITIES.map(getProvince));
    return Array.from(set).sort();
  }, []);

  const [topLimit, setTopLimit] = useState('10');
  const [chartType, setChartType] = useState('bar');
  const [selectedProvinces, setSelectedProvinces] = useState(() => new Set(allProvinces));
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 400);
  
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

  const filteredProvinces = useMemo(() => {
    return allProvinces.filter(p => p.toLowerCase().includes(debouncedSearch.toLowerCase()));
  }, [debouncedSearch, allProvinces]);

  const toggleProvince = (prov) => {
    const next = new Set(selectedProvinces);
    if (next.has(prov)) next.delete(prov);
    else next.add(prov);
    setSelectedProvinces(next);
  };

  const selectAll = () => {
    const next = new Set(selectedProvinces);
    filteredProvinces.forEach(p => next.add(p));
    setSelectedProvinces(next);
  };

  const clearAll = () => {
    const next = new Set(selectedProvinces);
    filteredProvinces.forEach(p => next.delete(p));
    setSelectedProvinces(next);
  };

  const chartData = useMemo(() => {
    let list = allCommunities.filter(c => selectedProvinces.has(getProvince(c.name)));
    if (topLimit === '10') return list.slice(0, 10);
    if (topLimit === '20') return list.slice(0, 20);
    return list;
  }, [selectedProvinces, allCommunities, topLimit]);

  const toggleDropdown = () => setDropdownOpen(!dropdownOpen);

  return (
    <div className="bg-white dark:bg-[#1E2130] rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm p-4 flex flex-col h-full relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div>
          <span className="m-0 font-inter text-sm font-bold text-slate-900 dark:text-white block">Donations by community</span>
          <span className="font-inter text-xs text-slate-500 dark:text-slate-400">Total funds raised per location</span>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Top Limit Selector */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#161922] p-1 rounded-lg border border-slate-200 dark:border-white/5">
            <button 
              className={`px-2.5 py-1 rounded-md text-xs font-semibold font-inter transition-all cursor-pointer border-none ${topLimit === '10' ? 'bg-white dark:bg-[#1E2130] text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-white/10' : 'bg-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'}`} 
              onClick={() => setTopLimit('10')}
            >
              Top 10
            </button>
            <button 
              className={`px-2.5 py-1 rounded-md text-xs font-semibold font-inter transition-all cursor-pointer border-none ${topLimit === '20' ? 'bg-white dark:bg-[#1E2130] text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-white/10' : 'bg-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'}`} 
              onClick={() => setTopLimit('20')}
            >
              Top 20
            </button>
            <button 
              className={`px-2.5 py-1 rounded-md text-xs font-semibold font-inter transition-all cursor-pointer border-none ${topLimit === 'all' ? 'bg-white dark:bg-[#1E2130] text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-white/10' : 'bg-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'}`} 
              onClick={() => setTopLimit('all')}
            >
              All
            </button>
          </div>

          <div className="relative" ref={dropdownRef}>
            <button className="h-9 px-3 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-slate-700 dark:text-slate-300 font-inter text-sm font-medium flex items-center gap-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 transition-colors" onClick={toggleDropdown}>
              <Filter size={14} />
              Filter
              <span className="bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 px-1.5 py-0.5 rounded text-[10px] font-bold">{selectedProvinces.size === allProvinces.length ? 'All' : selectedProvinces.size}</span>
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-11 w-[300px] bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 shadow-xl rounded-xl p-4 flex flex-col gap-3 z-50">
                <input 
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-sm font-inter text-slate-800 dark:text-white outline-none focus:border-blue-500" 
                  type="text" 
                  placeholder="Search province..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-white/5 pb-2">
                  <button className="text-xs font-inter font-medium text-blue-600 hover:text-blue-700 bg-transparent border-none cursor-pointer" onClick={selectAll}>Select all</button>
                  <button className="text-xs font-inter font-medium text-blue-600 hover:text-blue-700 bg-transparent border-none cursor-pointer" onClick={clearAll}>Clear all</button>
                  <span className="text-[11px] font-inter text-slate-400">{filteredProvinces.length} provinces</span>
                </div>
                <div className="max-h-[200px] overflow-y-auto custom-scrollbar flex flex-col gap-1 pr-1">
                  {filteredProvinces.map(prov => (
                    <label key={prov} className="flex items-center justify-between gap-2 px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-white/5 rounded-md cursor-pointer">
                      <div className="flex items-center gap-2 truncate">
                        <input type="checkbox" checked={selectedProvinces.has(prov)} onChange={() => toggleProvince(prov)} />
                        <span className="font-inter text-[13px] text-slate-700 dark:text-slate-300 truncate" title={prov}>{prov}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#161922] p-1 rounded-lg border border-slate-200 dark:border-white/5">
            <button 
              className={`px-3 py-1 rounded-md text-xs font-semibold font-inter transition-all cursor-pointer border-none ${chartType === 'bar' ? 'bg-white dark:bg-[#1E2130] text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-white/10' : 'bg-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`} 
              onClick={() => setChartType('bar')}
            >
              Bar
            </button>
            <button 
              className={`px-3 py-1 rounded-md text-xs font-semibold font-inter transition-all cursor-pointer border-none ${chartType === 'line' ? 'bg-white dark:bg-[#1E2130] text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-white/10' : 'bg-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`} 
              onClick={() => setChartType('line')}
            >
              Trend
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full min-h-[260px] mt-1">
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm font-inter text-slate-500 dark:text-slate-400 text-center px-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5 border-dashed">No communities selected. Use the filter to choose communities.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'bar' ? (
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#6B7280' }} 
                  interval={0}
                  tickFormatter={(val) => val.length > 10 ? val.substring(0, 8) + '…' : val} 
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(val) => val >= 1000 ? `₱${(val/1000).toFixed(0)}k` : `₱${val}`} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(229, 231, 235, 0.4)' }} />
                <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getColor(index)} />
                  ))}
                </Bar>
              </BarChart>
            ) : (
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#6B7280' }} 
                  interval={0}
                  tickFormatter={(val) => val.length > 10 ? val.substring(0, 8) + '…' : val} 
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(val) => val >= 1000 ? `₱${(val/1000).toFixed(0)}k` : `₱${val}`} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="amount" stroke="#1e3a5f" strokeWidth={2.5} dot={{ r: 4, fill: '#1e3a5f' }} activeDot={{ r: 6 }} />
              </LineChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
