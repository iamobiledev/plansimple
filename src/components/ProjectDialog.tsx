import { useState, type FormEvent } from "react";
import { useStore } from "../store";
import type { Project } from "../types";

/** Create a new project (project == null) or edit the open project's info. */
export default function ProjectDialog({
  project,
  onClose,
}: {
  project: Project | null;
  onClose: () => void;
}) {
  const createProject = useStore((s) => s.createProject);
  const updateProject = useStore((s) => s.updateProject);
  const [name, setName] = useState(project?.name ?? "");
  const [address, setAddress] = useState(project?.address ?? "");
  const [clientName, setClientName] = useState(project?.clientName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const data = {
      name: name.trim(),
      address: address.trim() || null,
      clientName: clientName.trim() || null,
    };
    try {
      if (project) await updateProject(data);
      else await createProject(data);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save project");
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <form className="dialog" onClick={(e) => e.stopPropagation()} onSubmit={onSubmit}>
        <h2>{project ? "Project details" : "New project"}</h2>
        <p className="muted small">
          Project details appear on exported takeoff PDFs your customers see.
        </p>
        <label>
          Project name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Riverside Office Fit-Out"
            autoFocus
            required
          />
        </label>
        <label>
          Site address
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. 4250 Riverside Dr, Detroit, MI 48209"
          />
        </label>
        <label>
          Client
          <input
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="e.g. Motown Development Group"
          />
        </label>
        {error && <div className="form-error">{error}</div>}
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={busy || !name.trim()}>
            {project ? "Save" : "Create project"}
          </button>
        </div>
      </form>
    </div>
  );
}
