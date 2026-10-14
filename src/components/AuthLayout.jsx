import { Link } from "react-router-dom";
import GearTag from "./GearTag";

export default function AuthLayout({ eyebrow, title, tagline, children }) {
  return (
    <div className="auth-split-shell">
      <aside className="auth-side">
        <div className="auth-side-grid" aria-hidden="true" />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", zIndex: 10, position: "relative" }}>
          <Link to="/" className="auth-side-logo" title="Back to Home">
            <GearTag size={52} variant="dark" showWordmark />
          </Link>
          <Link
            to="/"
            style={{
              color: "#86efac",
              fontSize: "13px",
              fontWeight: "700",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: "rgba(34, 197, 94, 0.12)",
              padding: "6px 14px",
              borderRadius: "20px",
              border: "1px solid rgba(74, 222, 128, 0.3)",
              transition: "all 0.2s ease",
            }}
          >
            ← Home
          </Link>
        </div>

        <div className="auth-side-copy">
          <span className="eyebrow">{eyebrow}</span>
          <h1 className="auth-side-title">{title}</h1>
          <p className="auth-side-tagline">{tagline}</p>
        </div>

        <div className="auth-side-tags" aria-hidden="true">
          <span className="mini-tag">BUY</span>
          <span className="mini-tag">RENT</span>
          <span className="mini-tag">VERIFIED</span>
        </div>
      </aside>

      <main className="auth-form-side">
        <div className="auth-panel-inner">{children}</div>
      </main>
    </div>
  );
}