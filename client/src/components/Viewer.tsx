import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Line, Circle, Group, Label, Tag, Text } from "react-konva";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { useStore } from "../store";
import { api } from "../api";
import { renderSheetPage, snapshotRegion, type RenderedPage } from "../pdf";
import { pixelQuantity, polygonCentroid, midpoint, distance } from "../lib/geometry";
import { toRealQuantity, formatLength, formatArea } from "../lib/scale";
import CalibrationDialog from "./CalibrationDialog";
import type { Condition, Measurement, Point } from "../types";

interface View {
  x: number;
  y: number;
  scale: number;
}

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 24;

function hexAlpha(hex: string, alpha: string): string {
  return hex + alpha;
}

export default function Viewer() {
  const project = useStore((s) => s.project);
  const activeSheetId = useStore((s) => s.activeSheetId);
  const measurements = useStore((s) => s.measurements);
  const tool = useStore((s) => s.tool);
  const setTool = useStore((s) => s.setTool);
  const activeConditionId = useStore((s) => s.activeConditionId);
  const selectedMeasurementId = useStore((s) => s.selectedMeasurementId);
  const setSelectedMeasurement = useStore((s) => s.setSelectedMeasurement);
  const addMeasurement = useStore((s) => s.addMeasurement);
  const updateMeasurementGeometry = useStore((s) => s.updateMeasurementGeometry);
  const deleteMeasurement = useStore((s) => s.deleteMeasurement);
  const showToast = useStore((s) => s.showToast);
  const aiBusy = useStore((s) => s.aiBusy);
  const setAiBusy = useStore((s) => s.setAiBusy);
  const aiCountCandidates = useStore((s) => s.aiCountCandidates);
  const setAiCountCandidates = useStore((s) => s.setAiCountCandidates);
  const setAiCandidateStatus = useStore((s) => s.setAiCandidateStatus);
  const commitAiCount = useStore((s) => s.commitAiCount);
  const aiAreaCandidate = useStore((s) => s.aiAreaCandidate);
  const setAiAreaCandidate = useStore((s) => s.setAiAreaCandidate);
  const acceptAiArea = useStore((s) => s.acceptAiArea);

  const sheet = project?.sheets.find((s) => s.id === activeSheetId) ?? null;
  const activeCondition = project?.conditions.find((c) => c.id === activeConditionId) ?? null;
  const sheetMeasurements = useMemo(
    () => measurements.filter((m) => m.sheetId === activeSheetId),
    [measurements, activeSheetId]
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [rendered, setRendered] = useState<RenderedPage | null>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 });
  const [draft, setDraftState] = useState<Point[]>([]);
  // Konva can fire a synthesized dblclick synchronously inside the same
  // native event as the second click, before React re-renders — so handlers
  // must read the draft through a ref to avoid stale closures.
  const draftRef = useRef<Point[]>([]);
  const setDraft = useCallback((next: Point[] | ((prev: Point[]) => Point[])) => {
    draftRef.current = typeof next === "function" ? next(draftRef.current) : next;
    setDraftState(draftRef.current);
  }, []);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [aiBox, setAiBox] = useState<{ start: Point; end: Point } | null>(null);
  const [calibrationPx, setCalibrationPx] = useState<number | null>(null);

  // ---- container sizing ----------------------------------------------------
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);
    setSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // ---- load & render the active sheet's PDF --------------------------------
  useEffect(() => {
    setRendered(null);
    setDraft([]);
    setAiBox(null);
    if (!sheet) return;
    let alive = true;
    renderSheetPage(sheet.fileUrl, 2.5)
      .then((r) => {
        if (alive) setRendered(r);
      })
      .catch(() => alive && showToast("Failed to render sheet PDF"));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet?.fileUrl]);

  const fitView = useCallback(
    (r: RenderedPage) => {
      const scale = Math.min(size.width / r.baseWidth, size.height / r.baseHeight) * 0.95 || 1;
      setView({
        scale,
        x: (size.width - r.baseWidth * scale) / 2,
        y: (size.height - r.baseHeight * scale) / 2,
      });
    },
    [size.width, size.height]
  );

  const fittedFor = useRef<string | null>(null);
  useEffect(() => {
    if (rendered && sheet && fittedFor.current !== sheet.id) {
      fittedFor.current = sheet.id;
      fitView(rendered);
    }
  }, [rendered, sheet, fitView]);

  // ---- helpers ---------------------------------------------------------------
  const toWorld = useCallback(
    (p: { x: number; y: number }): Point => ({
      x: (p.x - view.x) / view.scale,
      y: (p.y - view.y) / view.scale,
    }),
    [view]
  );

  function pointerWorld(): Point | null {
    const pos = stageRef.current?.getPointerPosition();
    return pos ? toWorld(pos) : null;
  }

  const cancelDraft = useCallback(() => {
    setDraft([]);
    setAiBox(null);
    setAiCountCandidates(null);
    setAiAreaCandidate(null);
    setCalibrationPx(null);
  }, [setAiCountCandidates, setAiAreaCandidate]);

  // ---- finish a linear/area draft -------------------------------------------
  const finishDraft = useCallback((fromDblClick = false) => {
    if (!sheet || !activeCondition) return;
    const raw = draftRef.current;
    if (fromDblClick) {
      // Two fast clicks in different places are wall-tracing, not a
      // double-click — only finish when the last two points coincide.
      if (raw.length < 2 || distance(raw[raw.length - 1], raw[raw.length - 2]) > 6 / view.scale) {
        return;
      }
    }
    // Drop the duplicate trailing point a double-click leaves behind.
    const pts = raw.filter((p, i) => i === 0 || distance(p, raw[i - 1]) > 0.5 / view.scale);
    const type = activeCondition.measurementType;
    const min = type === "area" ? 3 : 2;
    if (pts.length < min) {
      setDraft([]);
      return;
    }
    const px = pixelQuantity(type, pts);
    let value: number;
    try {
      value = toRealQuantity(type, px, sheet.scalePixelsPerUnit);
    } catch {
      showToast("Calibrate the sheet scale first (Calibrate tool)");
      setDraft([]);
      return;
    }
    setDraft([]);
    void addMeasurement({
      sheetId: sheet.id,
      conditionId: activeCondition.id,
      geometry: { points: pts },
      computedValue: value,
      source: "manual",
    });
  }, [sheet, activeCondition, view.scale, addMeasurement, showToast, setDraft]);

  // ---- keyboard --------------------------------------------------------------
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "Escape") {
        cancelDraft();
        setSelectedMeasurement(null);
      } else if (e.key === "Enter" && draft.length > 0) {
        e.preventDefault();
        finishDraft();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cancelDraft, finishDraft, draft.length, setSelectedMeasurement]);

  // Reset transient state when switching tools.
  useEffect(() => {
    setDraft([]);
    setAiBox(null);
  }, [tool]);

  // ---- AI flows ----------------------------------------------------------------
  async function runAiCount(box: { x: number; y: number; w: number; h: number }) {
    if (!rendered || !sheet) return;
    setAiBusy(true);
    try {
      const template = snapshotRegion(rendered, box.x, box.y, box.w, box.h, 512);
      const sheetSnap = snapshotRegion(rendered, 0, 0, rendered.baseWidth, rendered.baseHeight, 1568);
      const res = await api.aiCount({
        templateImage: template.dataUrl,
        sheetImage: sheetSnap.dataUrl,
        sheetImageWidth: sheetSnap.width,
        sheetImageHeight: sheetSnap.height,
      });
      const points = res.matches.map((m) => ({ x: m.x / sheetSnap.scale, y: m.y / sheetSnap.scale }));
      if (points.length === 0) {
        showToast("AI found no matching symbols");
      } else {
        setAiCountCandidates(points);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "AI count failed");
    } finally {
      setAiBusy(false);
    }
  }

  async function runAiArea(p: Point) {
    if (!rendered || !sheet) return;
    setAiBusy(true);
    try {
      const R = Math.min(1000, rendered.baseWidth, rendered.baseHeight);
      const rx = Math.min(Math.max(p.x - R / 2, 0), rendered.baseWidth - R);
      const ry = Math.min(Math.max(p.y - R / 2, 0), rendered.baseHeight - R);
      const snap = snapshotRegion(rendered, rx, ry, R, R, 1400);
      const res = await api.aiSuggestArea({
        regionImage: snap.dataUrl,
        regionWidth: snap.width,
        regionHeight: snap.height,
        clickX: (p.x - rx) * snap.scale,
        clickY: (p.y - ry) * snap.scale,
      });
      if (res.polygon.length < 3) {
        showToast("AI could not find an enclosed room there");
      } else {
        setAiAreaCandidate(res.polygon.map((v) => ({ x: rx + v.x / snap.scale, y: ry + v.y / snap.scale })));
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "AI area suggestion failed");
    } finally {
      setAiBusy(false);
    }
  }

  // ---- stage events -------------------------------------------------------------
  function onWheel(e: KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const factor = Math.exp(-e.evt.deltaY * (e.evt.ctrlKey ? 0.01 : 0.0018));
    const newScale = Math.min(Math.max(view.scale * factor, MIN_ZOOM), MAX_ZOOM);
    const worldX = (pointer.x - view.x) / view.scale;
    const worldY = (pointer.y - view.y) / view.scale;
    setView({
      scale: newScale,
      x: pointer.x - worldX * newScale,
      y: pointer.y - worldY * newScale,
    });
  }

  function onStageMouseDown(e: KonvaEventObject<MouseEvent>) {
    if (tool === "ai-count" && e.target === e.target.getStage()) {
      const p = pointerWorld();
      if (p) setAiBox({ start: p, end: p });
    }
  }

  function onStageMouseMove() {
    const p = pointerWorld();
    setCursor(p);
    if (aiBox && p) setAiBox({ ...aiBox, end: p });
  }

  function onStageMouseUp() {
    if (tool === "ai-count" && aiBox) {
      const box = {
        x: Math.min(aiBox.start.x, aiBox.end.x),
        y: Math.min(aiBox.start.y, aiBox.end.y),
        w: Math.abs(aiBox.end.x - aiBox.start.x),
        h: Math.abs(aiBox.end.y - aiBox.start.y),
      };
      setAiBox(null);
      if (box.w > 4 && box.h > 4) void runAiCount(box);
    }
  }

  function onStageClick(e: KonvaEventObject<MouseEvent>) {
    const clickedEmpty = e.target === e.target.getStage() || e.target.name() === "pdf-page";
    const p = pointerWorld();
    if (!p || !sheet) return;

    switch (tool) {
      case "select":
      case "pan":
        if (clickedEmpty) setSelectedMeasurement(null);
        break;
      case "calibrate": {
        const next = [...draft, p];
        if (next.length === 2) {
          setCalibrationPx(distance(next[0], next[1]));
          setDraft(next); // keep the line visible under the dialog
        } else {
          setDraft(next.slice(0, 2));
        }
        break;
      }
      case "linear":
      case "area":
        if (!activeCondition || activeCondition.measurementType !== tool) return;
        if (!sheet.scalePixelsPerUnit) {
          showToast("Calibrate the sheet scale first (Calibrate tool)");
          return;
        }
        setDraft((d) => [...d, p]);
        break;
      case "count":
        if (!activeCondition || activeCondition.measurementType !== "count") return;
        void addMeasurement({
          sheetId: sheet.id,
          conditionId: activeCondition.id,
          geometry: { points: [p] },
          computedValue: 1,
          source: "manual",
        });
        break;
      case "ai-area":
        if (clickedEmpty && !aiBusy) void runAiArea(p);
        break;
      case "ai-count":
        break;
    }
  }

  function onStageDblClick() {
    if ((tool === "linear" || tool === "area") && draftRef.current.length > 0) {
      finishDraft(true);
    }
  }

  // ---- render helpers ----------------------------------------------------------
  const invScale = 1 / view.scale;

  function measurementLabel(m: Measurement, c: Condition): string {
    if (!sheet) return "";
    if (c.measurementType === "linear") return formatLength(m.computedValue, sheet.unitSystem);
    if (c.measurementType === "area") return formatArea(m.computedValue, sheet.unitSystem);
    return c.name;
  }

  function draftLabel(): string | null {
    if (!sheet?.scalePixelsPerUnit || !activeCondition || draft.length === 0 || !cursor) return null;
    const pts = [...draft, cursor];
    try {
      if (activeCondition.measurementType === "linear") {
        return formatLength(
          toRealQuantity("linear", pixelQuantity("linear", pts), sheet.scalePixelsPerUnit),
          sheet.unitSystem
        );
      }
      if (activeCondition.measurementType === "area" && pts.length >= 3) {
        return formatArea(
          toRealQuantity("area", pixelQuantity("area", pts), sheet.scalePixelsPerUnit),
          sheet.unitSystem
        );
      }
    } catch {
      return null;
    }
    return null;
  }

  const selected = sheetMeasurements.find((m) => m.id === selectedMeasurementId) ?? null;
  const selectedCondition = selected
    ? project?.conditions.find((c) => c.id === selected.conditionId)
    : null;

  const drawingCursor =
    tool === "pan" ? "grab" : tool === "select" ? "default" : aiBusy ? "progress" : "crosshair";
  const pendingAiCount = aiCountCandidates?.filter((c) => c.status !== "rejected").length ?? 0;

  if (!sheet) {
    return (
      <div className="viewer-empty muted">
        <p>No sheet selected — upload a PDF plan set on the left.</p>
      </div>
    );
  }

  return (
    <div className="viewer" ref={containerRef} style={{ cursor: drawingCursor }}>
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        x={view.x}
        y={view.y}
        scaleX={view.scale}
        scaleY={view.scale}
        draggable={tool === "pan" || tool === "select"}
        onDragMove={(e) => {
          if (e.target === stageRef.current) {
            setView((v) => ({ ...v, x: e.target.x(), y: e.target.y() }));
          }
        }}
        onWheel={onWheel}
        onMouseDown={onStageMouseDown}
        onMouseMove={onStageMouseMove}
        onMouseUp={onStageMouseUp}
        onClick={onStageClick}
        onDblClick={onStageDblClick}
      >
        {/* PDF render layer */}
        <Layer listening={false}>
          {rendered && (
            <KonvaImage
              name="pdf-page"
              image={rendered.canvas}
              width={rendered.baseWidth}
              height={rendered.baseHeight}
            />
          )}
        </Layer>

        {/* Annotation layer */}
        <Layer>
          {sheetMeasurements.map((m) => {
            const c = project?.conditions.find((cc) => cc.id === m.conditionId);
            if (!c) return null;
            const isSelected = m.id === selectedMeasurementId;
            const flat = m.geometry.points.flatMap((p) => [p.x, p.y]);
            const select = (e: KonvaEventObject<MouseEvent>) => {
              if (tool !== "select") return;
              e.cancelBubble = true;
              setSelectedMeasurement(m.id);
            };
            if (c.measurementType === "linear") {
              return (
                <Group key={m.id}>
                  <Line
                    points={flat}
                    stroke={c.color}
                    strokeWidth={isSelected ? 4.5 : 2.5}
                    strokeScaleEnabled={false}
                    hitStrokeWidth={14}
                    lineCap="round"
                    lineJoin="round"
                    dash={m.source === "ai" ? undefined : undefined}
                    shadowColor={isSelected ? c.color : undefined}
                    shadowBlur={isSelected ? 8 : 0}
                    onClick={select}
                  />
                </Group>
              );
            }
            if (c.measurementType === "area") {
              return (
                <Line
                  key={m.id}
                  points={flat}
                  closed
                  stroke={c.color}
                  strokeWidth={isSelected ? 4 : 2}
                  strokeScaleEnabled={false}
                  fill={hexAlpha(c.color, isSelected ? "55" : "33")}
                  shadowColor={isSelected ? c.color : undefined}
                  shadowBlur={isSelected ? 8 : 0}
                  onClick={select}
                />
              );
            }
            // count marker
            const p = m.geometry.points[0];
            return (
              <Group
                key={m.id}
                x={p.x}
                y={p.y}
                scaleX={invScale}
                scaleY={invScale}
                onClick={select}
                draggable={tool === "select" && isSelected}
                onDragEnd={(e) => {
                  const np = { x: e.target.x(), y: e.target.y() };
                  e.target.position({ x: p.x, y: p.y }); // state will re-render
                  void updateMeasurementGeometry(m.id, [np]);
                }}
              >
                <Circle
                  radius={9}
                  stroke={c.color}
                  strokeWidth={isSelected ? 3.5 : 2}
                  fill={hexAlpha(c.color, "66")}
                  shadowColor={isSelected ? c.color : undefined}
                  shadowBlur={isSelected ? 10 : 0}
                />
                <Line points={[-4, 0, 4, 0]} stroke={c.color} strokeWidth={2} />
                <Line points={[0, -4, 0, 4]} stroke={c.color} strokeWidth={2} />
              </Group>
            );
          })}

          {/* vertex handles for the selected linear/area measurement */}
          {selected &&
            selectedCondition &&
            selectedCondition.measurementType !== "count" &&
            tool === "select" &&
            selected.geometry.points.map((p, i) => (
              <Circle
                key={`${selected.id}-v${i}`}
                x={p.x}
                y={p.y}
                radius={5 * invScale}
                fill="#ffffff"
                stroke={selectedCondition.color}
                strokeWidth={2}
                strokeScaleEnabled={false}
                draggable
                onDragEnd={(e) => {
                  const pts = selected.geometry.points.map((pp, j) =>
                    j === i ? { x: e.target.x(), y: e.target.y() } : pp
                  );
                  void updateMeasurementGeometry(selected.id, pts);
                }}
              />
            ))}

          {/* label for the selected measurement */}
          {selected && selectedCondition && (
            <Label
              x={
                selectedCondition.measurementType === "area"
                  ? polygonCentroid(selected.geometry.points).x
                  : selectedCondition.measurementType === "linear"
                    ? midpoint(
                        selected.geometry.points[0],
                        selected.geometry.points[selected.geometry.points.length - 1]
                      ).x
                    : selected.geometry.points[0].x
              }
              y={
                selectedCondition.measurementType === "area"
                  ? polygonCentroid(selected.geometry.points).y
                  : selectedCondition.measurementType === "linear"
                    ? midpoint(
                        selected.geometry.points[0],
                        selected.geometry.points[selected.geometry.points.length - 1]
                      ).y
                    : selected.geometry.points[0].y
              }
              scaleX={invScale}
              scaleY={invScale}
              offsetY={-14}
              listening={false}
            >
              <Tag fill="#1c2430" cornerRadius={4} opacity={0.92} />
              <Text
                text={` ${selectedCondition.name}: ${measurementLabel(selected, selectedCondition)} `}
                fontSize={13}
                fill="#ffffff"
                padding={5}
              />
            </Label>
          )}

          {/* in-progress draft */}
          {draft.length > 0 && activeCondition && tool !== "calibrate" && (
            <>
              <Line
                points={[...draft, ...(cursor ? [cursor] : [])].flatMap((p) => [p.x, p.y])}
                closed={tool === "area" && draft.length >= 2}
                stroke={activeCondition.color}
                strokeWidth={2}
                strokeScaleEnabled={false}
                dash={[8, 5]}
                fill={tool === "area" ? hexAlpha(activeCondition.color, "22") : undefined}
                listening={false}
              />
              {draft.map((p, i) => (
                <Circle
                  key={i}
                  x={p.x}
                  y={p.y}
                  radius={4 * invScale}
                  fill={activeCondition.color}
                  listening={false}
                />
              ))}
              {cursor && draftLabel() && (
                <Label x={cursor.x} y={cursor.y} scaleX={invScale} scaleY={invScale} offsetY={-18} listening={false}>
                  <Tag fill="#1c2430" cornerRadius={4} opacity={0.92} />
                  <Text text={` ${draftLabel()} `} fontSize={13} fill="#fff" padding={5} />
                </Label>
              )}
            </>
          )}

          {/* calibration line */}
          {tool === "calibrate" && draft.length > 0 && (
            <>
              <Line
                points={[...draft, ...(cursor && draft.length === 1 ? [cursor] : [])].flatMap((p) => [p.x, p.y])}
                stroke="#38bdf8"
                strokeWidth={2.5}
                strokeScaleEnabled={false}
                dash={[10, 6]}
                listening={false}
              />
              {draft.map((p, i) => (
                <Circle key={i} x={p.x} y={p.y} radius={5 * invScale} fill="#38bdf8" listening={false} />
              ))}
            </>
          )}

          {/* AI count drag box */}
          {aiBox && (
            <Line
              points={[
                aiBox.start.x, aiBox.start.y,
                aiBox.end.x, aiBox.start.y,
                aiBox.end.x, aiBox.end.y,
                aiBox.start.x, aiBox.end.y,
              ]}
              closed
              stroke="#a78bfa"
              strokeWidth={1.5}
              strokeScaleEnabled={false}
              dash={[6, 4]}
              fill="#a78bfa22"
              listening={false}
            />
          )}

          {/* AI count ghost candidates */}
          {aiCountCandidates?.map((cand, i) => {
            const color = activeCondition?.color ?? "#a78bfa";
            const rejected = cand.status === "rejected";
            return (
              <Group
                key={`ai-${i}`}
                x={cand.point.x}
                y={cand.point.y}
                scaleX={invScale}
                scaleY={invScale}
                opacity={rejected ? 0.3 : 0.9}
                onClick={(e) => {
                  e.cancelBubble = true;
                  setAiCandidateStatus(i, rejected ? "pending" : "rejected");
                }}
              >
                <Circle radius={11} stroke={rejected ? "#94a3b8" : color} strokeWidth={2.5} dash={[5, 3]} fill={rejected ? undefined : hexAlpha(color, "33")} />
                {rejected ? (
                  <>
                    <Line points={[-5, -5, 5, 5]} stroke="#94a3b8" strokeWidth={2.5} />
                    <Line points={[-5, 5, 5, -5]} stroke="#94a3b8" strokeWidth={2.5} />
                  </>
                ) : (
                  <>
                    <Line points={[-4, 0, 4, 0]} stroke={color} strokeWidth={2} />
                    <Line points={[0, -4, 0, 4]} stroke={color} strokeWidth={2} />
                  </>
                )}
              </Group>
            );
          })}

          {/* AI area ghost polygon with adjustable vertices */}
          {aiAreaCandidate && aiAreaCandidate.length >= 3 && (
            <>
              <Line
                points={aiAreaCandidate.flatMap((p) => [p.x, p.y])}
                closed
                stroke={activeCondition?.color ?? "#a78bfa"}
                strokeWidth={2.5}
                strokeScaleEnabled={false}
                dash={[8, 5]}
                fill={hexAlpha(activeCondition?.color ?? "#a78bfa", "2e")}
                listening={false}
              />
              {aiAreaCandidate.map((p, i) => (
                <Circle
                  key={`aiv-${i}`}
                  x={p.x}
                  y={p.y}
                  radius={5.5 * invScale}
                  fill="#ffffff"
                  stroke={activeCondition?.color ?? "#a78bfa"}
                  strokeWidth={2}
                  strokeScaleEnabled={false}
                  draggable
                  onDragMove={(e) => {
                    const pts = aiAreaCandidate.map((pp, j) =>
                      j === i ? { x: e.target.x(), y: e.target.y() } : pp
                    );
                    setAiAreaCandidate(pts);
                  }}
                />
              ))}
            </>
          )}
        </Layer>
      </Stage>

      {/* ---- HTML overlays ---- */}
      {!rendered && <div className="viewer-loading">Rendering sheet…</div>}
      {aiBusy && <div className="viewer-loading ai">✨ Asking Claude…</div>}

      {aiCountCandidates && (
        <div className="ai-bar">
          <span>
            ✨ {aiCountCandidates.length} candidate{aiCountCandidates.length === 1 ? "" : "s"} — click a
            marker to reject it
          </span>
          <button className="btn small primary" disabled={pendingAiCount === 0} onClick={() => void commitAiCount()}>
            Accept {pendingAiCount}
          </button>
          <button className="btn small" onClick={() => setAiCountCandidates(null)}>
            Dismiss
          </button>
        </div>
      )}

      {aiAreaCandidate && (
        <div className="ai-bar">
          <span>✨ Suggested room boundary — drag the handles to adjust</span>
          <button className="btn small primary" onClick={() => void acceptAiArea()}>
            Accept area
          </button>
          <button className="btn small" onClick={() => setAiAreaCandidate(null)}>
            Dismiss
          </button>
        </div>
      )}

      {selected && selectedCondition && (
        <div className="selection-bar">
          <span className="condition-swatch" style={{ background: selectedCondition.color }} />
          <span>
            {selectedCondition.name}: <strong>{measurementLabel(selected, selectedCondition)}</strong>
            {selected.source === "ai" && <em className="muted"> (AI)</em>}
          </span>
          <button className="btn small danger" onClick={() => void deleteMeasurement(selected.id)}>
            Delete
          </button>
        </div>
      )}

      <div className="viewer-status">
        <span className={sheet.scalePixelsPerUnit ? "" : "warn"}>
          {sheet.scalePixelsPerUnit
            ? `Scale: ${sheet.scalePixelsPerUnit.toFixed(1)} px/${sheet.unitSystem === "metric" ? "m" : "ft"}`
            : "Not calibrated"}
        </span>
        <span className="muted">·</span>
        <span>{Math.round(view.scale * 100)}%</span>
        <button className="btn subtle tiny" onClick={() => rendered && fitView(rendered)} title="Zoom to fit">
          Fit
        </button>
      </div>

      {(tool === "linear" || tool === "area") && draft.length > 0 && (
        <div className="hint-bar">Double-click or press Enter to finish · Esc to cancel</div>
      )}
      {tool === "calibrate" && draft.length < 2 && (
        <div className="hint-bar">Click both ends of a known dimension (e.g. a 20'-0" string)</div>
      )}
      {tool === "ai-count" && !aiCountCandidates && !aiBusy && (
        <div className="hint-bar">Drag a box around ONE example symbol — Claude will find the rest</div>
      )}
      {tool === "ai-area" && !aiAreaCandidate && !aiBusy && (
        <div className="hint-bar">Click inside a room — Claude will trace its boundary</div>
      )}

      {calibrationPx != null && (
        <CalibrationDialog
          pixelDistance={calibrationPx}
          onClose={() => {
            setCalibrationPx(null);
            setDraft([]);
            setTool("select");
          }}
        />
      )}
    </div>
  );
}
