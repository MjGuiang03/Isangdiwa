/* eslint-disable jsx-a11y/anchor-is-valid */
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  PiggyBank, Calendar, ArrowRight, ChevronRight, CheckCircle2
} from 'lucide-react';

import LoginModal from '../components/LoginModal';
import SignupModal from '../components/SignupModal';
import ResetPassword from '../components/ResetPassword';

import puacLogo from '../../assets/puaclogo.png';
import puacCongregation from '../../assets/IMG_8437.JPG';
import summerYouthCamp from '../../assets/summer youth camp.png';
import bentoImg1 from '../../assets/events/IMG_8439.JPG';
import bentoImg2 from '../../assets/events/pic4.jfif';
import missionImg from '../../assets/events/pic5.jfif';

import featureSavings from '../../assets/features/savings.jpg';
import featureChatbot from '../../assets/features/chatbot1.JPG';
import featureAttendance from '../../assets/features/attendance.jpg';

export default function LandingPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  const [loading, setLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);

  const revealRefs = useRef([]);

  useEffect(() => {
    if (location.pathname === '/reset-password') {
      setShowResetModal(true);
    } else {
      setShowResetModal(false);
    }
  }, [location.pathname]);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1500);
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);

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
      clearTimeout(timer);
      window.removeEventListener('scroll', handleScroll);
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
      
      {/* LOADER */}
      <div className={`fixed inset-0 bg-[#0D1F45] flex flex-col items-center justify-center z-[9999] transition-all duration-700 ${
        !loading ? 'opacity-0 invisible pointer-events-none' : 'opacity-100 visible'
      }`}>
        <img src={puacLogo} alt="IsangDiwa Logo" className="w-28 h-auto object-contain mb-6 animate-pulse" />
        <div className="text-3xl sm:text-4xl font-extrabold text-white text-center mb-1 tracking-tight font-dm">
          <span>Isang</span><span className="text-[#F5C800]">Diwa</span>
        </div>
        <div className="text-xs text-white/60 tracking-widest text-center uppercase font-medium">Philippine United Apostolic Church</div>
        <div className="w-36 h-1 bg-white/10 mt-6 rounded-full overflow-hidden">
          <div className="h-full bg-[#F5C800] rounded-full w-full animate-shimmer"></div>
        </div>
      </div>

      {/* NAVBAR */}
      <nav className={`fixed top-2 sm:top-4 left-0 right-0 z-[100] transition-all duration-300 ${scrolled ? 'top-0' : 'top-2 sm:top-4'}`}>
        <div className={`max-w-7xl mx-auto px-4 sm:px-8 transition-all duration-300`}>
          <div className={`flex items-center justify-between h-16 px-6 rounded-2xl transition-all duration-300 ${
            scrolled ? 'bg-[#09172E]/95 backdrop-blur-md border border-white/10 shadow-xl text-white rounded-none sm:rounded-2xl mt-0' : 'bg-[#0E254A]/80 backdrop-blur-md border border-white/10 shadow-sm text-white'
          }`}>
            <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="flex items-center gap-3 no-underline">
              <img src={puacLogo} alt="IsangDiwa Logo" className="w-9 h-9 object-contain shrink-0" />
              <div className="font-dm text-xl font-bold tracking-tight">
                <span className="text-white">Isang</span>
                <span className="text-[#F5C800]">Diwa</span>
              </div>
            </a>
            
            <div className="hidden md:flex items-center gap-8 text-sm font-medium">
              <a href="#features" onClick={(e) => scrollToSection(e, 'features')} className="no-underline text-white/80 hover:text-[#F5C800] transition-all duration-300 transform hover:scale-105">Features</a>
              <a href="#gallery" onClick={(e) => scrollToSection(e, 'gallery')} className="no-underline text-white/80 hover:text-[#F5C800] transition-all duration-300 transform hover:scale-105">Events</a>
              <a href="#gallery" onClick={(e) => scrollToSection(e, 'gallery')} className="no-underline text-white/80 hover:text-[#F5C800] transition-all duration-300 transform hover:scale-105">Community</a>
            </div>

            <div className="flex items-center gap-3">
              <button 
                onClick={handleOpenLogin}
                className="bg-[#1E3E6E] hover:bg-[#28508a] text-white text-xs font-bold px-5 py-2.5 rounded-xl border border-white/15 transition-all shadow-sm active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                Sign In <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* HERO SECTION — DARK NAVY EDITORIAL */}
      <section className="relative bg-[#0E254A] text-white pt-32 pb-24 lg:pt-40 lg:pb-32 px-4 sm:px-8 border-b border-white/10 overflow-hidden">
        
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute top-12 right-12 w-[350px] h-[350px] bg-[#F5C800]/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center relative z-10">
          
          {/* Hero Left Content */}
          <div className="lg:col-span-7 space-y-6">

            <h1 className="font-dm text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05] text-white">
              Empowering<br />
              <span className="text-[#F5C800]">Faith</span><br />
              Together
            </h1>

            <p className="text-slate-300 font-inter text-base sm:text-lg leading-relaxed max-w-xl">
              IsangDiwa unites 68 PUAC branches and 3,400+ members across the Philippines. One platform. One vision. One spirit.
            </p>

            <div className="flex flex-wrap gap-4 pt-3">
              <button 
                onClick={handleOpenSignup}
                className="bg-white hover:bg-slate-100 text-[#0E254A] font-bold text-sm px-7 py-3.5 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-2 group cursor-pointer active:scale-95"
              >
                Join Our Community 
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <button 
                onClick={(e) => scrollToSection(e, 'features')}
                className="bg-white/10 hover:bg-white/20 text-white font-semibold text-sm px-7 py-3.5 rounded-xl border border-white/20 backdrop-blur-xs transition-all cursor-pointer active:scale-95"
              >
                Learn More
              </button>
            </div>

            {/* Metrics Ribbon */}
            <div className="grid grid-cols-3 gap-6 pt-10 border-t border-white/15">
              <div>
                <div className="font-dm text-3xl sm:text-4xl font-extrabold text-white">68</div>
                <div className="text-xs text-slate-300 font-medium mt-1 uppercase tracking-wider">Branches</div>
              </div>
              <div>
                <div className="font-dm text-3xl sm:text-4xl font-extrabold text-white">3,400+</div>
                <div className="text-xs text-slate-300 font-medium mt-1 uppercase tracking-wider">Members</div>
              </div>
              <div>
                <div className="font-dm text-3xl sm:text-4xl font-extrabold text-white">100%</div>
                <div className="text-xs text-slate-300 font-medium mt-1 uppercase tracking-wider">Transparent</div>
              </div>
            </div>
          </div>

          {/* Hero Right Visual Stack (Detailed Interactive Feature Cards) */}
          <div className="lg:col-span-5 relative">
            <div className="relative z-10 space-y-4">
              
              {/* Card 1: Member Savings */}
              <div className="bg-white/95 text-[#0D1F45] p-5 rounded-2xl shadow-xl border border-white/20 transform hover:-translate-y-1 transition-all duration-300">
                <div className="w-full">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Member Savings</span>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">+ ₱12,500</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#0D1F45] w-[75%] rounded-full"></div>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500 mt-1 font-medium">
                    <span>Emergency Fund Goal</span>
                    <span className="text-[#0D1F45] font-bold">75% Completed</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Nationwide PUAC Network */}
              <div className="bg-[#142E54] text-white p-6 rounded-2xl shadow-2xl relative overflow-hidden transform lg:translate-x-6 hover:translate-x-4 transition-all duration-300 border border-white/15">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#F5C800]/10 rounded-full blur-2xl pointer-events-none"></div>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#F5C800]">Church Fellowship</span>
                    <h3 className="text-lg font-bold font-dm mt-0.5 text-white">Nationwide PUAC Network</h3>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30">Connected</span>
                </div>
                <div className="bg-white/10 rounded-xl p-4 backdrop-blur-xs border border-white/10 mb-3">
                  <div className="text-xs text-white/70">Registered Branch Network</div>
                  <div className="text-3xl font-extrabold font-dm text-white mt-0.5">68 Branches</div>
                </div>
                <div className="flex items-center justify-between text-xs text-white/70">
                  <span>Sunday Divine Assemblies</span>
                  <span className="text-[#F5C800] font-semibold">100% Active</span>
                </div>
              </div>

              {/* Card 3: Attendance Logging */}
              <div className="bg-white/95 text-[#0D1F45] p-4 rounded-2xl shadow-lg border border-white/20 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-900">Sunday Divine Service</div>
                  <div className="text-[11px] text-slate-500">Attendance Logged via RFID / App</div>
                </div>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg flex items-center gap-1">
                  <CheckCircle2 size={14} /> Present
                </span>
              </div>

            </div>

            {/* Background glow behind stack */}
            <div className="absolute inset-0 bg-gradient-to-tr from-[#F5C800]/20 to-[#0D1F45]/10 rounded-3xl blur-3xl -z-10 transform scale-110"></div>
          </div>

        </div>
      </section>

      {/* EDITORIAL VERSE & PHILOSOPHY STRIP (SMOOTH COLOR TRANSITION) */}
      <section className="bg-gradient-to-b from-[#0E254A] via-[#0A1A36] to-[#F8FAFC] text-white py-20 px-4 sm:px-8 relative overflow-hidden">
        <div className="max-w-4xl mx-auto text-center space-y-4 relative z-10">
          <span className="text-xs font-bold uppercase tracking-widest text-[#F5C800]">Philippine United Apostolic Church</span>
          <blockquote className="font-cormorant text-2xl sm:text-4xl italic font-semibold text-white/95 leading-relaxed drop-shadow-sm">
            "Now all who believed were together, and had all things in common, and sold their possessions and goods, and divided them among all, as anyone had need."
          </blockquote>
          <cite className="block text-xs font-bold tracking-widest text-[#F5C800] uppercase not-italic">
            Acts 2:44-45 · Apostolic Doctrine &amp; Fellowship
          </cite>
        </div>
      </section>

      {/* MEMBER-SIDE FEATURE SHOWCASE (ALTERNATING LAYOUT) */}
      <section id="features" className="py-24 px-4 sm:px-8 max-w-7xl mx-auto space-y-24">
        
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center opacity-0 translate-y-10 transition-all duration-700" ref={addToRefs}>
          <div className="lg:col-span-6 space-y-4">
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
          <div className="lg:col-span-6">
            <div className="bg-white p-2 rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
              <img 
                src={featureSavings} 
                alt="Savings and Stewardship UI" 
                className="w-full h-auto rounded-2xl object-cover object-top" 
              />
            </div>
          </div>
        </div>

        {/* Feature 2: AI Assistant & Support Chatbot */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center opacity-0 translate-y-10 transition-all duration-700" ref={addToRefs}>
          <div className="lg:col-span-6 lg:order-2 space-y-4">
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
          <div className="lg:col-span-6 lg:order-1">
            <div className="bg-white p-2 rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
              <img src={featureChatbot} alt="AI Assistant &amp; Chatbot UI" className="w-full h-auto rounded-2xl object-cover object-top" />
            </div>
          </div>
        </div>

        {/* Feature 3: Attendance & Community */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center opacity-0 translate-y-10 transition-all duration-700" ref={addToRefs}>
          <div className="lg:col-span-6 space-y-4">
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
          <div className="lg:col-span-6">
            <div className="bg-white p-2 rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
              <img src={featureAttendance} alt="Attendance Tracker UI" className="w-full h-auto rounded-2xl object-cover object-top" />
            </div>
          </div>
        </div>

      </section>

      {/* BENTO GRID GALLERY — REAL COMMUNITY MOMENTS (SMOOTH GRADIENT TRANSITION) */}
      <section id="gallery" className="pt-24 pb-24 bg-gradient-to-b from-[#F8FAFC] via-[#0E254A] to-[#0E254A] text-white px-4 sm:px-8">
        <div className="max-w-7xl mx-auto space-y-12">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/10 pb-8">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-[#F5C800]">Events &amp; Fellowship</span>
              <h2 className="font-dm text-3xl sm:text-5xl font-extrabold text-white mt-1">
                Church Events &amp; Celebrations
              </h2>
            </div>
            <p className="text-white/70 max-w-md text-sm leading-relaxed">
              From Sunday divine services and youth camps to district thanksgiving anniversaries, explore how our 68 PUAC branches gather in worship, mission, and fellowship.
            </p>
          </div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div className="md:col-span-2 relative group rounded-3xl overflow-hidden min-h-[340px] bg-slate-800 border border-white/10">
              <img src={puacCongregation} alt="PUAC Congregation" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-80" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent p-8 flex flex-col justify-end">
                <span className="text-xs font-bold uppercase tracking-wider text-[#F5C800]">Main Assembly</span>
                <h3 className="font-dm text-2xl font-bold text-white mt-1">National Apostolic Convention</h3>
              </div>
            </div>

            <div className="relative group rounded-3xl overflow-hidden min-h-[340px] bg-slate-800 border border-white/10">
              <img src={bentoImg1} alt="Sunday Worship" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-80" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent p-6 flex flex-col justify-end">
                <span className="text-xs font-bold uppercase tracking-wider text-[#F5C800]">Worship Service</span>
                <h3 className="font-dm text-xl font-bold text-white mt-1">Sunday Praise &amp; Prayer</h3>
              </div>
            </div>

            <div className="relative group rounded-3xl overflow-hidden min-h-[280px] bg-slate-800 border border-white/10">
              <img src={missionImg} alt="Outreach Mission" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-80" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent p-6 flex flex-col justify-end">
                <span className="text-xs font-bold uppercase tracking-wider text-[#F5C800]">Community Outreach</span>
                <h3 className="font-dm text-xl font-bold text-white mt-1">Medical &amp; Feeding Mission</h3>
              </div>
            </div>

            <div className="relative group rounded-3xl overflow-hidden min-h-[280px] bg-slate-800 border border-white/10">
              <img src={summerYouthCamp} alt="Summer Youth Camp" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-80" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent p-6 flex flex-col justify-end">
                <span className="text-xs font-bold uppercase tracking-wider text-[#F5C800]">Youth Ministry</span>
                <h3 className="font-dm text-xl font-bold text-white mt-1">Summer Youth Camp</h3>
              </div>
            </div>

            <div className="relative group rounded-3xl overflow-hidden min-h-[280px] bg-slate-800 border border-white/10">
              <img src={bentoImg2} alt="Water Baptism" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-80" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent p-6 flex flex-col justify-end">
                <span className="text-xs font-bold uppercase tracking-wider text-[#F5C800]">Sacraments</span>
                <h3 className="font-dm text-xl font-bold text-white mt-1">Water Baptism Services</h3>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* CTA BANNER (UNIFIED DARK NAVY - SEAMLESS FLOW) */}
      <section className="py-24 px-4 sm:px-8 bg-[#0E254A] text-white text-center relative overflow-hidden">
        {/* Subtle Ambient Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#F5C800]/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="max-w-4xl mx-auto space-y-6 relative z-10">
          <span className="text-xs font-bold uppercase tracking-widest text-[#F5C800]">Welcome To The Family</span>
          <h2 className="font-dm text-3xl sm:text-5xl font-extrabold leading-tight">
            Ready to Experience Digital Fellowship with <span className="text-white">Isang</span><span className="text-[#F5C800]">Diwa</span>?
          </h2>
          <p className="text-white/80 text-sm sm:text-base max-w-xl mx-auto">
            Create your member account today, link your local PUAC branch, and start managing your savings and attendance with ease.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-4">
            <button 
              onClick={handleOpenSignup}
              className="bg-[#F5C800] hover:bg-amber-400 text-[#0E254A] font-extrabold text-sm px-8 py-4 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-2 cursor-pointer"
            >
              Register as Member <ArrowRight size={18} />
            </button>
            <button 
              onClick={handleOpenLogin}
              className="bg-white/10 hover:bg-white/20 text-white font-bold text-sm px-8 py-4 rounded-xl backdrop-blur-xs transition-all border border-white/20 cursor-pointer"
            >
              Sign In to Account
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER (MATCHED DARK NAVY - SEAMLESS CONTINUATION) */}
      <footer className="bg-[#0E254A] text-white/70 py-16 px-4 sm:px-8 text-xs">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-white/10">
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-3">
              <img src={puacLogo} alt="IsangDiwa Logo" className="w-8 h-8 object-contain" />
              <span className="font-dm text-lg font-bold text-white">Isang<span className="text-[#F5C800]">Diwa</span></span>
            </div>
            <p className="leading-relaxed text-white/60">
              Official community platform of the Philippine United Apostolic Church. Empowering 68 branches through faith and transparent governance.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-white uppercase tracking-wider text-[11px] mb-4">Quick Links</h4>
            <ul className="space-y-2.5 list-none p-0">
              <li><a href="#features" className="hover:text-white transition-colors no-underline">Member Features</a></li>
              <li><a href="#gallery" className="hover:text-white transition-colors no-underline">Branch Gallery</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white uppercase tracking-wider text-[11px] mb-4">Member Portal</h4>
            <ul className="space-y-2.5 list-none p-0">
              <li><a href="#" onClick={(e) => { e.preventDefault(); handleOpenLogin(); }} className="hover:text-white transition-colors no-underline">Sign In</a></li>
              <li><a href="#" onClick={(e) => { e.preventDefault(); handleOpenSignup(); }} className="hover:text-white transition-colors no-underline">Register Account</a></li>
              <li><a href="#" onClick={(e) => { e.preventDefault(); handleSwitchToReset(); }} className="hover:text-white transition-colors no-underline">Forgot Password</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white uppercase tracking-wider text-[11px] mb-4">Church Headquarters</h4>
            <p className="leading-relaxed text-white/60">
              Philippine United Apostolic Church<br />
              68 Branches Nationwide<br />
              Manila, Philippines
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-white/40">
          <span>© {new Date().getFullYear()} IsangDiwa · Philippine United Apostolic Church. All rights reserved.</span>
          <span>To God Be All The Glory</span>
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
