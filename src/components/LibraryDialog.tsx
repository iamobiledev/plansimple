import { useState } from "react";
import { useStore } from "../store";
import type { MeasurementType } from "../types";

const TYPE_BADGE: Record<MeasurementType, string> = {
  linear: "╱",
  area: "▱",
  count: "⊕",
};

export default function LibraryDialog({ onClose }: { onClose: () => void }) {
  const library = useStore((s) => s.library);
  const project = useStore((s) => s.project);
  const addFromLibrary = useStore((s) => s.addFromLibrary);
  const deleteLibraryItem = useStore((s) => s.deleteLibraryItem);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const existingNames = new Set(project?.conditions.map((c) => c.name.toLowerCase()) ?? []);
  const filtered = library.filter((i) => i.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog wide" onClick={(e) => e.stopPropagation()}>
        <h2>Item library</h2>
        <p className="muted small">
          Your reusable takeoff items. Add them to any project, or save new ones from the item
          dialog.
        </p>
        {library.length > 4 && (
          <input
            placeholder="Search library…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        )}
        <div className="library-list">
          {library.length === 0 && (
            <p className="muted small pad">
              Your library is empty. When creating a takeoff item, check{" "}
              <em>&ldquo;Also save to my item library&rdquo;</em> to reuse it across projects.
            </p>
          )}
          {filtered.map((item) => {
            const alreadyAdded = existingNames.has(item.name.toLowerCase());
            return (
              <div key={item.id} className="library-item">
                {item.iconKey ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="library-icon" src={`/api/files/${item.iconKey}`} alt="" />
                ) : (
                  <span className="condition-swatch" style={{ background: item.color }} />
                )}
                <div className="condition-meta">
                  <span className="condition-name">{item.name}</span>
                  <span className="muted small">
                    {TYPE_BADGE[item.measurementType]} {item.measurementType} · {item.unit}
                    {item.unitCost != null ? ` · $${item.unitCost}/${item.unit}` : ""}
                  </span>
                </div>
                <button
                  className="btn small primary"
                  disabled={busyId === item.id || !project || alreadyAdded}
                  title={alreadyAdded ? "An item with this name is already in the project" : undefined}
                  onClick={async () => {
                    setBusyId(item.id);
                    await addFromLibrary(item).catch(() => {});
                    setBusyId(null);
                  }}
                >
                  {alreadyAdded ? "Added" : "Add to takeoff"}
                </button>
                <button
                  className="btn subtle danger tiny"
                  title="Remove from library"
                  onClick={() => {
                    if (confirm(`Remove "${item.name}" from your library?`)) {
                      void deleteLibraryItem(item.id);
                    }
                  }}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
        <div className="dialog-actions">
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
