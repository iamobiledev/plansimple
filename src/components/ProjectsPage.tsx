import { useState } from "react";
import { useStore } from "../store";
import ProjectDialog from "./ProjectDialog";

export default function ProjectsPage() {
  const projects = useStore((s) => s.projects);
  const deleteProject = useStore((s) => s.deleteProject);
  const openProject = useStore((s) => s.openProject);
  const logout = useStore((s) => s.logout);
  const user = useStore((s) => s.user);
  const [creating, setCreating] = useState(false);

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
        <div className="projects-title-row">
          <h1>Projects</h1>
          <button className="btn primary" onClick={() => setCreating(true)}>
            + New project
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="empty-state big">
            <p className="muted">
              No projects yet. Create one, upload your PDF plan sheets, and start your takeoff.
            </p>
            <button className="btn primary" onClick={() => setCreating(true)}>
              + Create your first project
            </button>
          </div>
        ) : (
          <ul className="project-list">
            {projects.map((p) => (
              <li key={p.id}>
                <button className="project-card" onClick={() => void openProject(p.id)}>
                  <div className="project-card-main">
                    <span className="project-name">{p.name}</span>
                    {(p.address || p.clientName) && (
                      <span className="muted small">
                        {[p.clientName, p.address].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </div>
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

      {creating && <ProjectDialog project={null} onClose={() => setCreating(false)} />}
    </div>
  );
}
