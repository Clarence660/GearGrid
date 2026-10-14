import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../lib/supabaseClient";

const initials = (name) =>
  name ? name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() : "?";

const formatDateDivider = (iso) => {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a, b) => a.toDateString() === b.toDateString();

  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

function ChatDock({ open, transactionId, otherPartyName, currentUserId, onClose, onRead }) {
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [minimized, setMinimized] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const onReadRef = useRef(onRead);
  onReadRef.current = onRead;

  useEffect(() => {
    if (!open || !transactionId) return undefined;

    let active = true;
    setLoading(true);
    setMinimized(false);

    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("transaction_id", transactionId)
        .order("created_at", { ascending: true });

      // Messages the user deleted from their own list stay hidden for them.
      const { data: hiddenRow } = await supabase
        .from("chat_hidden")
        .select("hidden_at")
        .eq("transaction_id", transactionId)
        .eq("user_id", currentUserId)
        .maybeSingle();
      const clearedAt = hiddenRow?.hidden_at ? new Date(hiddenRow.hidden_at) : null;

      if (active) {
        setMessages((data || []).filter((m) => !clearedAt || new Date(m.created_at) > clearedAt));
        setLoading(false);
        inputRef.current?.focus();
      }

      await supabase
        .from("message_reads")
        .upsert({ transaction_id: transactionId, user_id: currentUserId, last_read_at: new Date().toISOString() });

      onReadRef.current?.(transactionId);
    })();

    const channel = supabase
      .channel(`messages:${transactionId}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `transaction_id=eq.${transactionId}` },
        async (payload) => {
          setMessages((prev) => (prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]));
          if (payload.new.sender_id !== currentUserId) {
            await supabase
              .from("message_reads")
              .upsert({ transaction_id: transactionId, user_id: currentUserId, last_read_at: new Date().toISOString() });
          }
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [open, transactionId, currentUserId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, minimized]);

  if (!open) return null;

  const handleSend = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;

    setSending(true);
    setError("");

    const { error: insertError } = await supabase.from("messages").insert({
      transaction_id: transactionId,
      sender_id: currentUserId,
      body: body.trim(),
    });

    setSending(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setBody("");
    inputRef.current?.focus();
  };

  let lastDateLabel = null;

  return (
    <div className={`chat-dock${minimized ? " minimized" : ""}`} role="dialog" aria-label="Chat">
      <div className="chat-modal-header chat-dock-header" onClick={() => setMinimized((m) => !m)}>
        <div className="chat-modal-header-identity">
          <span className="chat-avatar">{initials(otherPartyName)}</span>
          <div>
            <p className="chat-modal-name">{otherPartyName || "GearGrid user"}</p>
            <p className="chat-modal-subtitle">Conversation for this transaction</p>
          </div>
        </div>
        <div className="chat-dock-actions">
          <button
            type="button"
            className="chat-modal-close"
            onClick={(e) => {
              e.stopPropagation();
              setMinimized((m) => !m);
            }}
            aria-label={minimized ? "Expand chat" : "Minimize chat"}
            title={minimized ? "Expand" : "Minimize"}
          >
            {minimized ? "▢" : "—"}
          </button>
          <button
            type="button"
            className="chat-modal-close"
            onClick={(e) => {
              e.stopPropagation();
              onClose?.();
            }}
            aria-label="Close chat"
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>

      {!minimized && (
        <>
          <div className="chat-messages" ref={scrollRef}>
            {loading ? (
              <div className="requests-panel-loading">
                <span className="loading-orb-inline" />
              </div>
            ) : messages.length === 0 ? (
              <div className="chat-empty">
                <span className="chat-empty-icon">💬</span>
                <p>No messages yet — say hello!</p>
              </div>
            ) : (
              messages.map((m) => {
                const label = formatDateDivider(m.created_at);
                const showDivider = label !== lastDateLabel;
                lastDateLabel = label;
                const mine = m.sender_id === currentUserId;

                return (
                  <div key={m.id}>
                    {showDivider && <div className="chat-date-divider">{label}</div>}
                    <div className={`chat-bubble-row ${mine ? "mine" : "theirs"}`}>
                      <div className={`chat-bubble ${mine ? "chat-bubble-mine" : "chat-bubble-theirs"}`}>
                        <p>{m.body}</p>
                      </div>
                      <span className="chat-bubble-time">
                        {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {error && (
            <div className="form-banner error" style={{ margin: "0 12px" }}>
              {error}
            </div>
          )}

          <form className="chat-input-row" onSubmit={handleSend}>
            <input
              ref={inputRef}
              type="text"
              placeholder="Type a message…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={sending}
            />
            <button type="submit" className="chat-send-btn" disabled={sending || !body.trim()} aria-label="Send">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2 11 13" />
                <path d="M22 2 15 22l-4-9-9-4 20-7z" />
              </svg>
            </button>
          </form>
        </>
      )}
    </div>
  );
}

// Drawn into <body> and docked at the bottom-right of the screen, like Messenger.
// It lives outside the page header (which has a blur effect) so "fixed" is measured against the screen.
export default function ChatModal(props) {
  return createPortal(<ChatDock {...props} />, document.body);
}