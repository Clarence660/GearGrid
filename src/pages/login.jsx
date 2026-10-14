import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import PasswordField from "../components/PasswordField";
import AuthLayout from "../components/AuthLayout";
import { supabase } from "../lib/supabaseClient";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const notice = location.state?.message || "";
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((er) => ({ ...er, [name]: "" }));
  };

  const validate = () => {
    const next = {};
    if (!form.identifier.trim()) next.identifier = "Enter your email.";
    if (!form.password) next.password = "Enter your password.";
    return next;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;

        setSubmitting(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: form.identifier.trim(),
      password: form.password,
    });

    if (error) {
      setSubmitting(false);
      if (error.code === "email_not_confirmed" || /not confirmed/i.test(error.message)) {
        setFormError(
          "Your email isn't verified yet. Choose Create an account and sign up again with the same email to get a new code."
        );
        return;
      }
      setFormError(error.message);
      return;
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", data.user.id)
      .single();

    setSubmitting(false);
    navigate(profileData?.is_admin ? "/admin" : "/dashboard");
  };

  return (
    <AuthLayout
      eyebrow="Sign in"
      title="Your gear is waiting."
      tagline="Log back in to browse listings, manage your rentals, and message equipment owners near you."
    >
      <div className="auth-panel-heading">
        <h2>Welcome back</h2>
        <p>Log in to your GearGrid account.</p>
      </div>

      {notice && <div className="form-banner success">{notice}</div>}
      {formError && <div className="form-banner error">{formError}</div>}

      <form onSubmit={handleSubmit} noValidate>
        <div className={`field${errors.identifier ? " has-error" : ""}`}>
          <label htmlFor="identifier">Email</label>
          <input
            id="identifier"
            name="identifier"
            type="email"
            placeholder="you@example.com"
            value={form.identifier}
            onChange={handleChange}
            autoComplete="username"
          />
          {errors.identifier && <span className="field-error">{errors.identifier}</span>}
        </div>

        <PasswordField
          id="password"
          label="Password"
          placeholder="Enter your password"
          value={form.password}
          onChange={handleChange}
          error={errors.password}
        />

        <p className="form-note" style={{ textAlign: "right", margin: "-4px 0 14px" }}>
          <Link to="/forgot-password">Forgot password?</Link>
        </p>

        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>

      <p className="form-note">
        New to GearGrid? <Link to="/register">Create an account</Link>
      </p>
    </AuthLayout>
  );
}