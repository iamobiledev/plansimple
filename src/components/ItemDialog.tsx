import { useRef, useState, type FormEvent } from "react";
import { useStore } from "../store";
import { defaultUnit } from "../lib/scale";
import type { Condition, MeasurementType } from "../types";

const PALETTE = [
  "#e05252", "#e8a33d", "#d4c530", "#5cb85c", "#3ba99c",
  "#3b82c4", "#7a5cd6", "#c45cb0", "#8a6d4a", "#64748b",
];

const TYPE_LABEL: Record<MeasurementType, string> = {
  linear: "Linear (length)",
  area: "Area",
  count: "Count",
};

export default function ItemDialog({
  condition,
  onClose,
}: {
  condition: Condition | null;
  onClose: () => void;
}) {
  const createCondition = useStore((s) => s.createCondition);
  const updateCondition = useStore((s) => s.updateCondition);
  const setTool = useStore((s) => s.setTool);
  const saveToLibrary = useStore((s) => s.saveToLibrary);
  const icons = useStore((s) => s.icons);
  const uploadIcon = useStore((s) => s.uploadIcon);
  const project = useStore((s) => s.project);
  const unitSystem = project?.sheets[0]?.unitSystem ?? "imperial";

  const [name, setName] = useState(condition?.name ?? "");
  const [type, setType] = useState<MeasurementType>(condition?.measurementType ?? "linear");
  const [color, setColor] = useState(condition?.color ?? PALETTE[0]);
  const [unit, setUnit] = useState(condition?.unit ?? defaultUnit("linear", unitSystem));
  const [unitCost, setUnitCost] = useState(condition?.unitCost != null ? String(condition.unitCost) : "");
  const [iconKey, setIconKey] = useState<string | null>(condition?.iconKey ?? null);
  const [alsoSaveToLibrary, setAlsoSaveToLibrary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const iconInput = useRef<HTMLInputElement>(null);

  function changeType(t: MeasurementType) {
    if (unit === defaultUnit(type, unitSystem)) {
      setUnit(defaultUnit(t, unitSystem));
    }
    setType(t);
  }

  async function onIconFile(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadingIcon(true);
    const icon = await uploadIcon(files[0]);
    if (icon) setIconKey(icon.fileKey);
    setUploadingIcon(false);
    if (iconInput.current) iconInput.current.value = "";
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
    const data = {
      name: name.trim(),
      color,
      measurementType: type,
      unit: unit.trim(),
      unitCost: cost,
      iconKey: type === "count" ? iconKey : null,
    };
    try {
      if (condition) {
        await updateCondition(condition.id, data);
      } else {
        await createCondition(data);
        // Arm the matching tool so the user can start measuring immediately.
        setTool(type);
        if (alsoSaveToLibrary) {
          await saveToLibrary(data).catch(() => {});
        }
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save item");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <form className="dialog" onClick={(e) => e.stopPropagation()} onSubmit={onSubmit}>
        <h2>{condition ? "Edit takeoff item" : "New takeoff item"}</h2>
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
                title={condition ? "Type can't change once measurements exist" : TYPE_LABEL[t]}
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

        {type === "count" && (
          <label>
            Marker icon
            <div className="icon-picker">
              <button
                type="button"
                className={`icon-choice ${iconKey === null ? "active" : ""}`}
                title="Default circle marker"
                onClick={() => setIconKey(null)}
              >
                <span className="icon-default-dot" style={{ borderColor: color, background: `${color}55` }} />
              </button>
              {icons.map((icon) => (
                <button
                  key={icon.id}
                  type="button"
                  className={`icon-choice ${iconKey === icon.fileKey ? "active" : ""}`}
                  title={icon.name}
                  onClick={() => setIconKey(icon.fileKey)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/files/${icon.fileKey}`} alt={icon.name} />
                </button>
              ))}
              <button
                type="button"
                className="icon-choice upload"
                title="Upload a custom icon (PNG, SVG, or JPEG, max 1 MB)"
                disabled={uploadingIcon}
                onClick={() => iconInput.current?.click()}
              >
                {uploadingIcon ? "…" : "+"}
              </button>
              <input
                ref={iconInput}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                hidden
                onChange={(e) => void onIconFile(e.target.files)}
              />
            </div>
          </label>
        )}

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

        {!condition && (
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={alsoSaveToLibrary}
              onChange={(e) => setAlsoSaveToLibrary(e.target.checked)}
            />
            Also save to my item library for reuse in other projects
          </label>
        )}

        {error && <div className="form-error">{error}</div>}
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={busy || !name.trim()}>
            {condition ? "Save" : "Add item"}
          </button>
        </div>
      </form>
    </div>
  );
}
