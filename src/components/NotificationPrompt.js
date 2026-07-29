import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import {
  shouldShowPromptBanner,
  requestNotificationPermission,
  dismissPromptForever,
} from '../utils/desktopNotify';
export default function NotificationPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Small delay so it appears after the page loads, not instantly
    const timer = setTimeout(() => {
      if (shouldShowPromptBanner()) {
        setVisible(true);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  const handleAllow = async () => {
    await requestNotificationPermission();
    setVisible(false);
  };

  const handleDismiss = () => {
    setVisible(false);
  };

  const handleDontShowAgain = () => {
    dismissPromptForever();
    setVisible(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-[99999] bg-white dark:bg-[#1E2130] border border-slate-200 dark:border-white/10 rounded-xl p-4 pr-12 w-[440px] max-w-[calc(100vw-48px)] shadow-xl animate-fadeIn transition-all">
      <div className="flex items-center gap-3 mb-3.5">
        <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center shrink-0">
          <Bell className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-inter text-sm font-semibold text-slate-900 dark:text-slate-100 m-0 mb-0.5">
            Enable Desktop Notifications
          </p>
          <p className="font-inter text-xs text-slate-500 dark:text-slate-400 m-0 leading-relaxed">
            Get real-time alerts for new activities, even when this tab is in the background.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
        <button
          className="font-inter text-xs font-semibold bg-primary hover:bg-blue-700 text-white rounded-md px-4 py-2 transition-colors cursor-pointer border-none"
          onClick={handleAllow}
        >
          Allow Notifications
        </button>
        <button
          className="font-inter text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md px-4 py-2 transition-colors cursor-pointer border-none"
          onClick={handleDismiss}
        >
          Later
        </button>
        <button
          className="font-inter text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 bg-transparent px-2.5 py-2 transition-colors cursor-pointer border-none sm:ml-auto"
          onClick={handleDontShowAgain}
        >
          Don't show again
        </button>
      </div>
      <button
        className="absolute top-3 right-3 bg-transparent border-none cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center"
        onClick={handleDismiss}
        aria-label="Close"
      >
        <X size={16} />
      </button>
    </div>
  );
}
