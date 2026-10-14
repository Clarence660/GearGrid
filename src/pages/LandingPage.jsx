import { useState } from "react";
import { Link } from "react-router-dom";
import "./LandingPage.css";

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState("all");

  const gridItems = [
    {
      id: "tactical-1",
      title: "Aeroshelter X-1",
      classTag: "CLASS: TACTICAL",
      version: "v1.0",
      status: "Available",
      statusType: "available",
      imgUrl: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=800&q=80",
    },
    {
      id: "speed-1",
      title: "Velocity V-Carbon",
      classTag: "CLASS: SPEED",
      version: "v2.1",
      status: "Limited",
      statusType: "limited",
      imgUrl: "https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=800&q=80",
    },
    {
      id: "optics-1",
      title: "Ocular HUD Pro",
      classTag: "CLASS: OPTICS",
      version: "v3.0",
      status: "Available",
      statusType: "available",
      imgUrl: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=800&q=80",
    },
  ];

  const athleteAvatars = [
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&h=100&q=80",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&h=100&q=80",
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&h=100&q=80",
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&h=100&q=80",
  ];

  return (
    <div className="gg-landing-root">
      {/* Top Navigation */}
      <header className="gg-nav-header">
        <Link to="/" className="gg-nav-brand">
          <img src="/logo.png" alt="GearGrid Logo" />
        </Link>

        <nav>
          <ul className="gg-nav-links">
            <li>
              <a href="#about" className="gg-nav-link">About Us</a>
            </li>
            <li>
              <a href="#rental-guide" className="gg-nav-link">Rental Guide</a>
            </li>
            <li>
              <a href="#explore" className="gg-nav-link active">Categories</a>
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </Link>

          <div className="gg-hero-stats">
            <div className="gg-stat-number">28K+</div>
            <div className="gg-stat-avatars">
              {athleteAvatars.map((src, i) => (
                <img key={i} src={src} alt="Active Athlete" className="gg-avatar-circle" />
              ))}
            </div>
            <span className="gg-stat-label">Active Athletes</span>
          </div>
        </div>

        {/* Right HUD Visual Frame */}
        <div className="gg-hero-visual">
          <div className="gg-hud-card">
            <div className="gg-hud-grid-lines" />

            {/* HUD interactive pins */}
            <div className="gg-hud-pin pin-top-left">
              <span className="gg-pin-dot" />
              Carbon Frame
            </div>

            <div className="gg-hud-pin pin-bottom-right">
              <span className="gg-pin-dot" />
              Pro Setup
            </div>

            {/* Wireframe Graphic SVG */}
            <svg viewBox="0 0 500 350" fill="none" style={{ width: "95%", height: "auto", filter: "drop-shadow(0 0 16px rgba(74, 222, 128, 0.25))" }}>
              <defs>
                <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#4ade80" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#15803d" stopOpacity="0.2" />
                </linearGradient>
              </defs>

              {/* Wireframe Geometry */}
              <circle cx="120" cy="240" r="75" stroke="#4ade80" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />
              <circle cx="120" cy="240" r="60" stroke="#22c55e" strokeWidth="1" opacity="0.3" />
              <circle cx="380" cy="240" r="75" stroke="#4ade80" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />
              <circle cx="380" cy="240" r="60" stroke="#22c55e" strokeWidth="1" opacity="0.3" />

              {/* Bike Frame Lines */}
              <path d="M120 240 L 230 230 L 330 140 L 200 140 Z" stroke="url(#lineGrad)" strokeWidth="3" strokeLinejoin="round" />
              <path d="M230 230 L 380 240 L 340 120" stroke="url(#lineGrad)" strokeWidth="3" strokeLinejoin="round" />
              <path d="M200 140 L 170 110 L 220 100" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M330 140 L 350 100 L 380 100" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" />

              {/* Pulse line chart overlay */}
              <path
                d="M40 70 L 100 70 L 115 45 L 125 90 L 140 60 L 150 70 L 250 70"
                stroke="#4ade80"
                strokeWidth="2"
                fill="none"
                opacity="0.85"
              />
              <text x="45" y="40" fill="#86efac" fontSize="11" fontFamily="monospace" letterSpacing="1">TELEMETRY SYNC: LIVE</text>
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

      {/* About Platform Section */}
      <section id="about" className="gg-about-section">
        <div className="gg-about-inner">
          <div className="gg-about-pill-badge">About Platform</div>

          <div className="gg-about-grid">
            <div className="gg-about-device-card">
              <img
                src="https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=700&q=80"
                alt="Lab equipment module"
              />
              <div className="gg-about-device-meta">
                <span>SPEC: LAB-VERIFIED</span>
                <span>STATUS: ACTIVE</span>
              </div>
            </div>

            <div className="gg-about-copy">
              <h2 className="gg-about-headline">
                GearGrid delivers <span className="highlight-green">professional performance</span> to your <em>pursuit</em>, balancing <span className="highlight-green">technical precision</span> with everyday athletic ambition.
              </h2>
              <p className="gg-about-subtext">
                We engineer a seamless marketplace bridging the gap between <span>elite sporting equipment</span> and everyday athletic ambition. We do not merely rent equipment; we distribute verified performance capability.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Explore the Grid Section */}
      <section id="explore" className="gg-explore-section">
        <div className="gg-explore-header">
          <h2 className="gg-explore-title">Explore the Grid</h2>
          <div className="gg-explore-arrows">
            <button className="gg-arrow-btn" aria-label="Previous">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <button className="gg-arrow-btn" aria-label="Next">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>

        <div className="gg-cards-grid">
          {gridItems.map((item) => (
            <div key={item.id} className="gg-card">
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
                  <Link to="/dashboard" className="gg-card-inspect">
                    Inspect ↗
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Rental Guide Section */}
      <section id="rental-guide" className="gg-guide-section">
        <div className="gg-guide-inner">
          <div className="gg-about-pill-badge">Rental Guide & Protocol</div>
          <div className="gg-guide-grid">
            <div className="gg-guide-step">
              <div className="gg-guide-step-num">PROTOCOL 01</div>
              <h3 className="gg-guide-step-title">Precision Selection</h3>
              <p className="gg-guide-step-desc">
                Browse peer-verified gear cataloged with detailed calibration metrics, serial identification, and usage history.
              </p>
            </div>

            <div className="gg-guide-step">
              <div className="gg-guide-step-num">PROTOCOL 02</div>
              <h3 className="gg-guide-step-title">Encrypted Meetup Hand-off</h3>
              <p className="gg-guide-step-desc">
                Meet the gear owner in person. When the physical inspection passes, scan the dynamic QR code to securely confirm handoff.
              </p>
            </div>

            <div className="gg-guide-step">
              <div className="gg-guide-step-num">PROTOCOL 03</div>
              <h3 className="gg-guide-step-title">Verified Return & Escrow</h3>
              <p className="gg-guide-step-desc">
                Return the gear seamlessly. Both parties confirm condition and ratings, releasing payments smoothly through the grid.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="gg-footer">
        <div className="gg-footer-logo">
          <img src="/logo.png" alt="GearGrid Logo" />
        </div>

        <div className="gg-footer-links">
          <a href="#about" className="gg-footer-link">Technical Support</a>
          <a href="#rental-guide" className="gg-footer-link">Rental Agreement</a>
          <a href="#about" className="gg-footer-link">Privacy Protocol</a>
          <a href="#explore" className="gg-footer-link">System Status</a>
        </div>

        <div className="gg-footer-copyright">
          © {new Date().getFullYear()} GEARGRID PRECISION. ALL RIGHTS RESERVED.
        </div>
      </footer>
    </div>
  );
}
