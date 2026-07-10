"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("demo@plansimple.dev");
  const [password, setPassword] = useState("plansimple123");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Login failed");
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="blueprint-grid flex min-h-screen items-center justify-center p-6">
      <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-2 lg:items-center">
        <section className="hidden lg:block">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-lg font-black text-white">
              PS
            </span>
            <div>
              <div className="text-lg font-black">PlanSimple</div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
                Construction Docs
              </div>
            </div>
          </div>
          <h1 className="mt-10 text-4xl font-black tracking-tight">
            Coordinate drawings, markups, and project teams without the noise.
          </h1>
          <p className="mt-4 text-slate-600">
            Vercel-native PlanSimple — Neon Postgres, Blob storage, browser PDF viewer.
          </p>
        </section>
        <section className="panel p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">
            Welcome back
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight">Sign in to PlanSimple</h2>
          <form className="mt-8 space-y-5" onSubmit={onSubmit}>
            <label className="block space-y-2">
              <span className="label">Email</span>
              <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label className="block space-y-2">
              <span className="label">Password</span>
              <input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
            {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
            <button className="btn-primary w-full" disabled={busy}>
              {busy ? "Signing in..." : "Sign in"}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-500">
            New to PlanSimple?{" "}
            <Link className="font-semibold text-blue-600" href="/signup">
              Create an account
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
