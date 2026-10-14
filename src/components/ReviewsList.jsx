import { useEffect, useState } from "react";
import StarRating from "./StarRating";
import { supabase } from "../lib/supabaseClient";

export default function ReviewsList({ userId, limit = 10 }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      if (!userId) return;
      setLoading(true);

      const { data: ratings } = await supabase
        .from("ratings")
        .select("*")
        .eq("rated_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      const raterIds = [...new Set((ratings || []).map((r) => r.rater_id))];
      const { data: raters } = raterIds.length
        ? await supabase.from("public_profiles").select("id, full_name").in("id", raterIds)
        : { data: [] };
      const raterMap = Object.fromEntries((raters || []).map((p) => [p.id, p.full_name]));

      if (active) {
        setReviews(
          (ratings || []).map((r) => ({
            ...r,
            raterName: raterMap[r.rater_id] || "A GearGrid user",
          }))
        );
        setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [userId, limit]);

  if (loading) {
    return (
      <div className="requests-panel-loading">
        <span className="loading-orb-inline" />
      </div>
    );
  }

  if (reviews.length === 0) {
    return <p className="owner-section-empty">No reviews yet.</p>;
  }

  return (
    <div className="reviews-list">
      {reviews.map((r) => (
        <div className="review-item" key={r.id}>
          <div className="review-item-header">
            <StarRating value={r.rating} readOnly size={13} />
            <span className="review-item-name">{r.raterName}</span>
            <span className="review-item-date">{new Date(r.created_at).toLocaleDateString()}</span>
          </div>
          {r.review_text && <p className="review-item-text">{r.review_text}</p>}
        </div>
      ))}
    </div>
  );
}