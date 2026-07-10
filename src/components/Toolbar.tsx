import { useStore } from "../store";
import type { MeasurementType, Tool } from "../types";

const TOOLS: Array<{ id: Tool; label: string; icon: string; title: string; needs?: MeasurementType }> = [
  { id: "select", label: "Select", icon: "➤", title: "Select & pan (V)" },
  { id: "pan", label: "Pan", icon: "✋", title: "Pan (H)" },
  { id: "calibrate", label: "Calibrate", icon: "📏", title: "Calibrate scale — draw a line over a known dimension" },
  { id: "linear", label: "Linear", icon: "╱", title: "Linear measurement — click points, double-click to finish", needs: "linear" },
  { id: "area", label: "Area", icon: "▱", title: "Area measurement — click points, double-click to close", needs: "area" },
  { id: "count", label: "Count", icon: "⊕", title: "Count — click to drop markers", needs: "count" },
  { id: "ai-count", label: "AI Count", icon: "✨", title: "AI Count — drag a box around one example symbol", needs: "count" },
  { id: "ai-area", label: "AI Area", icon: "✨▱", title: "AI Area — click inside a room to auto-trace it", needs: "area" },
];

export default function Toolbar() {
  const tool = useStore((s) => s.tool);
  const setTool = useStore((s) => s.setTool);
  const project = useStore((s) => s.project);
  const activeConditionId = useStore((s) => s.activeConditionId);
  const setActiveCondition = useStore((s) => s.setActiveCondition);
  const showToast = useStore((s) => s.showToast);
  const undoStack = useStore((s) => s.undoStack);
  const redoStack = useStore((s) => s.redoStack);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);

  function pickTool(t: (typeof TOOLS)[number]) {
    if (t.needs && project) {
      const active = project.conditions.find((c) => c.id === activeConditionId);
      if (!active || active.measurementType !== t.needs) {
        const match = project.conditions.find((c) => c.measurementType === t.needs);
        if (!match) {
          showToast(`Create a ${t.needs} condition first (right panel)`);
          return;
        }
        setActiveCondition(match.id);
      }
    }
    setTool(t.id);
  }

  return (
    <div className="toolbar">
      {TOOLS.map((t) => (
        <button
          key={t.id}
          className={`tool-btn ${tool === t.id ? "active" : ""} ${t.id.startsWith("ai") ? "ai" : ""}`}
          title={t.title}
          onClick={() => pickTool(t)}
        >
          <span className="tool-icon">{t.icon}</span>
          {t.label}
        </button>
      ))}
      <div className="toolbar-sep" />
      <button className="tool-btn" disabled={undoStack.length === 0} onClick={() => void undo()} title="Undo (Ctrl+Z)">
        ↩ Undo
      </button>
      <button className="tool-btn" disabled={redoStack.length === 0} onClick={() => void redo()} title="Redo (Ctrl+Shift+Z)">
        ↪ Redo
      </button>
    </div>
  );
}
