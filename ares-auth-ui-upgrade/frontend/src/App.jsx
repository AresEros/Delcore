import React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight, ArrowRight, Asterisk, Check, CheckCircle2, ChevronRight,
  CircleHelp, Eye, EyeOff, Fingerprint, KeyRound, LockKeyhole, Mail,
  ShieldCheck, Sparkles, UserRound, Waves, Zap, LogOut
} from "lucide-react";

async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      ...options,
      credentials: "include",
      signal:AbortSignal.timeout(8000),
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });
  } catch {
    throw new Error("We couldn’t reach Ares. Check that both app terminals are running, then try again.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Request failed. Please try again.");
  return data;
}

function Brand({ light = false }) {
  return (
    <a className={`brand ${light ? "brand-light" : ""}`} href="/" aria-label="Ares home">
      <span className="brand-mark"><Asterisk size={23} strokeWidth={2.4} /></span>
      <span className="brand-word">ares<span>.</span></span>
    </a>
  );
}

function AuthField({
  label, name, type = "text", value, onChange, placeholder,
  icon: Icon, autoComplete, trailing, minLength, maxLength, required = true
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="input-wrap">
        <Icon className="input-icon" size={17} strokeWidth={1.8} aria-hidden="true" />
        <input
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
          spellCheck={name === "email" ? "false" : undefined}
        />
        {trailing}
      </span>
    </label>
  );
}

function PasswordStrength({ password }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password) && /[a-z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password)
  ];
  const score = checks.filter(Boolean).length;
  const label = !password ? "Use at least 8 characters" : score <= 1 ? "Could be stronger" : score === 2 ? "Getting stronger" : score === 3 ? "Strong password" : "Excellent password";
  return (
    <div className="strength-wrap" aria-live="polite">
      <div className="strength-bars" aria-label={`Password strength: ${score} of 4`}>
        {[0, 1, 2, 3].map((item) => <span key={item} className={item < score ? `strength-fill strength-${score}` : ""} />)}
      </div>
      <span className="strength-label">{label}</span>
    </div>
  );
}

function SecurityOrb() {
  return (
    <div className="visual-stage" aria-hidden="true">
      <div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit orbit-three" />
      <div className="orbit-node node-one" /><div className="orbit-node node-two" /><div className="orbit-node node-three" />
      <div className="core-glow" />
      <div className="core-card">
        <div className="core-top"><span className="core-mini-mark"><Asterisk size={17} /></span><span>ARES / CORE</span><span className="core-live"><i /> LIVE</span></div>
        <div className="core-emblem"><Fingerprint size={65} strokeWidth={1.05} /></div>
        <div className="core-status"><span><ShieldCheck size={15} /> Identity protected</span><span className="core-check"><Check size={13} /></span></div>
        <div className="core-lines"><i /><i /><i /></div>
      </div>
      <div className="float-chip chip-top"><span className="chip-icon"><LockKeyhole size={15} /></span><span><b>Encrypted access</b><small>Private by design</small></span><CheckCircle2 size={16} className="chip-check" /></div>
      <div className="float-chip chip-bottom"><span className="pulse-mark"><Waves size={16} /></span><span><b>Session active</b><small>Secure connection</small></span><span className="live-dot" /></div>
      <div className="visual-caption"><span>01</span><span className="caption-rule" /><span>SECURITY, REIMAGINED</span></div>
    </div>
  );
}

function Dashboard({ user, onLogout, busy }) {
  const firstName = (user.name || "there").trim().split(/\s+/)[0];
  return (
    <main className="signed-shell">
      <div className="signed-noise" />
      <header className="signed-nav"><Brand /><span className="signed-secure"><span className="live-dot" /> SESSION VERIFIED</span></header>
      <section className="signed-card">
        <div className="signed-icon"><Sparkles size={25} /></div>
        <p className="kicker">YOU’RE RIGHT WHERE YOU BELONG</p>
        <h1>Welcome back,<br /><span>{firstName}.</span></h1>
        <p className="signed-copy">Your personal space is ready. Your account and preferences are waiting for you.</p>
        <div className="profile-card">
          <div className="profile-avatar">{(user.name || "A").trim().charAt(0).toUpperCase()}</div>
          <div className="profile-details"><strong>{user.name}</strong><span>{user.email}</span></div>
          <span className="profile-verified"><Check size={13} /> VERIFIED</span>
        </div>
        <div className="session-note"><ShieldCheck size={17} /><span><strong>Your session is protected</strong><small>Stay signed in on this device for up to 7 days.</small></span></div>
        <button className="signout-button" onClick={onLogout} disabled={busy}><span>{busy ? "Signing out…" : "Sign out securely"}</span>{busy ? <span className="button-spinner" /> : <LogOut size={17} />}</button>
      </section>
      <footer className="signed-footer"><span>ARES IDENTITY SYSTEM</span><span>BUILT FOR PEACE OF MIND <Asterisk size={13} /></span></footer>
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
  const passwordHasValue = form.password.length > 0;

  useEffect(() => {
    let active = true;
    apiRequest("/api/auth/me")
      .then((data) => { if (active) setUser(data.user); })
      .catch(() => {})
      .finally(() => { if (active) setCheckingSession(false); });
    return () => { active = false; };
  }, []);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setError("");
    setMessage("");
  }

  function switchMode(nextMode) {
    if (busy) return;
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
        ? { email: form.email.trim(), password: form.password }
        : { name: form.name.trim(), email: form.email.trim(), password: form.password };
      const data = await apiRequest(endpoint, { method: "POST", body: JSON.stringify(payload) });
      setUser(data.user);
      setForm({ name: "", email: "", password: "" });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    setBusy(true);
    try {
      await apiRequest("/api/auth/logout", { method: "POST", body: "{}" });
      setUser(null);
      setMode("login");
      setForm({ name: "", email: "", password: "" });
      setMessage("You’ve signed out successfully.");
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (checkingSession) {
    return <main className="loading-screen"><div className="loading-mark"><Asterisk size={25} /></div><span className="loader" /><p>Establishing a secure connection…</p></main>;
  }
  if (user) return <Dashboard user={user} onLogout={handleLogout} busy={busy} />;

  return (
    <main className="app-shell">
      <div className="ambient ambient-a" /><div className="ambient ambient-b" /><div className="grid-glow" />
      <header className="top-nav"><Brand /><div className="nav-right"><span className="secure-label"><span className="secure-icon"><ShieldCheck size={14} /></span> PRIVATE BY DESIGN</span><span className="nav-divider" /><span className="edition-label">IDENTITY / 001</span></div></header>

      <section className="auth-layout">
        <aside className="story-panel">
          <div className="story-topline"><span className="live-dot" /> YOUR DIGITAL LIFE, IN SYNC <ArrowDownRight size={15} /></div>
          <div className="story-content">
            <p className="kicker">A NEW STANDARD OF ACCESS</p>
            <h1>Everything<br />that’s <span>yours.</span><br />One secure place.</h1>
            <p className="story-copy">Step into a quieter kind of technology. Your identity, your space, your pace — protected from the first click.</p>
            <SecurityOrb />
          </div>
          <div className="story-bottom"><span><span className="tiny-star">✳</span> BUILT AROUND YOU</span><span>DESIGNED TO FEEL DIFFERENT</span></div>
        </aside>

        <section className="form-panel">
          <div className="form-inner" key={mode}>
            <div className="mobile-brand"><Brand /></div>
            <div className="form-heading-row"><div className="form-symbol"><KeyRound size={20} /></div><span className="form-step">SECURE ACCESS <span>·</span> {mode === "login" ? "01" : "02"}</span></div>
            <p className="kicker">{mode === "login" ? "GOOD TO HAVE YOU BACK" : "YOUR NEXT CHAPTER STARTS HERE"}</p>
            <h2>{mode === "login" ? <>Welcome<br /><span className="heading-accent">back.</span></> : <>Make it<br /><span className="heading-accent">personal.</span></>}</h2>
            <p className="form-subtitle">{mode === "login" ? "Sign in to pick up right where you left off." : "Create your Ares account. It only takes a moment."}</p>

            <div className="mode-switch" role="tablist" aria-label="Choose sign in or create account">
              <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "mode-active" : ""} onClick={() => switchMode("login")}>Sign in <ChevronRight size={14} /></button>
              <button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "mode-active" : ""} onClick={() => switchMode("register")}>Create account <ChevronRight size={14} /></button>
            </div>

            {message && <div className="notice success-notice" role="status"><CheckCircle2 size={16} />{message}</div>}
            {error && <div className="notice error-notice" role="alert"><CircleHelp size={16} />{error}</div>}

            <form onSubmit={handleSubmit} className="auth-form">
              {mode === "register" && <AuthField label="FULL NAME" name="name" value={form.name} onChange={updateField} placeholder="Your name" icon={UserRound} autoComplete="name" minLength={2} maxLength={80} />}
              <AuthField label="EMAIL ADDRESS" name="email" type="email" value={form.email} onChange={updateField} placeholder="name@example.com" icon={Mail} autoComplete="email" maxLength={254} />
              <AuthField
                label="PASSWORD" name="password" type={showPassword ? "text" : "password"}
                value={form.password} onChange={updateField}
                placeholder={mode === "register" ? "Create a strong password" : "Enter your password"}
                icon={LockKeyhole} autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={mode === "register" ? 8 : 1} maxLength={72}
                trailing={<button className="reveal-button" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>}
              />
              {mode === "register" && <PasswordStrength password={form.password} />}
              {mode === "login" && <div className="form-options"><span className="subtle-note"><ShieldCheck size={14} /> Protected sign-in</span><span className="subtle-note">7-day session</span></div>}
              {mode === "register" && <p className="terms-note"><LockKeyhole size={13} /> Your password is hashed before storage and is never written to application logs.</p>}
              <button className="primary-button" type="submit" disabled={busy}>
                <span>{busy ? (mode === "login" ? "Signing you in…" : "Creating your account…") : (mode === "login" ? "Enter your space" : "Create secure account")}</span>
                {busy ? <span className="button-spinner" /> : <ArrowRight size={18} />}
              </button>
            </form>

            <p className="switch-prompt">{mode === "login" ? "New to Ares?" : "Already part of Ares?"} <button type="button" onClick={() => switchMode(mode === "login" ? "register" : "login")}>{mode === "login" ? "Create your account" : "Sign in instead"}</button></p>
            <div className="form-footer"><span><ShieldCheck size={14} /> PRIVATE. ENCRYPTED. YOURS.</span><span>ARES © 2026</span></div>
          </div>
        </section>
      </section>
      <footer className="page-footer"><span>IDENTITY IS PERSONAL.</span><span>SECURITY SHOULD BE SEAMLESS <Asterisk size={13} /></span></footer>
    </main>
  );
}
