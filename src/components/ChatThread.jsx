import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

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

const MESSAGES_PAGE_SIZE = 30;

export default function ChatThread({ transactionId, currentUserId, onRead }) {
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [hasEarlier, setHasEarlier] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const clearedAtRef = useRef(null);

  useEffect(() => {
    if (!transactionId) return;

    let active = true;
    setLoading(true);

    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("transaction_id", transactionId)
        .order("created_at", { ascending: false })
        .limit(MESSAGES_PAGE_SIZE);

const { data: hiddenRow } = await supabase
        .from("chat_hidden")
        .select("hidden_at")
        .eq("transaction_id", transactionId)
        .eq("user_id", currentUserId)
        .maybeSingle();
      clearedAtRef.current = hiddenRow?.hidden_at ? new Date(hiddenRow.hidden_at) : null;

      const recent = (data || [])
        .reverse()
        .filter((m) => !clearedAtRef.current || new Date(m.created_at) > clearedAtRef.current);

      if (active) {
        setMessages(recent);
        setHasEarlier(recent.length === MESSAGES_PAGE_SIZE);
        setLoading(false);
        inputRef.current?.focus();
      }

      await supabase
        .from("message_reads")
        .upsert({ transaction_id: transactionId, user_id: currentUserId, last_read_at: new Date().toISOString() });

      onRead?.(transactionId);
    })();

    const channel = supabase
      .channel(`messages:${transactionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `transaction_id=eq.${transactionId}` },
        async (payload) => {
          setMessages((prev) => [...prev, payload.new]);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionId, currentUserId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const handleLoadEarlier = async () => {
    if (!messages.length) return;
    setLoadingEarlier(true);

    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("transaction_id", transactionId)
      .lt("created_at", messages[0].created_at)
      .order("created_at", { ascending: false })
      .limit(MESSAGES_PAGE_SIZE);

      const older = (data || [])
      .reverse()
      .filter((m) => !clearedAtRef.current || new Date(m.created_at) > clearedAtRef.current);
    setMessages((prev) => [...older, ...prev]);
    setHasEarlier(older.length === MESSAGES_PAGE_SIZE);
    setLoadingEarlier(false);
  };

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
    <>
      <div className="chat-messages" ref={scrollRef}>
        {loading ? (
          <div className="requests-panel-loading">
            <span className="loading-orb-inline" />
          </div>
        ) : (
          <>
            {hasEarlier && (
              <button type="button" className="chat-load-earlier" onClick={handleLoadEarlier} disabled={loadingEarlier}>
                {loadingEarlier ? "Loading…" : "Load earlier messages"}
              </button>
            )}
          </>
        )}
        {!loading && messages.length === 0 ? (
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
        <div className="form-banner error" style={{ margin: "0 16px" }}>
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
  );
}