import { useState, type FormEvent } from "react";
import { useStore } from "../store";
import { defaultUnit } from "../lib/scale";
import type { Condition, MeasurementType } from "../types";

const PALETTE = [
  "#e05252", "#e8a33d", "#d4c530", "#5cb85c", "#3ba99c",
  "#3b82c4", "#7a5cd6", "#c45cb0", "#8a6d4a", "#64748b",
];

export default function ConditionDialog({
  condition,
  onClose,
}: {
  condition: Condition | null;
  onClose: () => void;
}) {
  const createCondition = useStore((s) => s.createCondition);
  const updateCondition = useStore((s) => s.updateCondition);
  const project = useStore((s) => s.project);
  const unitSystem = project?.sheets[0]?.unitSystem ?? "imperial";

  const [name, setName] = useState(condition?.name ?? "");
  const [type, setType] = useState<MeasurementType>(condition?.measurementType ?? "linear");
  const [color, setColor] = useState(condition?.color ?? PALETTE[0]);
  const [unit, setUnit] = useState(condition?.unit ?? defaultUnit("linear", unitSystem));
  const [unitCost, setUnitCost] = useState(condition?.unitCost != null ? String(condition.unitCost) : "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function changeType(t: MeasurementType) {
    // If the unit still matches the previous type's default, follow the new type.
    if (unit === defaultUnit(type, unitSystem)) {
      setUnit(defaultUnit(t, unitSystem));
    }
    setType(t);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const cost = unitCost.trim() === "" ? null : Number(unitCost);
    if (cost != null && (!isFinite(cost) || cost < 0)) {
      setError("Unit cost must be a non-negative number");
      setBusy(false);
      return;
    }
    try {
      if (condition) {
        await updateCondition(condition.id, {
          name: name.trim(),
          color,
          measurementType: type,
          unit: unit.trim(),
          unitCost: cost,
        });
      } else {
        await createCondition({
          name: name.trim(),
          color,
          measurementType: type,
          unit: unit.trim(),
          unitCost: cost,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save condition");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <form className="dialog" onClick={(e) => e.stopPropagation()} onSubmit={onSubmit}>
        <h2>{condition ? "Edit condition" : "New condition"}</h2>
        <label>
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`e.g. Interior Wall — 5/8" Drywall`}
            autoFocus
            required
          />
        </label>
        <label>
          Measurement type
          <div className="segmented">
            {(["linear", "area", "count"] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={type === t ? "active" : ""}
                disabled={!!condition && condition.measurementType !== t}
                title={condition ? "Type can't change once measurements exist" : undefined}
                onClick={() => changeType(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </label>
        <label>
          Color
          <div className="palette">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                className={`swatch ${color === c ? "active" : ""}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </label>
        <div className="dialog-row">
          <label>
            Unit
            <input value={unit} onChange={(e) => setUnit(e.target.value)} required />
          </label>
          <label>
            Unit cost ($, optional)
            <input
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              placeholder="e.g. 12.50"
              inputMode="decimal"
            />
          </label>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={busy || !name.trim()}>
            {condition ? "Save" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}
