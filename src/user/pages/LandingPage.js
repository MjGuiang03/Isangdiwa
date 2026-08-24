/* eslint-disable jsx-a11y/anchor-is-valid */
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  ArrowRight, ChevronRight, CheckCircle2
} from 'lucide-react';

import LoginModal from '../components/LoginModal';
import SignupModal from '../components/SignupModal';
import ResetPassword from '../components/ResetPassword';

import puacLogo from '../../assets/optimized/puaclogo.webp';
import puacCongregation from '../../assets/optimized/IMG_8437.webp';
import summerYouthCamp from '../../assets/optimized/summer_youth_camp.webp';
import bentoImg1 from '../../assets/optimized/events/IMG_8439.webp';
import bentoImg2 from '../../assets/optimized/events/pic4.webp';
import missionImg from '../../assets/optimized/events/pic5.webp';

import featureSavings from '../../assets/optimized/features/savings.webp';
import featureChatbot from '../../assets/optimized/features/chatbot1.webp';
import featureAttendance from '../../assets/optimized/features/attendance.webp';

export default function LandingPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  const revealRefs = useRef([]);

  useEffect(() => {
    if (location.pathname === '/reset-password') {
      setShowResetModal(true);
    } else {
      setShowResetModal(false);
    }
  }, [location.pathname]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('opacity-100', 'translate-y-0');
          entry.target.classList.remove('opacity-0', 'translate-y-10');
        }
      });
    }, { threshold: 0.1 });

    revealRefs.current.forEach(el => { if (el) observer.observe(el); });

    return () => {
      observer.disconnect();
    };
  }, []);

  const addToRefs = el => {
    if (el && !revealRefs.current.includes(el)) revealRefs.current.push(el);
  };

  const handleOpenLogin = () => setShowLoginModal(true);
  const handleCloseLogin = () => setShowLoginModal(false);
  const handleOpenSignup = () => setShowSignupModal(true);
  const handleCloseSignup = () => setShowSignupModal(false);
  const handleSwitchToSignup = () => { setShowLoginModal(false); setShowSignupModal(true); };
  const handleSwitchToReset = () => { setShowLoginModal(false); setShowResetModal(true); };
  const handleSwitchToLoginFromSignup = () => { setShowSignupModal(false); setShowLoginModal(true); };

  const scrollToSection = (e, id) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      const yOffset = -90; // offset for fixed top navbar
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  return (
    <div className="font-inter bg-[#F8FAFC] text-[#0D1F45] min-h-screen selection:bg-[#F5C800] selection:text-[#0D1F45] overflow-x-hidden scroll-smooth">
      
      {/* ── NAVBAR: FLOATING PILL (ABSOLUTE TOP - NON-STICKY) ── */}
      <nav className="absolute top-0 left-0 right-0 z-[100] py-4 sm:py-5 pointer-events-none">
        <div className="max-w-[1400px] mx-auto px-5 sm:px-10 flex items-center justify-between pointer-events-auto">
          {/* Logo — left side */}
          <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="flex items-center gap-2.5 no-underline shrink-0">
            <img src={puacLogo} alt="IsangDiwa" className="w-9 h-9 object-contain" width="36" height="36" />
            <span className="font-outfit text-xl font-bold tracking-tight text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]">
              Isang<span className="text-[#F5C800]">Diwa</span>
            </span>
          </a>

          {/* Right cluster: dark navy glass pill with high-contrast links + CTA outside */}
          <div className="flex items-center gap-3">
            {/* Frosted glass pill with matched height */}
            <div className="hidden md:flex items-center gap-1 h-11 px-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/25 shadow-sm">
              <a href="#features" onClick={(e) => scrollToSection(e, 'features')} className="no-underline text-xs font-bold h-8 flex items-center px-4 rounded-full text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] hover:bg-white/20 transition-all">Features</a>
              <a href="#gallery" onClick={(e) => scrollToSection(e, 'gallery')} className="no-underline text-xs font-bold h-8 flex items-center px-4 rounded-full text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] hover:bg-white/20 transition-all">Events</a>
            </div>

            {/* Dark CTA button with matched height */}
            <button onClick={handleOpenLogin} className="bg-[#0E254A] hover:bg-[#142E54] text-white text-xs font-bold h-11 px-6 rounded-full transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-sm">
              Sign In <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO: FULL-BLEED CINEMATIC (TasteSkill style) ── */}
      <section className="relative h-screen min-h-[600px] max-h-[900px] overflow-hidden">
        <img src={puacCongregation} alt="PUAC National Assembly" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#060F20] via-[#060F20]/60 to-[#060F20]/30" />

        <div className="relative z-10 h-full flex flex-col justify-end max-w-[1400px] mx-auto px-6 sm:px-10 pb-16 sm:pb-20">
          <div className="max-w-3xl">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#F5C800] mb-4">Philippine United Apostolic Church</div>
            <h1 className="font-outfit text-[clamp(2.8rem,6vw,5.5rem)] font-extrabold leading-[1.02] tracking-tight text-white mb-5">
              Empowering Faith,<br />
              Fellowship, and<br />
              Stewardship
            </h1>
            <p className="text-white/60 text-base sm:text-lg max-w-lg mb-8 leading-relaxed">
              Connecting 68 branches and 3,400+ members across the Philippines under one unified digital platform.
            </p>
            <div className="flex flex-wrap gap-3">
              <button onClick={handleOpenSignup} className="bg-[#F5C800] hover:bg-amber-400 text-[#0E254A] font-bold text-sm px-7 py-3.5 rounded-xl transition-all flex items-center gap-2 group cursor-pointer active:scale-[0.97]">
                Join Our Community <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
              <button onClick={(e) => scrollToSection(e, 'features')} className="bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white font-semibold text-sm px-7 py-3.5 rounded-xl border border-white/15 transition-all cursor-pointer active:scale-[0.97]">
                Explore Features
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── SCROLLING STATS MARQUEE ── */}
      <div className="bg-[#0E254A] border-y border-white/10 py-4 overflow-hidden">
        <div className="flex animate-ticker whitespace-nowrap">
          {[...Array(2)].map((_, rep) => (
            <div key={rep} className="flex items-center gap-12 px-6 shrink-0">
              {['68 Active Branches', '3,400+ Church Members', '100% Financial Transparency', 'RFID Attendance System', '24/7 AI Member Assistant', 'Nationwide PUAC Network'].map((t, i) => (
                <span key={i} className="flex items-center gap-3 text-sm font-semibold text-white/80 tracking-wide">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#F5C800] shrink-0" /> {t}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>


      {/* EDITORIAL VERSE & PHILOSOPHY STRIP */}
      <section className="bg-[#0E254A] text-white py-16 sm:py-20 px-6 sm:px-10 border-t border-white/10 relative overflow-hidden">
        <div className="max-w-4xl mx-auto text-center space-y-4 relative z-10">
          <span className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.2em] text-[#F5C800]">Philippine United Apostolic Church</span>
          <blockquote className="font-outfit text-xl sm:text-3xl lg:text-4xl font-medium text-white leading-relaxed tracking-tight">
            “Now all who believed were together, and had all things in common, and sold their possessions and goods, and divided them among all, as anyone had need.”
          </blockquote>
          <cite className="block text-xs font-bold tracking-[0.15em] text-[#F5C800] uppercase not-italic pt-1">
            Acts 2:44-45 · Apostolic Doctrine &amp; Fellowship
          </cite>
        </div>
      </section>

      {/* MEMBER-SIDE FEATURE SHOWCASE (ALTERNATING LAYOUT) */}
      <section id="features" className="py-24 px-4 sm:px-8 max-w-[1400px] mx-auto space-y-24">
        
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="text-xs font-bold uppercase tracking-widest text-[#0D1F45] bg-[#0D1F45]/5 px-3 py-1 rounded-full">Designed For Church Members</span>
          <h2 className="font-dm text-3xl sm:text-5xl font-extrabold text-[#0D1F45]">
            Everything You Need<br />In One Spiritual &amp; Financial Hub
          </h2>
          <p className="text-slate-600 text-sm sm:text-base">
            IsangDiwa gives every congregation member real-time visibility and direct access to church services, savings, and assistance.
          </p>
        </div>

        {/* Feature 1: Savings */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center opacity-0 translate-y-10 transition-all duration-700" ref={addToRefs}>
          <div className="lg:col-span-5 space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600">Savings &amp; Financial Stewardship</span>
            <h3 className="font-dm text-2xl sm:text-4xl font-extrabold text-[#0D1F45]">
              Build Your Personal Savings with Church Integrity
            </h3>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
              Set personal financial goals for emergency funds, education, or house building. Deposit easily and watch your savings accumulate safely within the PUAC community network.
            </p>
            <ul className="space-y-2 text-sm text-slate-700 font-medium">
              <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> Goal-oriented savings trackers</li>
              <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> Transparent deposit logs and instant receipts</li>
              <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> Verified deposit logging and transparent ledger tracking</li>
            </ul>
          </div>
          <div className="lg:col-span-7">
            <div className="bg-white p-2 sm:p-3 rounded-3xl shadow-2xl border border-slate-200 overflow-hidden transform hover:scale-[1.01] transition-transform duration-500">
              <img 
                src={featureSavings} 
                alt="Savings and Stewardship UI" 
                className="w-full h-auto rounded-2xl object-cover object-top max-h-[550px]" 
                loading="lazy" width="1000" height="600"
              />
            </div>
          </div>
        </div>

        {/* Feature 2: AI Assistant & Support Chatbot */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center opacity-0 translate-y-10 transition-all duration-700" ref={addToRefs}>
          <div className="lg:col-span-5 lg:order-2 space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">AI Member Assistant</span>
            <h3 className="font-dm text-2xl sm:text-4xl font-extrabold text-[#0D1F45]">
              Instant Answers &amp; Guidance Anytime
            </h3>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
              Get 24/7 assistance on church guidelines, service schedules, savings inquiries, and general member support powered by our intelligent AI assistant.
            </p>
            <ul className="space-y-2 text-sm text-slate-700 font-medium">
              <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> 24/7 automated member query support</li>
              <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> Fast access to service schedules and church policies</li>
              <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> Personalized member account and savings guidance</li>
            </ul>
          </div>
          <div className="lg:col-span-7 lg:order-1">
            <div className="bg-white p-2 sm:p-3 rounded-3xl shadow-2xl border border-slate-200 overflow-hidden transform hover:scale-[1.01] transition-transform duration-500">
              <img src={featureChatbot} alt="AI Assistant &amp; Chatbot UI" className="w-full h-auto rounded-2xl object-cover object-top max-h-[550px]" loading="lazy" width="1000" height="600" />
            </div>
          </div>
        </div>

        {/* Feature 3: Attendance & Community */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center opacity-0 translate-y-10 transition-all duration-700" ref={addToRefs}>
          <div className="lg:col-span-5 space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">Attendance &amp; Fellowship</span>
            <h3 className="font-dm text-2xl sm:text-4xl font-extrabold text-[#0D1F45]">
              Stay Connected with Service Records &amp; Events
            </h3>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
              Keep track of your service attendance across Sunday assemblies, youth gatherings, and national conventions. Receive announcements from your branch secretary instantly.
            </p>
            <ul className="space-y-2 text-sm text-slate-700 font-medium">
              <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> Automated RFID tap-in logging</li>
              <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> Attendance stats and spiritual engagement metrics</li>
              <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> Branch announcements &amp; event reminders</li>
            </ul>
          </div>
          <div className="lg:col-span-7">
            <div className="bg-white p-2 sm:p-3 rounded-3xl shadow-2xl border border-slate-200 overflow-hidden transform hover:scale-[1.01] transition-transform duration-500">
              <img src={featureAttendance} alt="Attendance Tracker UI" className="w-full h-auto rounded-2xl object-cover object-top max-h-[550px]" loading="lazy" width="1000" height="600" />
            </div>
          </div>
        </div>

      </section>

      {/* ── BENTO GRID GALLERY — CHURCH EVENTS & CELEBRATIONS ── */}
      <section id="gallery" className="py-24 bg-[#F8FAFC] text-[#0D1F45] px-4 sm:px-8 border-t border-slate-200/80 relative overflow-hidden">
        <div className="max-w-[1400px] mx-auto space-y-12 relative z-10">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-8">
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#0D1F45] bg-[#0D1F45]/5 px-3 py-1 rounded-full">
                Events &amp; Fellowship
              </span>
              <h2 className="font-outfit text-3xl sm:text-5xl font-extrabold text-[#0D1F45] tracking-tight mt-1">
                Church Events &amp; Celebrations
              </h2>
            </div>
            <p className="text-slate-600 max-w-lg text-sm sm:text-base leading-relaxed">
              From Sunday divine services and youth camps to district thanksgiving anniversaries, explore how our 68 PUAC branches gather in worship, mission, and fellowship.
            </p>
          </div>

          {/* Premium Rounded Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6">
            
            {/* Card 1: Main Assembly (Large Feature, 2 cols, 2 rows) */}
            <div className="md:col-span-2 md:row-span-2 relative group overflow-hidden rounded-3xl border border-slate-200 bg-slate-900 shadow-2xl min-h-[380px] lg:min-h-[460px]">
              <img 
                src={puacCongregation} 
                alt="PUAC Congregation" 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-85" 
                loading="lazy" width="1200" height="700" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#060F20]/95 via-[#060F20]/40 to-transparent p-6 sm:p-10 flex flex-col justify-end">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#060F20] bg-[#F5C800] px-3 py-1 rounded-full">Main Assembly</span>
                  <span className="text-xs font-medium text-white/70">68 Branches United</span>
                </div>
                <h3 className="font-outfit text-2xl sm:text-4xl font-extrabold text-white leading-tight">
                  National Apostolic Convention
                </h3>
                <p className="text-white/70 text-xs sm:text-sm mt-2 max-w-xl hidden sm:block">
                  Annual gathering of PUAC members across all Philippine districts for spiritual renewal, leadership fellowship, and worship.
                </p>
              </div>
            </div>

            {/* Card 2: Sunday Praise & Prayer */}
            <div className="relative group overflow-hidden rounded-3xl border border-slate-200 bg-slate-900 shadow-xl min-h-[220px] lg:min-h-[240px]">
              <img 
                src={bentoImg1} 
                alt="Sunday Worship" 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-85" 
                loading="lazy" width="800" height="600" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#060F20]/90 via-[#060F20]/30 to-transparent p-6 flex flex-col justify-end">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#F5C800] mb-1">Worship Service</span>
                <h3 className="font-outfit text-xl font-bold text-white">Sunday Praise &amp; Prayer</h3>
              </div>
            </div>

            {/* Card 3: Medical & Feeding Mission */}
            <div className="relative group overflow-hidden rounded-3xl border border-slate-200 bg-slate-900 shadow-xl min-h-[220px] lg:min-h-[240px]">
              <img 
                src={missionImg} 
                alt="Outreach Mission" 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-85" 
                loading="lazy" width="800" height="600" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#060F20]/90 via-[#060F20]/30 to-transparent p-6 flex flex-col justify-end">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#F5C800] mb-1">Community Outreach</span>
                <h3 className="font-outfit text-xl font-bold text-white">Medical &amp; Feeding Mission</h3>
              </div>
            </div>

            {/* Card 4: Summer Youth Camp */}
            <div className="relative group overflow-hidden rounded-3xl border border-slate-200 bg-slate-900 shadow-xl min-h-[220px] lg:min-h-[240px]">
              <img 
                src={summerYouthCamp} 
                alt="Summer Youth Camp" 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-85" 
                loading="lazy" width="900" height="600" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#060F20]/90 via-[#060F20]/30 to-transparent p-6 flex flex-col justify-end">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#F5C800] mb-1">Youth Ministry</span>
                <h3 className="font-outfit text-xl font-bold text-white">Summer Youth Camp</h3>
              </div>
            </div>

            {/* Card 5: Water Baptism Services (Wide 2 cols) */}
            <div className="md:col-span-2 relative group overflow-hidden rounded-3xl border border-slate-200 bg-slate-900 shadow-xl min-h-[220px] lg:min-h-[240px]">
              <img 
                src={bentoImg2} 
                alt="Water Baptism" 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-85" 
                loading="lazy" width="1000" height="600" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#060F20]/95 via-[#060F20]/40 to-transparent p-6 sm:p-8 flex flex-col justify-end">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#F5C800] mb-1">Sacraments</span>
                <h3 className="font-outfit text-xl sm:text-2xl font-bold text-white">Water Baptism Services</h3>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── CTA BANNER: TASTESKILL CINEMATIC FULL-BLEED ── */}
      <section className="py-16 sm:py-24 px-5 sm:px-10 bg-[#0E254A] text-white text-center relative overflow-hidden">
        <div className="max-w-4xl mx-auto space-y-5 sm:space-y-6 relative z-10">
          <span className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.2em] text-[#F5C800]">
            Welcome To The Family
          </span>

          <h2 className="font-outfit text-2xl sm:text-5xl font-extrabold leading-tight tracking-tight text-white">
            Ready to Experience Digital Fellowship with <span className="text-white">Isang</span><span className="text-[#F5C800]">Diwa</span>?
          </h2>

          <p className="text-slate-300 text-xs sm:text-base max-w-xl mx-auto font-normal leading-relaxed">
            Create your member account today, link your local PUAC branch, and start managing your savings and attendance with ease.
          </p>

          <div className="flex flex-col sm:flex-row justify-center items-center gap-3 sm:gap-4 pt-2 sm:pt-4">
            <button 
              onClick={handleOpenSignup}
              className="bg-[#F5C800] hover:bg-amber-400 text-[#0E254A] font-extrabold text-xs sm:text-sm px-6 py-3 sm:px-8 sm:py-3.5 rounded-full transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 w-[85%] sm:w-auto max-w-[260px] sm:max-w-none"
            >
              Register as Member <ArrowRight size={16} />
            </button>
            <button 
              onClick={handleOpenLogin}
              className="bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm px-6 py-3 sm:px-8 sm:py-3.5 rounded-full transition-all border border-white/20 cursor-pointer active:scale-95 w-[85%] sm:w-auto max-w-[260px] sm:max-w-none justify-center"
            >
              Sign In to Account
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER: TASTESKILL EDITORIAL ── */}
      <footer className="bg-[#09172E] text-slate-400 py-12 sm:py-16 px-5 sm:px-10 text-xs border-t border-white/10">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-10 pb-10 sm:pb-12 border-b border-white/10">
          
          {/* Brand Info (Full Width on Mobile) */}
          <div className="col-span-2 md:col-span-1 space-y-3 sm:space-y-4">
            <div className="flex items-center gap-2.5">
              <img src={puacLogo} alt="IsangDiwa Logo" className="w-7 h-7 sm:w-8 sm:h-8 object-contain" width="32" height="32" />
              <span className="font-outfit text-base sm:text-lg font-bold text-white">
                Isang<span className="text-[#F5C800]">Diwa</span>
              </span>
            </div>
            <p className="leading-relaxed text-slate-400 text-xs max-w-sm">
              Official community platform of the Philippine United Apostolic Church. Empowering 68 branches through faith and transparent governance.
            </p>
          </div>

          {/* Quick Links (Left 1/2 on Mobile Grid) */}
          <div className="col-span-1">
            <h4 className="font-bold text-white uppercase tracking-wider text-[10px] sm:text-[11px] mb-3 sm:mb-4">Quick Links</h4>
            <ul className="space-y-2 sm:space-y-2.5 list-none p-0">
              <li><a href="#features" onClick={(e) => scrollToSection(e, 'features')} className="hover:text-white transition-colors no-underline text-slate-400 text-xs">Member Features</a></li>
              <li><a href="#gallery" onClick={(e) => scrollToSection(e, 'gallery')} className="hover:text-white transition-colors no-underline text-slate-400 text-xs">Branch Gallery</a></li>
            </ul>
          </div>

          {/* Member Portal (Right 1/2 on Mobile Grid) */}
          <div className="col-span-1">
            <h4 className="font-bold text-white uppercase tracking-wider text-[10px] sm:text-[11px] mb-3 sm:mb-4">Member Portal</h4>
            <ul className="space-y-2 sm:space-y-2.5 list-none p-0">
              <li><a href="#" onClick={(e) => { e.preventDefault(); handleOpenLogin(); }} className="hover:text-white transition-colors no-underline text-slate-400 text-xs">Sign In</a></li>
              <li><a href="#" onClick={(e) => { e.preventDefault(); handleOpenSignup(); }} className="hover:text-white transition-colors no-underline text-slate-400 text-xs">Register Account</a></li>
              <li><a href="#" onClick={(e) => { e.preventDefault(); handleSwitchToReset(); }} className="hover:text-white transition-colors no-underline text-slate-400 text-xs">Forgot Password</a></li>
            </ul>
          </div>

          {/* Church Headquarters (Bottom Full-Width on Mobile) */}
          <div className="col-span-2 md:col-span-1 pt-4 md:pt-0 border-t md:border-t-0 border-white/10">
            <h4 className="font-bold text-white uppercase tracking-wider text-[10px] sm:text-[11px] mb-3 sm:mb-4">Church Headquarters</h4>
            <p className="leading-relaxed text-slate-400 text-xs">
              Philippine United Apostolic Church<br />
              68 Branches Nationwide<br />
              Manila, Philippines
            </p>
          </div>

        </div>

        {/* Sub-Footer Bar */}
        <div className="max-w-7xl mx-auto pt-6 sm:pt-8 flex flex-col sm:flex-row justify-between items-center gap-3 text-center sm:text-left text-slate-500 text-[11px] sm:text-xs">
          <span>© {new Date().getFullYear()} IsangDiwa · Philippine United Apostolic Church. All rights reserved.</span>
          <span className="text-[#F5C800]/80 font-medium">To God Be All The Glory</span>
        </div>
      </footer>

      {/* MODALS INTEGRATION */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={handleCloseLogin}
        onSwitchToSignup={handleSwitchToSignup}
        onSwitchToReset={handleSwitchToReset}
      />
      <SignupModal
        isOpen={showSignupModal}
        onClose={handleCloseSignup}
        onSwitchToLogin={handleSwitchToLoginFromSignup}
      />
      <ResetPassword
        isOpen={showResetModal}
        onClose={() => {
          setShowResetModal(false);
          if (location.pathname === '/reset-password') navigate('/', { replace: true });
        }}
      />

    </div>
  );
}
