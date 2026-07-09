import { useState, type FormEvent } from "react";
import { useStore } from "../store";
import { computePixelsPerUnit, parseLengthInput } from "../lib/scale";
import type { UnitSystem } from "../types";

export default function CalibrationDialog({
  pixelDistance,
  onClose,
}: {
  pixelDistance: number;
  onClose: () => void;
}) {
  const project = useStore((s) => s.project);
  const activeSheetId = useStore((s) => s.activeSheetId);
  const calibrateSheet = useStore((s) => s.calibrateSheet);
  const sheet = project?.sheets.find((s) => s.id === activeSheetId);

  const [unitSystem, setUnitSystem] = useState<UnitSystem>(sheet?.unitSystem ?? "imperial");
  const [lengthText, setLengthText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!sheet) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const realLength = parseLengthInput(lengthText, unitSystem);
      const ppu = computePixelsPerUnit(pixelDistance, realLength);
      await calibrateSheet(sheet!.id, ppu, unitSystem);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Calibration failed");
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <form className="dialog" onClick={(e) => e.stopPropagation()} onSubmit={onSubmit}>
        <h2>Calibrate scale</h2>
        <p className="muted small">
          You drew a line {Math.round(pixelDistance)} px long. Enter the real-world distance it
          represents on the drawing.
        </p>
        <label>
          Unit system
          <div className="segmented">
            {(["imperial", "metric"] as const).map((u) => (
              <button
                key={u}
                type="button"
                className={unitSystem === u ? "active" : ""}
                onClick={() => setUnitSystem(u)}
              >
                {u === "imperial" ? "Imperial (ft/in)" : "Metric (m)"}
              </button>
            ))}
          </div>
        </label>
        <label>
          Real-world length
          <input
            value={lengthText}
            onChange={(e) => setLengthText(e.target.value)}
            placeholder={unitSystem === "imperial" ? `e.g. 20'-0"` : "e.g. 6.1m or 250mm"}
            autoFocus
            required
          />
        </label>
        {error && <div className="form-error">{error}</div>}
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={busy || !lengthText.trim()}>
            Save scale
          </button>
        </div>
      </form>
    </div>
  );
}
