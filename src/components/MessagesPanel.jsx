import { useEffect, useState } from "react";
import ChatModal from "./ChatModal";
import useLiveRefresh from "../lib/useLiveRefresh";
import { supabase } from "../lib/supabaseClient";

const initials = (name) =>
  name ? name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() : "?";

const truncate = (text, max = 46) =>
  !text ? "" : text.length > max ? `${text.slice(0, max)}…` : text;

export default function MessagesPanel({ open, onClose, onUnreadCountChange }) {
  const [dockChat, setDockChat] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    loadConversations();
  }, [open]);

  useLiveRefresh(["messages", "transactions"], () => loadConversations(true), open);

  const loadConversations = async (silent = false) => {
    if (!silent) setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);

    const { data: transactions } = await supabase
      .from("transactions")
      .select("id, requester_id, owner_id, equipment_id, created_at")
      .in("status", ["approved", "paid"])
      .or(`requester_id.eq.${user.id},owner_id.eq.${user.id}`);

    const txList = transactions || [];
    if (txList.length === 0) {
      setConversations([]);
      setLoading(false);
      onUnreadCountChange?.(0);
      return;
    }

    const txIds = txList.map((t) => t.id);
    const otherPartyIds = [
      ...new Set(txList.map((t) => (t.requester_id === user.id ? t.owner_id : t.requester_id))),
    ];
    const equipmentIds = [...new Set(txList.map((t) => t.equipment_id))];

    const [{ data: profileRows }, { data: equipmentRows }, { data: readRows }, lastMessages] = await Promise.all([
      supabase.from("public_profiles").select("id, full_name, avatar_url").in("id", otherPartyIds),
      supabase.from("equipment").select("id, name").in("id", equipmentIds),
      supabase.from("message_reads").select("transaction_id, last_read_at").eq("user_id", user.id).in("transaction_id", txIds),
      Promise.all(
        txIds.map((txId) =>
          supabase
            .from("messages")
            .select("transaction_id, body, sender_id, created_at")
            .eq("transaction_id", txId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
            .then((res) => res.data)
        )
      ),
    ]);

    const profileMap = Object.fromEntries((profileRows || []).map((p) => [p.id, p]));
    const equipmentMap = Object.fromEntries((equipmentRows || []).map((e) => [e.id, e]));
    const readMap = Object.fromEntries((readRows || []).map((r) => [r.transaction_id, r.last_read_at]));

    const lastMessageByTx = {};
    lastMessages.filter(Boolean).forEach((m) => {
      lastMessageByTx[m.transaction_id] = m;
    });

    const convos = txList.map((t) => {
      const otherPartyId = t.requester_id === user.id ? t.owner_id : t.requester_id;
      const otherParty = profileMap[otherPartyId];
      const lastMessage = lastMessageByTx[t.id];
      const readAt = readMap[t.id];
      const unread = Boolean(
        lastMessage && lastMessage.sender_id !== user.id && (!readAt || new Date(lastMessage.created_at) > new Date(readAt))
      );

      return {
        transactionId: t.id,
        otherPartyId,
        otherPartyName: otherParty?.full_name || "GearGrid user",
        otherPartyAvatar: otherParty?.avatar_url || null,
        equipmentName: equipmentMap[t.equipment_id]?.name || "Unknown item",
        lastMessageText: lastMessage?.body || null,
        lastMessageAt: lastMessage?.created_at || t.created_at,
        unread,
      };
    });

    const { data: hiddenRows } = await supabase
      .from("chat_hidden")
      .select("transaction_id, hidden_at")
      .eq("user_id", user.id);
    const hiddenMap = Object.fromEntries(
      (hiddenRows || []).map((h) => [h.transaction_id, new Date(h.hidden_at)])
    );
    convos.splice(
      0,
      convos.length,
      ...convos.filter((c) => {
        const hiddenAt = hiddenMap[c.transactionId];
        if (!hiddenAt) return true;
        return Boolean(c.lastMessageText) && new Date(c.lastMessageAt) > hiddenAt;
      })
    );

    convos.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));

    setConversations(convos);
    setLoading(false);
    onUnreadCountChange?.(convos.filter((c) => c.unread).length);
  };

  // Open the conversation as a docked chat window (bottom-right) and close this list.
  const openThread = (convo) => {
    setDockChat({ transactionId: convo.transactionId, name: convo.otherPartyName });
    onClose?.();
  };

  const handleDeleteChat = async (convo) => {
    const ok = window.confirm(
      "Delete this chat from your Messages? The other person keeps their copy. It only comes back if they send you a new message."
    );
    if (!ok) return;

    const { error } = await supabase.from("chat_hidden").upsert({
      user_id: currentUserId,
      transaction_id: convo.transactionId,
      hidden_at: new Date().toISOString(),
    });
    if (error) {
      window.alert(error.message);
      return;
    }

    if (dockChat?.transactionId === convo.transactionId) setDockChat(null);

    setConversations((prev) => {
      const next = prev.filter((c) => c.transactionId !== convo.transactionId);
      onUnreadCountChange?.(next.filter((c) => c.unread).length);
      return next;
    });
  };

  const handleThreadRead = (transactionId) => {
    setConversations((prev) => {
      const next = prev.map((c) => (c.transactionId === transactionId ? { ...c, unread: false } : c));
      onUnreadCountChange?.(next.filter((c) => c.unread).length);
      return next;
    });
  };

  return (
    <>
      {open && (
        <div className="requests-panel messages-panel">
          <div className="requests-panel-header">
            <h3>Messages</h3>
            <button className="requests-panel-close" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>

          <div className="messages-list-body">
            {loading ? (
              <div className="requests-panel-loading">
                <span className="loading-orb-inline" />
              </div>
            ) : conversations.length === 0 ? (
              <p className="requests-panel-empty">
                No conversations yet — messages unlock once a request is approved.
              </p>
            ) : (
              conversations.map((c) => (
                <div className="convo-row-wrap" key={c.transactionId}>
                  <button type="button" className="convo-row" onClick={() => openThread(c)}>
                    <span className="convo-avatar">
                      {c.otherPartyAvatar ? (
                        <img src={c.otherPartyAvatar} alt={c.otherPartyName} />
                      ) : (
                        initials(c.otherPartyName)
                      )}
                    </span>
                    <span className="convo-text">
                      <span className="convo-name-row">
                        <span className="convo-name">{c.otherPartyName}</span>
                        {c.unread && <span className="unread-dot" />}
                      </span>
                      <span className="convo-item">{c.equipmentName}</span>
                      <span className="convo-preview">
                        {c.lastMessageText ? truncate(c.lastMessageText) : "Say hello!"}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="convo-delete-btn"
                    aria-label={`Delete chat with ${c.otherPartyName}`}
                    title="Delete chat"
                    onClick={() => handleDeleteChat(c)}
                  >
                    🗑
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <ChatModal
        open={Boolean(dockChat)}
        transactionId={dockChat?.transactionId}
        otherPartyName={dockChat?.name}
        currentUserId={currentUserId}
        onClose={() => setDockChat(null)}
        onRead={handleThreadRead}
      />
    </>
  );
}