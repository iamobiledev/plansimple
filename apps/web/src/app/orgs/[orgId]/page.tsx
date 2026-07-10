"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

type Project = { id: string; name: string; description: string | null };

export default function OrgPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/organizations/${orgId}/projects`);
    if (res.status === 401) {
      router.replace("/login");
      return;
    }
    if (!res.ok) {
      setError("Failed to load projects");
      return;
    }
    setProjects(await res.json());
  }

  useEffect(() => {
    void load();
  }, [orgId]);

  async function createProject(e: FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/organizations/${orgId}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message || "Failed");
      return;
    }
    router.push(`/orgs/${orgId}/projects/${data.id}`);
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <Link href="/" className="text-sm font-semibold text-blue-600">
          ← Organizations
        </Link>
      </header>
      <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        <section className="panel p-6">
          <h1 className="text-2xl font-black">Projects</h1>
          <ul className="mt-4 space-y-2">
            {projects.map((p) => (
              <li key={p.id}>
                <Link
                  className="block rounded-xl border border-slate-200 px-4 py-3 hover:bg-slate-50"
                  href={`/orgs/${orgId}/projects/${p.id}`}
                >
                  <div className="font-semibold">{p.name}</div>
                  {p.description && <div className="text-xs text-slate-500">{p.description}</div>}
                </Link>
              </li>
            ))}
            {!projects.length && <li className="text-sm text-slate-500">No projects yet.</li>}
          </ul>
        </section>
        <section className="panel p-6">
          <h2 className="text-lg font-bold">Create project</h2>
          <form className="mt-4 flex gap-2" onSubmit={createProject}>
            <input className="field" placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} required />
            <button className="btn-primary" type="submit">
              Create
            </button>
          </form>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </section>
      </div>
    </main>
  );
}
