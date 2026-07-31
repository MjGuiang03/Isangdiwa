import React from 'react';

/**
 * Standardized PageHeader component for Loan Admin pages.
 * Ensures consistent typography, spacing, and styling across all sub-pages.
 */
export default function PageHeader({ title, subtitle, rightElement, className = '' }) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 ${className}`}>
      <div className="flex flex-col gap-1">
        <h1 className="font-inter text-2xl font-bold text-slate-900 dark:text-white m-0 tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="font-inter text-sm text-slate-500 dark:text-slate-400 m-0 font-normal">
            {subtitle}
          </p>
        )}
      </div>
      {rightElement && (
        <div className="flex items-center gap-3 shrink-0">
          {rightElement}
        </div>
      )}
    </div>
  );
}
