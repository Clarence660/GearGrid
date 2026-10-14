import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PasswordField from "../components/PasswordField";
import AuthLayout from "../components/AuthLayout";
import { supabase } from "../lib/supabaseClient";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_LENGTH = 8;

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState("email"); // email -> code -> password
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendCode = async () => {
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim());
    return err;
  };

  const handleEmail = async (e) => {
    e.preventDefault();
    setError("");
    if (!EMAIL_RE.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    const err = await sendCode();
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    // Same message whether or not the email has an account, so nobody can probe for accounts.
    setInfo("If an account exists for that email, we've sent a code. Check your inbox and spam folder.");
    setOtp("");
    setCooldown(60);
    setStep("code");
  };

  const handleResend = async () => {
    setError("");
    setInfo("");
    setBusy(true);
    const err = await sendCode();
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setInfo("A new code was sent if the email has an account.");
    setCooldown(60);
  };

  const handleCode = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    if (otp.length !== OTP_LENGTH) {
      setError(`Enter the ${OTP_LENGTH}-digit code from your email.`);
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.verifyOtp({ email: email.trim(), token: otp, type: "recovery" });
    setBusy(false);
    if (err) {
      setError("That code is incorrect or has expired. Check it or request a new one.");
      return;
    }
    setStep("password");
  };

  const handlePassword = async (e) => {
    e.preventDefault();
    setError("");
    const next = {};
    if (!password) next.password = "Enter a new password.";
    else if (password.length < 8) next.password = "Password must be at least 8 characters.";
    if (!confirm) next.confirm = "Confirm your new password.";
    else if (confirm !== password) next.confirm = "Passwords don't match.";
    setFieldErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setBusy(false);
      setError(err.message);
      return;
    }
    await supabase.auth.signOut();
    setBusy(false);
    navigate("/login", { state: { message: "Password updated. Log in with your new password." } });
  };

  const heading =
    step === "email" ? ["Forgot your password?", "Enter your email and we'll send you a code."]
    : step === "code" ? ["Enter your code", `We sent a ${OTP_LENGTH}-digit code to ${email.trim()}.`]
    : ["Choose a new password", "Use at least 8 characters."];

  return (
    <AuthLayout
      eyebrow="Reset password"
      title="Back in the game."
      tagline="Verify your email with a quick code, then pick a new password."
    >
      <div className="auth-panel-heading">
        <h2>{heading[0]}</h2>
        <p>{heading[1]}</p>
      </div>

      {info && <div className="form-banner success">{info}</div>}
      {error && <div className="form-banner error">{error}</div>}

      {step === "email" && (
        <form onSubmit={handleEmail} noValidate>
          <div className="field">
            <label htmlFor="resetEmail">Email</label>
            <input
              id="resetEmail"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? "Sending…" : "Send code"}
          </button>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={handleCode} noValidate>
          <div className="field">
            <label htmlFor="resetOtp">Verification code</label>
            <input
              id="resetOtp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={OTP_LENGTH}
              placeholder="12345678"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              style={{ letterSpacing: "0.4em", textAlign: "center", fontSize: 22 }}
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={busy || otp.length !== OTP_LENGTH}>
            {busy ? "Checking…" : "Verify code"}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-block"
            style={{ marginTop: 10 }}
            onClick={handleResend}
            disabled={cooldown > 0 || busy}
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-block"
            style={{ marginTop: 10 }}
            onClick={() => {
              setStep("email");
              setError("");
              setInfo("");
            }}
          >
            Use a different email
          </button>
        </form>
      )}

      {step === "password" && (
        <form onSubmit={handlePassword} noValidate>
          <PasswordField
            id="newPassword"
            label="New password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setFieldErrors((f) => ({ ...f, password: "" }));
            }}
            error={fieldErrors.password}
          />
          <PasswordField
            id="confirmNewPassword"
            label="Confirm new password"
            placeholder="Re-enter your new password"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              setFieldErrors((f) => ({ ...f, confirm: "" }));
            }}
            error={fieldErrors.confirm}
          />
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? "Updating…" : "Update password"}
          </button>
        </form>
      )}

      <p className="form-note">
        Remembered it? <Link to="/login">Back to log in</Link>
      </p>
    </AuthLayout>
  );
}