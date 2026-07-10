import { useCallback, useEffect, useRef, useState } from "react";
import type { Camera, Point } from "./camera";
import { screenToPdf } from "./camera";
import { drawDraft, drawMarkup } from "./drawMarkup";
import type { DrawTool, Markup, MarkupStyle } from "./markupTypes";
import { DEFAULT_STYLE } from "./markupTypes";

export type TileViewportProps = {
  widthPts: number;
  heightPts: number;
  tilePrefix: string;
  maxZoom?: number;
  tileSize?: number;
  authHeader?: string | null;
  searchQuery?: string;
  textSpans?: Array<{ text: string; x0: number; y0: number; x1: number; y1: number }>;
  markups?: Markup[];
  tool?: DrawTool;
  style?: MarkupStyle;
  subject?: string;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onCreateMarkup?: (payload: {
    type: string;
    geometry: Record<string, unknown>;
    style: MarkupStyle;
    subject: string | null;
  }) => void;
  onCalibrate?: (points: [Point, Point]) => void;
};

function tileUrl(prefix: string, z: number, x: number, y: number) {
  return `/api/storage/object/${encodeURIComponent(`${prefix}/${z}/${x}/${y}.webp`)}`;
}

export default function TileViewport({
  widthPts,
  heightPts,
  tilePrefix,
  maxZoom = 4,
  tileSize = 512,
  authHeader,
  searchQuery,
  textSpans = [],
  markups = [],
  tool = "pan",
  style = DEFAULT_STYLE,
  subject = "",
  selectedId = null,
  onSelect,
  onCreateMarkup,
  onCalibrate,
}: TileViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const cameraRef = useRef<Camera>({ x: 40, y: 40, scale: 1 });
  const [, bump] = useState(0);
  const cacheRef = useRef(new Map<string, HTMLImageElement | "loading" | "error">());
  const dragRef = useRef<{ ox: number; oy: number; cx: number; cy: number } | null>(null);
  const draftRef = useRef<Point[]>([]);
  const [draft, setDraft] = useState<Point[]>([]);
  const [cursor, setCursor] = useState<Point | null>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const fit = el.clientWidth / widthPts;
    cameraRef.current = { x: 20, y: 20, scale: Math.min(fit * 0.95, 2) };
    bump((n) => n + 1);
  }, [widthPts, heightPts, tilePrefix]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        draftRef.current = [];
        setDraft([]);
        onSelect?.(null);
      }
      if (e.key === "Enter" && draftRef.current.length >= 2) {
        finishPoly();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, style, subject]);

  const loadTile = useCallback(
    (z: number, x: number, y: number) => {
      const key = `${z}/${x}/${y}`;
      const cached = cacheRef.current.get(key);
      if (cached) return cached;
      cacheRef.current.set(key, "loading");
      const img = new Image();
      fetch(tileUrl(tilePrefix, z, x, y), {
        headers: authHeader ? { Authorization: authHeader } : {},
        credentials: "include",
      })
        .then((r) => {
          if (!r.ok) throw new Error(String(r.status));
          return r.blob();
        })
        .then((blob) => {
          img.src = URL.createObjectURL(blob);
          img.onload = () => {
            cacheRef.current.set(key, img);
            bump((n) => n + 1);
          };
          img.onerror = () => cacheRef.current.set(key, "error");
        })
        .catch(() => cacheRef.current.set(key, "error"));
      return "loading" as const;
    },
    [tilePrefix, authHeader]
  );

  const pickZ = (scale: number) => {
    const desiredPx = widthPts * scale;
    let z = 0;
    for (let i = 0; i <= maxZoom; i++) {
      if (tileSize * 2 ** i >= desiredPx * 0.9) {
        z = i;
        break;
      }
      z = i;
    }
    return z;
  };

  function finishPoly() {
    const points = draftRef.current;
    if (points.length < 2) return;
    const closed = tool === "polygon" || tool === "cloud" || tool === "cloud_callout" || tool === "area";
    if (closed && points.length < 3) return;
    const type =
      tool === "polylength" ? "polylength" : tool === "area" ? "area" : tool;
    onCreateMarkup?.({
      type,
      geometry: {
        points,
        text: tool.includes("callout") ? subject || "Note" : undefined,
      },
      style: {
        ...style,
        stroke: ["length", "polylength", "area"].includes(type)
          ? style.stroke || "#059669"
          : style.stroke,
        fill: tool === "highlighter" ? "rgba(250,204,21,0.35)" : style.fill,
      },
      subject: subject || null,
    });
    draftRef.current = [];
    setDraft([]);
    setCursor(null);
  }

  function commitBoxOrLine(start: Point, end: Point) {
    if (tool === "calibrate") {
      onCalibrate?.([start, end]);
      return;
    }
    if (tool === "length") {
      onCreateMarkup?.({
        type: "length",
        geometry: { points: [start, end] },
        style: { ...style, stroke: style.stroke || "#059669" },
        subject: subject || "Length",
      });
      return;
    }
    if (["rectangle", "ellipse", "highlighter", "textbox", "stamp"].includes(tool)) {
      const stampText =
        tool === "stamp"
          ? subject ||
            `REVIEWED\n${new Date().toISOString().slice(0, 10)}\n{{user}}`
          : tool === "textbox"
            ? subject || "Text"
            : undefined;
      onCreateMarkup?.({
        type: tool,
        geometry: {
          x: Math.min(start.x, end.x),
          y: Math.min(start.y, end.y),
          w: Math.abs(end.x - start.x),
          h: Math.abs(end.y - start.y),
          text: stampText,
        },
        style: {
          ...style,
          fill: tool === "highlighter" ? "rgba(250,204,21,0.35)" : style.fill,
        },
        subject: subject || (tool === "stamp" ? "Reviewed" : null),
      });
    } else if (["line", "arrow", "callout"].includes(tool)) {
      onCreateMarkup?.({
        type: tool,
        geometry: {
          x1: start.x,
          y1: start.y,
          x2: end.x,
          y2: end.y,
          text: tool === "callout" ? subject || "Note" : undefined,
        },
        style,
        subject: subject || null,
      });
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(size.w * dpr);
    canvas.height = Math.floor(size.h * dpr);
    canvas.style.width = `${size.w}px`;
    canvas.style.height = `${size.h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, size.w, size.h);

    const cam = cameraRef.current;
    const z = pickZ(cam.scale);
    const worldScale = (tileSize * 2 ** z) / widthPts;
    const pageWpx = tileSize * 2 ** z;
    const pageHpx = Math.ceil((heightPts / widthPts) * pageWpx);
    const cols = Math.ceil(pageWpx / tileSize);
    const rows = Math.ceil(pageHpx / tileSize);
    const pdfLeft = -cam.x / cam.scale;
    const pdfTop = -cam.y / cam.scale;
    const pdfRight = (size.w - cam.x) / cam.scale;
    const pdfBottom = (size.h - cam.y) / cam.scale;

    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < cols; tx++) {
        const tilePdfX0 = (tx * tileSize) / worldScale;
        const tilePdfY0 = (ty * tileSize) / worldScale;
        const tilePdfX1 = ((tx + 1) * tileSize) / worldScale;
        const tilePdfY1 = ((ty + 1) * tileSize) / worldScale;
        if (tilePdfX1 < pdfLeft - 50 || tilePdfX0 > pdfRight + 50) continue;
        if (tilePdfY1 < pdfTop - 50 || tilePdfY0 > pdfBottom + 50) continue;
        const img = loadTile(z, tx, ty);
        const sx = cam.x + tilePdfX0 * cam.scale;
        const sy = cam.y + tilePdfY0 * cam.scale;
        const sw = (tilePdfX1 - tilePdfX0) * cam.scale;
        const sh = (tilePdfY1 - tilePdfY0) * cam.scale;
        if (img instanceof HTMLImageElement) ctx.drawImage(img, sx, sy, sw, sh);
        else {
          ctx.fillStyle = "#334155";
          ctx.fillRect(sx, sy, sw, sh);
        }
      }
    }

    if (searchQuery && textSpans.length) {
      const q = searchQuery.toLowerCase();
      for (const span of textSpans) {
        if (!span.text.toLowerCase().includes(q)) continue;
        ctx.fillStyle = "rgba(250, 204, 21, 0.45)";
        ctx.fillRect(
          cam.x + span.x0 * cam.scale,
          cam.y + span.y0 * cam.scale,
          (span.x1 - span.x0) * cam.scale,
          Math.max((span.y1 - span.y0) * cam.scale, 4)
        );
      }
    }

    for (const m of markups) {
      drawMarkup(ctx, cam, m, m.id === selectedId);
    }
    if (draft.length) {
      drawDraft(ctx, cam, tool, draft, cursor);
    }
  });

  const localPoint = (e: React.PointerEvent): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return screenToPdf(cameraRef.current, e.clientX - rect.left, e.clientY - rect.top);
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const cam = cameraRef.current;
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const next = Math.min(24, Math.max(0.05, cam.scale * (e.deltaY < 0 ? 1.1 : 0.9)));
    const pdfX = (mx - cam.x) / cam.scale;
    const pdfY = (my - cam.y) / cam.scale;
    cameraRef.current = { scale: next, x: mx - pdfX * next, y: my - pdfY * next };
    bump((n) => n + 1);
  };

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-slate-800">
      <canvas
        ref={canvasRef}
        className={`h-full w-full ${tool === "pan" ? "cursor-grab active:cursor-grabbing" : "cursor-crosshair"}`}
        onWheel={onWheel}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          if (tool === "pan") {
            dragRef.current = {
              ox: e.clientX,
              oy: e.clientY,
              cx: cameraRef.current.x,
              cy: cameraRef.current.y,
            };
            return;
          }
          if (tool === "select") {
            onSelect?.(null);
            return;
          }
          const p = localPoint(e);
          drawingRef.current = true;
          if (["polyline", "polygon", "cloud", "cloud_callout", "polylength", "area"].includes(tool)) {
            if (e.detail === 2) {
              finishPoly();
              return;
            }
            const next = [...draftRef.current, p];
            draftRef.current = next;
            setDraft(next);
            return;
          }
          if (tool === "count") {
            onCreateMarkup?.({
              type: "count",
              geometry: { points: [p], count: 1 },
              style: { ...style, stroke: style.stroke || "#7c3aed" },
              subject: subject || "Count",
            });
            return;
          }
          if (tool === "freehand") {
            draftRef.current = [p];
            setDraft([p]);
            return;
          }
          draftRef.current = [p];
          setDraft([p]);
          setCursor(p);
        }}
        onPointerMove={(e) => {
          if (tool === "pan" && dragRef.current) {
            cameraRef.current = {
              ...cameraRef.current,
              x: dragRef.current.cx + (e.clientX - dragRef.current.ox),
              y: dragRef.current.cy + (e.clientY - dragRef.current.oy),
            };
            bump((n) => n + 1);
            return;
          }
          if (!drawingRef.current && !draftRef.current.length) return;
          const p = localPoint(e);
          setCursor(p);
          if (tool === "freehand" && drawingRef.current) {
            const next = [...draftRef.current, p];
            draftRef.current = next;
            setDraft(next);
          }
        }}
        onPointerUp={() => {
          dragRef.current = null;
          if (tool === "pan" || tool === "select") return;
          if (["polyline", "polygon", "cloud", "cloud_callout"].includes(tool)) {
            drawingRef.current = false;
            return;
          }
          if (["polylength", "area"].includes(tool)) {
            drawingRef.current = false;
            return;
          }
          if (tool === "freehand") {
            finishPoly();
            drawingRef.current = false;
            return;
          }
          const start = draftRef.current[0];
          const end = cursor;
          if (start && end) commitBoxOrLine(start, end);
          draftRef.current = [];
          setDraft([]);
          setCursor(null);
          drawingRef.current = false;
        }}
      />
    </div>
  );
}
