import { useState } from "react";
import StarRating from "./StarRating";
import { supabase } from "../lib/supabaseClient";
import { createPortal } from "react-dom";

function RatingModalInner({ open, transactionId, ratedUserId, ratedUserName, onClose, onSubmitted }) {
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleClose = () => {
    setRating(0);
    setReviewText("");
    setError("");
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (rating === 0) {
      setError("Pick a star rating.");
      return;
    }

    setSubmitting(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error: insertError } = await supabase
      .from("ratings")
      .insert({
        transaction_id: transactionId,
        rater_id: user.id,
        rated_user_id: ratedUserId,
        rating,
        review_text: reviewText.trim() || null,
      })
      .select()
      .single();

    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    onSubmitted?.(data);
    setRating(0);
    setReviewText("");
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <h3 className="modal-title">Rate {ratedUserName || "this user"}</h3>
          <div className="field">
            <label>Rating</label>
            <StarRating value={rating} onChange={setRating} size={26} />
          </div>
          <div className="field">
            <label htmlFor="reviewText">Review (optional)</label>
            <textarea
              id="reviewText"
              rows={3}
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="How was your experience?"
            />
          </div>
          {error && <div className="form-banner error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={handleClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit rating"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Render into <body> so the overlay is centred on the screen. Inside the sticky,
// blurred header, "position: fixed" is measured against the header instead,
// which pushed the modal to the top of the page.
export default function RatingModal(props) {
  return createPortal(<RatingModalInner {...props} />, document.body);
}