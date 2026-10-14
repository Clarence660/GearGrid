import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./LandingPage.css";

export default function LandingPage() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [currentIndex, setCurrentIndex] = useState(0);

  const categories = [
    { id: "all", label: "All Classes" },
    { id: "tactical", label: "Tactical" },
    { id: "speed", label: "Speed" },
    { id: "optics", label: "Optics" },
    { id: "terrain", label: "Terrain" },
  ];

  const allGridItems = [
    {
      id: "tactical-1",
      category: "tactical",
      title: "Aeroshelter X-1",
      classTag: "CLASS: TACTICAL",
      version: "v1.0",
      status: "Available",
      statusType: "available",
      imgUrl: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=800&q=80",
    },
    {
      id: "speed-1",
      category: "speed",
      title: "Velocity V-Carbon",
      classTag: "CLASS: SPEED",
      version: "v2.1",
      status: "Limited",
      statusType: "limited",
      imgUrl: "https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=800&q=80",
    },
    {
      id: "optics-1",
      category: "optics",
      title: "Ocular HUD Pro",
      classTag: "CLASS: OPTICS",
      version: "v3.0",
      status: "Available",
      statusType: "available",
      imgUrl: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=800&q=80",
    },
    {
      id: "terrain-1",
      category: "terrain",
      title: "Apex Altitude Pack",
      classTag: "CLASS: TERRAIN",
      version: "v2.4",
      status: "Available",
      statusType: "available",
      imgUrl: "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=800&q=80",
    },
    {
      id: "speed-2",
      category: "speed",
      title: "Aero Chrono Time-Trial",
      classTag: "CLASS: SPEED",
      version: "v1.8",
      status: "Available",
      statusType: "available",
      imgUrl: "https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?auto=format&fit=crop&w=800&q=80",
    },
    {
      id: "tactical-2",
      category: "tactical",
      title: "Stealth Hydration Rig",
      classTag: "CLASS: TACTICAL",
      version: "v3.2",
      status: "Limited",
      statusType: "limited",
      imgUrl: "https://images.unsplash.com/photo-1576176539998-0237d1ac6a85?auto=format&fit=crop&w=800&q=80",
    },
  ];

  const filteredItems = selectedCategory === "all"
    ? allGridItems
    : allGridItems.filter((item) => item.category === selectedCategory);

  const displayedItems = filteredItems.slice(currentIndex, currentIndex + 3).length > 0
    ? filteredItems.slice(currentIndex, currentIndex + 3)
    : filteredItems.slice(0, 3);

  const handleNext = () => {
    if (currentIndex + 3 < filteredItems.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setCurrentIndex(0);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    } else {
      setCurrentIndex(Math.max(0, filteredItems.length - 3));
    }
  };

  const athleteAvatars = [
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&h=100&q=80",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&h=100&q=80",
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&h=100&q=80",
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&h=100&q=80",
  ];

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="gg-landing-root">
      {/* Background Animated Cyber Grid & Moving Glows */}
      <div className="gg-hero-bg-canvas" aria-hidden="true">
        <div className="gg-grid-plane" />
        <div className="gg-ambient-glow gg-glow-1" />
        <div className="gg-ambient-glow gg-glow-2" />
      </div>

      {/* Top Navigation */}
      <header className="gg-nav-header">
        <Link to="/" className="gg-nav-brand">
          <img src="/logo-transparent.png" alt="GearGrid Logo" />
        </Link>

        <nav>
          <ul className="gg-nav-links">
            <li>
              <button type="button" onClick={() => scrollTo("about")} className="gg-nav-link">
                About Us
              </button>
            </li>
            <li>
              <button type="button" onClick={() => scrollTo("rental-guide")} className="gg-nav-link">
                Rental Guide
              </button>
            </li>
            <li>
              <button type="button" onClick={() => scrollTo("explore")} className="gg-nav-link active">
                Categories
              </button>
            </li>
          </ul>
        </nav>

        <div className="gg-nav-actions">
          <Link to="/login" className="gg-btn-signin">Sign In</Link>
          <Link to="/register" className="gg-btn-getstarted">Get Started</Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="gg-hero-section">
        <div className="gg-hero-content">
          <p className="gg-hero-tagline">
            Access elite-grade equipment engineered for extreme conditions. Every asset in our grid is lab-tested, structurally verified, and ready for deployment.
          </p>

          <Link to="/dashboard" className="gg-hero-btn">
            Explore Gear
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </Link>

          <div className="gg-hero-stats" onClick={() => navigate("/dashboard")} style={{ cursor: "pointer" }}>
            <div className="gg-stat-number">28K+</div>
            <div className="gg-stat-avatars">
              {athleteAvatars.map((src, i) => (
                <img key={i} src={src} alt="Active Athlete" className="gg-avatar-circle" />
              ))}
            </div>
            <span className="gg-stat-label">Active Athletes</span>
          </div>
        </div>

        {/* Right HUD Visual Frame with Moving Radar Scanline & Animations */}
        <div className="gg-hero-visual">
          <div className="gg-hud-scanline" />

          <div className="gg-hud-card">
            <div className="gg-hud-grid-lines" />

            {/* Clickable HUD interactive pins */}
            <button
              type="button"
              onClick={() => { setSelectedCategory("speed"); scrollTo("explore"); }}
              className="gg-hud-pin pin-top-left"
            >
              <span className="gg-pin-dot" />
              Carbon Frame
            </button>

            <button
              type="button"
              onClick={() => { setSelectedCategory("speed"); scrollTo("explore"); }}
              className="gg-hud-pin pin-bottom-right"
            >
              <span className="gg-pin-dot" />
              Pro Setup
            </button>

            {/* Wireframe Graphic SVG with Animated Wheels and ECG Wave */}
            <svg viewBox="0 0 500 350" fill="none" style={{ width: "95%", height: "auto", filter: "drop-shadow(0 0 18px rgba(74, 222, 128, 0.3))" }}>
              <defs>
                <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#4ade80" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#15803d" stopOpacity="0.25" />
                </linearGradient>
              </defs>

              {/* Rear Wheel with Rotating Tech Spokes */}
              <g className="gg-wheel-rotate-cw">
                <circle cx="120" cy="240" r="75" stroke="#4ade80" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.7" />
                <circle cx="120" cy="240" r="60" stroke="#22c55e" strokeWidth="1" strokeDasharray="8 4" opacity="0.4" />
                <line x1="120" y1="165" x2="120" y2="315" stroke="#4ade80" strokeWidth="1" opacity="0.3" />
                <line x1="45" y1="240" x2="195" y2="240" stroke="#4ade80" strokeWidth="1" opacity="0.3" />
              </g>

              {/* Front Wheel with Rotating Tech Spokes */}
              <g className="gg-wheel-rotate-cw-2">
                <circle cx="380" cy="240" r="75" stroke="#4ade80" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.7" />
                <circle cx="380" cy="240" r="60" stroke="#22c55e" strokeWidth="1" strokeDasharray="8 4" opacity="0.4" />
                <line x1="380" y1="165" x2="380" y2="315" stroke="#4ade80" strokeWidth="1" opacity="0.3" />
                <line x1="305" y1="240" x2="455" y2="240" stroke="#4ade80" strokeWidth="1" opacity="0.3" />
              </g>

              {/* Bike Frame Lines */}
              <path d="M120 240 L 230 230 L 330 140 L 200 140 Z" stroke="url(#lineGrad)" strokeWidth="3" strokeLinejoin="round" />
              <path d="M230 230 L 380 240 L 340 120" stroke="url(#lineGrad)" strokeWidth="3" strokeLinejoin="round" />
              <path d="M200 140 L 170 110 L 220 100" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M330 140 L 350 100 L 380 100" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" />

              {/* Animated Pulse / ECG Waveform Overlay */}
              <path
                className="gg-ecg-path"
                d="M40 70 L 95 70 L 110 40 L 125 95 L 140 55 L 155 70 L 260 70"
                stroke="#4ade80"
                strokeWidth="2.5"
                fill="none"
                strokeLinecap="round"
              />
              <text x="45" y="38" fill="#86efac" fontSize="11" fontFamily="monospace" letterSpacing="1.2">
                TELEMETRY SYNC: LIVE
              </text>
            </svg>

            {/* Bottom HUD metrics bar */}
            <div className="gg-hud-telemetry">
              <span>POWER: <strong>385W</strong></span>
              <span>HR: <strong>178 BPM</strong></span>
              <span>CADENCE: <strong>94 RPM</strong></span>
            </div>
          </div>
        </div>
      </section>

      {/* About Platform Section (Broken card removed as requested) */}
      <section id="about" className="gg-about-section">
        <div className="gg-about-inner">
          <div className="gg-about-pill-badge">About Platform</div>

          <h2 className="gg-about-headline">
            GearGrid delivers <span className="highlight-green">professional performance</span> to your <em>pursuit</em>, balancing <span className="highlight-green">technical precision</span> with everyday athletic ambition.
          </h2>

          <p className="gg-about-subtext">
            We engineer a seamless marketplace bridging the gap between <span>elite sporting equipment</span> and everyday athletic ambition. We do not merely rent equipment; we distribute verified performance capability.
          </p>

          <div className="gg-about-badges-row">
            <div className="gg-about-metric-badge">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              <span>100% Lab Verified</span>
            </div>
            <div className="gg-about-metric-badge">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M7 7h10v10H7z" />
              </svg>
              <span>Encrypted QR Hand-off</span>
            </div>
            <div className="gg-about-metric-badge">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              <span>Zero-Risk Escrow</span>
            </div>
          </div>
        </div>
      </section>

      {/* Explore the Grid Section (Interactive & Clickable) */}
      <section id="explore" className="gg-explore-section">
        <div className="gg-explore-header">
          <h2 className="gg-explore-title">Explore the Grid</h2>
          <div className="gg-explore-arrows">
            <button type="button" onClick={handlePrev} className="gg-arrow-btn" aria-label="Previous">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <button type="button" onClick={handleNext} className="gg-arrow-btn" aria-label="Next">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>

        {/* Interactive Category Filter Pills */}
        <div className="gg-category-filters">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`gg-cat-btn ${selectedCategory === cat.id ? "active" : ""}`}
              onClick={() => { setSelectedCategory(cat.id); setCurrentIndex(0); }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Clickable Product Cards */}
        <div className="gg-cards-grid">
          {displayedItems.map((item) => (
            <Link key={item.id} to="/dashboard" className="gg-card">
              <div className="gg-card-img-wrapper">
                <img src={item.imgUrl} alt={item.title} />
              </div>
              <div className="gg-card-body">
                <div className="gg-card-top-tags">
                  <span className="gg-card-class">{item.classTag}</span>
                  <span className="gg-card-version">{item.version}</span>
                </div>
                <h3 className="gg-card-title">{item.title}</h3>
                <div className="gg-card-footer">
                  <span className={`gg-card-status ${item.statusType}`}>
                    <span className="status-dot" />
                    Status: {item.status}
                  </span>
                  <span className="gg-card-inspect">
                    Inspect ↗
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Rental Guide Section (Clickable) */}
      <section id="rental-guide" className="gg-guide-section">
        <div className="gg-guide-inner">
          <div className="gg-about-pill-badge">Rental Guide & Protocol</div>
          <div className="gg-guide-grid">
            <Link to="/dashboard" className="gg-guide-step">
              <div className="gg-guide-step-num">PROTOCOL 01</div>
              <h3 className="gg-guide-step-title">Precision Selection</h3>
              <p className="gg-guide-step-desc">
                Browse peer-verified gear cataloged with detailed calibration metrics, serial identification, and usage history.
              </p>
            </Link>

            <Link to="/dashboard" className="gg-guide-step">
              <div className="gg-guide-step-num">PROTOCOL 02</div>
              <h3 className="gg-guide-step-title">Encrypted Meetup Hand-off</h3>
              <p className="gg-guide-step-desc">
                Meet the gear owner in person. When the physical inspection passes, scan the dynamic QR code to securely confirm handoff.
              </p>
            </Link>

            <Link to="/dashboard" className="gg-guide-step">
              <div className="gg-guide-step-num">PROTOCOL 03</div>
              <h3 className="gg-guide-step-title">Verified Return & Escrow</h3>
              <p className="gg-guide-step-desc">
                Return the gear seamlessly. Both parties confirm condition and ratings, releasing payments smoothly through the grid.
              </p>
            </Link>
          </div>
        </div>
      </section>

      {/* Call to Action Banner */}
      <section className="gg-cta-banner">
        <h2>Ready to Deploy Elite Gear?</h2>
        <p>Join thousands of active athletes renting and sharing championship-caliber equipment today.</p>
        <div className="gg-cta-btns">
          <Link to="/register" className="gg-btn-getstarted" style={{ padding: "14px 34px", fontSize: "14px" }}>
            Get Started Now
          </Link>
          <Link to="/dashboard" className="gg-hero-btn" style={{ padding: "14px 34px", fontSize: "14px", background: "transparent", border: "1px solid #4ade80", color: "#4ade80" }}>
            Browse Inventory
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="gg-footer">
        <div className="gg-footer-logo">
          <Link to="/">
            <img src="/logo-transparent.png" alt="GearGrid Logo" />
          </Link>
        </div>

        <div className="gg-footer-links">
          <button type="button" onClick={() => scrollTo("about")} className="gg-footer-link">Technical Support</button>
          <button type="button" onClick={() => scrollTo("rental-guide")} className="gg-footer-link">Rental Agreement</button>
          <button type="button" onClick={() => scrollTo("about")} className="gg-footer-link">Privacy Protocol</button>
          <button type="button" onClick={() => scrollTo("explore")} className="gg-footer-link">System Status</button>
        </div>

        <div className="gg-footer-copyright">
          © {new Date().getFullYear()} GEARGRID PRECISION. ALL RIGHTS RESERVED.
        </div>
      </footer>
    </div>
  );
}
