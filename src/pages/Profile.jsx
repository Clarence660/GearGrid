import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import NavHeader from "../components/NavHeader";
import AvatarUploadField from "../components/AvatarUploadField";
import IdUploadField from "../components/IdUploadField";
import PasswordField from "../components/PasswordField";
import StarRating from "../components/StarRating";
import ReviewsList from "../components/ReviewsList";
import { supabase } from "../lib/supabaseClient";

const ID_TYPES = ["Driver's License", "Passport", "National/Government ID", "Student ID"];

export default function Profile() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [userId, setUserId] = useState(null);
  const [ratingStats, setRatingStats] = useState({ avg: 0, count: 0 });
  const [activeTab, setActiveTab] = useState("profile");

  // Avatar
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");

  // Name
  const [fullName, setFullName] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [nameError, setNameError] = useState("");

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordErrors, setPasswordErrors] = useState({});
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordFormError, setPasswordFormError] = useState("");

  // ID re-submission
  const [idType, setIdType] = useState(ID_TYPES[0]);
  const [idFile, setIdFile] = useState(null);
  const [idError, setIdError] = useState("");
  const [idSubmitting, setIdSubmitting] = useState(false);
  const [idSubmitted, setIdSubmitted] = useState(false);

  // Owner payment details (shown to buyers at pickup)
  const [paymentQrUploading, setPaymentQrUploading] = useState(false);
  const [paymentQrError, setPaymentQrError] = useState("");
  const [paymentNumber, setPaymentNumber] = useState("");
  const [paymentNumberSaving, setPaymentNumberSaving] = useState(false);
  const [paymentNumberSaved, setPaymentNumberSaved] = useState(false);
  const [paymentNumberError, setPaymentNumberError] = useState("");

  // Owner subscription
const [subscribing, setSubscribing] = useState(false);
  const [becomingOwner, setBecomingOwner] = useState(false);
  const [becomeOwnerError, setBecomeOwnerError] = useState("");
  const [subscribeError, setSubscribeError] = useState("");
  const [subscriptionBanner, setSubscriptionBanner] = useState(null);
  const needsSubscription = Boolean(location.state?.needsSubscription);
  const subscriptionParamHandled = useRef(false);

  useEffect(() => {
    let active = true;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate("/login");
        return;
      }

      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();

      const { data: myRatings } = await supabase
        .from("ratings")
        .select("rating")
        .eq("rated_user_id", user.id);

      const count = (myRatings || []).length;
      const avg = count ? myRatings.reduce((s, r) => s + r.rating, 0) / count : 0;

      if (active) {
        setRatingStats({ avg, count });
        setUserId(user.id);
        setProfile(data);
        setFullName(data?.full_name || "");
        setPaymentNumber(data?.payment_number || "");
        setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [navigate]);

  // After returning from PayMongo checkout. Guarded against React StrictMode's
  // dev-only double effect invocation — see the same pattern in EquipmentDetails.jsx.
  useEffect(() => {
    if (subscriptionParamHandled.current) return;
    subscriptionParamHandled.current = true;

    const params = new URLSearchParams(window.location.search);
    const subscriptionResult = params.get("subscription");

    if (subscriptionResult === "success") {
      setSubscriptionBanner("Subscription payment received! This can take a few seconds to confirm — refresh if it doesn't update.");
      // Give the webhook a moment, then refetch the profile to pick up the new status.
      setTimeout(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
        if (data) setProfile(data);
      }, 2500);
    } else if (subscriptionResult === "cancelled") {
      setSubscriptionBanner("Subscription checkout was cancelled — you can try again below.");
    }

    if (subscriptionResult) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const handleAvatarSelected = async (file) => {
    setAvatarError("");
    setAvatarUploading(true);

    const ext = file.name.split(".").pop();
    const path = `${userId}/avatar_${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file);

    if (uploadError) {
      setAvatarError(`Upload failed: ${uploadError.message}`);
      setAvatarUploading(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(path);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrlData.publicUrl })
      .eq("id", userId);

    setAvatarUploading(false);

    if (updateError) {
      setAvatarError(updateError.message);
      return;
    }

    setProfile((p) => ({ ...p, avatar_url: publicUrlData.publicUrl }));
  };

  const handlePaymentQrSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPaymentQrError("");
    setPaymentQrUploading(true);

    const ext = file.name.split(".").pop();
    const path = `${userId}/payment_qr_${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from("payment-qr").upload(path, file);

    if (uploadError) {
      setPaymentQrError(`Upload failed: ${uploadError.message}`);
      setPaymentQrUploading(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from("payment-qr").getPublicUrl(path);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ payment_qr_url: publicUrlData.publicUrl })
      .eq("id", userId);

    setPaymentQrUploading(false);

    if (updateError) {
      setPaymentQrError(updateError.message);
      return;
    }

    setProfile((p) => ({ ...p, payment_qr_url: publicUrlData.publicUrl }));
  };

  const handleSavePaymentNumber = async (e) => {
    e.preventDefault();
    setPaymentNumberError("");
    setPaymentNumberSaved(false);
    setPaymentNumberSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({ payment_number: paymentNumber.trim() || null })
      .eq("id", userId);

    setPaymentNumberSaving(false);

    if (error) {
      setPaymentNumberError(error.message);
      return;
    }

    setProfile((p) => ({ ...p, payment_number: paymentNumber.trim() || null }));
    setPaymentNumberSaved(true);
  };

const handleBecomeOwner = async () => {
    setBecomeOwnerError("");
    setBecomingOwner(true);
    const { error } = await supabase.rpc("become_owner");
    setBecomingOwner(false);
    if (error) {
      setBecomeOwnerError(error.message);
      return;
    }
    setProfile((p) => ({ ...p, role: "owner" }));
  };

  const handleSubscribe = async () => {
    setSubscribeError("");
    setSubscribing(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-paymongo-checkout`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const result = await res.json();
      setSubscribing(false);

      if (!res.ok || result.error) {
        setSubscribeError(result.error || "Something went wrong starting checkout.");
        return;
      }

      window.location.href = result.checkout_url;
    } catch (err) {
      setSubscribing(false);
      setSubscribeError("Couldn't reach the server. Check your connection and try again.");
    }
  };

  const handleSaveName = async (e) => {
    e.preventDefault();
    setNameError("");
    setNameSaved(false);

    if (!fullName.trim()) {
      setNameError("Enter your full name.");
      return;
    }

    setNameSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim() })
      .eq("id", userId);
    setNameSaving(false);

    if (error) {
      setNameError(error.message);
      return;
    }

    setProfile((p) => ({ ...p, full_name: fullName.trim() }));
    setNameSaved(true);
  };

  const validatePassword = () => {
    const next = {};
    if (!currentPassword) next.currentPassword = "Enter your current password.";
    if (!newPassword) next.newPassword = "Enter a new password.";
    else if (newPassword.length < 8) next.newPassword = "Password must be at least 8 characters.";
    if (!confirmPassword) next.confirmPassword = "Confirm your new password.";
    else if (confirmPassword !== newPassword) next.confirmPassword = "Passwords don't match.";
    return next;
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordFormError("");
    setPasswordSaved(false);
    const next = validatePassword();
    setPasswordErrors(next);
    if (Object.keys(next).length > 0) return;

    setPasswordSaving(true);

    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: currentPassword,
    });

    if (verifyError) {
      setPasswordSaving(false);
      setPasswordErrors((er) => ({ ...er, currentPassword: "Current password is incorrect." }));
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);

    if (error) {
      setPasswordFormError(error.message);
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordSaved(true);
  };

  const handleResubmitId = async (e) => {
    e.preventDefault();
    if (!idFile) {
      setIdError("Please upload a photo or scan of your ID to continue.");
      return;
    }
    setIdError("");
    setIdSubmitting(true);

    const filePath = `${userId}/${Date.now()}_${idFile.name}`;
    const { error: uploadError } = await supabase.storage.from("ids").upload(filePath, idFile);

    if (uploadError) {
      setIdError(`Upload failed: ${uploadError.message}`);
      setIdSubmitting(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ id_type: idType, id_file_path: filePath, verification_status: "pending" })
      .eq("id", userId);

    setIdSubmitting(false);

    if (updateError) {
      setIdError(updateError.message);
      return;
    }

    setProfile((p) => ({ ...p, verification_status: "pending" }));
    setIdSubmitted(true);
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div className="loading-orb" />
        <p>Loading…</p>
      </div>
    );
  }

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  const isOwner = profile?.role === "owner";
  const subscriptionActive =
    profile?.subscription_status === "active" &&
    profile?.subscription_expires_at &&
    new Date(profile.subscription_expires_at) > new Date();

  return (
    <div className="app-page">
      <NavHeader onLogout={handleLogout} />

      <main className="profile-main">
        <div className="dashboard-welcome">
          <div>
            <span className="eyebrow">Account</span>
            <h1>Your profile</h1>
            <p className="dashboard-sub">Update your photo, details, and password.</p>
          </div>
        </div>

        <section className="profile-card">
          <div className="profile-identity">
            <AvatarUploadField
              avatarUrl={profile?.avatar_url}
              initials={initials}
              onFileSelected={handleAvatarSelected}
              uploading={avatarUploading}
            />
            <div>
              <p className="profile-identity-name">{profile?.full_name || "Unnamed member"}</p>
              <p className="profile-identity-email">{profile?.email}</p>
              <div className="profile-identity-badges">
                {profile?.is_admin ? (
                  <span className="admin-badge">Admin</span>
                ) : (
                  <span className="mini-tag listing-mode">{profile?.role === "owner" ? "OWNER" : "RENTER"}</span>
                )}
                {profile?.verification_status === "verified" && (
                  <span className="verified-badge">✓ Verified</span>
                )}
                {profile?.verification_status === "pending" && (
                  <span className="status-badge status-pending">PENDING</span>
                )}
                {profile?.verification_status === "rejected" && (
                  <span className="status-badge status-declined">REJECTED</span>
                )}
              </div>
              {ratingStats.count > 0 && (
                <p className="equipment-owner-meta owner-rating-line" style={{ marginTop: 6 }}>
                  <StarRating value={Math.round(ratingStats.avg)} readOnly size={13} />
                  {ratingStats.avg.toFixed(1)} ({ratingStats.count} review{ratingStats.count > 1 ? "s" : ""})
                </p>
              )}
            </div>
          </div>
{avatarError && <div className="form-banner error" style={{ marginTop: 16 }}>{avatarError}</div>}

          {profile?.role === "renter" && !profile?.is_admin && (
            <div className="equipment-note" style={{ marginTop: 16 }}>
              <p><strong>Have equipment to rent out or sell?</strong></p>
              <p className="equipment-note-detail">
                Become an owner to list your own gear. Publishing listings needs an active owner subscription.
                You can still rent and buy from others.
              </p>
              {becomeOwnerError && <div className="form-banner error">{becomeOwnerError}</div>}
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleBecomeOwner}
                disabled={becomingOwner || profile?.verification_status !== "verified"}
                style={{ marginTop: 10 }}
              >
                {becomingOwner ? "Switching…" : "Become an owner"}
              </button>
              {profile?.verification_status !== "verified" && (
                <p className="equipment-note-detail">Your ID must be verified before you can become an owner.</p>
              )}
            </div>
          )}
        </section>

        {isOwner && (
          <section className="profile-card">
            <h2 className="equipment-section-title">Subscription</h2>
            <p className="dashboard-sub" style={{ marginBottom: 16 }}>
              An active subscription is required to publish new equipment listings.
            </p>

            {needsSubscription && !subscriptionActive && (
              <div className="form-banner error" style={{ marginBottom: 16 }}>
                You'll need an active subscription before you can list equipment.
              </div>
            )}
            {subscriptionBanner && (
              <div className="form-banner success" style={{ marginBottom: 16 }}>
                {subscriptionBanner}
              </div>
            )}

            {subscriptionActive ? (
              <div className="equipment-note approved">
                <p>✓ Subscription active</p>
                <p className="equipment-note-detail">
                  Renews or expires on {new Date(profile.subscription_expires_at).toLocaleDateString()}
                </p>
              </div>
            ) : (
              <>
                {subscribeError && <div className="form-banner error" style={{ marginBottom: 12 }}>{subscribeError}</div>}
                <button type="button" className="btn btn-primary" onClick={handleSubscribe} disabled={subscribing}>
                  {subscribing ? "Starting checkout…" : "Subscribe — 3 months"}
                </button>
              </>
            )}
          </section>
        )}

        {isOwner && (
          <section className="profile-card">
            <h2 className="equipment-section-title">Payment details</h2>
            <p className="dashboard-sub" style={{ marginBottom: 16 }}>
              Shown to buyers once you approve their request, so they know how to pay you directly at pickup.
            </p>

            <div className="field">
              <label>Payment QR code (GCash, Maya, or any QR Ph)</label>
              {profile?.payment_qr_url && (
                <img
                  src={profile.payment_qr_url}
                  alt="Your payment QR code"
                  className="owner-payment-qr"
                  style={{ marginBottom: 10 }}
                />
              )}
              <input type="file" accept="image/*" onChange={handlePaymentQrSelected} disabled={paymentQrUploading} />
              {paymentQrUploading && <p className="equipment-note-detail">Uploading…</p>}
              {paymentQrError && <span className="field-error">{paymentQrError}</span>}
            </div>

            <form onSubmit={handleSavePaymentNumber} noValidate>
              <div className="field">
                <label htmlFor="paymentNumber">GCash / Maya number (optional, shown alongside the QR)</label>
                <input
                  id="paymentNumber"
                  type="text"
                  placeholder="09XX XXX XXXX"
                  value={paymentNumber}
                  onChange={(e) => {
                    setPaymentNumber(e.target.value);
                    setPaymentNumberSaved(false);
                    setPaymentNumberError("");
                  }}
                />
                {paymentNumberError && <span className="field-error">{paymentNumberError}</span>}
              </div>
              {paymentNumberSaved && <div className="form-banner success">Payment number updated.</div>}
              <button type="submit" className="btn btn-primary" disabled={paymentNumberSaving}>
                {paymentNumberSaving ? "Saving…" : "Save payment number"}
              </button>
            </form>
          </section>
        )}

        <section className="profile-card">
          <h2 className="equipment-section-title">Reviews about you</h2>
          <ReviewsList userId={userId} />
        </section>

        <div className="profile-tabs">
          <button
            type="button"
            className={`profile-tab-btn${activeTab === "profile" ? " active" : ""}`}
            onClick={() => setActiveTab("profile")}
          >
            My Profile
          </button>
          <button
            type="button"
            className={`profile-tab-btn${activeTab === "security" ? " active" : ""}`}
            onClick={() => setActiveTab("security")}
          >
            Security
          </button>
        </div>

        {activeTab === "profile" && (
          <section className="profile-card">
            <h2 className="equipment-section-title">Personal information</h2>
            <form onSubmit={handleSaveName} noValidate>
              <div className={`field${nameError ? " has-error" : ""}`}>
                <label htmlFor="fullName">Full name</label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    setNameError("");
                    setNameSaved(false);
                  }}
                />
                {nameError && <span className="field-error">{nameError}</span>}
              </div>
              <div className="field">
                <label htmlFor="email">Email</label>
                <input id="email" type="email" value={profile?.email || ""} disabled />
              </div>
              {nameSaved && <div className="form-banner success">Name updated.</div>}
              <button type="submit" className="btn btn-primary" disabled={nameSaving}>
                {nameSaving ? "Saving…" : "Save changes"}
              </button>
            </form>
          </section>
        )}

        {activeTab === "security" && (
          <section className="profile-card">
            <h2 className="equipment-section-title">Change password</h2>
            <form onSubmit={handleChangePassword} noValidate>
              <PasswordField
                id="currentPassword"
                label="Current password"
                placeholder="Enter your current password"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  setPasswordErrors((er) => ({ ...er, currentPassword: "" }));
                  setPasswordSaved(false);
                }}
                error={passwordErrors.currentPassword}
              />
              <PasswordField
                id="newPassword"
                label="New password"
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setPasswordErrors((er) => ({ ...er, newPassword: "" }));
                  setPasswordSaved(false);
                }}
                error={passwordErrors.newPassword}
              />
              <PasswordField
                id="confirmNewPassword"
                label="Confirm new password"
                placeholder="Re-enter your new password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setPasswordErrors((er) => ({ ...er, confirmPassword: "" }));
                  setPasswordSaved(false);
                }}
                error={passwordErrors.confirmPassword}
              />
              {passwordFormError && <div className="form-banner error">{passwordFormError}</div>}
              {passwordSaved && <div className="form-banner success">Password updated.</div>}
              <button type="submit" className="btn btn-primary" disabled={passwordSaving}>
                {passwordSaving ? "Updating…" : "Update password"}
              </button>
            </form>
          </section>
        )}

        {profile?.verification_status === "rejected" && (
          <section className="profile-card">
            <h2 className="equipment-section-title">Re-submit ID verification</h2>
            <p className="dashboard-sub" style={{ marginBottom: 16 }}>
              Your last submission wasn't approved. Upload a new ID to try again.
            </p>

            {idSubmitted ? (
              <div className="form-banner pending">
                Your ID has been re-submitted and is now under review.
              </div>
            ) : (
              <form onSubmit={handleResubmitId} noValidate>
                <div className="field">
                  <label htmlFor="idType">ID type</label>
                  <select id="idType" value={idType} onChange={(e) => setIdType(e.target.value)}>
                    {ID_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <IdUploadField file={idFile} onFileChange={setIdFile} error={idError} />

                <button type="submit" className="btn btn-primary" disabled={idSubmitting}>
                  {idSubmitting ? "Submitting…" : "Submit for review"}
                </button>
              </form>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
