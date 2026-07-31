import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';

import { Send, X, Sparkles, Bot } from 'lucide-react';
import API from '../../utils/api';


/* ─────────────────────────────────────────────
   Fallback Knowledge Base (used when AI is unavailable)
───────────────────────────────────────────── */
const KB_SHARED = [
  {
    patterns: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'kumusta', 'magandang umaga', 'magandang hapon'],
    responses: ["Hello! 👋 I'm IsangDiwa Chatbot, your AI assistant. How can I help you today?"],
    quickReplies: ['Donations', 'Savings', 'Attendance', 'Branches']
  },
  {
    patterns: ['savings', 'save', 'ipon', 'savings goal'],
    responses: ["🏦 **Savings:**\n\nYou can set personal savings goals, track progress, and deposit via Manual — upload proof and your admin will confirm.\n\nGo to **Savings** to manage your goals."],
    quickReplies: ['Donations', 'Attendance']
  },
  {
    patterns: ['donat', 'donation', 'donate', 'giving', 'tithe', 'offering', 'handog', 'ikapu'],
    responses: ["❤️ **Donations** are open to all members!\n\n**Categories:** General Fund, Children's Dept, Men's Dept, Women's Dept, Youth Dept, Mission Fund\n\n**Payment method:** Manual — Cash or Bank Transfer. Upload proof of payment and your admin will confirm it.\n\nGo to **Donations** → choose category → enter amount → upload proof."],
    quickReplies: ['Attendance', 'Branches']
  },
  {
    patterns: ['attendance', 'attend', 'check in', 'presensya'],
    responses: ["📅 Attendance is recorded by administrators via **manual entry** or **RFID tap**.\n\nYou cannot log your own attendance. View your history on the **Attendance** page or your Home dashboard."],
    quickReplies: ['Branches', 'Donations']
  },
  {
    patterns: ['branch', 'location', 'address', 'simbahan', 'church', 'community', 'how many'],
    responses: ["🏛️ PUAC has **68 branches** across the Philippines with over **3,400 members**. Visit the **Branches** page to find locations, contact info, and service schedules."],
    quickReplies: ['Attendance', 'Donations']
  },
  {
    patterns: ['settings', 'profile', 'password', 'account', 'update profile'],
    responses: ["👤 To view or update your profile, click your **name or avatar on the sidebar** — it will take you to your profile page where you can edit your info and change your password."],
    quickReplies: ['Donations', 'Savings', 'Attendance']
  },
  {
    patterns: ['notification', 'alert', 'updates', 'abiso'],
    responses: ["🔔 **Notifications** keep you updated on:\n- Donation confirmations/rejections\n- Savings updates\n- Attendance records\n\nCheck the **Notifications** page for all updates."],
    quickReplies: ['Donations', 'Savings', 'Attendance']
  },
  {
    patterns: ['what is isangdiwa', 'about isangdiwa', 'isangdiwa', 'ano ang isangdiwa', 'portal'],
    responses: ["🙏 **IsangDiwa** is the official digital portal of the **Philippine United Apostolic Church**.\n\nAll members can manage donations, savings, attendance, and branches. **Church officers** also get access to loans."],
    quickReplies: ['Donations', 'Savings', 'Attendance']
  },
];

const KB_OFFICER_ONLY = [
  {
    patterns: ['loan', 'loans', 'borrow', 'apply loan', 'utang', 'hulugan', 'pautang'],
    responses: ["💳 **Loan Application:**\n\nGo to **Loans** → **Apply for a Loan** → fill in loan type, amount, and term → upload required documents → submit for admin review."],
    quickReplies: ['Loan statuses', 'Late payment', 'Donations']
  },
  {
    patterns: ['late', 'penalty', 'overdue', 'missed payment', 'late payment'],
    responses: ["⚠️ **Late Payment Penalty:**\nIf a loan payment is not made within **3 days** of the due date, a **3% flat interest penalty** replaces the regular interest for that month.\n\nCheck your due date in the Loan Detail page."],
    quickReplies: ['Loans', 'Loan statuses']
  },
];

const KB_MEMBER_BLOCK = [
  {
    patterns: ['loan', 'loans', 'borrow', 'apply loan', 'utang', 'hulugan', 'pautang',
               'late', 'penalty', 'overdue', 'missed payment', 'late payment'],
    responses: ["🚫 **Loans are only available to church officers.**\n\nAs a regular member, you do not have access to this feature."],
    quickReplies: ['Savings', 'Donations', 'Attendance']
  },
];

function getLocalResponse(input, isOfficer) {
  const normalized = input.toLowerCase().trim();
  const roleKB = isOfficer ? KB_OFFICER_ONLY : KB_MEMBER_BLOCK;
  for (const entry of roleKB) {
    if (entry.patterns.some(p => normalized.includes(p))) {
      return { text: entry.responses[0], quickReplies: entry.quickReplies };
    }
  }
  for (const entry of KB_SHARED) {
    if (entry.patterns.some(p => normalized.includes(p))) {
      return { text: entry.responses[0], quickReplies: entry.quickReplies };
    }
  }
  return null;
}

const INITIAL_MESSAGE = {
  id: 1,
  sender: 'bot',
  text: null,
  greeting: true,
  quickReplies: ['Donations', 'Savings', 'Attendance', 'Branches'],
  timestamp: new Date(),
};

export default function Chatbot({ isOpen, onClose }) {
  const { profile } = useAuth();
  const firstName = profile?.fullName?.split(' ')[0] || 'there';
  const token = localStorage.getItem('token');

  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isOfficer, setIsOfficer] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [isAI, setIsAI] = useState(true);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds(prev => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const sendMessage = async (text) => {
    const userText = text || input.trim();
    if (!userText) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: userText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const history = [...messages, userMsg]
        .filter(m => m.text && !m.greeting)
        .slice(-8)
        .map(m => ({ sender: m.sender, text: m.text }));

      const res = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: userText, history }),
      });

      if (res.status === 429) {
        const errData = await res.json();
        setCooldownSeconds(errData.retryAfterSeconds || 900);
        const botMsg = {
          id: Date.now() + 1,
          sender: 'bot',
          text: `⏳ You've reached the message limit (20 messages per 15 minutes). Please wait for the cooldown to expire before sending more messages.`,
          quickReplies: [],
          isAI: false,
          timestamp: new Date(),
        };
        setIsTyping(false);
        setMessages(prev => [...prev, botMsg]);
        return;
      }

      if (!res.ok) throw new Error('API failed');

      const data = await res.json();

      if (data.success) {
        setIsAI(data.source === 'ai');
        if (data.isOfficer !== undefined) setIsOfficer(data.isOfficer);
        const botMsg = {
          id: Date.now() + 1,
          sender: 'bot',
          text: data.reply,
          quickReplies: data.quickReplies || ['Donations', 'Savings', 'Attendance', 'Branches'],
          isAI: data.source === 'ai',
          timestamp: new Date(),
        };
        setIsTyping(false);
        setMessages(prev => [...prev, botMsg]);
        return;
      }
      throw new Error('API returned failure');
    } catch (err) {
      console.warn('[Chatbot] AI unavailable, using fallback:', err.message);
      const fallback = getLocalResponse(userText, isOfficer);
      const defaultReplies = isOfficer
        ? ['Loans', 'Donations', 'Savings', 'Attendance']
        : ['Donations', 'Savings', 'Attendance', 'Branches'];

      const botMsg = {
        id: Date.now() + 1,
        sender: 'bot',
        text: fallback?.text || "I'm not sure I understand that. Could you try rephrasing?\n\nHere are some things I can help with:",
        quickReplies: fallback?.quickReplies || defaultReplies,
        isAI: false,
        timestamp: new Date(),
      };
      setIsAI(false);
      setIsTyping(false);
      setMessages(prev => [...prev, botMsg]);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const renderInline = (text, keyPrefix) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={`${keyPrefix}-b${i}`}>{part.slice(2, -2)}</strong>;
      }
      return <span key={`${keyPrefix}-s${i}`}>{part}</span>;
    });
  };

  const renderText = (text) => {
    const lines = text.split('\n');
    const elements = [];
    let listItems = [];
    let listType = null;

    const flushList = () => {
      if (listItems.length === 0) return;
      if (listType === 'ol') {
        elements.push(
          <ol key={`ol-${elements.length}`} className="my-1 ml-4 list-decimal pl-1">
            {listItems.map((item, i) => <li key={i}>{item}</li>)}
          </ol>
        );
      } else {
        elements.push(
          <ul key={`ul-${elements.length}`} className="my-1 ml-4 list-disc pl-1">
            {listItems.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        );
      }
      listItems = [];
      listType = null;
    };

    lines.forEach((line, idx) => {
      const bulletMatch = line.match(/^[-*]\s+(.+)/);
      const numberedMatch = line.match(/^(\d+)\.\s+(.+)/);

      if (bulletMatch) {
        if (listType === 'ol') flushList();
        listType = 'ul';
        listItems.push(renderInline(bulletMatch[1], `ul-item-${idx}`));
      } else if (numberedMatch) {
        if (listType === 'ul') flushList();
        listType = 'ol';
        listItems.push(renderInline(numberedMatch[2], `ol-item-${idx}`));
      } else {
        flushList();
        if (line.trim() === '') {
          elements.push(<br key={`br-${idx}`} />);
        } else {
          elements.push(
            <span key={`line-${idx}`} className="block">
              {renderInline(line, `line-${idx}`)}
            </span>
          );
        }
      }
    });

    flushList();
    return elements;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center sm:justify-end p-0 sm:p-6 font-inter" onClick={onClose}>
      <div 
        className="relative w-full sm:w-[400px] h-[100dvh] sm:h-[580px] max-h-[100dvh] sm:max-h-[85vh] bg-white dark:bg-[#1E2130] rounded-none sm:rounded-3xl shadow-2xl border-0 sm:border border-slate-200 dark:border-white/10 flex flex-col overflow-hidden text-left font-inter"
        onClick={e => e.stopPropagation()}
      >
        {/* Header — Navy + Gold */}
        <div className="px-5 py-4 bg-gradient-to-r from-[#0D1F45] via-[#142E54] to-[#0E254A] text-white flex items-center justify-between shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#F5C800]/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="relative w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-[#F5C800] border border-white/20 shadow-inner shrink-0">
              <Bot size={22} />
              <Sparkles size={11} className="absolute -top-1 -right-1 text-[#F5C800] animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white font-dm">IsangDiwa Chatbot</span>
                <span className="px-2 py-0.5 text-[9px] font-extrabold bg-[#F5C800]/20 backdrop-blur-xs rounded-full uppercase tracking-wider text-[#F5C800]">
                  Assistant
                </span>
              </div>
              <span className="text-[11px] text-white/60 flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
                Online
              </span>
            </div>
          </div>
          <button 
            className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 transition-all text-white border-none cursor-pointer active:scale-95 relative z-10" 
            onClick={onClose} 
            aria-label="Close chat"
          >
            <X size={18} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/70 dark:bg-slate-900/40">
          {messages.map(msg => (
            <div key={msg.id} className={`flex items-end gap-2.5 text-xs ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.sender === 'bot' && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#0D1F45] to-[#1E3A8A] flex items-center justify-center text-[#F5C800] shrink-0 mb-1 shadow-md shadow-[#0D1F45]/30">
                  <Bot size={16} />
                </div>
              )}
              <div className={`max-w-[85%] p-4 rounded-2xl shadow-xs space-y-2 leading-relaxed ${
                msg.sender === 'user' 
                  ? 'bg-gradient-to-r from-[#0D1F45] to-[#1E3A8A] text-white rounded-br-xs font-medium' 
                  : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-white/10 rounded-bl-xs'
              }`}>
                {msg.greeting ? (
                  <p className="text-xs">
                    👋 Hi <strong className="font-bold">{firstName}</strong>! I'm <strong className="font-bold">IsangDiwa Chatbot</strong>, your AI-powered assistant.
                    I can help with <strong className="font-bold">donations</strong>, <strong className="font-bold">savings</strong>, <strong className="font-bold">attendance</strong>, and more.
                    {' '}Type anything to get started!
                  </p>
                ) : (
                  <div className="text-xs space-y-1">
                    {msg.text ? renderText(msg.text) : null}
                  </div>
                )}
                <div className={`flex items-center gap-1.5 text-[10px] ${msg.sender === 'user' ? 'justify-end text-white/50' : 'justify-between text-slate-400 dark:text-slate-500'}`}>
                  {msg.sender === 'bot' && msg.isAI && (
                    <span className="flex items-center gap-1 text-[9px] font-bold text-[#0D1F45] dark:text-[#F5C800] bg-[#0D1F45]/5 dark:bg-[#F5C800]/10 px-1.5 py-0.5 rounded-md border border-[#0D1F45]/10 dark:border-[#F5C800]/20">
                      <Sparkles size={9} /> AI
                    </span>
                  )}
                  <span>{formatTime(msg.timestamp)}</span>
                </div>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex items-end gap-2.5 text-xs justify-start">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#0D1F45] to-[#1E3A8A] flex items-center justify-center text-[#F5C800] shrink-0 mb-1 shadow-md shadow-[#0D1F45]/30">
                <Bot size={16} />
              </div>
              <div className="px-4 py-3 rounded-2xl rounded-bl-xs bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-white/10 flex items-center gap-1.5 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-[#F5C800] animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 rounded-full bg-[#F5C800] animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 rounded-full bg-[#F5C800] animate-bounce" />
              </div>
            </div>
          )}

          {/* Quick replies of last bot message */}
          {!isTyping && messages.length > 0 && (() => {
            const lastBot = [...messages].reverse().find(m => m.sender === 'bot');
            if (!lastBot?.quickReplies?.length) return null;
            return (
              <div className="flex flex-wrap gap-1.5 pt-1 pl-10">
                {lastBot.quickReplies.map(qr => (
                  <button
                    key={qr}
                    className="px-3.5 py-1.5 bg-[#0D1F45]/5 dark:bg-[#F5C800]/10 hover:bg-[#0D1F45] hover:text-white dark:hover:bg-[#F5C800] dark:hover:text-[#0D1F45] text-[#0D1F45] dark:text-[#F5C800] font-semibold rounded-xl text-xs transition-all border border-[#0D1F45]/15 dark:border-[#F5C800]/20 active:scale-95 shadow-2xs cursor-pointer"
                    onClick={() => sendMessage(qr)}
                  >
                    {qr}
                  </button>
                ))}
              </div>
            );
          })()}

          <div ref={bottomRef} />
        </div>

        {/* Input / Cooldown */}
        {cooldownSeconds > 0 ? (
          <div className="p-3 bg-white dark:bg-[#1E2130] border-t border-slate-100 dark:border-white/10">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40">
              <div className="w-9 h-9 rounded-lg bg-[#F5C800]/20 text-[#F5C800] flex items-center justify-center shrink-0 font-dm text-sm font-extrabold">
                {Math.floor(cooldownSeconds / 60)}:{String(cooldownSeconds % 60).padStart(2, '0')}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 font-inter">Message limit reached</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-inter">Please wait before sending more messages</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-white dark:bg-[#1E2130] border-t border-slate-100 dark:border-white/10 flex items-center gap-2">
            <input
              ref={inputRef}
              className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 focus:border-[#0D1F45] dark:focus:border-[#F5C800] rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none transition-all"
              placeholder="Ask me anything about IsangDiwa..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={500}
              disabled={isTyping}
            />
            <button
              className="w-10 h-10 rounded-xl bg-gradient-to-r from-[#0D1F45] to-[#1E3A8A] hover:from-[#142E54] hover:to-[#2B4EAF] active:scale-95 disabled:opacity-40 text-[#F5C800] flex items-center justify-center shadow-md shadow-[#0D1F45]/30 transition-all shrink-0 cursor-pointer border-none"
              onClick={() => sendMessage()}
              disabled={!input.trim() || isTyping}
              aria-label="Send message"
            >
              <Send size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
