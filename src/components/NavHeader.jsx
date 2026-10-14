import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import GearTag from "./GearTag";
import RequestsPanel from "./RequestsPanel";
import MessagesPanel from "./MessagesPanel";
import { supabase } from "../lib/supabaseClient";

export default function NavHeader({ onLogout, rightSlot, showRequests = true, showMessages = true, homePath = "/dashboard" }) {
  const location = useLocation();
  const onHome = location.pathname === homePath;
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
const [unreadMessageCount, setUnreadMessageCount] = useState(0);

  // Show the unread dot as soon as someone else sends us a message.
  useEffect(() => {
    if (!showMessages) return undefined;
    let channel;
    let mounted = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !mounted) return;
      channel = supabase
        .channel(`nav-messages-${user.id}-${Math.random().toString(36).slice(2)}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
          if (payload.new.sender_id !== user.id) setUnreadMessageCount((c) => c + 1);
        })
        .subscribe();
    })();
    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [showMessages]);
  const wrapRef = useRef(null);
  const messagesWrapRef = useRef(null);

  useEffect(() => {
const handleClickOutside = (e) => {
      // Clicks inside a pop-up (drawn on the page body) shouldn't close the panels.
      if (e.target.closest?.(".modal-overlay, .chat-dock")) return;
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setRequestsOpen(false);
      }
      if (messagesWrapRef.current && !messagesWrapRef.current.contains(e.target)) {
        setMessagesOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setRequestsOpen(false);
    setMessagesOpen(false);
  }, [location.pathname]);

  return (
    <header className="app-nav">
      <Link to={homePath} className="app-nav-logo">
        <GearTag size={44} variant="light" showWordmark />
      </Link>
      <div className="app-nav-actions">
        <Link
          to={homePath}
          className={`nav-icon-link${onHome ? " nav-icon-link-active" : ""}`}
          aria-label="Browse"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 11l9-8 9 8" />
            <path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" />
          </svg>
          <span className="nav-icon-label">Browse</span>
        </Link>

        {showRequests && (
          <div className="nav-requests-wrap" ref={wrapRef}>
            <button
              type="button"
              className={`nav-icon-link${requestsOpen ? " nav-icon-link-active" : ""}`}
              onClick={() => setRequestsOpen((v) => !v)}
              aria-label="My Requests"
              aria-expanded={requestsOpen}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                <rect x="9" y="3" width="6" height="4" rx="1" />
                <path d="M9 12h6M9 16h4" />
              </svg>
              <span className="nav-icon-label">My Requests</span>
            </button>
            <RequestsPanel open={requestsOpen} onClose={() => setRequestsOpen(false)} />
          </div>
        )}

        {showMessages && (
          <div className="nav-requests-wrap" ref={messagesWrapRef}>
            <button
              type="button"
              className={`nav-icon-link${messagesOpen ? " nav-icon-link-active" : ""}`}
              onClick={() => setMessagesOpen((v) => !v)}
              aria-label="Messages"
              aria-expanded={messagesOpen}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span className="nav-icon-label">Messages</span>
              {unreadMessageCount > 0 && <span className="unread-dot nav-badge-dot" />}
            </button>
            <MessagesPanel
              open={messagesOpen}
              onClose={() => setMessagesOpen(false)}
              onUnreadCountChange={setUnreadMessageCount}
            />
          </div>
        )}

        <Link
          to="/profile"
          className={`nav-icon-link${location.pathname === "/profile" ? " nav-icon-link-active" : ""}`}
          aria-label="Profile"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
          <span className="nav-icon-label">Profile</span>
        </Link>

        {rightSlot}

        <span className="nav-divider" aria-hidden="true" />

        <button className="nav-icon-link" onClick={onLogout} aria-label="Log out">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="M16 17l5-5-5-5" />
            <path d="M21 12H9" />
          </svg>
          <span className="nav-icon-label">Log out</span>
        </button>
      </div>
    </header>
  );
}