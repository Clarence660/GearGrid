import { useEffect, useRef, useState } from "react";
import useLiveRefresh from "../lib/useLiveRefresh";
import { Link, useParams, useNavigate } from "react-router-dom";
import NavHeader from "../components/NavHeader";
import ReportModal from "../components/ReportModal";
import RatingModal from "../components/RatingModal";
import StarRating from "../components/StarRating";
import ReviewsList from "../components/ReviewsList";
import ChatModal from "../components/ChatModal";
import { supabase } from "../lib/supabaseClient";
import { QRCodeSVG } from "qrcode.react";
import { rentalDays as dayCount } from "../lib/rentalDays";

const formatPeso = (amount) => `₱${Number(amount).toLocaleString()}`;
const formatDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

const todayLocal = () =>
  new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0];

export default function EquipmentDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [owner, setOwner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [mode, setMode] = useState(null);
  const [activeImage, setActiveImage] = useState(0);

  const [currentUser, setCurrentUser] = useState(null);
  const [myVerification, setMyVerification] = useState(null);
  const [existingRequest, setExistingRequest] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [rentAgain, setRentAgain] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [requestError, setRequestError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tryToBuyOffer, setTryToBuyOffer] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);
const [chatOpen, setChatOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const modeSetForListing = useRef(null);
  useLiveRefresh(["transactions", "messages", "equipment", "ratings"], () => setRefreshTick((t) => t + 1));
  const [showPickupCode, setShowPickupCode] = useState(false);
  const [hasUnreadChat, setHasUnreadChat] = useState(false);
  const [myRating, setMyRating] = useState(null);
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [ownerRatingStats, setOwnerRatingStats] = useState({ avg: 0, count: 0 });

  useEffect(() => {
    let active = true;

    (async () => {
      const { data, error } = await supabase.from("equipment").select("*").eq("id", id).single();

      if (error || !data) {
        if (active) {
          setNotFound(true);
          setLoading(false);
        }
        return;
      }

      const { data: ownerData } = await supabase
        .from("public_profiles")
        .select("full_name, avatar_url, verification_status, created_at, payment_qr_url, payment_number")
        .eq("id", data.owner_id)
        .single();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      let myProfile = null;
      let myExisting = null;

      if (user) {
        const { data: p } = await supabase
          .from("profiles")
          .select("verification_status")
          .eq("id", user.id)
          .single();
        myProfile = p;

        const { data: existing } = await supabase
          .from("transactions")
          .select("*")
          .eq("equipment_id", id)
          .eq("requester_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        myExisting = existing;
      }

      // A transaction is "active" once the owner approves it — there is no separate
      // paid step anymore. Payment happens directly between buyer and owner at the
      // meetup, outside the app.
      const isActive = myExisting?.status === "approved";

      let myRatingRow = null;
      if (user && isActive && myExisting?.meetup_confirmed) {
        const { data: rr } = await supabase
          .from("ratings")
          .select("*")
          .eq("transaction_id", myExisting.id)
          .eq("rater_id", user.id)
          .maybeSingle();
        myRatingRow = rr;
      }

      const { data: ownerRatings } = await supabase
        .from("ratings")
        .select("rating")
        .eq("rated_user_id", data.owner_id);

      const ratingCount = (ownerRatings || []).length;
      const ratingAvg = ratingCount
        ? ownerRatings.reduce((s, r) => s + r.rating, 0) / ratingCount
        : 0;

      let unreadChat = false;
      if (user && isActive) {
        const { data: lastMsg } = await supabase
          .from("messages")
          .select("created_at, sender_id")
          .eq("transaction_id", myExisting.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastMsg && lastMsg.sender_id !== user.id) {
          const { data: readRow } = await supabase
            .from("message_reads")
            .select("last_read_at")
            .eq("transaction_id", myExisting.id)
            .eq("user_id", user.id)
            .maybeSingle();

          unreadChat = !readRow || new Date(lastMsg.created_at) > new Date(readRow.last_read_at);
        }
      }

      let myTryToBuyOffer = null;
      if (user && isActive && myExisting.transaction_type === "rent") {
        const { data: offer } = await supabase
          .from("transactions")
          .select("*")
          .eq("converts_transaction_id", myExisting.id)
          .eq("requester_id", user.id)
          .maybeSingle();
        myTryToBuyOffer = offer;
      }

      if (active) {
        setItem(data);
        setOwner(ownerData);
        if (modeSetForListing.current !== id) {
          setMode(data.rent_price_per_day ? "rent" : "buy");
          modeSetForListing.current = id;
        }
        setCurrentUser(user);
        setMyVerification(myProfile?.verification_status || null);
        setExistingRequest(myExisting);
        setTryToBuyOffer(myTryToBuyOffer);
        setMyRating(myRatingRow);
        setOwnerRatingStats({ avg: ratingAvg, count: ratingCount });
        setHasUnreadChat(unreadChat);
        setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
}, [id, refreshTick]);

  const submitLock = useRef(false);

  const handleSubmitRequest = async () => {
    if (submitLock.current) return; // ignore double-clicks while a request is in flight
    submitLock.current = true;
    try {
      await submitRequest();
    } finally {
      submitLock.current = false;
    }
  };

  const submitRequest = async () => {
    setRequestError("");

    if (mode === "rent") {
      if (!startDate || !endDate) {
        setRequestError("Pick a start and end date.");
        return;
      }
      if (new Date(endDate) < new Date(startDate)) {
        setRequestError("End date can't be before the start date.");
        return;
      }
      if (startDate < todayLocal()) {
        setRequestError("Start date can't be in the past.");
        return;
      }

      const { data: available, error: availabilityError } = await supabase.rpc(
        "is_equipment_available",
        {
          p_equipment_id: item.id,
          p_start_date: startDate,
          p_end_date: endDate,
        }
      );

      if (availabilityError) {
        setRequestError(availabilityError.message);
        return;
      }

      if (available === false) {
        setRequestError("Those dates are already booked. Please choose different dates.");
        return;
      }
    }

    setSubmitting(true);

    const price =
      mode === "rent"
        ? item.rent_price_per_day * dayCount(startDate, endDate)
        : item.buy_price;

    const { data, error } = await supabase
      .from("transactions")
      .insert({
        equipment_id: item.id,
        requester_id: currentUser.id,
        owner_id: item.owner_id,
        transaction_type: mode,
        start_date: mode === "rent" ? startDate : null,
        end_date: mode === "rent" ? endDate : null,
        price,
      })
      .select()
      .single();

    setSubmitting(false);

    if (error) {
      setRequestError(error.message);
      return;
    }

    setExistingRequest(data);
    setShowForm(false);
    setRentAgain(false);
  };

const handleDisputeDeposit = async () => {
    const { data, error } = await supabase
      .from("transactions")
      .update({ deposit_status: "disputed" })
      .eq("id", existingRequest.id)
      .select()
      .single();
    if (error) {
      window.alert(error.message);
      return;
    }
    setExistingRequest(data);
  };

  const handleOfferToBuy = async () => {
    setRequestError("");
    setSubmitting(true);

    const discountedPrice = Math.max(0, item.buy_price - existingRequest.price);

    const { data, error } = await supabase
      .from("transactions")
      .insert({
        equipment_id: item.id,
        requester_id: currentUser.id,
        owner_id: item.owner_id,
        transaction_type: "buy",
        price: discountedPrice,
        converts_transaction_id: existingRequest.id,
      })
      .select()
      .single();

    setSubmitting(false);

    if (error) {
      setRequestError(error.message);
      return;
    }

    setTryToBuyOffer(data);
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div className="loading-orb" />
        <p>Loading…</p>
      </div>
    );
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  if (notFound) {
    return (
      <div className="app-page">
        <NavHeader onLogout={handleLogout} />
        <main className="equipment-page">
          <p style={{ marginTop: 20 }}>This listing doesn't exist or was removed.</p>
        </main>
      </div>
    );
  }

  const hasRent = Boolean(item.rent_price_per_day);
  const hasBuy = Boolean(item.buy_price);
  const images = item.images || [];
  const isOwnListing = currentUser?.id === item.owner_id;
  const isVerified = myVerification === "verified";
  const isSold = Boolean(item.is_sold);

  const ownerInitials = owner?.full_name
    ? owner.full_name.split(" ").map((n) => n[0]).join("")
    : "?";
  const memberSinceYear = owner?.created_at ? new Date(owner.created_at).getFullYear() : null;
  const ownerHasPaymentInfo = Boolean(owner?.payment_qr_url || owner?.payment_number);

  const requestSummary = (r) =>
    r.transaction_type === "rent"
      ? `${formatDate(r.start_date)} → ${formatDate(r.end_date)} · ${formatPeso(r.price)} total`
      : `${formatPeso(r.price)} total`;

  return (
    <div className="app-page">
      <NavHeader onLogout={handleLogout} />
      <main className="equipment-page">
        <div className="equipment-layout">
        <div className="equipment-gallery">
          {images.length > 0 ? (
            <>
              <div className="equipment-gallery-main">
                <img src={images[activeImage]} alt={item.name} />
              </div>
              {images.length > 1 && (
                <div className="equipment-gallery-thumbs">
                  {images.map((src, i) => (
                    <button
                      key={src}
                      className={`equipment-thumb${i === activeImage ? " active" : ""}`}
                      onClick={() => setActiveImage(i)}
                      aria-label={`View image ${i + 1}`}
                    >
                      <img src={src} alt="" />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="equipment-gallery-main equipment-gallery-empty">No photos yet</div>
          )}
        </div>

        <div className="equipment-panel">
          <span className="eyebrow">{item.category}</span>
          <h1 className="equipment-title">{item.name}</h1>
          <p className="equipment-condition">Condition: {item.condition}</p>

          {!isSold && hasRent && hasBuy && !showForm && (
            <div className="equipment-mode-toggle">
              <button
                className={`mode-toggle-btn${mode === "rent" ? " active" : ""}`}
                onClick={() => setMode("rent")}
              >
                Rent
              </button>
              <button
                className={`mode-toggle-btn${mode === "buy" ? " active" : ""}`}
                onClick={() => setMode("buy")}
              >
                Buy
              </button>
            </div>
          )}

          <div className="equipment-price-block">
            {mode === "rent" ? (
              <>
                <span className="equipment-price">{formatPeso(item.rent_price_per_day)}</span>
                <span className="equipment-price-unit">/ day</span>
                {item.deposit_amount > 0 && (
                  <span className="equipment-price-unit"> · {formatPeso(item.deposit_amount)} refundable deposit</span>
                )}
              </>
            ) : (
              <>
                <span className="equipment-price">{formatPeso(item.buy_price)}</span>
                <span className="equipment-price-unit">one-time</span>
              </>
            )}
          </div>

          {isOwnListing ? (
            <div className="equipment-owner-controls">
              <p className="equipment-note">
                {isSold ? "This listing is marked as sold." : "This is your listing."}
              </p>
              <Link to={`/edit-listing/${item.id}`} className="btn btn-ghost btn-block">
                Edit Listing
              </Link>
            </div>
                ) : existingRequest && existingRequest.status === "approved" && !rentAgain ? (
            <div className="equipment-note approved">
              <p>✓ Approved!</p>
              <p className="equipment-note-detail">{requestSummary(existingRequest)}</p>

              {!existingRequest.meetup_confirmed && (
                <p className="equipment-note-detail">
                  Message the owner to arrange a pickup time and location. Pay them at the meetup, in cash or by e-wallet, whichever you both prefer.
                </p>
              )}

{existingRequest.transaction_type === "rent" &&
                existingRequest.deposit_status &&
                existingRequest.deposit_status !== "none" && (
                  <div className="owner-payment-block">
                    <p className="equipment-note-detail">
                      {{
                        pending: `Deposit: ${formatPeso(existingRequest.deposit_amount)}. Pay the owner at pickup (cash or e-wallet), along with the rental. It's refundable when you return the item in good condition.`,
                        held: `Deposit: ${formatPeso(existingRequest.deposit_amount)} is held by the owner and refunded when you return the item in good condition.`,
                        returned: "✓ Your deposit was returned.",
                        waived: "The owner waived your deposit.",
                        withheld: `The owner kept ${formatPeso(existingRequest.deposit_withheld_amount)} of your deposit: ${existingRequest.deposit_note}`,
                        disputed: "You've flagged the withheld deposit as disputed. You can also report the owner.",
                      }[existingRequest.deposit_status]}
                    </p>
                    {existingRequest.deposit_status === "withheld" && (
                      <button type="button" className="btn btn-ghost btn-block" onClick={handleDisputeDeposit}>
                        Dispute this
                      </button>
                    )}
                    <p className="equipment-note-detail">
                      Deposits are agreed between you and the owner. GearGrid doesn't hold or guarantee them.
                    </p>
                  </div>
                )}

              {ownerHasPaymentInfo && !existingRequest.meetup_confirmed && (
                <div className="owner-payment-block">
                  <p className="equipment-note-detail" style={{ marginBottom: 8 }}>
                  Prefer to pay by e-wallet? Scan this or use the number below:
                  </p>
                  {owner.payment_qr_url && (
                    <img src={owner.payment_qr_url} alt="Owner's payment QR code" className="owner-payment-qr" />
                  )}
                  {owner.payment_number && (
                    <p className="owner-payment-number">{owner.payment_number}</p>
                  )}
                </div>
              )}

              {existingRequest.meetup_confirmed ? (
                <p className="equipment-note-detail meetup-confirmed-note">
                  ✓ Meetup confirmed by the owner
                </p>
              ) : (
                  <div className="meetup-qr-block">
                  <button
                    type="button"
                    className="btn btn-ghost btn-block"
                    onClick={() => setShowPickupCode((v) => !v)}
                    style={{ marginBottom: 10 }}
                  >
                    {showPickupCode ? "Hide pickup code" : "Show pickup code"}
                  </button>
                  {showPickupCode && <QRCodeSVG value={existingRequest.id} size={140} />}
                  <p className="equipment-note-detail">
This is your pickup code, not a payment code. Tap the button above and show it to {owner?.full_name || "the owner"} at pickup so they can scan it and confirm the handoff.
                  </p>
                </div>
              )}

              <button
                type="button"
                className="btn btn-primary btn-block chat-trigger-btn"
                style={{ marginTop: 10 }}
                onClick={() => setChatOpen(true)}
              >
                💬 Message {owner?.full_name || "the owner"}
              </button>

              {existingRequest.meetup_confirmed &&
                (myRating ? (
                  <div className="equipment-note-detail">
                    <p>Your rating:</p>
                    <StarRating value={myRating.rating} readOnly size={14} />
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn btn-ghost btn-block"
                    style={{ marginTop: 10 }}
                    onClick={() => setRatingModalOpen(true)}
                  >
                    ★ Rate your experience
                  </button>
                ))}

              {existingRequest.transaction_type === "rent" && existingRequest.meetup_confirmed && !isSold && (
                <button
                  type="button"
                  className="btn btn-ghost btn-block"
                  style={{ marginTop: 10 }}
                  onClick={() => {
                    setRentAgain(true);
                    setShowForm(true);
                  }}
                >
                  Rent again
                </button>
              )}

              {existingRequest.transaction_type === "rent" && item.try_to_buy && hasBuy && !isSold && (
                tryToBuyOffer ? (
                  <p className="equipment-note-detail">
                    Try-to-Buy offer: <strong>{tryToBuyOffer.status}</strong>
                  </p>
                ) : (
                  <>
                    {requestError && <div className="form-banner error" style={{ marginTop: 10 }}>{requestError}</div>}
                    <button
                      className="btn btn-primary btn-block"
                      style={{ marginTop: 10 }}
                      onClick={handleOfferToBuy}
                      disabled={submitting}
                    >
                      {submitting ? "Sending…" : `Offer to Buy — ${formatPeso(Math.max(0, item.buy_price - existingRequest.price))}`}
                    </button>
                  </>
                )
              )}
            </div>
          ) : isSold ? (
            <p className="equipment-note">This item has already been sold.</p>
          ) : !currentUser ? (
            <Link to="/login" className="btn btn-primary btn-block">
              Log in to {mode === "rent" ? "rent" : "buy"}
            </Link>
          ) : existingRequest && existingRequest.status === "pending" ? (
            <div className="equipment-note pending">
              <p>Request sent — waiting on the owner.</p>
              <p className="equipment-note-detail">{requestSummary(existingRequest)}</p>
            </div>
          ) : !isVerified ? (
            <p className="equipment-note">Get verified to send rent/buy requests.</p>
          ) : showForm ? (
            <div className="request-form">
              {mode === "rent" && (
                <div className="request-form-dates">
                  <div className="field">
                    <label htmlFor="startDate">Start date</label>
                    <input
                      id="startDate"
                      type="date"
                      value={startDate}
                      min={todayLocal()}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="endDate">End date</label>
                    <input
                      id="endDate"
                      type="date"
                      value={endDate}
                      min={startDate || todayLocal()}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
              )}
              {mode === "rent" && startDate && endDate && new Date(endDate) >= new Date(startDate) && (
                <p className="request-form-preview">
                  {dayCount(startDate, endDate)} day{dayCount(startDate, endDate) > 1 ? "s" : ""} ·{" "}
                  {formatPeso(item.rent_price_per_day * dayCount(startDate, endDate))} total
                </p>
              )}
                {mode === "rent" && item.deposit_amount > 0 && (
                <p className="request-form-preview">
                  + {formatPeso(item.deposit_amount)} refundable deposit, paid directly to the owner at pickup (cash or e-wallet, whichever you both agree on).
                  Agreed between you and the owner; GearGrid doesn't hold or guarantee deposits.
                </p>
              )}
              {requestError && <div className="form-banner error">{requestError}</div>}
              <button
                className="btn btn-primary btn-block"
                onClick={handleSubmitRequest}
                disabled={submitting}
              >
                {submitting ? "Sending…" : "Confirm Request"}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-block"
                style={{ marginTop: 8 }}
                onClick={() => {
                  setShowForm(false);
                  setRentAgain(false);
                }}
                disabled={submitting}
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              {existingRequest?.status === "declined" && (
                <div className="equipment-note declined">
                  <p>
                    {existingRequest.decline_reason === "date_conflict"
                      ? "Your previous request wasn't approved — those dates were given to another renter first."
                      : existingRequest.decline_reason === "item_sold"
                      ? "Your previous request wasn't approved — this item has since been sold."
                      : "Your previous request wasn't approved by the owner."}
                  </p>
                </div>
              )}
              {existingRequest?.status === "cancelled" && (
                <div className="equipment-note declined">
                  <p>
                    Your previous {existingRequest.transaction_type === "rent" ? "rental" : "purchase"} was cancelled
                    {existingRequest.cancel_reason ? `: ${existingRequest.cancel_reason}` : "."}
                  </p>
                </div>
              )}
              <button className="btn btn-primary btn-block equipment-cta" onClick={() => setShowForm(true)}>
                {existingRequest?.status === "declined" || existingRequest?.status === "cancelled"
                  ? "Request Again"
                  : mode === "rent"
                  ? "Request to Rent"
                  : "Buy Now"}
              </button>
            </>
          )}

          <div className="equipment-owner-card">
            <div className="equipment-owner-avatar">
              {owner?.avatar_url ? (
                <img src={owner.avatar_url} alt={owner.full_name || "Owner"} />
              ) : (
                ownerInitials
              )}
            </div>
            <div>
              <p className="equipment-owner-name">
                {owner?.full_name || "Unknown owner"}
                {owner?.verification_status === "verified" && (
                  <span className="verified-badge">✓ Verified</span>
                )}
              </p>
              {memberSinceYear && (
                <p className="equipment-owner-meta">Member since {memberSinceYear}</p>
              )}
              {ownerRatingStats.count > 0 && (
                <p className="equipment-owner-meta owner-rating-line">
                  <StarRating value={Math.round(ownerRatingStats.avg)} readOnly size={13} />
                  {ownerRatingStats.avg.toFixed(1)} ({ownerRatingStats.count})
                </p>
              )}
            </div>
          </div>

          {currentUser && !isOwnListing && (
            <button type="button" className="report-trigger" onClick={() => setReportOpen(true)}>
              ⚑ Report this user
            </button>
          )}
        </div>
      </div>

      <ReportModal
        open={reportOpen}
        reportedUserId={item.owner_id}
        reportedUserName={owner?.full_name}
        onClose={() => setReportOpen(false)}
      />

      <ChatModal
        open={chatOpen}
        transactionId={existingRequest?.id}
        otherPartyName={owner?.full_name}
        currentUserId={currentUser?.id}
        onClose={() => setChatOpen(false)}
        onRead={() => setHasUnreadChat(false)}
      />

      <RatingModal
        open={ratingModalOpen}
        transactionId={existingRequest?.id}
        ratedUserId={item.owner_id}
        ratedUserName={owner?.full_name}
        onClose={() => setRatingModalOpen(false)}
        onSubmitted={(r) => {
          setMyRating(r);
          setRatingModalOpen(false);
        }}
      />

      <div className="equipment-info-grid">
          <div>
            <h2 className="equipment-section-title">Description</h2>
            <p className="equipment-description">
              {item.description?.trim() || "No description provided."}
            </p>
          </div>
          <div>
            <h2 className="equipment-section-title">Details</h2>
            <dl className="equipment-specs">
              <div className="equipment-spec-row">
                <dt>Category</dt>
                <dd>{item.category}</dd>
              </div>
              <div className="equipment-spec-row">
                <dt>Condition</dt>
                <dd>{item.condition}</dd>
              </div>
              <div className="equipment-spec-row">
                <dt>Listed</dt>
                <dd>{new Date(item.created_at).toLocaleDateString()}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="equipment-reviews-section">
          <h2 className="equipment-section-title">Reviews for {owner?.full_name || "this owner"}</h2>
          <ReviewsList userId={item.owner_id} />
        </div>
      </main>
    </div>
  );
}
