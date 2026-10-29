import { useEffect, useState } from "react";
import {
  ArrowRight, Asterisk, Check, Eye, EyeOff, Fingerprint,
  LockKeyhole, Mail, ShieldCheck, Sparkles, UserRound, Zap
} from "lucide-react";

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Request failed. Please try again.");
  return data;
}

function Brand() {
  return (
    <a className="brand" href="/" aria-label="Ares home">
      <span className="brand-mark"><Asterisk size={25} strokeWidth={2.5} /></span>
      <span>ares<span className="brand-period">.</span></span>
    </a>
  );
}

function AuthField({
  label, name, type = "text", value, onChange, placeholder,
  icon: Icon, autoComplete, trailing, required = true
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="input-wrap">
        <Icon className="input-icon" size={18} strokeWidth={1.8} aria-hidden="true" />
        <input
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          minLength={name === "password" ? 8 : undefined}
          maxLength={name === "name" ? 80 : undefined}
        />
        {trailing}
      </span>
    </label>
  );
}

function Dashboard({ user, onLogout }) {
  return (
    <main className="dashboard-shell">
      <nav className="top-nav"><Brand /><span className="secure-label"><ShieldCheck size={15} /> Secure workspace</span></nav>
      <section className="welcome-card">
        <div className="welcome-icon"><Sparkles size={25} /></div>
        <p className="eyebrow">YOUR SPACE. YOUR PACE.</p>
        <h1>Welcome in,<br /><span>{user.name.split(" ")[0]}.</span></h1>
        <p className="welcome-copy">You’re signed in and ready to pick up where you left off.</p>
        <div className="account-row">
          <div className="avatar">{user.name.trim().charAt(0).toUpperCase()}</div>
          <div className="account-meta"><strong>{user.name}</strong><span>{user.email}</span></div>
          <span className="verified"><Check size={14} /> Active</span>
        </div>
        <button className="primary-button" onClick={onLogout}>Sign out <ArrowRight size={17} /></button>
      </section>
      <p className="dashboard-foot">Protected by Ares security <LockKeyhole size={13} /></p>
    </main>
  );
}

export default function App() {
  const [mode, setMode] = useState("login");
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiRequest("/api/auth/me")
      .then((data) => setUser(data.user))
      .catch(() => {})
      .finally(() => setCheckingSession(false));
  }, []);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setError("");
    setMessage("");
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setError("");
    setMessage("");
    setShowPassword(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload = mode === "login"
        ? { email: form.email, password: form.password }
        : form;
      const data = await apiRequest(endpoint, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setUser(data.user);
      setForm({ name: "", email: "", password: "" });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    try {
      await apiRequest("/api/auth/logout", { method: "POST", body: "{}" });
    } finally {
      setUser(null);
      setMode("login");
      setMessage("You’ve signed out successfully.");
    }
  }

  if (checkingSession) {
    return <main className="loading-screen"><span className="loader" /><p>Preparing your space…</p></main>;
  }

  if (user) return <Dashboard user={user} onLogout={handleLogout} />;

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <nav className="top-nav"><Brand /><span className="secure-label"><ShieldCheck size={15} /> Private by design</span></nav>

      <section className="auth-layout">
        <aside className="story-panel">
          <div className="story-content">
            <div className="status-pill"><span className="status-dot" /> A BETTER WAY TO BEGIN</div>
            <h1>Your next chapter<br />starts <span>here.</span></h1>
            <p className="story-copy">A calmer, clearer space to focus on what matters. Everything you need, right where you need it.</p>
            <div className="feature-list">
              <div className="feature-item"><span className="feature-icon"><Fingerprint size={19} /></span><span><strong>Your space, protected</strong><small>Thoughtful security from day one</small></span><Check className="feature-check" size={17} /></div>
              <div className="feature-item"><span className="feature-icon"><Zap size={19} /></span><span><strong>Less friction, more flow</strong><small>Pick up right where you left off</small></span><Check className="feature-check" size={17} /></div>
            </div>
          </div>
          <div className="panel-bottom"><span>DESIGNED FOR YOUR NEXT MOVE</span><span>01 — 02</span></div>
          <div className="orb orb-large" /><div className="orb orb-small" />
        </aside>

        <section className="form-panel">
          <div className="form-inner" key={mode}>
            <div className="mobile-brand"><Brand /></div>
            <div className="form-symbol"><Sparkles size={21} /></div>
            <p className="eyebrow">{mode === "login" ? "WELCOME BACK" : "MAKE IT OFFICIAL"}</p>
            <h2>{mode === "login" ? "Good to see you." : "Create your space."}</h2>
            <p className="form-subtitle">{mode === "login" ? "Enter your details to sign in to your account." : "A few details and you’re ready to go."}</p>

            <div className="mode-switch" role="tablist" aria-label="Authentication mode">
              <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "mode-active" : ""} onClick={() => switchMode("login")}>Sign in</button>
              <button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "mode-active" : ""} onClick={() => switchMode("register")}>Create account</button>
            </div>

            {message && <div className="notice success-notice" role="status">{message}</div>}
            {error && <div className="notice error-notice" role="alert">{error}</div>}

            <form onSubmit={handleSubmit} className="auth-form">
              {mode === "register" && (
                <AuthField label="Full name" name="name" value={form.name} onChange={updateField} placeholder="How should we call you?" icon={UserRound} autoComplete="name" />
              )}
              <AuthField label="Email address" name="email" type="email" value={form.email} onChange={updateField} placeholder="you@example.com" icon={Mail} autoComplete="email" />
              <AuthField
                label="Password" name="password" type={showPassword ? "text" : "password"}
                value={form.password} onChange={updateField}
                placeholder={mode === "register" ? "At least 8 characters" : "Enter your password"}
                icon={LockKeyhole} autoComplete={mode === "login" ? "current-password" : "new-password"}
                trailing={<button className="reveal-button" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>}
              />
              {mode === "login" && <div className="form-options"><span className="subtle-note"><LockKeyhole size={13} /> Secure sign-in</span><span className="subtle-note">Welcome back</span></div>}
              {mode === "register" && <p className="terms-note">By creating an account, you agree to use this service responsibly.</p>}
              <button className="primary-button" type="submit" disabled={busy}>
                <span>{busy ? "Please wait…" : mode === "login" ? "Sign in to your account" : "Create your account"}</span>
                {busy ? <span className="button-spinner" /> : <ArrowRight size={18} />}
              </button>
            </form>
            <p className="switch-prompt">{mode === "login" ? "New around here?" : "Already have an account?"} <button type="button" onClick={() => switchMode(mode === "login" ? "register" : "login")}>{mode === "login" ? "Create an account" : "Sign in"}</button></p>
            <div className="form-footer"><span><ShieldCheck size={14} /> Your data stays yours</span><span>DelCore ARES © 2026</span></div>
          </div>
        </section>
      </section>
      <footer className="page-footer"><span>BUILT WITH INTENTION.</span><span>FOCUS ON WHAT’S NEXT <span className="footer-star">✳</span></span></footer>
    </main>
  );
}
