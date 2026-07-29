import React, { useMemo } from 'react';

const INITIAL_DONATION_CATEGORIES = [
  { name: 'General Fund', value: 0, color: '#0D1F45' },
  { name: 'Children\'s Department', value: 0, color: '#1E3A8A' },
  { name: 'Men\'s Department', value: 0, color: '#2563EB' },
  { name: 'Women\'s Department', value: 0, color: '#3B82F6' },
  { name: 'Youth Department', value: 0, color: '#60A5FA' },
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
        fillColor: item.value > 0 ? item.color : '#D1D5DB'
      };
    });
  }, [pieData, pieTotal]);

  const formatK = (num) => num >= 1000 ? `${(num / 1000).toFixed(0)}k` : num;

  return (
    <div className="bg-white dark:bg-[#1E2130] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm p-6 flex flex-col h-full">
      <div className="flex items-center justify-between mb-5">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
          <h3 className="m-0 font-inter text-base font-bold text-slate-900 dark:text-white">Donation Categories</h3>
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
            ₱{(pieTotal || 0).toLocaleString()}
          </span>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-3 overflow-y-auto custom-scrollbar flex-1 pr-2">
        {sortedDonationData.map((item, idx) => {
          const shortName = item.name.replace('Department', 'Dept');
          const displayLabel = `₱${formatK(item.value || 0)} • ${item.percentage}%`;
          return (
            <div key={idx} className="flex items-center gap-3">
              <span className="w-[100px] font-inter text-[13px] font-semibold text-slate-700 dark:text-slate-300 truncate shrink-0">{shortName}</span>
              <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${item.percentage}%`, backgroundColor: item.fillColor }}></div>
              </div>
              <span className="w-[80px] font-inter text-xs text-slate-500 dark:text-slate-400 text-right shrink-0">{displayLabel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
