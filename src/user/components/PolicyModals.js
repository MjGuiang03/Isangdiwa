import React from 'react';
import { X } from 'lucide-react';

export function TermsModal({ isOpen, onClose, onAgree }) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150" 
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-xl bg-white dark:bg-[#1E2130] rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col max-h-[85vh] overflow-hidden" 
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#1E2130] shrink-0">
          <h3 className="font-bold text-slate-900 dark:text-white text-base">Terms and Conditions</h3>
          <button 
            type="button"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer" 
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
          <ol className="list-decimal pl-5 space-y-4">
            <li>
              <strong className="text-slate-900 dark:text-slate-100 font-semibold block text-xs">Acceptance of Terms</strong>
              <p className="mt-1 text-slate-600 dark:text-slate-400">By accessing and using IsangDiwa, a loan management system developed for the Philippine United Apostolic Church, you agree to comply with and be bound by these Terms and Conditions. If you do not agree, you must discontinue use of the system.</p>
            </li>
            <li>
              <strong className="text-slate-900 dark:text-slate-100 font-semibold block text-xs">Purpose of the System</strong>
              <p className="mt-1 text-slate-600 dark:text-slate-400">IsangDiwa is designed to facilitate transparent and accountable management of church-related loan applications, approvals, payments, and member records in support of responsible financial stewardship.</p>
            </li>
            <li>
              <strong className="text-slate-900 dark:text-slate-100 font-semibold block text-xs">Authorized Users</strong>
              <p className="mt-1 text-slate-600 dark:text-slate-400">Only registered and approved church members, officers, and administrators are permitted to access IsangDiwa. Access rights are assigned based on user roles defined by church authorities.</p>
            </li>
            <li>
              <strong className="text-slate-900 dark:text-slate-100 font-semibold block text-xs">User Responsibilities</strong>
              <p className="mt-1 text-slate-600 dark:text-slate-400">Users are responsible for maintaining the confidentiality of their login credentials and for all activities performed under their accounts. Any unauthorized use must be reported immediately.</p>
            </li>
            <li>
              <strong className="text-slate-900 dark:text-slate-100 font-semibold block text-xs">Loan Application and Approval</strong>
              <p className="mt-1 text-slate-600 dark:text-slate-400">Submitting a loan application through IsangDiwa does not guarantee approval. All loan requests are subject to review, verification, and approval by authorized church officers in accordance with church policies.</p>
            </li>
            <li>
              <strong className="text-slate-900 dark:text-slate-100 font-semibold block text-xs">Loan Terms, Interest, and Penalties</strong>
              <p className="mt-1 text-slate-600 dark:text-slate-400">Approved loans are governed by agreed terms, including loan amount, repayment schedule, interest rates, and applicable penalties for late payments. These details are displayed within the system and serve as the official reference.</p>
            </li>
            <li>
              <strong className="text-slate-900 dark:text-slate-100 font-semibold block text-xs">Payments and Monitoring</strong>
              <p className="mt-1 text-slate-600 dark:text-slate-400">Borrowers are responsible for making payments on or before the due dates shown in IsangDiwa. The system provides automated monitoring of balances, payment history, and loan status for reference purposes.</p>
            </li>
            <li>
              <strong className="text-slate-900 dark:text-slate-100 font-semibold block text-xs">AI Assistance Disclaimer</strong>
              <p className="mt-1 text-slate-600 dark:text-slate-400">IsangDiwa may include an AI-powered chatbot (IsangDiwa Chatbot) to assist with inquiries related to loan status, payment schedules, and system navigation. The chatbot provides informational support only and does not replace official decisions made by church authorities.</p>
            </li>
            <li>
              <strong className="text-slate-900 dark:text-slate-100 font-semibold block text-xs">Prohibited Use</strong>
              <p className="mt-1 text-slate-600 dark:text-slate-400">Users shall not misuse the system, attempt unauthorized access, manipulate records, or engage in activities that compromise the security or integrity of IsangDiwa.</p>
            </li>
            <li>
              <strong className="text-slate-900 dark:text-slate-100 font-semibold block text-xs">Termination of Access</strong>
              <p className="mt-1 text-slate-600 dark:text-slate-400">The church reserves the right to suspend or terminate access to IsangDiwa for violations of these Terms and Conditions or other valid administrative reasons.</p>
            </li>
            <li>
              <strong className="text-slate-900 dark:text-slate-100 font-semibold block text-xs">Limitation of Liability</strong>
              <p className="mt-1 text-slate-600 dark:text-slate-400">IsangDiwa is provided for administrative support purposes only. The church shall not be held liable for any direct or indirect damages arising from the use or inability to use the system.</p>
            </li>
            <li>
              <strong className="text-slate-900 dark:text-slate-100 font-semibold block text-xs">Governing Principles</strong>
              <p className="mt-1 text-slate-600 dark:text-slate-400">IsangDiwa operates under the principles of faith, integrity, transparency, accountability, and responsible stewardship in alignment with church values.</p>
            </li>
          </ol>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200/80 dark:border-white/10 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={() => {
              if (onAgree) onAgree();
              onClose();
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-semibold rounded-xl text-xs transition-all shadow-xs cursor-pointer"
          >
            {onAgree ? 'I Agree & Close' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PrivacyModal({ isOpen, onClose, onAgree }) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150" 
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-xl bg-white dark:bg-[#1E2130] rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col max-h-[85vh] overflow-hidden" 
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#1E2130] shrink-0">
          <h3 className="font-bold text-slate-900 dark:text-white text-base">Privacy Policy</h3>
          <button 
            type="button"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer" 
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
          <ol className="list-decimal pl-5 space-y-4">
            <li>
              <strong className="text-slate-900 dark:text-slate-100 font-semibold block text-xs">Data Collection</strong>
              <p className="mt-1 text-slate-600 dark:text-slate-400">IsangDiwa collects personal information such as names, contact details, loan records, payment history, and system usage data necessary for loan management and administrative purposes.</p>
            </li>
            <li>
              <strong className="text-slate-900 dark:text-slate-100 font-semibold block text-xs">Use of Information</strong>
              <p className="mt-1 text-slate-600 dark:text-slate-400">Collected information is used solely to process loan applications, monitor payments, maintain records, provide system support, and improve IsangDiwa services.</p>
            </li>
            <li>
              <strong className="text-slate-900 dark:text-slate-100 font-semibold block text-xs">Data Protection and Security</strong>
              <p className="mt-1 text-slate-600 dark:text-slate-400">IsangDiwa implements reasonable administrative, technical, and organizational measures to protect personal data against unauthorized access, alteration, disclosure, or loss.</p>
            </li>
            <li>
              <strong className="text-slate-900 dark:text-slate-100 font-semibold block text-xs">Data Privacy Compliance</strong>
              <p className="mt-1 text-slate-600 dark:text-slate-400">All personal data is processed in accordance with the Data Privacy Act of 2012 (Republic Act No. 10173) and its implementing rules and regulations.</p>
            </li>
            <li>
              <strong className="text-slate-900 dark:text-slate-100 font-semibold block text-xs">Data Sharing</strong>
              <p className="mt-1 text-slate-600 dark:text-slate-400">Personal information shall not be shared with third parties except when required by law or authorized by church administration for official purposes.</p>
            </li>
            <li>
              <strong className="text-slate-900 dark:text-slate-100 font-semibold block text-xs">User Rights</strong>
              <p className="mt-1 text-slate-600 dark:text-slate-400">Users have the right to access, correct, and request updates to their personal information in accordance with applicable data privacy laws.</p>
            </li>
            <li>
              <strong className="text-slate-900 dark:text-slate-100 font-semibold block text-xs">Data Retention</strong>
              <p className="mt-1 text-slate-600 dark:text-slate-400">Personal data is retained only for as long as necessary to fulfill the purposes of the system or as required by church policy and applicable laws.</p>
            </li>
            <li>
              <strong className="text-slate-900 dark:text-slate-100 font-semibold block text-xs">Changes to the Privacy Policy</strong>
              <p className="mt-1 text-slate-600 dark:text-slate-400">The church reserves the right to update this Privacy Policy as needed. Users will be informed of significant changes, and continued use of IsangDiwa constitutes acceptance of the updated policy.</p>
            </li>
            <li>
              <strong className="text-slate-900 dark:text-slate-100 font-semibold block text-xs">Contact Information</strong>
              <p className="mt-1 text-slate-600 dark:text-slate-400">For questions or concerns regarding these Terms and Conditions or the Privacy Policy, users may contact the church administration through official communication channels.</p>
            </li>
          </ol>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200/80 dark:border-white/10 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={() => {
              if (onAgree) onAgree();
              onClose();
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-semibold rounded-xl text-xs transition-all shadow-xs cursor-pointer"
          >
            {onAgree ? 'I Agree & Close' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}

