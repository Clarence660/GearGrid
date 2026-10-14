import { useState } from "react";
import { createPortal } from "react-dom";

function CancelModalInner({ open, onConfirm, onClose, submitting }) {
  const [reason, setReason] = useState("");

  if (!open) return null;

  const handleConfirm = () => {
    onConfirm(reason.trim());
    setReason("");
  };

  const handleClose = () => {
    setReason("");
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Cancel this transaction?</h3>
        <p className="modal-message">This can't be undone. Let the other party know why (optional).</p>
        <div className="field">
          <label htmlFor="cancelReason">Reason (optional)</label>
          <textarea
            id="cancelReason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Change of plans, item no longer needed…"
          />
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={handleClose} disabled={submitting}>
            Keep it
          </button>
          <button className="btn btn-danger" onClick={handleConfirm} disabled={submitting}>
            {submitting ? "Cancelling…" : "Cancel transaction"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Render into <body> so the overlay is centred on the screen. Inside the sticky,
// blurred header, "position: fixed" is measured against the header instead,
// which pushed the modal to the top of the page.
export default function CancelModal(props) {
  return createPortal(<CancelModalInner {...props} />, document.body);
}