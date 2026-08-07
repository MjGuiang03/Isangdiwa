import React from 'react';

const generatePagination = (currentPage, totalPages) => {
    if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 4) {
        return [1, 2, 3, 4, 5, '...', totalPages];
    }
    if (currentPage >= totalPages - 3) {
        return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
};

export default function Pagination({
    currentPage,
    totalPages,
    onPageChange,
    totalItems = 0,
    itemsPerPage = 10,
    itemName = 'items',
    embedded = false
}) {
    if (totalItems === 0 && (!totalPages || totalPages < 1)) return null;

    const effectiveTotalPages = Math.max(1, totalPages || 1);
    const startItem = totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    const containerClasses = embedded
        ? "flex flex-col sm:flex-row justify-between items-center gap-3 px-4 py-3 bg-white dark:bg-[#1E2130] border-t border-slate-200/80 dark:border-white/10 shrink-0"
        : "flex flex-col sm:flex-row justify-between items-center gap-3 mt-1 px-4 py-2 bg-white dark:bg-[#1E2130] rounded-xl border border-slate-200/80 dark:border-white/10 shadow-sm shrink-0";

    return (
        <div className={containerClasses}>
            {totalItems > 0 ? (
                <span className="text-[13px] font-medium text-slate-500 dark:text-slate-400 font-inter">
                    Showing {startItem}–{endItem} of {totalItems} {itemName}
                </span>
            ) : (
                <span className="text-[13px] font-medium text-slate-500 dark:text-slate-400 font-inter">
                    Page {currentPage} of {effectiveTotalPages}
                </span>
            )}
            
            <div className="flex items-center gap-1.5">
                <button
                    className="px-2.5 py-1 border border-slate-200 dark:border-white/10 rounded-lg text-[12px] font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-[#1E2130] hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                >
                    ← Prev
                </button>
                
                {generatePagination(currentPage, effectiveTotalPages).map((page, idx) => (
                    page === '...' ? (
                        <span key={`ellipsis-${idx}`} className="px-1.5 text-xs text-slate-400 dark:text-slate-500">...</span>
                    ) : (
                        <button
                            key={idx}
                            className={`w-7 h-7 flex items-center justify-center p-0 border border-slate-200 dark:border-white/10 rounded-lg text-[12px] font-semibold transition-colors cursor-pointer ${currentPage === page ? 'bg-navy text-white border-navy dark:bg-[#0D1F45] dark:border-[#0D1F45] dark:text-white' : 'text-slate-600 dark:text-slate-300 bg-white dark:bg-[#1E2130] hover:bg-slate-50 dark:hover:bg-white/5'}`}
                            onClick={() => onPageChange(page)}
                        >
                            {page}
                        </button>
                    )
                ))}
                
                <button
                    className="px-2.5 py-1 border border-slate-200 dark:border-white/10 rounded-lg text-[12px] font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-[#1E2130] hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    onClick={() => onPageChange(Math.min(effectiveTotalPages, currentPage + 1))}
                    disabled={currentPage >= effectiveTotalPages}
                >
                    Next →
                </button>
            </div>
        </div>
    );
}
