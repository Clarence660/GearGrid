import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PasswordField from "../components/PasswordField";
import IdUploadField from "../components/IdUploadField";
import StepIndicator from "../components/StepIndicator";
import AuthLayout from "../components/AuthLayout";
import { supabase } from "../lib/supabaseClient";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ID_TYPES = ["Driver's License", "Passport", "National/Government ID", "Student ID"];
const STEPS = ["Account", "Email", "Verify ID"];
const OTP_LENGTH = 8;

export default function Register() {
  const navigate = useNavigate();

  const [step, setStep] = useState("details");
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "renter",
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");

  const [idType, setIdType] = useState(ID_TYPES[0]);
  const [idFile, setIdFile] = useState(null);
  const [idError, setIdError] = useState("");

  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpInfo, setOtpInfo] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const currentStepNum = step === "details" ? 1 : step === "otp" ? 2 : step === "verification" ? 3 : 4;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((er) => ({ ...er, [name]: "" }));
  };

  const validateDetails = () => {
    const next = {};
    if (!form.fullName.trim()) next.fullName = "Enter your full name.";
    if (!form.email.trim()) next.email = "Enter your email.";
    else if (!EMAIL_RE.test(form.email.trim())) next.email = "Enter a valid email address.";
    if (!form.password) next.password = "Create a password.";
    else if (form.password.length < 8) next.password = "Password must be at least 8 characters.";
    if (!form.confirmPassword) next.confirmPassword = "Confirm your password.";
    else if (form.confirmPassword !== form.password) next.confirmPassword = "Passwords don't match.";
    return next;
  };

  const handleDetailsSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    const next = validateDetails();
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: { data: { full_name: form.fullName.trim() } },
    });
    setSubmitting(false);

    if (error) {
      setFormError(error.message);
      return;
    }

    // Supabase returns an empty identities list when the email already has an account.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setFormError("This email is already registered. Try logging in instead.");
      return;
    }

    // If email confirmation is turned off in Supabase, we already have a session.
    if (data.session) {
      setStep("verification");
      return;
    }

    setOtp("");
    setOtpError("");
    setOtpInfo("");
    setCooldown(60);
    setStep("otp");
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    if (otp.length !== OTP_LENGTH) {
      setOtpError(`Enter the ${OTP_LENGTH}-digit code from your email.`);
      return;
    }
    setOtpError("");
    setOtpInfo("");
    setSubmitting(true);

    const { error } = await supabase.auth.verifyOtp({
      email: form.email.trim(),
      token: otp,
      type: "signup",
    });
    setSubmitting(false);

    if (error) {
      setOtpError("That code is incorrect or has expired. Check it or request a new one.");
      return;
    }
    setStep("verification");
  };

  const handleResendOtp = async () => {
    setOtpError("");
    setOtpInfo("");
    setResending(true);
    const { error } = await supabase.auth.resend({ type: "signup", email: form.email.trim() });
    setResending(false);
    if (error) {
      setOtpError(error.message);
      return;
    }
    setOtpInfo("A new code was sent. Check your inbox (and spam folder).");
    setCooldown(60);
  };

  const handleVerificationSubmit = async (e) => {
    e.preventDefault();
    if (!idFile) {
      setIdError("Please upload a photo or scan of your ID to continue.");
      return;
    }
    setIdError("");
    setFormError("");
    setSubmitting(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userId = user?.id;
    if (!userId) {
      setFormError("Your session expired. Please go back to the start and sign up again.");
      setSubmitting(false);
      return;
    }

    const { error: profileError } = await supabase.from("profiles").insert({
      id: userId,
      email: form.email.trim(),
      full_name: form.fullName.trim(),
      role: form.role,
      verification_status: "pending",
    });

    if (profileError) {
      setFormError(profileError.message);
      setSubmitting(false);
      return;
    }

    const filePath = `${userId}/${Date.now()}_${idFile.name}`;
    const { error: uploadError } = await supabase.storage.from("ids").upload(filePath, idFile);

    if (uploadError) {
      setFormError(
        `Your account was created, but the ID upload failed: ${uploadError.message}. You can try re-uploading from your dashboard.`
      );
      setSubmitting(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ id_type: idType, id_file_path: filePath })
      .eq("id", userId);

    setSubmitting(false);

    if (updateError) {
      setFormError(updateError.message);
      return;
    }

    setStep("pending");
  };

  const handleContinueToDashboard = () => {
    navigate("/dashboard");
  };

  let content;
  let layoutProps = {
    eyebrow: "Create account",
    title: "List it. Rent it. Play.",
    tagline: "Join GearGrid to buy and rent sports equipment from people near you, or start listing your own gear.",
  };

  if (step === "pending") {
    layoutProps = {
      eyebrow: "Almost there",
      title: "Sit tight.",
      tagline: "We review every ID submitted to keep GearGrid trustworthy for everyone.",
    };
    content = (
      <>
        <div className="pending-icon">⏳</div>
        <div className="auth-panel-heading" style={{ textAlign: "center" }}>
          <h2>Verification submitted</h2>
          <p>
            Thanks, {form.fullName.split(" ")[0] || "there"}. Your account has been created and
            your ID is under review. This usually takes 1–2 business days. We'll notify you by
            email once you're verified and able to fully use GearGrid.
          </p>
        </div>
        <button className="btn btn-primary btn-block" onClick={handleContinueToDashboard}>
          Continue to Dashboard
        </button>
      </>
    );
  } else if (step === "otp") {
    layoutProps = {
      eyebrow: "Step 2 of 3",
      title: "Check your inbox.",
      tagline: "We send a quick code to make sure your email is really yours.",
    };
    content = (
      <>
        <StepIndicator steps={STEPS} currentStep={currentStepNum} />

        <div className="auth-panel-heading">
          <h2>Verify your email</h2>
          <p>
            We sent a {OTP_LENGTH}-digit code to <strong>{form.email.trim()}</strong>. Enter it below.
          </p>
        </div>

        {otpInfo && <div className="form-banner success">{otpInfo}</div>}

        <form onSubmit={handleOtpSubmit} noValidate>
          <div className={`field${otpError ? " has-error" : ""}`}>
            <label htmlFor="otp">Verification code</label>
            <input
              id="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={OTP_LENGTH}
              placeholder="12345678"
              value={otp}
              onChange={(e) => {
                setOtp(e.target.value.replace(/\D/g, ""));
                setOtpError("");
              }}
              style={{ letterSpacing: "0.4em", textAlign: "center", fontSize: 22 }}
            />
            {otpError && <span className="field-error">{otpError}</span>}
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting || otp.length !== OTP_LENGTH}>
            {submitting ? "Verifying…" : "Verify email"}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-block"
            style={{ marginTop: 10 }}
            onClick={handleResendOtp}
            disabled={cooldown > 0 || resending}
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : resending ? "Sending…" : "Resend code"}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-block"
            style={{ marginTop: 10 }}
            onClick={() => {
              setStep("details");
              setOtp("");
              setOtpError("");
            }}
          >
            Use a different email
          </button>
        </form>
      </>
    );
  } else if (step === "verification") {
    layoutProps = {
      eyebrow: "Step 3 of 4",
      title: "Almost done.",
      tagline: "One quick ID check keeps every member of GearGrid accountable — buyers, renters, and owners alike.",
    };
    content = (
      <>
        <StepIndicator steps={STEPS} currentStep={currentStepNum} />

        <div className="auth-panel-heading">
          <h2>Verify your identity</h2>
          <p>GearGrid verifies every member — renters and owners alike — to keep the marketplace trustworthy.</p>
        </div>

        {formError && <div className="form-banner error">{formError}</div>}

        <form onSubmit={handleVerificationSubmit} noValidate>
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

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? "Submitting…" : "Submit for verification"}
          </button>
        </form>
      </>
    );
  } else {
    content = (
      <>
        <StepIndicator steps={STEPS} currentStep={currentStepNum} />

        <div className="auth-panel-heading">
          <h2>Create your account</h2>
          <p>It only takes a minute.</p>
        </div>

        {formError && <div className="form-banner error">{formError}</div>}

        <form onSubmit={handleDetailsSubmit} noValidate>
          <div className="field">
            <label>I'm signing up to</label>
            <div className="role-options">
              <label className={`role-card${form.role === "renter" ? " selected" : ""}`}>
                <input
                  type="radio"
                  name="role"
                  value="renter"
                  checked={form.role === "renter"}
                  onChange={handleChange}
                />
                <span className="role-card-title">Rent or buy gear</span>
                <span className="role-card-sub">Browse and use equipment</span>
              </label>
              <label className={`role-card${form.role === "owner" ? " selected" : ""}`}>
                <input
                  type="radio"
                  name="role"
                  value="owner"
                  checked={form.role === "owner"}
                  onChange={handleChange}
                />
                <span className="role-card-title">List my equipment</span>
                <span className="role-card-sub">You can still rent from others too</span>
              </label>
            </div>
          </div>

          <div className={`field${errors.fullName ? " has-error" : ""}`}>
            <label htmlFor="fullName">Full name</label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              placeholder="Jordan Reyes"
              value={form.fullName}
              onChange={handleChange}
              autoComplete="name"
            />
            {errors.fullName && <span className="field-error">{errors.fullName}</span>}
          </div>

          <div className={`field${errors.email ? " has-error" : ""}`}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
            />
            {errors.email && <span className="field-error">{errors.email}</span>}
          </div>

          <PasswordField
            id="password"
            label="Password"
            placeholder="At least 8 characters"
            value={form.password}
            onChange={handleChange}
            error={errors.password}
          />

          <PasswordField
            id="confirmPassword"
            label="Confirm password"
            placeholder="Re-enter your password"
            value={form.confirmPassword}
            onChange={handleChange}
            error={errors.confirmPassword}
          />

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? "Sending code…" : "Continue"}
          </button>
        </form>

        <p className="form-note">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </>
    );
  }

  return <AuthLayout {...layoutProps}>{content}</AuthLayout>;
}