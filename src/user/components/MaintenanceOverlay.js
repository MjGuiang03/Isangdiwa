import { Wrench, RefreshCw, AlertTriangle } from 'lucide-react';

export default function MaintenanceOverlay() {
  return (
    <div className="fixed inset-0 z-[99999] bg-[#0D0F14] text-white flex flex-col items-center justify-center p-6 text-center font-inter animate-fadeIn">
      {/* Background radial glow */}
      <div className="absolute w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center max-w-md">
        <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-6 shadow-2xl shadow-amber-500/10">
          <Wrench size={38} className="animate-pulse" />
        </div>
        
        <span className="px-3.5 py-1.5 rounded-full bg-amber-500/15 text-amber-300 text-[11px] font-bold uppercase tracking-wider mb-4 border border-amber-500/30 flex items-center gap-1.5">
          <AlertTriangle size={14} /> Scheduled Maintenance Mode
        </span>

        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-3 text-white">
          System Under Maintenance
        </h1>
        
        <p className="text-xs sm:text-sm text-slate-400 mb-8 leading-relaxed">
          The IsangDiwa Member Portal is currently undergoing system updates and routine database maintenance. Access for regular members is temporarily restricted.
        </p>

        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-lg flex items-center gap-2 cursor-pointer active:scale-95 border border-blue-400/30"
        >
          <RefreshCw size={16} /> Check System Status
        </button>

        <p className="text-[11px] text-slate-500 mt-6">
          If you are an administrator, please log in through the Admin Portal.
        </p>
      </div>
    </div>
  );
}
