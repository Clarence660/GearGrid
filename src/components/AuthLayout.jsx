import { Link } from "react-router-dom";
import GearTag from "./GearTag";

export default function AuthLayout({ eyebrow, title, tagline, children }) {
  return (
    <div className="auth-split-shell">
      <aside className="auth-side">
        <div className="auth-side-grid" aria-hidden="true" />
        <div className="auth-side-copy">
          <Link to="/" className="auth-side-logo" title="GearGrid Home" style={{ margin: "16px 0 34px", display: "inline-block" }}>
            <GearTag size={68} variant="dark" showWordmark />
          </Link>
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