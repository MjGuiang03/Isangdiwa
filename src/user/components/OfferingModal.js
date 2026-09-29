import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Landmark, Wallet, CheckCircle2 } from 'lucide-react';
import puacLogo from '../../assets/optimized/puaclogo.webp';
import gcashQr from '../../assets/optimized/gcash_qr.webp';
import gcashLogo from '../../assets/optimized/gcashlogo.webp';

export default function OfferingModal({ isOpen, onClose, onOpenLogin, onOpenSignup }) {
  const [activeTab, setActiveTab] = useState('gcash'); // 'gcash' | 'bank'
  const [copiedField, setCopiedField] = useState(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopy = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div 
      className="fixed inset-0 z-[10000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-[#0E254A] text-white shrink-0">
          <div className="flex items-center gap-3">
            <img src={puacLogo} alt="PUAC Logo" className="w-9 h-9 object-contain" />
            <div>
              <h3 className="font-outfit text-base sm:text-lg font-bold text-white m-0 leading-tight">
                Church Giving &amp; Offering
              </h3>
              <p className="text-[11px] text-amber-300 font-medium m-0">
                Philippine United Apostolic Church
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-100 shrink-0">
          <div className="grid grid-cols-2 gap-2 bg-slate-200/70 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => setActiveTab('gcash')}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'gcash'
                  ? 'bg-white text-[#0E254A] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Wallet size={15} className="text-blue-500" />
              <span>GCash / E-Wallet</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('bank')}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'bank'
                  ? 'bg-white text-[#0E254A] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Landmark size={15} className="text-indigo-600" />
              <span>Bank Transfer (BDO)</span>
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-slate-700 font-inter text-xs">
          
          {activeTab === 'gcash' ? (
            <div className="space-y-4">
              {/* QR Code Container */}
              <div className="flex flex-col sm:flex-row items-center gap-5 bg-blue-50/60 border border-blue-100 rounded-2xl p-4">
                <div className="bg-white p-2.5 rounded-2xl shadow-sm border border-slate-200 shrink-0 flex flex-col items-center">
                  <img 
                    src={gcashQr} 
                    alt="PUAC GCash QR Code" 
                    className="w-36 h-36 sm:w-40 sm:h-40 object-contain rounded-lg"
                  />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1.5 flex items-center gap-1">
                    Scan with GCash
                  </span>
                </div>

                <div className="space-y-3 flex-1 w-full">
                  <div className="flex items-center gap-2">
                    <img src={gcashLogo} alt="GCash" className="h-5 object-contain" />
                    <span className="font-bold text-slate-900 text-sm">Official GCash Account</span>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1">
                    <span className="text-[10.5px] text-slate-400 block font-medium">Account Name</span>
                    <span className="text-xs font-bold text-slate-800 block">IsangDiwa Church</span>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1">
                    <span className="text-[10.5px] text-slate-400 block font-medium">GCash Number</span>
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-900 text-sm">0912 345 6789</span>
                      <button
                        type="button"
                        onClick={() => handleCopy('09123456789', 'gcash')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 font-bold text-[11px] transition-colors cursor-pointer"
                      >
                        {copiedField === 'gcash' ? (
                          <>
                            <Check size={12} className="text-emerald-600" />
                            <span className="text-emerald-600">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2">
                <span className="font-bold text-slate-800 block text-xs">
                  How to send your offering:
                </span>
                <ol className="list-decimal pl-4 space-y-1.5 text-[11.5px] text-slate-600 leading-relaxed m-0">
                  <li>Open your <strong>GCash app</strong> and tap <strong>QR</strong> to scan the code, or send money directly to <strong>0912 345 6789</strong>.</li>
                  <li>Enter your offering amount.</li>
                  <li>In the <strong>Message / Notes</strong> field, write your name and intended ministry (e.g. <em>Missions, Youth, General Fund</em>).</li>
                  <li>Save a screenshot of your transfer receipt for your personal record.</li>
                </ol>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm">
                  <Landmark size={18} className="text-indigo-600" />
                  <span>Official Church Bank Account</span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[10.5px] text-slate-400 block font-medium">Bank Name</span>
                  <span className="text-xs font-bold text-slate-800 block">BDO Unibank</span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[10.5px] text-slate-400 block font-medium">Account Name</span>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Philippine United Apostolic Church</span>
                    <button
                      type="button"
                      onClick={() => handleCopy('Philippine United Apostolic Church', 'accName')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 font-bold text-[11px] transition-colors cursor-pointer"
                    >
                      {copiedField === 'accName' ? (
                        <>
                          <Check size={12} className="text-emerald-600" />
                          <span className="text-emerald-600">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[10.5px] text-slate-400 block font-medium">Account Number</span>
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-900 text-sm">0012 3456 7890</span>
                    <button
                      type="button"
                      onClick={() => handleCopy('001234567890', 'accNum')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 font-bold text-[11px] transition-colors cursor-pointer"
                    >
                      {copiedField === 'accNum' ? (
                        <>
                          <Check size={12} className="text-emerald-600" />
                          <span className="text-emerald-600">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Bank Instructions */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2">
                <span className="font-bold text-slate-800 block text-xs">
                  How to transfer via Online Banking or Over-the-Counter:
                </span>
                <ol className="list-decimal pl-4 space-y-1.5 text-[11.5px] text-slate-600 leading-relaxed m-0">
                  <li>Send your offering via InstaPay, PESONet, or direct BDO deposit to the account details above.</li>
                  <li>Include your name and designated ministry fund in the transfer remarks.</li>
                  <li>Save your transaction reference number or confirmation email.</li>
                </ol>
              </div>
            </div>
          )}

          {/* Ministry Funds Note */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
              Available Ministry Funds:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {['General Church Fund', 'Mission & Outreach', 'Youth Department', "Children's Dept", "Men's Dept", "Women's Dept"].map(f => (
                <span key={f} className="text-[11px] font-semibold bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded-md">
                  {f}
                </span>
              ))}
            </div>
          </div>

          {/* Member Portal Banner */}
          <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 space-y-2">
            <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
              <CheckCircle2 size={15} className="text-amber-600 shrink-0" />
              <span>Want an official verified digital receipt?</span>
            </div>
            <p className="text-[11.5px] text-amber-950/80 leading-relaxed m-0">
              Members with an IsangDiwa account can upload transfer receipts to have donations verified by church treasurers and tracked permanently in their personal giving ledger.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => { onClose(); onOpenLogin(); }}
                className="px-3.5 py-1.5 bg-[#0E254A] hover:bg-[#142E54] text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
              >
                Sign In to Account
              </button>
              <button
                type="button"
                onClick={() => { onClose(); onOpenSignup(); }}
                className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
              >
                Register as Member
              </button>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between text-slate-500 text-[11px] shrink-0">
          <span>Philippine United Apostolic Church · Stewardship</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}

