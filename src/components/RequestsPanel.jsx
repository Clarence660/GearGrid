import { useEffect, useRef, useState } from "react";
import useLiveRefresh from "../lib/useLiveRefresh";
import { Link } from "react-router-dom";
import ConfirmDialog from "./ConfirmDialog";
import ReportModal from "./ReportModal";
import RatingModal from "./RatingModal";
import CancelModal from "./CancelModal";
import ChatModal from "./ChatModal";
import MeetupScanner from "./MeetupScanner";
import { supabase } from "../lib/supabaseClient";

const formatPeso = (amount) => `₱${Number(amount).toLocaleString()}`;

const datesOverlap = (aStart, aEnd, bStart, bEnd) =>
  new Date(aStart) <= new Date(bEnd) && new Date(bStart) <= new Date(aEnd);

const describeRange = (r) =>
  r.transaction_type === "rent" ? `${r.start_date} → ${r.end_date}` : "Purchase";

const FILTERS = [
  ["all", "All"],
  ["pending", "Pending"],
  ["approved", "Approved"],
  ["confirmed", "Meetup confirmed"],
];

function StatusBadge({ status }) {
  return <span className={`status-badge status-${status}`}>{status}</span>;
}

export default function RequestsPanel({ open, onClose }) {
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [myRequests, setMyRequests] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [actionError, setActionError] = useState("");
  const [conflictDialog, setConflictDialog] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);
  const [ratingTarget, setRatingTarget] = useState(null);
  const [myRatedTransactionIds, setMyRatedTransactionIds] = useState(new Set());
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [chatTarget, setChatTarget] = useState(null);
  const [unreadChatIds, setUnreadChatIds] = useState(new Set());
  const [refreshTick, setRefreshTick] = useState(0);
  const silentRefresh = useRef(false);
  useLiveRefresh(
    ["transactions"],
    () => {
      silentRefresh.current = true;
      setRefreshTick((t) => t + 1);
    },
    open
  );
  const [scanTarget, setScanTarget] = useState(null);

  // Filters and "remove from my list"
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [hiddenIds, setHiddenIds] = useState(new Set());
  const bulkMode = statusFilter === "approved" || statusFilter === "confirmed";

  const matchesFilter = (r) => {
    if (statusFilter === "pending") return r.status === "pending";
    if (statusFilter === "approved") return r.status === "approved" && !r.meetup_confirmed;
    if (statusFilter === "confirmed") return r.status === "approved" && Boolean(r.meetup_confirmed);
    return true;
  };

  const visibleRequests = (list) => list.filter((r) => !hiddenIds.has(r.id) && matchesFilter(r));

  const visibleIds = () =>
    [...new Set([...visibleRequests(myRequests), ...visibleRequests(incomingRequests)].map((r) => r.id))];

  const toggleSelect = (id) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleSelectAll = () => {
    const ids = visibleIds();
    setSelectedIds((prev) => (prev.size === ids.length ? new Set() : new Set(ids)));
  };

  const handleRemoveSelected = async () => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    const ok = window.confirm(
      `Remove ${ids.length} request(s) from your list? This only clears them from your view. The other person keeps their copy, and nothing is deleted from the system.`
    );
    if (!ok) return;

    const { error } = await supabase
      .from("request_hidden")
      .upsert(ids.map((id) => ({ user_id: currentUserId, transaction_id: id })));
    if (error) {
      setActionError(error.message);
      return;
    }
    setHiddenIds((prev) => new Set([...prev, ...ids]));
    setSelectedIds(new Set());
  };

  const loadAll = async (userId) => {
    const [{ data: asRequester }, { data: asOwner }] = await Promise.all([
      supabase
        .from("transactions")
        .select("*")
        .eq("requester_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("transactions")
        .select("*")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false }),
    ]);

    const equipmentIds = [
      ...new Set([...(asRequester || []), ...(asOwner || [])].map((r) => r.equipment_id)),
    ];
    const otherPartyIds = [
      ...new Set([
        ...(asRequester || []).map((r) => r.owner_id),
        ...(asOwner || []).map((r) => r.requester_id),
      ]),
    ];

    const [{ data: equipmentRows }, { data: profileRows }] = await Promise.all([
      equipmentIds.length
        ? supabase.from("equipment").select("id, name").in("id", equipmentIds)
        : Promise.resolve({ data: [] }),
      otherPartyIds.length
        ? supabase.from("public_profiles").select("id, full_name").in("id", otherPartyIds)
        : Promise.resolve({ data: [] }),
    ]);

    const equipmentMap = Object.fromEntries((equipmentRows || []).map((e) => [e.id, e]));
    const profileMap = Object.fromEntries((profileRows || []).map((p) => [p.id, p]));

    setMyRequests(
      (asRequester || []).map((r) => ({
        ...r,
        equipmentName: equipmentMap[r.equipment_id]?.name || "Unknown item",
        otherPartyName: profileMap[r.owner_id]?.full_name || "Unknown owner",
      }))
    );

    setIncomingRequests(
      (asOwner || []).map((r) => ({
        ...r,
        equipmentName: equipmentMap[r.equipment_id]?.name || "Unknown item",
        otherPartyName: profileMap[r.requester_id]?.full_name || "Unknown requester",
      }))
    );
  };

  useEffect(() => {
    if (!open) return;

    (async () => {
      if (!silentRefresh.current) setLoading(true);
      silentRefresh.current = false;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: myProfile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      setCurrentUserId(user.id);
      setIsOwner(myProfile?.role === "owner");
      await loadAll(user.id);

      const { data: hiddenRows } = await supabase
        .from("request_hidden")
        .select("transaction_id")
        .eq("user_id", user.id);
      setHiddenIds(new Set((hiddenRows || []).map((h) => h.transaction_id)));

      const { data: myRatings } = await supabase
        .from("ratings")
        .select("transaction_id")
        .eq("rater_id", user.id);
      setMyRatedTransactionIds(new Set((myRatings || []).map((r) => r.transaction_id)));

      const activeIds = [...myRequests, ...incomingRequests]
        .filter((r) => r.status === "approved")
        .map((r) => r.id);

      if (activeIds.length) {
        const [{ data: lastMessages }, { data: readRows }] = await Promise.all([
          supabase
            .from("messages")
            .select("transaction_id, created_at, sender_id")
            .in("transaction_id", activeIds)
            .order("created_at", { ascending: false }),
          supabase
            .from("message_reads")
            .select("transaction_id, last_read_at")
            .eq("user_id", user.id)
            .in("transaction_id", activeIds),
        ]);

        const latestByTx = {};
        (lastMessages || []).forEach((m) => {
          if (!latestByTx[m.transaction_id]) latestByTx[m.transaction_id] = m;
        });
        const readByTx = Object.fromEntries((readRows || []).map((r) => [r.transaction_id, r.last_read_at]));

        const unread = new Set();
        Object.entries(latestByTx).forEach(([txId, msg]) => {
          if (msg.sender_id === user.id) return;
          const readAt = readByTx[txId];
          if (!readAt || new Date(msg.created_at) > new Date(readAt)) unread.add(txId);
        });
        setUnreadChatIds(unread);
      }

      setLoading(false);
    })();
  }, [open, refreshTick]);

  const handleDecline = async (transactionId) => {
    setActionError("");
    const { error } = await supabase
      .from("transactions")
      .update({ status: "declined" })
      .eq("id", transactionId);

    if (error) {
      setActionError(error.message);
      return;
    }

    if (currentUserId) await loadAll(currentUserId);
  };

  const approveTransaction = async (transaction, conflictIds = []) => {
    setActionError("");

    const { error } = await supabase
      .from("transactions")
      .update({ status: "approved" })
      .eq("id", transaction.id);

    if (error) {
      if (error.code === "23P01" || error.message.includes("no_overlapping_approved_rentals")) {
        setActionError(
          "Can't approve this — it overlaps with another rental you've already approved for the same equipment."
        );
      } else {
        setActionError(error.message);
      }
      return;
    }

    if (conflictIds.length > 0) {
      const reason = transaction.transaction_type === "buy" ? "item_sold" : "date_conflict";
      await supabase
        .from("transactions")
        .update({ status: "declined", decline_reason: reason })
        .in("id", conflictIds);
    }

    setConflictDialog(null);
    if (currentUserId) await loadAll(currentUserId);
  };

  const handleCancelConfirm = async (reason) => {
    setCancelSubmitting(true);
    setActionError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("transactions")
      .update({ status: "cancelled", cancel_reason: reason || null, cancelled_by: user.id })
      .eq("id", cancelTarget.id);

    setCancelSubmitting(false);

    if (error) {
      setActionError(error.message);
      return;
    }

    setCancelTarget(null);
    if (currentUserId) await loadAll(currentUserId);
  };

  const handleApproveClick = async (r) => {
    setActionError("");

    if (r.transaction_type === "buy") {
      const today = new Date().toISOString().split("T")[0];
      const { data: activeRentals } = await supabase
        .from("transactions")
        .select("id, end_date")
        .eq("equipment_id", r.equipment_id)
        .eq("transaction_type", "rent")
        .eq("status", "approved")
        .gte("end_date", today);

      const blockingRentals = (activeRentals || []).filter((t) => t.id !== r.converts_transaction_id);

      if (blockingRentals.length > 0) {
        const latestEnd = blockingRentals.reduce(
          (latest, t) => (t.end_date > latest ? t.end_date : latest),
          blockingRentals[0].end_date
        );
        setActionError(
          `Can't approve this purchase — this item has an active or upcoming rental until ${latestEnd}. You can mark it sold after that rental ends.`
        );
        return;
      }
    }

    if (r.transaction_type === "rent") {
      const { data: overlapping } = await supabase
        .from("transactions")
        .select("id, start_date, end_date")
        .eq("equipment_id", r.equipment_id)
        .eq("transaction_type", "rent")
        .eq("status", "pending")
        .neq("id", r.id);

      const conflicts = (overlapping || []).filter((o) =>
        datesOverlap(o.start_date, o.end_date, r.start_date, r.end_date)
      );

      if (conflicts.length > 0) {
        setConflictDialog({ transaction: r, conflictIds: conflicts.map((c) => c.id), mode: "rent" });
        return;
      }
    } else {
      const { data: others } = await supabase
        .from("transactions")
        .select("id")
        .eq("equipment_id", r.equipment_id)
        .eq("status", "pending")
        .neq("id", r.id);

      if ((others || []).length > 0) {
        setConflictDialog({ transaction: r, conflictIds: others.map((o) => o.id), mode: "buy" });
        return;
      }
    }

    await approveTransaction(r);
  };

  const updateDeposit = async (r, patch) => {
    const { data, error } = await supabase
      .from("transactions")
      .update(patch)
      .eq("id", r.id)
      .select()
      .single();
    if (error) {
      window.alert(error.message);
      return;
    }
    setIncomingRequests((list) => list.map((x) => (x.id === r.id ? { ...x, ...data } : x)));
  };

  const handleWithholdDeposit = async (r) => {
    const amountText = window.prompt(
      `How much of the ${formatPeso(r.deposit_amount)} deposit are you keeping? (1 to ${r.deposit_amount})`
    );
    if (amountText === null) return;
    const amount = Number(amountText);
    if (!Number.isFinite(amount) || amount <= 0 || amount > Number(r.deposit_amount)) {
      window.alert("Enter an amount between 1 and the deposit.");
      return;
    }
    const note = window.prompt("Reason (required), for example: cracked lens, not returned");
    if (!note || note.trim().length < 5) {
      window.alert("Please give a short reason (at least 5 characters).");
      return;
    }
    await updateDeposit(r, {
      deposit_status: "withheld",
      deposit_withheld_amount: amount,
      deposit_note: note.trim(),
    });
  };

  const renderDepositControls = (r) => {
    if (r.transaction_type !== "rent" || !r.deposit_status || r.deposit_status === "none") return null;
    const amt = formatPeso(r.deposit_amount);
    const labels = {
      pending: `Deposit ${amt}: not collected yet`,
      held: `Deposit ${amt}: received`,
      returned: `Deposit ${amt}: returned`,
      waived: `Deposit ${amt}: waived`,
      withheld: `Deposit: kept ${formatPeso(r.deposit_withheld_amount)} of ${amt}`,
      disputed: `Deposit: renter disputed the ${formatPeso(r.deposit_withheld_amount)} withheld`,
    };
    return (
      <>
        <br />
        <span>{labels[r.deposit_status]}</span>
        {r.status === "approved" && r.meetup_confirmed && r.deposit_status === "pending" && (
          <>
            {" "}
            <button type="button" className="report-trigger" onClick={() => updateDeposit(r, { deposit_status: "held" })}>
              Mark received
            </button>{" "}
            <button type="button" className="report-trigger" onClick={() => updateDeposit(r, { deposit_status: "waived" })}>
              Waive
            </button>
          </>
        )}
        {r.deposit_status === "held" && (
          <>
            {" "}
            <button type="button" className="report-trigger" onClick={() => updateDeposit(r, { deposit_status: "returned" })}>
              Return in full
            </button>{" "}
            <button type="button" className="report-trigger" onClick={() => handleWithholdDeposit(r)}>
              Withhold…
            </button>
          </>
        )}
        {(r.deposit_status === "withheld" || r.deposit_status === "disputed") && r.deposit_note && (
          <>
            <br />
            <span>Reason: {r.deposit_note}</span>
          </>
        )}
      </>
    );
  };

  const sentVisible = visibleRequests(myRequests);
  const incomingVisible = visibleRequests(incomingRequests);

  return (
    <>
      {open && (
    <div className="requests-panel">
      <div className="requests-panel-header">
        <h3>My Requests</h3>
        <button className="requests-panel-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      <div className="requests-panel-body">
        {loading ? (
          <div className="requests-panel-loading">
            <span className="loading-orb-inline" />
          </div>
        ) : (
          <>
            {actionError && (
              <div className="form-banner error" style={{ margin: "0 16px 12px" }}>
                {actionError}
              </div>
            )}

            <div className="requests-panel-section">
              <div className="request-filter-bar">
                {FILTERS.map(([value, label]) => (
                  <button
                    type="button"
                    key={value}
                    className={`filter-pill ${statusFilter === value ? "active" : ""}`}
                    onClick={() => {
                      setStatusFilter(value);
                      setSelectedIds(new Set());
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {bulkMode && (
                <div className="request-bulk-bar">
                  <label className="request-select-all">
                    <input
                      type="checkbox"
                      checked={visibleIds().length > 0 && selectedIds.size === visibleIds().length}
                      onChange={handleSelectAll}
                    />
                    Select all
                  </label>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={handleRemoveSelected}
                    disabled={selectedIds.size === 0}
                  >
                    Remove selected ({selectedIds.size})
                  </button>
                </div>
              )}

              <p className="requests-panel-section-title">Sent</p>
              {sentVisible.length === 0 ? (
                <p className="requests-panel-empty">
                  {myRequests.length === 0 ? "You haven't requested anything yet." : "No requests match this filter."}
                </p>
              ) : (
                sentVisible.map((r) => (
                  <div className="requests-panel-item" key={r.id}>
                    {bulkMode && (
                      <label className="request-select">
                        <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)} />
                      </label>
                    )}
                    <div>
                      <Link to={`/equipment/${r.equipment_id}`} className="request-item-name" onClick={onClose}>
                        {r.equipmentName}
                      </Link>
                      <p className="request-row-meta">
                        {r.transaction_type === "rent" ? "Rent" : "Buy"} · {describeRange(r)} ·{" "}
                        {formatPeso(r.price)}
                      </p>
                      {r.status === "declined" && (
                        <p className="request-row-meta request-row-meta-reason">
                          {r.decline_reason === "date_conflict"
                            ? "Those dates were given to another renter."
                            : r.decline_reason === "item_sold"
                            ? "This item was sold to someone else."
                            : "Declined by the owner."}
                        </p>
                      )}
                      {r.status === "cancelled" && r.cancel_reason && (
                        <p className="request-row-meta request-row-meta-reason">Cancelled: {r.cancel_reason}</p>
                      )}
                      <div className="row-actions-inline">
                        <button
                          type="button"
                          className="report-trigger"
                          onClick={() => setReportTarget({ id: r.owner_id, name: r.otherPartyName })}
                        >
                          ⚑ Report
                        </button>
                        {r.status === "approved" && (
                          <button type="button" className="report-trigger" onClick={() => setCancelTarget(r)}>
                            Cancel
                          </button>
                        )}
                        {r.status === "approved" && (
                          <button
                            type="button"
                            className="report-trigger"
                            onClick={() => setChatTarget({ transactionId: r.id, userName: r.otherPartyName })}
                          >
                             Message
                            {unreadChatIds.has(r.id) && <span className="unread-dot" />}
                          </button>
                        )}
                        {r.status === "approved" && r.meetup_confirmed &&
                          (myRatedTransactionIds.has(r.id) ? (
                            <span className="rated-tag">★ Rated</span>
                          ) : (
                            <button
                              type="button"
                              className="report-trigger"
                              onClick={() =>
                                setRatingTarget({ transactionId: r.id, userId: r.owner_id, userName: r.otherPartyName })
                              }
                            >
                              ★ Rate
                            </button>
                          ))}
                      </div>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                ))
              )}
            </div>

            {isOwner && (
              <div className="requests-panel-section">
                <p className="requests-panel-section-title">Incoming</p>
                {incomingVisible.length === 0 ? (
                  <p className="requests-panel-empty">
                    {incomingRequests.length === 0
                      ? "No one has requested your equipment yet."
                      : "No requests match this filter."}
                  </p>
                ) : (
                  incomingVisible.map((r) => (
                    <div className="requests-panel-item" key={r.id}>
                      {bulkMode && (
                        <label className="request-select">
                          <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)} />
                        </label>
                      )}
                      <div>
                        <Link to={`/equipment/${r.equipment_id}`} className="request-item-name" onClick={onClose}>
                          {r.equipmentName}
                        </Link>
                        <p className="request-row-meta">
                          {r.transaction_type === "rent" ? "Rent" : "Buy"} · {describeRange(r)} ·{" "}
                          {formatPeso(r.price)} · From: {r.otherPartyName}
                          {renderDepositControls(r)}
                        </p>
                        <div className="row-actions-inline">
                          <button
                            type="button"
                            className="report-trigger"
                            onClick={() => setReportTarget({ id: r.requester_id, name: r.otherPartyName })}
                          >
                            ⚑ Report
                          </button>
                          {r.status === "approved" && (
                            <button type="button" className="report-trigger" onClick={() => setCancelTarget(r)}>
                              Cancel
                            </button>
                          )}
                          {r.status === "approved" && (
                            <button
                              type="button"
                              className="report-trigger"
                              onClick={() => setChatTarget({ transactionId: r.id, userName: r.otherPartyName })}
                            >
                              💬 Message
                            </button>
                          )}
                          {r.status === "approved" &&
                            (r.meetup_confirmed ? (
                              <span className="rated-tag">✓ Meetup confirmed</span>
                            ) : (
                              <button
                                type="button"
                                className="report-trigger"
                                onClick={() => setScanTarget({ id: r.id, otherPartyName: r.otherPartyName })}
                              >
                                📷 Scan to confirm meetup
                              </button>
                            ))}
                          {r.status === "approved" && r.meetup_confirmed &&
                            (myRatedTransactionIds.has(r.id) ? (
                              <span className="rated-tag">★ Rated</span>
                            ) : (
                              <button
                                type="button"
                                className="report-trigger"
                                onClick={() =>
                                  setRatingTarget({ transactionId: r.id, userId: r.requester_id, userName: r.otherPartyName })
                                }
                              >
                                ★ Rate
                              </button>
                            ))}
                        </div>
                      </div>
                      {r.status === "pending" ? (
                        <div className="request-row-actions">
                          <button className="btn btn-primary btn-sm" onClick={() => handleApproveClick(r)}>
                            Approve
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDecline(r.id)}>
                            Decline
                          </button>
                        </div>
                      ) : (
                        <StatusBadge status={r.status} />
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
      )}

      <ReportModal
        open={Boolean(reportTarget)}
        reportedUserId={reportTarget?.id}
        reportedUserName={reportTarget?.name}
        onClose={() => setReportTarget(null)}
      />

      <ChatModal
        open={Boolean(chatTarget)}
        transactionId={chatTarget?.transactionId}
        otherPartyName={chatTarget?.userName}
        currentUserId={currentUserId}
        onClose={() => setChatTarget(null)}
        onRead={(txId) => setUnreadChatIds((prev) => {
          const next = new Set(prev);
          next.delete(txId);
          return next;
        })}
      />

      <CancelModal
        open={Boolean(cancelTarget)}
        submitting={cancelSubmitting}
        onConfirm={handleCancelConfirm}
        onClose={() => setCancelTarget(null)}
      />

      <MeetupScanner
        key={scanTarget?.id || "closed"}
        open={Boolean(scanTarget)}
        transaction={scanTarget}
        onClose={() => setScanTarget(null)}
        onConfirmed={(txId) =>
          setIncomingRequests((prev) =>
            prev.map((r) => (r.id === txId ? { ...r, meetup_confirmed: true } : r))
          )
        }
      />

      <RatingModal
        open={Boolean(ratingTarget)}
        transactionId={ratingTarget?.transactionId}
        ratedUserId={ratingTarget?.userId}
        ratedUserName={ratingTarget?.userName}
        onClose={() => setRatingTarget(null)}
        onSubmitted={() => {
          setMyRatedTransactionIds((prev) => new Set(prev).add(ratingTarget.transactionId));
          setRatingTarget(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(conflictDialog)}
        title={conflictDialog?.mode === "buy" ? "Mark as sold?" : "Approve this request?"}
        message={
          conflictDialog?.mode === "buy"
            ? `This will mark the item as sold and automatically decline ${conflictDialog.conflictIds.length} other pending request${conflictDialog.conflictIds.length > 1 ? "s" : ""} for it. This can't be undone.`
            : `This will automatically decline ${conflictDialog?.conflictIds.length} other pending request${conflictDialog?.conflictIds.length > 1 ? "s" : ""} with conflicting dates for this item. This can't be undone.`
        }
        confirmLabel={conflictDialog?.mode === "buy" ? "Mark as sold" : "Approve & decline others"}
        onConfirm={() => approveTransaction(conflictDialog.transaction, conflictDialog.conflictIds)}
        onCancel={() => setConflictDialog(null)}
      />
    </>
  );
}