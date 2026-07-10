import { cloudPathFromPolygon } from "@plansimple/shared";
import type { Camera, Point } from "./camera";
import { pdfToScreen } from "./camera";
import type { Markup, MarkupStyle } from "./markupTypes";

function styleOf(m: Markup): Required<Pick<MarkupStyle, "stroke" | "fill" | "strokeWidth" | "opacity">> & MarkupStyle {
  return {
    stroke: (m.style?.stroke as string) || "#e11d48",
    fill: (m.style?.fill as string) || "transparent",
    strokeWidth: Number(m.style?.strokeWidth ?? 2),
    opacity: Number(m.style?.opacity ?? 1),
    fontSize: m.style?.fontSize,
  };
}

function applyStroke(ctx: CanvasRenderingContext2D, cam: Camera, m: Markup, highlight = false) {
  const s = styleOf(m);
  ctx.globalAlpha = s.opacity;
  ctx.strokeStyle = highlight ? "#2563eb" : s.stroke;
  ctx.fillStyle = s.fill === "transparent" ? "rgba(0,0,0,0)" : s.fill;
  ctx.lineWidth = Math.max(1, s.strokeWidth * (highlight ? 1.4 : 1));
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
}

function pts(geom: Record<string, unknown>): Point[] {
  const raw = geom.points;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (p): p is Point =>
      !!p && typeof p === "object" && typeof (p as Point).x === "number" && typeof (p as Point).y === "number"
  );
}

export function drawMarkup(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  m: Markup,
  selected = false
) {
  applyStroke(ctx, cam, m, selected);
  const g = m.geometry || {};
  const type = m.type;

  if (type === "rectangle" || type === "highlighter") {
    const x = Number(g.x ?? 0);
    const y = Number(g.y ?? 0);
    const w = Number(g.w ?? 0);
    const h = Number(g.h ?? 0);
    const a = pdfToScreen(cam, { x, y });
    const b = pdfToScreen(cam, { x: x + w, y: y + h });
    if (type === "highlighter") {
      ctx.fillStyle = (m.style?.fill as string) || "rgba(250, 204, 21, 0.35)";
      ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
    } else {
      ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
      if (m.style?.fill && m.style.fill !== "transparent") {
        ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
      }
    }
  } else if (type === "ellipse") {
    const x = Number(g.x ?? 0);
    const y = Number(g.y ?? 0);
    const w = Number(g.w ?? 0);
    const h = Number(g.h ?? 0);
    const cx = pdfToScreen(cam, { x: x + w / 2, y: y + h / 2 });
    ctx.beginPath();
    ctx.ellipse(cx.x, cx.y, (Math.abs(w) * cam.scale) / 2, (Math.abs(h) * cam.scale) / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (type === "line" || type === "arrow") {
    const a = pdfToScreen(cam, { x: Number(g.x1 ?? 0), y: Number(g.y1 ?? 0) });
    const b = pdfToScreen(cam, { x: Number(g.x2 ?? 0), y: Number(g.y2 ?? 0) });
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    if (type === "arrow") {
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const size = 10;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - size * Math.cos(ang - 0.4), b.y - size * Math.sin(ang - 0.4));
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - size * Math.cos(ang + 0.4), b.y - size * Math.sin(ang + 0.4));
      ctx.stroke();
    }
  } else if (type === "polyline" || type === "freehand" || type === "polygon" || type === "cloud" || type === "cloud_callout") {
    let points = pts(g);
    if (type === "cloud" || type === "cloud_callout") {
      if (points.length >= 3) points = cloudPathFromPolygon(points, { radius: 8 });
    }
    if (points.length < 2) return;
    ctx.beginPath();
    const first = pdfToScreen(cam, points[0]!);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < points.length; i++) {
      const p = pdfToScreen(cam, points[i]!);
      ctx.lineTo(p.x, p.y);
    }
    if (type === "polygon" || type === "cloud" || type === "cloud_callout") ctx.closePath();
    ctx.stroke();
    if (type === "cloud_callout") {
      const text = String(g.text ?? m.subject ?? "");
      if (text) {
        const anchor = pdfToScreen(cam, points[0]!);
        ctx.fillStyle = "#0f172a";
        ctx.font = `${12 * cam.scale}px sans-serif`;
        ctx.fillText(text, anchor.x + 6, anchor.y - 6);
      }
    }
  } else if (type === "textbox" || type === "callout") {
    const x = Number(g.x ?? 0);
    const y = Number(g.y ?? 0);
    const a = pdfToScreen(cam, { x, y });
    const text = String(g.text ?? m.subject ?? "Text");
    ctx.fillStyle = "#0f172a";
    ctx.font = `${(m.style?.fontSize ?? 12) * cam.scale}px sans-serif`;
    ctx.fillText(text, a.x, a.y);
    if (type === "callout" && g.x2 != null) {
      const b = pdfToScreen(cam, { x: Number(g.x2), y: Number(g.y2) });
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  ctx.globalAlpha = 1;
}

export function drawDraft(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  tool: string,
  points: Point[],
  cursor: Point | null
) {
  if (!points.length) return;
  const draft: Markup = {
    id: "draft",
    pageId: "",
    revisionId: "",
    type: tool,
    geometry: {},
    style: { stroke: "#2563eb", strokeWidth: 2, fill: "transparent", opacity: 0.9 },
    status: "open",
    subject: null,
    layer: "Default",
    authorId: null,
    createdAt: new Date().toISOString(),
  };

  if (["rectangle", "ellipse", "highlighter", "textbox"].includes(tool) && points[0] && cursor) {
    draft.geometry = {
      x: Math.min(points[0].x, cursor.x),
      y: Math.min(points[0].y, cursor.y),
      w: Math.abs(cursor.x - points[0].x),
      h: Math.abs(cursor.y - points[0].y),
      text: tool === "textbox" ? "Text" : undefined,
    };
  } else if (["line", "arrow", "callout"].includes(tool) && points[0] && cursor) {
    draft.geometry = { x1: points[0].x, y1: points[0].y, x2: cursor.x, y2: cursor.y, text: "Note" };
  } else if (["polyline", "polygon", "cloud", "cloud_callout", "freehand"].includes(tool)) {
    const all = cursor ? [...points, cursor] : points;
    draft.geometry = { points: all, text: tool.includes("callout") ? "Note" : undefined };
  }
  drawMarkup(ctx, cam, draft, true);
}
