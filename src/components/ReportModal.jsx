import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { createPortal } from "react-dom";

const REASONS = [
  "Scam or fraud",
  "Item not as described",
  "No-show / unresponsive",
  "Other",
];

function ReportModalInner({ open, reportedUserId, reportedUserName, onClose }) {
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("You must be logged in to submit a report.");
      setSubmitting(false);
      return;
    }

    const { error: insertError } = await supabase.from("reports").insert({
      reporter_id: user.id,
      reported_user_id: reportedUserId,
      reason,
      details: details.trim(),
    });

    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setSubmitted(true);
  };

  const handleClose = () => {
    setSubmitted(false);
    setReason(REASONS[0]);
    setDetails("");
    setError("");
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {submitted ? (
          <>
            <h3 className="modal-title">Report submitted</h3>
            <p className="modal-message">
              Thanks — an admin will review this report on {reportedUserName || "this user"}.
            </p>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={handleClose}>
                Done
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <h3 className="modal-title">Report {reportedUserName || "this user"}</h3>
            <div className="field">
              <label htmlFor="reportReason">Reason</label>
              <select id="reportReason" value={reason} onChange={(e) => setReason(e.target.value)}>
                {REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="reportDetails">Details (optional)</label>
              <textarea
                id="reportDetails"
                rows={3}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Anything else admins should know?"
              />
            </div>
            {error && <div className="form-banner error">{error}</div>}
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={handleClose} disabled={submitting}>
                Cancel
              </button>
              <button type="submit" className="btn btn-danger" disabled={submitting}>
                {submitting ? "Submitting…" : "Submit report"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// Render into <body> so the overlay is centred on the screen. Inside the sticky,
// blurred header, "position: fixed" is measured against the header instead,
// which pushed the modal to the top of the page.
export default function ReportModal(props) {
  return createPortal(<ReportModalInner {...props} />, document.body);
}