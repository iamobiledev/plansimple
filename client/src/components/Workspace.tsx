import { useEffect } from "react";
import { useStore } from "../store";
import SheetSidebar from "./SheetSidebar";
import Toolbar from "./Toolbar";
import Viewer from "./Viewer";
import RightPanel from "./RightPanel";

function isTypingTarget(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
}

export default function Workspace() {
  const project = useStore((s) => s.project);
  const closeProject = useStore((s) => s.closeProject);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const selectedMeasurementId = useStore((s) => s.selectedMeasurementId);
  const deleteMeasurement = useStore((s) => s.deleteMeasurement);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        void undo();
      } else if ((mod && e.key.toLowerCase() === "z" && e.shiftKey) || (mod && e.key.toLowerCase() === "y")) {
        e.preventDefault();
        void redo();
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedMeasurementId) {
        e.preventDefault();
        void deleteMeasurement(selectedMeasurementId);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo, selectedMeasurementId, deleteMeasurement]);

  if (!project) return null;

  return (
    <div className="workspace">
      <header className="workspace-header">
        <button className="btn subtle" onClick={closeProject} title="Back to projects">
          ← Projects
        </button>
        <span className="workspace-title">{project.name}</span>
        <Toolbar />
      </header>
      <div className="workspace-body">
        <SheetSidebar />
        <Viewer />
        <RightPanel />
      </div>
    </div>
  );
}
