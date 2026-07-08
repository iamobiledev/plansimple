import { useState, type FormEvent } from "react";
import { useStore } from "../store";

export default function LoginPage() {
  const login = useStore((s) => s.login);
  const register = useStore((s) => s.register);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-center">
      <form className="auth-card" onSubmit={onSubmit}>
        <div className="brand">
          <span className="brand-mark">▰</span> PlanSimple
        </div>
        <p className="muted">Construction takeoff, in your browser.</p>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={mode === "register" ? 8 : undefined}
            required
          />
        </label>
        {error && <div className="form-error">{error}</div>}
        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? "…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
        <button
          type="button"
          className="btn link"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "New here? Create an account" : "Have an account? Sign in"}
        </button>
        <p className="muted small">
          Demo login after seeding: <code>demo@plansimple.dev</code> / <code>plansimple123</code>
        </p>
      </form>
    </div>
  );
}
