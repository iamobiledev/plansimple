import { useMemo, useState } from "react";
import { useStore } from "../store";
import { buildSummary, summaryToCsv } from "../lib/csv";
import { formatQuantity } from "../lib/scale";
import ConditionDialog from "./ConditionDialog";
import type { Condition, MeasurementType } from "../types";

const TYPE_BADGE: Record<MeasurementType, string> = {
  linear: "╱",
  area: "▱",
  count: "⊕",
};

export default function RightPanel() {
  const project = useStore((s) => s.project);
  const measurements = useStore((s) => s.measurements);
  const activeConditionId = useStore((s) => s.activeConditionId);
  const setActiveCondition = useStore((s) => s.setActiveCondition);
  const setTool = useStore((s) => s.setTool);
  const deleteCondition = useStore((s) => s.deleteCondition);
  const [editing, setEditing] = useState<Condition | "new" | null>(null);
  const [groupBySheet, setGroupBySheet] = useState(false);

  const summary = useMemo(
    () => (project ? buildSummary(measurements, project.conditions, project.sheets) : []),
    [measurements, project]
  );

  const conditionTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const m of measurements) {
      totals.set(m.conditionId, (totals.get(m.conditionId) ?? 0) + m.computedValue);
    }
    return totals;
  }, [measurements]);

  if (!project) return null;

  function pickCondition(c: Condition) {
    setActiveCondition(c.id);
    // Selecting a condition arms its matching tool so measuring starts immediately.
    setTool(c.measurementType);
  }

  function exportCsv() {
    const csv = summaryToCsv(summary);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project!.name.replace(/[^\w-]+/g, "_")}_takeoff.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const grandTotal = summary.reduce((sum, l) => sum + (l.extendedCost ?? 0), 0);

  return (
    <aside className="right-panel">
      <section className="conditions-section">
        <div className="panel-title">
          Conditions
          <button className="btn small primary" onClick={() => setEditing("new")}>
            + New
          </button>
        </div>
        <div className="condition-list">
          {project.conditions.length === 0 && (
            <p className="muted small pad">
              Conditions are what you're measuring (e.g. "Interior Wall"). Create one to start.
            </p>
          )}
          {project.conditions.map((c) => {
            const sheet = project.sheets[0];
            const total = conditionTotals.get(c.id) ?? 0;
            return (
              <div
                key={c.id}
                className={`condition-item ${c.id === activeConditionId ? "active" : ""}`}
                onClick={() => pickCondition(c)}
                title={`Measure with "${c.name}"`}
              >
                <span className="condition-swatch" style={{ background: c.color }} />
                <div className="condition-meta">
                  <span className="condition-name">{c.name}</span>
                  <span className="muted small">
                    {TYPE_BADGE[c.measurementType]} {c.measurementType} · {c.unit}
                    {c.unitCost != null ? ` · $${c.unitCost}/${c.unit}` : ""}
                  </span>
                </div>
                <span className="condition-total small">
                  {total > 0
                    ? formatQuantity(c.measurementType, total, sheet?.unitSystem ?? "imperial")
                    : "—"}
                </span>
                <button
                  className="btn subtle tiny"
                  title="Edit condition"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditing(c);
                  }}
                >
                  ✎
                </button>
                <button
                  className="btn subtle danger tiny"
                  title="Delete condition"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete "${c.name}" and its measurements?`)) {
                      void deleteCondition(c.id);
                    }
                  }}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="summary-section">
        <div className="panel-title">
          Summary
          <label className="small muted checkbox-label">
            <input
              type="checkbox"
              checked={groupBySheet}
              onChange={(e) => setGroupBySheet(e.target.checked)}
            />
            by sheet
          </label>
          <button className="btn small" onClick={exportCsv} disabled={summary.length === 0}>
            Export CSV
          </button>
        </div>
        <div className="summary-table-wrap">
          {summary.length === 0 ? (
            <p className="muted small pad">No measurements yet.</p>
          ) : (
            <table className="summary-table">
              <thead>
                <tr>
                  <th>Condition</th>
                  {groupBySheet && <th>Sheet</th>}
                  <th className="num">Qty</th>
                  <th>Unit</th>
                  <th className="num">Cost</th>
                </tr>
              </thead>
              <tbody>
                {(groupBySheet
                  ? summary
                  : // roll sheets up per condition
                    [...summary
                      .reduce((map, line) => {
                        const existing = map.get(line.conditionName);
                        if (existing) {
                          existing.quantity += line.quantity;
                          existing.extendedCost =
                            existing.extendedCost != null && line.extendedCost != null
                              ? existing.extendedCost + line.extendedCost
                              : existing.extendedCost ?? line.extendedCost;
                        } else {
                          map.set(line.conditionName, { ...line });
                        }
                        return map;
                      }, new Map<string, (typeof summary)[number]>())
                      .values()]
                ).map((line, i) => (
                  <tr key={i}>
                    <td>{line.conditionName}</td>
                    {groupBySheet && <td className="muted">{line.sheetName}</td>}
                    <td className="num">{(Math.round(line.quantity * 100) / 100).toLocaleString()}</td>
                    <td className="muted">{line.unit}</td>
                    <td className="num">
                      {line.extendedCost != null
                        ? `$${line.extendedCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                        : "—"}
                    </td>
                  </tr>
                ))}
                {grandTotal > 0 && (
                  <tr className="summary-total-row">
                    <td colSpan={groupBySheet ? 4 : 3}>Total</td>
                    <td className="num">
                      ${grandTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {editing && (
        <ConditionDialog
          condition={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </aside>
  );
}
