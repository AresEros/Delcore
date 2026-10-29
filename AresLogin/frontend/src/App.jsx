
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Fingerprint,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  UserRound,
  Waves,
} from "lucide-react";

const API_URL = "http://localhost:4000/api";

export default function App() {
  const [mode, setMode] = useState("login");
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  useEffect(() => {
    let active = true;

    fetch(`${API_URL}/auth/me`, {
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then((data) => {
        if (active && data?.user) setUser(data.user);
      })
      .catch(() => {
        // The user can still sign in if the server is unavailable.
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });

    return () => {
      active = false;
    };
  }, []);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setError("");
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setError("");
    setNotice("");
    setShowPassword(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);

    try {
      const response = await fetch(
        `${API_URL}/auth/${mode === "register" ? "register" : "login"}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            ...(mode === "register" ? { name: form.name } : {}),
            email: form.email,
            password: form.password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Authentication failed.");
      }

      setUser(data.user);
      setForm({ name: "", email: "", password: "" });
      setNotice(
        mode === "register"
          ? "Your account has been created successfully."
          : "Welcome back. You are now signed in."
      );
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "Unable to reach the server. Check that the backend is running."
          : err.message || "Something went wrong. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    setError("");
    setNotice("");

    try {
      const response = await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Could not sign out. Please try again.");
      }

      setUser(null);
      setMode("login");
      setNotice("You have signed out successfully.");
    } catch (err) {
      setError(err.message || "Unable to sign out.");
    }
  }

  if (checkingSession) {
    return (
      <main className="loading-screen">
        <div className="loading-mark">
          <Fingerprint size={32} />
        </div>
        <p>SECURELY CONNECTING</p>
        <span className="loading-line" />
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="grid-overlay" />

      <header className="topbar">
        <a
          className="brand"
          href="#home"
          onClick={(event) => event.preventDefault()}
          aria-label="Ares Auth home"
        >
          <span className="brand-symbol">
            <Waves size={22} strokeWidth={1.8} />
          </span>
          <span className="brand-name">
            ARES<span>AUTH</span>
          </span>
        </a>

        <div className="topbar-status">
          <span className="status-dot" />
          ENCRYPTED ACCESS
        </div>
      </header>

      <section className="auth-layout">
        <aside className="intro-panel">
          <div className="eyebrow">
            <span className="eyebrow-line" />
            YOUR SPACE. YOUR SECURITY.
          </div>

          <h1>
            Access your
            <br />
            world<span className="accent-dot">.</span>
          </h1>

          <p className="intro-copy">
            A calmer, smarter way to access your account. Built around
            privacy, designed around you.
          </p>

          <div className="security-card">
            <div className="security-icon">
              <ShieldCheck size={23} />
            </div>
            <div>
              <strong>Security comes first</strong>
              <p>Your password is never stored as plain text.</p>
            </div>
            <Check className="security-check" size={18} />
          </div>

          <div className="feature-row">
            <span>
              <LockKeyhole size={14} />
              Private by design
            </span>
            <span>
              <Sparkles size={14} />
              Made for you
            </span>
          </div>

          <div className="decorative-orbit orbit-one" />
          <div className="decorative-orbit orbit-two" />
          <div className="decorative-core">
            <Fingerprint size={66} strokeWidth={0.85} />
          </div>
        </aside>

        <section className="form-panel">
          {user ? (
            <div className="success-view">
              <div className="success-symbol">
                <ShieldCheck size={34} />
              </div>
              <span className="form-kicker">IDENTITY VERIFIED</span>
              <h2>You're in.</h2>
              <p className="form-description">
                Welcome, {user.name}. Your Ares Auth session is active.
              </p>

              <div className="account-card">
                <div className="account-avatar">
                  {user.name?.charAt(0)?.toUpperCase() || "A"}
                </div>
                <div className="account-details">
                  <strong>{user.name}</strong>
                  <span>{user.email}</span>
                </div>
                <span className="account-active">
                  <span className="status-dot" />
                  Active
                </span>
              </div>

              {notice && <p className="notice-message">{notice}</p>}
              {error && <p className="error-message">{error}</p>}

              <button
                className="submit-button"
                type="button"
                onClick={handleLogout}
              >
                <span>Sign out securely</span>
                <ArrowRight size={18} />
              </button>

              <p className="form-footer">
                <LockKeyhole size={13} />
                Your session is protected by a secure cookie.
              </p>
            </div>
          ) : (
            <>
              <div className="form-heading">
                <span className="form-kicker">
                  {mode === "login" ? "WELCOME BACK" : "YOUR JOURNEY STARTS HERE"}
                </span>
                <h2>
                  {mode === "login" ? "Sign in" : "Create account"}
                  <span className="accent-dot">.</span>
                </h2>
                <p className="form-description">
                  {mode === "login"
                    ? "Enter your details to continue to your account."
                    : "Create your secure account in just a moment."}
                </p>
              </div>

              <div className="mode-switch" role="tablist" aria-label="Authentication mode">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "login"}
                  className={mode === "login" ? "mode-active" : ""}
                  onClick={() => switchMode("login")}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "register"}
                  className={mode === "register" ? "mode-active" : ""}
                  onClick={() => switchMode("register")}
                >
                  Create account
                </button>
              </div>

              <form className="auth-form" onSubmit={handleSubmit}>
                {mode === "register" && (
                  <label className="field">
                    <span className="field-label">FULL NAME</span>
                    <span className="input-wrap">
                      <UserRound size={18} className="input-icon" />
                      <input
                        type="text"
                        name="name"
                        placeholder="Your full name"
                        value={form.name}
                        onChange={updateField}
                        minLength={2}
                        maxLength={80}
                        autoComplete="name"
                        required
                      />
                    </span>
                  </label>
                )}

                <label className="field">
                  <span className="field-label">EMAIL ADDRESS</span>
                  <span className="input-wrap">
                    <Mail size={18} className="input-icon" />
                    <input
                      type="email"
                      name="email"
                      placeholder="you@example.com"
                      value={form.email}
                      onChange={updateField}
                      maxLength={254}
                      autoComplete="email"
                      required
                    />
                  </span>
                </label>

                <label className="field">
                  <span className="field-label">PASSWORD</span>
                  <span className="input-wrap">
                    <LockKeyhole size={18} className="input-icon" />
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      placeholder="At least 8 characters"
                      value={form.password}
                      onChange={updateField}
                      minLength={8}
                      maxLength={72}
                      autoComplete={
                        mode === "login" ? "current-password" : "new-password"
                      }
                      required
                    />
                    <button
                      className="password-toggle"
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((value) => !value)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </span>
                  {mode === "register" && (
                    <span className="field-hint">
                      Use at least 8 characters.
                    </span>
                  )}
                </label>

                {error && (
                  <div className="error-message" role="alert">
                    {error}
                  </div>
                )}

                {notice && (
                  <div className="notice-message" role="status">
                    {notice}
                  </div>
                )}

                <button
                  className="submit-button"
                  type="submit"
                  disabled={busy}
                >
                  <span>
                    {busy
                      ? "Please wait..."
                      : mode === "login"
                        ? "Sign in securely"
                        : "Create your account"}
                  </span>
                  {!busy && <ArrowRight size={18} />}
                  {busy && <span className="button-spinner" />}
                </button>
              </form>

              <div className="form-divider">
                <span />
                <span>YOUR SECURITY MATTERS</span>
                <span />
              </div>

              <p className="form-footer">
                <ShieldCheck size={15} />
                Protected access. Passwords are hashed before storage.
              </p>

              <p className="switch-prompt">
                {mode === "login"
                  ? "New to Ares Auth?"
                  : "Already have an account?"}{" "}
                <button
                  type="button"
                  onClick={() =>
                    switchMode(mode === "login" ? "register" : "login")
                  }
                >
                  {mode === "login" ? "Create account" : "Sign in"}
                </button>
              </p>
            </>
          )}
        </section>
      </section>

      <footer className="page-footer">
        <span>© {new Date().getFullYear()}DelCore ARES AUTH</span>
        <span className="footer-center">
          <span className="status-dot" />
          SECURITY-FOCUSED ACCESS
        </span>
        <span>BUILT WITH CARE</span>
      </footer>
    </main>
  );
}
