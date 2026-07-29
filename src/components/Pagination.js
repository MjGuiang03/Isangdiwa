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
    itemName = 'items'
}) {
    if (totalPages <= 1) return null;

    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    return (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6 p-4 bg-white dark:bg-[#1E2130] rounded-xl border border-slate-200 dark:border-white/5 shadow-sm shrink-0">
            {totalItems > 0 ? (
                <span className="text-sm text-slate-500 dark:text-slate-400 font-inter">
                    Showing {startItem}–{endItem} of {totalItems} {itemName}
                </span>
            ) : (
                <span className="text-sm text-slate-500 dark:text-slate-400 font-inter">
                    Page {currentPage} of {totalPages}
                </span>
            )}
            
            <div className="flex items-center gap-2">
                <button
                    className="px-3 py-1.5 border border-slate-200 dark:border-white/10 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-[#1E2130] hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                >
                    ← Prev
                </button>
                
                {generatePagination(currentPage, totalPages).map((page, idx) => (
                    page === '...' ? (
                        <span key={`ellipsis-${idx}`} className="px-2 text-slate-400 dark:text-slate-500">...</span>
                    ) : (
                        <button
                            key={idx}
                            className={`w-8 h-8 flex items-center justify-center p-0 border border-slate-200 dark:border-white/10 rounded-lg text-sm font-medium transition-colors cursor-pointer ${currentPage === page ? 'bg-navy text-white border-navy dark:bg-[#0D1F45] dark:border-[#0D1F45] dark:text-white' : 'text-slate-600 dark:text-slate-300 bg-white dark:bg-[#1E2130] hover:bg-slate-50 dark:hover:bg-white/5'}`}
                            onClick={() => onPageChange(page)}
                        >
                            {page}
                        </button>
                    )
                ))}
                
                <button
                    className="px-3 py-1.5 border border-slate-200 dark:border-white/10 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-[#1E2130] hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                >
                    Next →
                </button>
            </div>
        </div>
    );
}
