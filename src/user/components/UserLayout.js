import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

import Chatbot from './Chatbot';
import NotificationPrompt from '../../components/NotificationPrompt';
import { Bot, Sparkles, X, Menu } from 'lucide-react';

export default function UserLayout() {
  const [chatOpen, setChatOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true' || window.innerWidth < 1024;
  });

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarCollapsed(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="flex min-h-screen bg-background text-foreground transition-colors duration-300">
      <Sidebar 
        collapsed={sidebarCollapsed} 
        setCollapsed={setSidebarCollapsed}
        toggleCollapsed={toggleSidebar}
      />
      
      <div 
        className={`flex-1 min-w-0 transition-[margin] duration-300 ease-in-out bg-background min-h-screen ${
          sidebarCollapsed ? 'md:ml-[72px]' : 'md:ml-[256px]'
        }`}
      >
        {/* Mobile top header bar with fixed sticky hamburger toggle */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-[1000] flex items-center justify-between h-12 px-3.5 bg-white/90 dark:bg-[#101217]/95 backdrop-blur-md border-b border-slate-200/60 dark:border-white/10 shadow-xs">
          <button 
            className="w-9 h-9 rounded-xl bg-slate-100/90 dark:bg-white/10 border border-slate-200/80 dark:border-white/15 text-slate-700 dark:text-white flex items-center justify-center hover:bg-slate-200 dark:hover:bg-white/20 cursor-pointer active:scale-95 transition-all p-0 shadow-xs" 
            onClick={toggleSidebar}
            aria-label="Open sidebar"
          >
            <Menu size={20} className="text-slate-800 dark:text-blue-400" />
          </button>
          <span className="text-xs font-bold text-slate-800 dark:text-white font-inter tracking-tight">
            Isang<span className="text-blue-600 dark:text-[#F5C800]">Diwa</span>
          </span>
          <div className="w-9" /> {/* Spacer for centered title */}
        </div>

        <div className="p-3 pt-16 sm:p-5 md:pt-5 lg:px-6 w-full max-w-[1800px] mx-auto">
          <Outlet />
        </div>
      </div>

      <NotificationPrompt />

      {/* Floating Chat Button */}
      <button
        className={`fixed bottom-6 right-6 z-[990] w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#0D1F45] via-[#162B5B] to-[#1E3A8A] hover:from-[#142E54] hover:to-[#25469C] text-white flex items-center justify-center shadow-lg shadow-[#0D1F45]/40 hover:shadow-blue-900/50 hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer border border-white/20 group ${
          chatOpen ? 'rotate-90 !from-slate-800 !to-slate-900 shadow-slate-900/20' : ''
        }`}
        onClick={() => setChatOpen(prev => !prev)}
        aria-label={chatOpen ? 'Close chat' : 'Open chat'}
        title={chatOpen ? 'Close chat' : 'Chat with IsangDiwa Chatbot'}
      >
        {/* Glow halo underlay */}
        <span className="absolute inset-0 rounded-2xl bg-[#1E3A8A]/30 blur-md group-hover:blur-lg transition-all" />

        {/* AI Pulsing Online Indicator Badge (only when closed) */}
        {!chatOpen && (
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white dark:border-[#1E2130]" />
          </span>
        )}

        <div className="relative z-10 flex items-center justify-center">
          {chatOpen ? (
            <X size={22} color="white" />
          ) : (
            <div className="flex items-center justify-center">
              <Bot size={24} className="text-white group-hover:rotate-12 transition-transform duration-300" />
              <Sparkles size={12} className="absolute -top-1 -right-1.5 text-[#F5C800] animate-pulse" />
            </div>
          )}
        </div>
      </button>

      {/* Chatbot */}
      <Chatbot isOpen={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
