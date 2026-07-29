/* eslint-disable jsx-a11y/anchor-is-valid */
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import LoginModal from '../components/LoginModal';
import SignupModal from '../components/SignupModal';
import ResetPassword from '../components/ResetPassword';
import DonationInfoModal from '../components/DonationInfoModal';
import puacLogo from '../../assets/puaclogo.png';
import puacCongregation from '../../assets/IMG_8437.JPG';
import puacCommunity from '../../assets/IMG_8443.JPG';
import thanksgiving from '../../assets/events/thanksgiving.png';
import summerYouthCamp from '../../assets/summer youth camp.png';
import womenFellowship from '../../assets/events/pic1.jfif';
import youthFellowship from '../../assets/events/youth_fellowship.png';
import divineService from '../../assets/events/pic2.jfif';
import bentoImg1 from '../../assets/events/IMG_8439.JPG';
import bentoImg2 from '../../assets/events/pic4.jfif';
import youthCampImg from '../../assets/events/IMG_8460.JPG';
import missionImg from '../../assets/events/pic5.jfif';
import featureTransactions from '../../assets/features/transactions1.png';
import featureConnected from '../../assets/features/connected.JPG';
import featureChatbot from '../../assets/features/chatbot1.JPG';
import featureAttendance from '../../assets/features/attendance.jpg';

export default function WelcomePage() {
  const location = useLocation();
  const navigate = useNavigate();

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showDonationModal, setShowDonationModal] = useState(false);

  useEffect(() => {
    if (location.pathname === '/reset-password') {
      setShowResetModal(true);
    } else {
      setShowResetModal(false);
    }
  }, [location.pathname]);

  const handleOpenLogin = () => setShowLoginModal(true);
  const handleCloseLogin = () => setShowLoginModal(false);
  const handleOpenSignup = () => setShowSignupModal(true);
  const handleCloseSignup = () => setShowSignupModal(false);
  const handleSwitchToSignup = () => { setShowLoginModal(false); setShowSignupModal(true); };
  const handleSwitchToReset = () => { setShowLoginModal(false); setShowResetModal(true); };
  const handleSwitchToLoginFromSignup = () => { setShowSignupModal(false); setShowLoginModal(true); };

  const [loading, setLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slideWidth, setSlideWidth] = useState(0);

  const revealRefs = useRef([]);
  const trackRef = useRef(null);

  const slidesCount = 5;
  const visibleSlides = typeof window !== 'undefined' && window.innerWidth < 768 ? 1 : 2;
  const maxIndex = slidesCount - visibleSlides;

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2000);
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('opacity-100', 'translate-y-0', 'translate-x-0');
          entry.target.classList.remove('opacity-0', 'translate-y-9', '-translate-x-10', 'translate-x-10');
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    revealRefs.current.forEach(el => { if (el) observer.observe(el); });

    const autoSlide = setInterval(() => {
      setCurrentSlide(prev => prev < maxIndex ? prev + 1 : 0);
    }, 5000);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', handleScroll);
      observer.disconnect();
      clearInterval(autoSlide);
    };
  }, [maxIndex]);

  useEffect(() => {
    const updateWidth = () => {
      if (trackRef.current && trackRef.current.children[0]) {
        setSlideWidth(trackRef.current.children[0].offsetWidth + 20);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const addToRefs = el => {
    if (el && !revealRefs.current.includes(el)) revealRefs.current.push(el);
  };

  const handlePrev = () => setCurrentSlide(prev => Math.max(0, prev - 1));
  const handleNext = () => setCurrentSlide(prev => Math.min(maxIndex, prev + 1));
  const goTo = (index) => setCurrentSlide(Math.max(0, Math.min(index, maxIndex)));

  return (
    <>
      <div className="font-dm bg-white text-[#0F1E4A] overflow-x-hidden min-h-screen">

        {/* LOADER */}
        <div id="wpt-loader" className={`fixed inset-0 bg-[#132654] flex flex-col items-center justify-center z-[9999] transition-all duration-700 ${
          !loading ? 'opacity-0 invisible pointer-events-none' : 'opacity-100 visible'
        }`}>
          <img src={puacLogo} alt="IsangDiwa Logo" className="w-36 h-auto object-contain mb-7 animate-fadeIn" />
          <div className="text-4xl sm:text-5xl font-bold text-white text-center mb-2 tracking-tight">
            <span className="text-white">Isang</span><span className="text-[#F0D89A]">Diwa</span>
          </div>
          <div className="font-dm text-sm sm:text-base text-white/70 tracking-widest text-center px-5 uppercase">Philippine United Apostolic Church</div>
          <div className="w-44 h-0.5 bg-white/10 mt-5 rounded-full overflow-hidden">
            <div className="h-full bg-[#C9A84C] rounded-full w-full animate-shimmer"></div>
          </div>
        </div>

        {/* TICKER */}
        <div className="bg-[#0D1F45] text-white py-2.5 px-4 overflow-hidden border-b border-white/10 text-xs sm:text-sm font-inter">
          <div className="flex items-center gap-4 max-w-7xl mx-auto">
            <span className="bg-[#C9A84C] text-[#0D1F45] font-bold text-[10px] sm:text-xs uppercase tracking-wider px-2.5 py-1 rounded-md shrink-0 flex items-center gap-1">
              📢 Announcements
            </span>
            <div className="overflow-hidden whitespace-nowrap flex-1 relative">
              <div className="inline-block animate-ticker whitespace-nowrap">
                <span className="inline-flex items-center gap-4 pr-12 text-white/80">
                  Sunday Service — 9:00 AM &amp; 6:00 PM <span className="text-[#C9A84C]">✦</span>
                  Youth Gathering — Every Friday 7:00 PM <span className="text-[#C9A84C]">✦</span>
                  Monthly Thanksgiving Offering — 3rd Sunday <span className="text-[#C9A84C]">✦</span>
                  Prayer &amp; Fasting Week — July 14–18 <span className="text-[#C9A84C]">✦</span>
                  New Branch Opening — Caloocan District <span className="text-[#C9A84C]">✦</span>
                  Online Giving now available via GCash &amp; Maya
                </span>
                <span className="inline-flex items-center gap-4 text-white/80">
                  Sunday Service — 9:00 AM &amp; 6:00 PM <span className="text-[#C9A84C]">✦</span>
                  Youth Gathering — Every Friday 7:00 PM <span className="text-[#C9A84C]">✦</span>
                  Monthly Thanksgiving Offering — 3rd Sunday <span className="text-[#C9A84C]">✦</span>
                  Prayer &amp; Fasting Week — July 14–18 <span className="text-[#C9A84C]">✦</span>
                  New Branch Opening — Caloocan District <span className="text-[#C9A84C]">✦</span>
                  Online Giving now available via GCash &amp; Maya
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* NAVBAR */}
        <nav id="wpt-navbar" className={`fixed top-0 left-0 right-0 z-[100] px-4 sm:px-8 lg:px-12 h-18 flex items-center justify-between bg-white/90 backdrop-blur-md border-b border-slate-200/80 transition-shadow ${
          scrolled ? 'shadow-md' : ''
        }`}>
          <a href="#home" className="flex items-center gap-3 no-underline">
            <img src={puacLogo} alt="IsangDiwa Logo" className="w-10 h-10 object-contain shrink-0" />
            <div className="font-cormorant text-2xl font-bold text-[#1E3A8A] leading-tight">
              <span className="text-[#1E3A8A]">Isang</span><span className="text-[#C9A84C]">Diwa</span>
            </div>
          </a>
          <ul className="flex items-center gap-6 sm:gap-8 list-none m-0 p-0">
            <li><a href="#features" className="text-sm font-medium text-slate-600 hover:text-[#1E3A8A] no-underline transition-colors">Features</a></li>
            <li><a href="#gallery" className="text-sm font-medium text-slate-600 hover:text-[#1E3A8A] no-underline transition-colors">Gallery</a></li>
            <li><a href="#/" onClick={(e) => { e.preventDefault(); setShowDonationModal(true); }} className="text-sm font-medium text-slate-600 hover:text-[#1E3A8A] no-underline transition-colors">Give</a></li>
            <li>
              <a 
                href="#/" 
                className="bg-[#1E3A8A] hover:bg-[#2B4EAF] text-white text-sm font-semibold px-5 py-2 rounded-xl no-underline shadow-sm transition-all hover:-translate-y-0.5 active:scale-95" 
                onClick={(e) => { e.preventDefault(); handleOpenLogin(); }}
              >
                Log In
              </a>
            </li>
          </ul>
        </nav>

        {/* WELCOME SECTION */}
        <section className="relative min-h-screen pt-28 pb-6 overflow-hidden bg-[#1a2e6e] text-white flex flex-col justify-between rounded-b-2xl">
          <div className="absolute inset-0 pointer-events-none z-0">
            <div className="absolute left-[20%] top-1/2 -translate-x-1/2 -translate-y-1/2 w-36 h-44 opacity-5 border-white"></div>
            <div className="absolute top-[8%] left-[4%] w-80 h-80 rounded-full border border-white/5 animate-pulseRing"></div>
            <div className="absolute top-[55%] left-[18%] w-52 h-52 rounded-full border border-[#C9A84C]/10"></div>
            <div className="absolute bottom-[6%] right-[8%] w-72 h-72 rounded-full border border-white/5"></div>
            <div className="hidden lg:block absolute top-0 bottom-0 left-1/2 w-[1px] bg-white/10"></div>
          </div>

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto w-full px-4 sm:px-8 lg:px-12 py-8 flex-1 items-center">
            {/* LEFT COLUMN */}
            <div className="flex flex-col justify-center text-left">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-6 h-[1px] bg-[#C9A84C]"></span>
                <span className="text-xs font-semibold uppercase tracking-widest text-[#C9A84C] font-inter">All Honour to God</span>
              </div>

              <div className="mb-6">
                <h1 className="font-dm font-bold text-5xl sm:text-6xl lg:text-7xl leading-tight tracking-tight text-white mb-2">
                  <span className="text-white">Isang</span><span className="text-[#F0D89A]">Diwa</span>
                </h1>
                <div className="flex items-center gap-3">
                  <span className="w-8 h-[1px] bg-[#C9A84C]/60"></span>
                  <h3 className="text-base sm:text-lg font-normal text-white/80 tracking-wide font-dm m-0">
                    Philippine United Apostolic Church
                  </h3>
                </div>
              </div>

              <p className="text-sm sm:text-base text-white/70 leading-relaxed mb-8 max-w-md font-inter">
                A community of believers committed to transforming lives across the Philippines
                through faith, fellowship, and digital empowerment.
              </p>

              <div className="flex flex-wrap gap-4">
                <a
                  href="#/"
                  className="bg-[#C9A84C] hover:bg-[#F0D89A] text-[#1a2e6e] font-semibold text-sm px-6 py-3 rounded-xl no-underline shadow-md transition-all hover:-translate-y-0.5"
                  onClick={(e) => { e.preventDefault(); handleOpenSignup(); }}
                >
                  Join Our Community
                </a>
                <a
                  href="#/"
                  className="bg-transparent hover:bg-white/10 text-white border border-white/30 hover:border-white/60 font-medium text-sm px-6 py-3 rounded-xl no-underline transition-all hover:-translate-y-0.5"
                  onClick={(e) => { e.preventDefault(); setShowDonationModal(true); }}
                >
                  Give Offering
                </a>
              </div>
            </div>

            {/* RIGHT COLUMN — photo mosaic */}
            <div className="w-full h-full min-h-[360px] flex flex-col">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full h-full rounded-2xl overflow-hidden shadow-2xl">
                <div className="relative group overflow-hidden bg-[#2a3d7e] min-h-[220px] transition-all duration-700 opacity-0 translate-y-9" ref={addToRefs}>
                  <img src={puacCongregation} alt="IsangDiwa Congregation" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute bottom-3 left-3 z-10">
                    <span className="bg-black/60 backdrop-blur-xs border border-white/20 text-white/90 text-xs px-3 py-1 rounded-lg font-medium">Main Assembly</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 min-h-[220px]">
                  <div className="relative group overflow-hidden bg-[#243570] flex-1 min-h-[120px] transition-all duration-700 opacity-0 translate-y-9" ref={addToRefs}>
                    <img src={puacCommunity} alt="IsangDiwa Community" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute bottom-3 left-3 z-10">
                      <span className="bg-black/60 backdrop-blur-xs border border-white/20 text-white/90 text-xs px-3 py-1 rounded-lg font-medium">Church Family</span>
                    </div>
                  </div>
                  <div className="relative group overflow-hidden bg-[#243570] flex-1 min-h-[120px] transition-all duration-700 opacity-0 translate-y-9" ref={addToRefs}>
                    <img src={summerYouthCamp} alt="Summer Youth Camp" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute bottom-3 left-3 z-10">
                      <span className="bg-black/60 backdrop-blur-xs border border-white/20 text-white/90 text-xs px-3 py-1 rounded-lg font-medium">Youth Ministry</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Scroll hint bar */}
          <div className="relative z-10 flex items-center justify-between px-6 sm:px-12 py-3.5 border-t border-white/10 max-w-7xl mx-auto w-full">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#C9A84C] animate-pulse"></span>
              <span className="text-[11px] font-semibold uppercase tracking-widest text-white/50 font-inter">Scroll to Explore</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-white/20"></span>
              <span className="w-5 h-2 rounded-full bg-[#C9A84C]"></span>
              <span className="w-2 h-2 rounded-full bg-white/20"></span>
            </div>
          </div>
        </section>

        {/* HERO SECTION */}
        <section className="py-20 sm:py-28 px-4 sm:px-8 lg:px-12 bg-slate-50 relative overflow-hidden" id="home">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="font-dm text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#0D1F45] leading-tight mb-6 tracking-tight">
                Built on <em className="not-italic text-[#1E3A8A]">Faith,</em><br />
                Serving with <em className="not-italic text-[#C9A84C]">Purpose</em>
              </h1>
              <p className="text-slate-600 font-inter text-base sm:text-lg leading-relaxed mb-8 max-w-xl">
                A community of believers united in worship, empowered through digital tools to manage
                savings, give faithfully, and grow together as one body in Christ.
              </p>
              <div className="flex flex-wrap gap-4 mb-12">
                <a href="#features" className="bg-[#1E3A8A] hover:bg-[#2B4EAF] text-white font-semibold text-sm px-6 py-3.5 rounded-xl no-underline shadow-md transition-all hover:-translate-y-0.5">
                  Explore Features →
                </a>
                <a
                  href="#/"
                  className="bg-white hover:bg-slate-100 text-[#1E3A8A] border border-slate-300 font-semibold text-sm px-6 py-3.5 rounded-xl no-underline shadow-sm transition-all hover:-translate-y-0.5"
                  onClick={(e) => { e.preventDefault(); setShowDonationModal(true); }}
                >
                  Give Offering
                </a>
              </div>

              <div className="grid grid-cols-3 gap-6 pt-6 border-t border-slate-200">
                <div>
                  <div className="font-dm text-3xl font-bold text-[#1E3A8A]">68</div>
                  <div className="font-inter text-xs text-slate-500 font-medium">Active Branches</div>
                </div>
                <div>
                  <div className="font-dm text-3xl font-bold text-[#1E3A8A]">3,400+</div>
                  <div className="font-inter text-xs text-slate-500 font-medium">Church Members</div>
                </div>
                <div>
                  <div className="font-dm text-3xl font-bold text-[#1E3A8A]">24/7</div>
                  <div className="font-inter text-xs text-slate-500 font-medium">Chatbot Support</div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="bg-gradient-to-br from-[#0D1F45] to-[#1E3A8A] rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
                <div className="mb-6">
                  <h3 className="font-inter text-xl font-bold text-white mb-1">Member Dashboard</h3>
                  <p className="font-inter text-xs text-white/60">Savings · Attendance · Donation</p>
                </div>
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/15">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#F0D89A] mb-1 font-inter">This Month</div>
                  <div className="font-dm text-4xl font-extrabold text-white mb-1">₱84,200</div>
                  <div className="font-inter text-xs text-white/70">Total Donations Received</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CAROUSEL */}
        <section className="py-20 px-4 sm:px-8 lg:px-12 bg-white" id="events">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-10 gap-4 transition-all duration-700 opacity-0 translate-y-9" ref={addToRefs}>
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-[#C9A84C] font-inter mb-2">Church Events</div>
                <h2 className="font-dm text-3xl sm:text-4xl font-bold text-[#0D1F45] m-0 leading-tight">
                  Moments That<br />Move Us
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <button className="w-10 h-10 rounded-full border border-slate-300 hover:border-[#1E3A8A] text-slate-700 hover:text-[#1E3A8A] flex items-center justify-center cursor-pointer transition-all active:scale-95" onClick={handlePrev}>←</button>
                <button className="w-10 h-10 rounded-full border border-slate-300 hover:border-[#1E3A8A] text-slate-700 hover:text-[#1E3A8A] flex items-center justify-center cursor-pointer transition-all active:scale-95" onClick={handleNext}>→</button>
              </div>
            </div>

            <div className="overflow-hidden py-2">
              <div
                className="flex gap-5 transition-transform duration-500 ease-out"
                ref={trackRef}
                style={{ transform: slideWidth ? `translateX(-${currentSlide * slideWidth}px)` : 'none' }}
              >
                <div className="w-[300px] sm:w-[420px] shrink-0 relative group rounded-2xl overflow-hidden shadow-lg h-72 bg-slate-900">
                  <img src={thanksgiving} alt="Annual Convention" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-6 flex flex-col justify-end">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#F0D89A] font-inter mb-1">Annual Convention</span>
                    <h4 className="font-inter text-lg font-bold text-white m-0">National Apostolic Convention 2025</h4>
                  </div>
                </div>

                <div className="w-[300px] sm:w-[420px] shrink-0 relative group rounded-2xl overflow-hidden shadow-lg h-72 bg-slate-900">
                  <img src={youthCampImg} alt="Youth Ministry" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-6 flex flex-col justify-end">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#F0D89A] font-inter mb-1">Youth Ministry</span>
                    <h4 className="font-inter text-lg font-bold text-white m-0">Youth Leadership Summit</h4>
                  </div>
                </div>

                <div className="w-[300px] sm:w-[420px] shrink-0 relative group rounded-2xl overflow-hidden shadow-lg h-72 bg-slate-900">
                  <img src={womenFellowship} alt="Outreach" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-6 flex flex-col justify-end">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#F0D89A] font-inter mb-1">Outreach</span>
                    <h4 className="font-inter text-lg font-bold text-white m-0">Community Feeding &amp; Medical Mission</h4>
                  </div>
                </div>

                <div className="w-[300px] sm:w-[420px] shrink-0 relative group rounded-2xl overflow-hidden shadow-lg h-72 bg-slate-900">
                  <img src={youthFellowship} alt="Worship Night" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-6 flex flex-col justify-end">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#F0D89A] font-inter mb-1">Worship Night</span>
                    <h4 className="font-inter text-lg font-bold text-white m-0">All-Night Prayer &amp; Praise — Main Sanctuary</h4>
                  </div>
                </div>

                <div className="w-[300px] sm:w-[420px] shrink-0 relative group rounded-2xl overflow-hidden shadow-lg h-72 bg-slate-900">
                  <img src={divineService} alt="Baptism Sunday" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-6 flex flex-col justify-end">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#F0D89A] font-inter mb-1">Baptism Sunday</span>
                    <h4 className="font-inter text-lg font-bold text-white m-0">Water Baptism</h4>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-center gap-2 mt-8">
              {[...Array(maxIndex + 1)].map((_, i) => (
                <button
                  key={i}
                  className={`h-2.5 rounded-full border-none transition-all cursor-pointer ${currentSlide === i ? 'w-8 bg-[#1E3A8A]' : 'w-2.5 bg-slate-300'}`}
                  onClick={() => goTo(i)}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </section>

        {/* VERSE BANNER */}
        <section className="py-16 px-4 sm:px-8 bg-[#0D1F45] text-white text-center relative overflow-hidden transition-all duration-700 opacity-0 translate-y-9" ref={addToRefs}>
          <div className="max-w-4xl mx-auto relative z-10">
            <blockquote className="font-cormorant text-2xl sm:text-4xl italic font-semibold text-[#F0D89A] mb-4 leading-relaxed">
              "For where two or three are gathered in my name, there am I among them."
            </blockquote>
            <cite className="font-inter text-xs sm:text-sm font-semibold tracking-widest text-white/70 uppercase not-italic">
              Matthew 18:20 · ESV
            </cite>
          </div>
        </section>

        {/* FEATURES */}
        <section className="py-24 px-4 sm:px-8 lg:px-12 bg-slate-50" id="features">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col lg:flex-row items-start lg:items-end justify-between mb-16 gap-6">
              <div className="transition-all duration-700 opacity-0 -translate-x-10" ref={addToRefs}>
                <div className="text-xs font-bold uppercase tracking-widest text-[#C9A84C] font-inter mb-2">System Features</div>
                <h2 className="font-dm text-3xl sm:text-4xl font-bold text-[#0D1F45] m-0">Everything Your<br />Church Needs</h2>
              </div>
              <p className="font-inter text-slate-600 text-sm sm:text-base max-w-md m-0 transition-all duration-700 opacity-0 translate-x-10" ref={addToRefs}>
                A complete digital platform built for Filipino apostolic churches — from financial
                tools to member management, all in one place.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 hover:shadow-md transition-all duration-700 opacity-0 translate-y-9" ref={addToRefs}>
                <div className="h-44 rounded-xl overflow-hidden mb-6 bg-slate-100">
                  <img src={featureTransactions} alt="Manage Transactions" className="w-full h-full object-cover" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#1E3A8A] bg-blue-50 px-2.5 py-1 rounded-md font-inter inline-block mb-3">Finance</span>
                <h3 className="font-inter text-lg font-bold text-[#0D1F45] mb-2">Manage Transactions</h3>
                <p className="font-inter text-xs text-slate-500 leading-relaxed m-0">Handle savings goals, tithes, offerings, and donations via GCash, Maya, or bank transfer — all in one place.</p>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 hover:shadow-md transition-all duration-700 opacity-0 translate-y-9" ref={addToRefs}>
                <div className="h-44 rounded-xl overflow-hidden mb-6 bg-slate-100">
                  <img src={featureAttendance} alt="Track Church Operations" className="w-full h-full object-cover" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#1E3A8A] bg-blue-50 px-2.5 py-1 rounded-md font-inter inline-block mb-3">Operations</span>
                <h3 className="font-inter text-lg font-bold text-[#0D1F45] mb-2">Track Church Operations</h3>
                <p className="font-inter text-xs text-slate-500 leading-relaxed m-0">Maintain digital member profiles, log service attendance, and generate reports per branch automatically.</p>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 hover:shadow-md transition-all duration-700 opacity-0 translate-y-9" ref={addToRefs}>
                <div className="h-44 rounded-xl overflow-hidden mb-6 bg-slate-100">
                  <img src={featureConnected} alt="Stay Connected" className="w-full h-full object-cover" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#1E3A8A] bg-blue-50 px-2.5 py-1 rounded-md font-inter inline-block mb-3">Communication</span>
                <h3 className="font-inter text-lg font-bold text-[#0D1F45] mb-2">Stay Connected</h3>
                <p className="font-inter text-xs text-slate-500 leading-relaxed m-0">Broadcast updates, post event schedules, and maintain a live branch directory across all locations.</p>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 hover:shadow-md transition-all duration-700 opacity-0 translate-y-9" ref={addToRefs}>
                <div className="h-44 rounded-xl overflow-hidden mb-6 bg-slate-100">
                  <img src={featureChatbot} alt="24/7 Chatbot Assistant" className="w-full h-full object-cover" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#1E3A8A] bg-blue-50 px-2.5 py-1 rounded-md font-inter inline-block mb-3">AI Support</span>
                <h3 className="font-inter text-lg font-bold text-[#0D1F45] mb-2">24/7 Chatbot Assistant</h3>
                <p className="font-inter text-xs text-slate-500 leading-relaxed m-0">Answer member queries, guide new visitors, and provide support around the clock — always available.</p>
              </div>
            </div>
          </div>
        </section>

        {/* BENTO GRID */}
        <section className="py-24 px-4 sm:px-8 lg:px-12 bg-white" id="gallery">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-12 gap-4 transition-all duration-700 opacity-0 translate-y-9" ref={addToRefs}>
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-[#C9A84C] font-inter mb-2">Giving &amp; Community</div>
                <h2 className="font-dm text-3xl sm:text-4xl font-bold text-[#0D1F45] m-0">One Body,<br />Many Ways to Give</h2>
              </div>
              <a
                href="#/"
                className="bg-[#1E3A8A] hover:bg-[#2B4EAF] text-white font-semibold text-sm px-6 py-3 rounded-xl no-underline shadow-sm transition-all hover:-translate-y-0.5"
                onClick={(e) => { e.preventDefault(); setShowDonationModal(true); }}
              >
                Start Giving →
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="donate">
              <div className="md:col-span-2 bg-[#0D1F45] rounded-3xl p-8 text-white relative overflow-hidden flex flex-col justify-between transition-all duration-700 opacity-0 translate-y-9 min-h-[300px]" ref={addToRefs}>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#F0D89A] font-inter block mb-2">Church Giving</span>
                  <h3 className="font-dm text-3xl font-bold text-white mb-3">Give Faithfully,<br />Give Freely</h3>
                  <p className="font-inter text-sm text-white/70 max-w-md mb-6 leading-relaxed">Your generosity fuels outreach, missions, and community programs. Every peso honors God.</p>
                </div>
                <div>
                  <div className="flex flex-wrap gap-2 mb-6">
                    <span className="bg-white/10 text-white font-inter text-xs px-3 py-1.5 rounded-lg border border-white/15">GCash</span>
                    <span className="bg-white/10 text-white font-inter text-xs px-3 py-1.5 rounded-lg border border-white/15">Maya</span>
                    <span className="bg-white/10 text-white font-inter text-xs px-3 py-1.5 rounded-lg border border-white/15">BPI / BDO</span>
                    <span className="bg-white/10 text-white font-inter text-xs px-3 py-1.5 rounded-lg border border-white/15">Cash</span>
                  </div>
                  <a
                    href="#/"
                    className="inline-block bg-[#C9A84C] hover:bg-[#F0D89A] text-[#0D1F45] font-semibold text-sm px-6 py-3 rounded-xl no-underline transition-all"
                    onClick={(e) => { e.preventDefault(); setShowDonationModal(true); }}
                  >
                    Give Now →
                  </a>
                </div>
              </div>

              <div className="bg-slate-900 rounded-3xl overflow-hidden relative group min-h-[280px] transition-all duration-700 opacity-0 translate-y-9" ref={addToRefs}>
                <img src={bentoImg1} alt="Sunday Worship Service" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-6 flex flex-col justify-end">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#F0D89A] font-inter mb-1">Community</span>
                  <h4 className="font-inter text-lg font-bold text-white m-0">Sunday Worship Service</h4>
                </div>
              </div>

              <div className="bg-slate-900 rounded-3xl overflow-hidden relative group min-h-[280px] transition-all duration-700 opacity-0 translate-y-9" ref={addToRefs}>
                <img src={missionImg} alt="Outreach &amp; Missions" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-6 flex flex-col justify-end">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#F0D89A] font-inter mb-1">Mission Fund</span>
                  <h4 className="font-inter text-lg font-bold text-white m-0">Outreach &amp; Missions</h4>
                </div>
              </div>

              <div className="bg-amber-50 rounded-3xl p-8 border border-amber-200/60 flex flex-col justify-center transition-all duration-700 opacity-0 translate-y-9 min-h-[200px]" ref={addToRefs}>
                <div className="font-dm text-4xl font-extrabold text-[#0D1F45] mb-1">₱1.2M</div>
                <div className="font-inter text-xs font-semibold text-slate-500 uppercase tracking-wider">Raised This Year</div>
              </div>

              <div className="bg-slate-900 rounded-3xl overflow-hidden relative group min-h-[280px] transition-all duration-700 opacity-0 translate-y-9" ref={addToRefs}>
                <img src={bentoImg2} alt="Medical Mission 2025" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-6 flex flex-col justify-end">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#F0D89A] font-inter mb-1">Outreach</span>
                  <h4 className="font-inter text-lg font-bold text-white m-0">Medical Mission 2025</h4>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA STRIP */}
        <section className="py-20 px-4 sm:px-8 lg:px-12 bg-gradient-to-r from-[#0D1F45] to-[#1E3A8A] text-white">
          <div className="max-w-5xl mx-auto text-center transition-all duration-700 opacity-0 translate-y-9" ref={addToRefs}>
            <span className="text-xs font-bold uppercase tracking-widest text-[#F0D89A] font-inter block mb-3">Get Started Today</span>
            <h2 className="font-dm text-3xl sm:text-5xl font-bold mb-6 leading-tight">
              Join the <span className="text-white">Isang</span><span className="text-[#F0D89A]">Diwa</span> Digital Community
            </h2>
            <p className="font-inter text-sm sm:text-base text-white/80 max-w-2xl mx-auto mb-8 leading-relaxed">
              Register as a member, access your profile, manage your savings goals, and stay
              connected with your branch — all from one platform.
            </p>
            <a
              href="#/"
              className="inline-block bg-[#C9A84C] hover:bg-[#F0D89A] text-[#0D1F45] font-semibold text-sm px-8 py-3.5 rounded-xl no-underline shadow-lg transition-all hover:-translate-y-0.5"
              onClick={(e) => { e.preventDefault(); handleOpenSignup(); }}
            >
              Register Now →
            </a>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="bg-[#091530] text-white pt-16 pb-8 px-4 sm:px-8 lg:px-12">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-10 pb-12 border-b border-white/10">
              <div className="md:col-span-2">
                <a href="#" className="flex items-center gap-3 no-underline mb-4">
                  <img src={puacLogo} alt="IsangDiwa Logo" className="w-10 h-10 object-contain" />
                  <div className="font-cormorant text-2xl font-bold text-white">
                    <span className="text-white">Isang</span><span className="text-[#F0D89A]">Diwa</span>
                  </div>
                </a>
                <p className="font-inter text-xs text-white/60 leading-relaxed max-w-sm m-0">
                  A church rooted in apostolic doctrine, committed to transforming communities
                  across the Philippines through faith, fellowship, and digital empowerment.
                </p>
              </div>

              <div>
                <h4 className="font-inter text-xs font-bold uppercase tracking-wider text-white mb-4">Quick Links</h4>
                <ul className="list-none p-0 m-0 space-y-2.5 text-xs font-inter text-white/60">
                  <li><a href="#" className="hover:text-white transition-colors no-underline">About Us</a></li>
                  <li><a href="#" className="hover:text-white transition-colors no-underline">Branches</a></li>
                  <li><a href="#" className="hover:text-white transition-colors no-underline">Events</a></li>
                  <li><a href="#" className="hover:text-white transition-colors no-underline">Sermons</a></li>
                </ul>
              </div>

              <div>
                <h4 className="font-inter text-xs font-bold uppercase tracking-wider text-white mb-4">Member Tools</h4>
                <ul className="list-none p-0 m-0 space-y-2.5 text-xs font-inter text-white/60">
                  <li><a href="#" className="hover:text-white transition-colors no-underline">Member Login</a></li>
                  <li><a href="#" className="hover:text-white transition-colors no-underline">Savings Goals</a></li>
                  <li><a href="#" className="hover:text-white transition-colors no-underline">Attendance</a></li>
                </ul>
              </div>

              <div>
                <h4 className="font-inter text-xs font-bold uppercase tracking-wider text-white mb-4">Giving</h4>
                <ul className="list-none p-0 m-0 space-y-2.5 text-xs font-inter text-white/60">
                  <li><a href="#" className="hover:text-white transition-colors no-underline">General Fund</a></li>
                  <li><a href="#" className="hover:text-white transition-colors no-underline">Children's Dept.</a></li>
                  <li><a href="#" className="hover:text-white transition-colors no-underline">Men's Dept.</a></li>
                  <li><a href="#" className="hover:text-white transition-colors no-underline">Women's Dept.</a></li>
                  <li><a href="#" className="hover:text-white transition-colors no-underline">Youth Dept.</a></li>
                  <li><a href="#" className="hover:text-white transition-colors no-underline">Mission Fund</a></li>
                </ul>
              </div>
            </div>

            <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 font-inter text-xs text-white/40">
              <span>© 2026 IsangDiwa | Philippine United Apostolic Church. All rights reserved.</span>
              <span>Glorifying God · Serving People</span>
            </div>
          </div>
        </footer>
      </div>

      {/* MODALS */}
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
      <DonationInfoModal
        isOpen={showDonationModal}
        onClose={() => setShowDonationModal(false)}
      />
    </>
  );
}