import { Link } from "react-router-dom";
import GearTag from "./GearTag";

export default function AuthLayout({ eyebrow, title, tagline, children }) {
  return (
    <div className="auth-split-shell">
      <aside className="auth-side">
        <div className="auth-side-grid" aria-hidden="true" />
        <Link to="/" className="auth-side-logo">
          <GearTag size={36} variant="dark" showWordmark />
        </Link>

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