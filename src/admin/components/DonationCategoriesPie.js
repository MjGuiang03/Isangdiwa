import React, { useMemo } from 'react';

const INITIAL_DONATION_CATEGORIES = [
  { name: 'General Fund', value: 0, color: '#0F172A' },
  { name: "Children's Department", value: 0, color: '#1E3A8A' },
  { name: "Men's Department", value: 0, color: '#2563EB' },
  { name: "Women's Department", value: 0, color: '#3B82F6' },
  { name: "Youth Department", value: 0, color: '#60A5FA' },
  { name: 'Mission Fund', value: 0, color: '#93C5FD' },
];

export default function DonationCategoriesPie({ categoryBreakdown = {} }) {
  const pieData = useMemo(() => {
    return INITIAL_DONATION_CATEGORIES.map(cat => ({
      ...cat,
      value: categoryBreakdown[cat.name] || 0
    }));
  }, [categoryBreakdown]);

  const pieTotal = pieData.reduce((sum, item) => sum + (item.value || 0), 0);

  const sortedDonationData = useMemo(() => {
    return [...pieData].sort((a, b) => b.value - a.value).map(item => {
      const percentage = pieTotal > 0 ? ((item.value / pieTotal) * 100).toFixed(1) : 0;
      return {
        ...item,
        percentage,
        displayLabel: `₱${(item.value || 0).toLocaleString()} (${percentage}%)`,
        fillColor: item.value > 0 ? item.color : '#CBD5E1'
      };
    });
  }, [pieData, pieTotal]);

  const formatK = (num) => (num >= 1000000 ? `₱${(num / 1000000).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')}M` : num >= 1000 ? `₱${(num / 1000).toFixed(0)}k` : `₱${num}`);

  return (
    <div className="bg-white dark:bg-[#1E2130] rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm p-4 flex flex-col h-full justify-between">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div>
          <h3 className="m-0 font-inter text-sm font-bold text-slate-900 dark:text-white tracking-tight">Donation Categories</h3>
          <p className="m-0 font-inter text-xs text-slate-500 dark:text-slate-400 mt-0.5">Fund breakdown</p>
        </div>
        <span className="px-3 py-1.5 rounded-full text-xs font-extrabold tracking-wide bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-500/20">
          ₱{(pieTotal || 0).toLocaleString()}
        </span>
      </div>

      {/* Category List filling vertical space evenly */}
      <div className="flex flex-col flex-1 justify-between gap-2 my-0.5">
        {sortedDonationData.map((item, idx) => {
          const shortName = item.name.replace('Department', 'Dept');
          return (
            <div
              key={idx}
              className="group flex flex-col justify-center px-3 py-2 rounded-lg bg-slate-50/70 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 hover:border-blue-200 dark:hover:border-blue-500/30 transition-all duration-200"
            >
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: item.fillColor }} />
                  <span className="font-inter text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                    {shortName}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-inter text-xs font-bold text-slate-900 dark:text-white">
                    {formatK(item.value || 0)}
                  </span>
                  <span className="font-inter text-xs font-semibold text-slate-500 dark:text-slate-400">
                    • {item.percentage}%
                  </span>
                </div>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200/60 dark:bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 group-hover:brightness-110"
                  style={{ width: `${Math.max(item.percentage, 2)}%`, backgroundColor: item.fillColor }}
                />
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
