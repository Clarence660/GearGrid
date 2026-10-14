import { useState } from "react";

export default function PasswordField({ id, label, value, onChange, error, placeholder }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`field${error ? " has-error" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <div className="password-row">
        <input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={id === "password" ? "current-password" : "new-password"}
        />
        <button
          type="button"
          className="toggle-visibility"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}