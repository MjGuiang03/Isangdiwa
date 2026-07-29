import React from 'react';
import { X, Copy, Check } from 'lucide-react';


// You might need to adjust the path to your gcash QR code if you have one
import gcashQr from '../../assets/gcash_qr.png';

export default function DonationInfoModal({ isOpen, onClose }) {
  const [copiedField, setCopiedField] = React.useState('');

  if (!isOpen) return null;

  const handleCopy = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(''), 2000);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="relative w-full max-w-xl bg-white dark:bg-[#1E2130] rounded-2xl p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-white/10 max-h-[90vh] overflow-y-auto my-auto text-left" onClick={(e) => e.stopPropagation()}>
        <button className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white p-2 rounded-full transition-colors" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="text-center mb-6 pt-2">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Give Offering</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Thank you for your generosity. Choose a method below to send your donation.</p>
        </div>

        <div className="space-y-4">
          {/* GCash */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
            <div className="bg-blue-600 text-white px-4 py-2.5 font-bold text-sm">
              <h3>GCash</h3>
            </div>
            <div className="p-4 space-y-3">
              {gcashQr && <img src={gcashQr} alt="GCash QR" className="max-w-[180px] mx-auto mb-3 rounded-lg border border-slate-200 shadow-sm" />}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs py-1 border-b border-slate-200/60 dark:border-white/5">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Name:</span>
                  <span className="text-slate-900 dark:text-white font-bold">IsangDiwa Church</span>
                </div>
                <div className="flex items-center justify-between text-xs py-1">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Number:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-900 dark:text-white font-bold">0912 345 6789</span>
                    <button 
                      className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded transition-colors" 
                      onClick={() => handleCopy('09123456789', 'gcash')}
                      title="Copy GCash Number"
                    >
                      {copiedField === 'gcash' ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Maya */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
            <div className="bg-emerald-600 text-white px-4 py-2.5 font-bold text-sm">
              <h3>Maya</h3>
            </div>
            <div className="p-4 space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs py-1 border-b border-slate-200/60 dark:border-white/5">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Name:</span>
                  <span className="text-slate-900 dark:text-white font-bold">IsangDiwa Church</span>
                </div>
                <div className="flex items-center justify-between text-xs py-1">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Number:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-900 dark:text-white font-bold">0998 765 4321</span>
                    <button 
                      className="p-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded transition-colors" 
                      onClick={() => handleCopy('09987654321', 'maya')}
                      title="Copy Maya Number"
                    >
                      {copiedField === 'maya' ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bank Transfer */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
            <div className="bg-indigo-600 text-white px-4 py-2.5 font-bold text-sm">
              <h3>Bank Transfer</h3>
            </div>
            <div className="p-4 space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs py-1 border-b border-slate-200/60 dark:border-white/5">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Bank:</span>
                  <span className="text-slate-900 dark:text-white font-bold">BDO Unibank</span>
                </div>
                <div className="flex items-center justify-between text-xs py-1 border-b border-slate-200/60 dark:border-white/5">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Account Name:</span>
                  <span className="text-slate-900 dark:text-white font-bold">Philippine United Apostolic Church</span>
                </div>
                <div className="flex items-center justify-between text-xs py-1">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Account Number:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-900 dark:text-white font-bold">0012 3456 7890</span>
                    <button 
                      className="p-1 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded transition-colors" 
                      onClick={() => handleCopy('001234567890', 'bank')}
                      title="Copy Account Number"
                    >
                      {copiedField === 'bank' ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
