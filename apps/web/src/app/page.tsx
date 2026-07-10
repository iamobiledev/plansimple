"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Org = { id: string; name: string; slug: string; role: string };

export default function HomePage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  async function load() {
    const me = await fetch("/api/auth/me");
    if (me.status === 401) {
      router.replace("/login");
      return;
    }
    const user = await me.json();
    setEmail(user.email);
    const res = await fetch("/api/organizations");
    setOrgs(await res.json());
  }

  useEffect(() => {
    void load();
  }, []);

  async function createOrg(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message || "Failed");
      return;
    }
    router.push(`/orgs/${data.id}`);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600 font-black text-white">
              PS
            </span>
            <span className="font-black">PlanSimple</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-500">{email}</span>
            <button className="btn-secondary" onClick={() => void logout()}>
              Log out
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-5xl space-y-8 px-6 py-8">
        <section className="panel p-6">
          <h1 className="text-2xl font-black">Your organizations</h1>
          <ul className="mt-4 space-y-2">
            {orgs.map((o) => (
              <li key={o.id}>
                <Link
                  className="block rounded-xl border border-slate-200 px-4 py-3 hover:bg-slate-50"
                  href={`/orgs/${o.id}`}
                >
                  <div className="font-semibold">{o.name}</div>
                  <div className="text-xs text-slate-500">
                    {o.slug} · {o.role}
                  </div>
                </Link>
              </li>
            ))}
            {!orgs.length && <li className="text-sm text-slate-500">No organizations yet.</li>}
          </ul>
        </section>
        <section className="panel p-6">
          <h2 className="text-lg font-bold">Create organization</h2>
          <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={createOrg}>
            <input className="field" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
            <input className="field" placeholder="slug-like-this" value={slug} onChange={(e) => setSlug(e.target.value)} required />
            {error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}
            <button className="btn-primary sm:col-span-2" type="submit">
              Create
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
