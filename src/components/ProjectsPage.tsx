import { useState, type FormEvent } from "react";
import { useStore } from "../store";

export default function ProjectsPage() {
  const projects = useStore((s) => s.projects);
  const createProject = useStore((s) => s.createProject);
  const deleteProject = useStore((s) => s.deleteProject);
  const openProject = useStore((s) => s.openProject);
  const logout = useStore((s) => s.logout);
  const user = useStore((s) => s.user);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await createProject(name.trim());
      setName("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="projects-page">
      <header className="projects-header">
        <div className="brand">
          <span className="brand-mark">▰</span> PlanSimple
        </div>
        <div className="spacer" />
        <span className="muted small">{user?.email}</span>
        <button className="btn subtle" onClick={() => void logout()}>
          Sign out
        </button>
      </header>

      <main className="projects-main">
        <h1>Projects</h1>
        <form className="project-create" onSubmit={onCreate}>
          <input
            placeholder="New project name…"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn primary" disabled={busy || !name.trim()}>
            Create project
          </button>
        </form>

        {projects.length === 0 ? (
          <p className="muted">No projects yet — create one above, or run the seed script.</p>
        ) : (
          <ul className="project-list">
            {projects.map((p) => (
              <li key={p.id}>
                <button className="project-card" onClick={() => void openProject(p.id)}>
                  <span className="project-name">{p.name}</span>
                  <span className="muted small">
                    {p._count?.sheets ?? 0} sheet{(p._count?.sheets ?? 0) === 1 ? "" : "s"}
                  </span>
                </button>
                <button
                  className="btn subtle danger"
                  title="Delete project"
                  onClick={() => {
                    if (confirm(`Delete project "${p.name}" and all its data?`)) {
                      void deleteProject(p.id);
                    }
                  }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
