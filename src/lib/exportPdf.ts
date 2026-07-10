/**
 * Branded takeoff PDF export — pure logic on top of pdf-lib.
 *
 * Produces: a letter-size cover page (project info + quantity summary table)
 * followed by each plan sheet with vector measurement overlays, an optional
 * per-sheet legend, and a footer stamp.
 *
 * All geometry is stored in PDF base coordinates (viewport scale 1, y-down),
 * which for an unrotated page equals PDF points with y flipped.
 */
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, type RGB } from "pdf-lib";
import type { Condition, Measurement, ProjectDetail, Sheet } from "../types";
import { buildSummary } from "./csv";
import { formatQuantity } from "./scale";
import { midpoint, polygonCentroid } from "./geometry";

export interface ExportOptions {
  /** Which sheets to include. */
  sheets: "all" | "measured";
  /** Draw a per-sheet legend box with item colors and totals. */
  legend: boolean;
}

export interface IconBitmap {
  bytes: Uint8Array;
  format: "png" | "jpg";
}

const ACCENT = rgb(0.23, 0.51, 0.77); // #3b82c4
const INK = rgb(0.11, 0.14, 0.19);
const MUTED = rgb(0.42, 0.47, 0.53);
const LIGHT = rgb(0.93, 0.95, 0.97);
const WHITE = rgb(1, 1, 1);

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.replace("#", ""), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function money(v: number): string {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function truncate(font: PDFFont, text: string, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && font.widthOfTextAtSize(t + "…", size) > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + "…";
}

/** Strip characters WinAnsi can't encode (pdf-lib standard fonts). */
function ansi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[^\x20-\x7E\xA0-\xFF—–’‘“”·]/g, "").replace(/[—–]/g, "-").replace(/[’‘]/g, "'").replace(/[“”]/g, '"');
}

export async function buildTakeoffPdf(args: {
  project: ProjectDetail;
  measurements: Measurement[];
  options: ExportOptions;
  fetchSheetPdf: (sheet: Sheet) => Promise<ArrayBuffer>;
  iconBitmaps: Map<string, IconBitmap>;
  generatedAt?: Date;
}): Promise<Uint8Array> {
  const { project, measurements, options, fetchSheetPdf, iconBitmaps } = args;
  const generatedAt = args.generatedAt ?? new Date();
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  doc.setTitle(`${project.name} — Quantity Takeoff`);
  doc.setProducer("PlanSimple");
  doc.setCreator("PlanSimple");

  drawCoverPages(doc, font, bold, project, measurements, generatedAt);

  const measuredSheetIds = new Set(measurements.map((m) => m.sheetId));
  const sheets =
    options.sheets === "measured"
      ? project.sheets.filter((s) => measuredSheetIds.has(s.id))
      : project.sheets;

  // Pre-embed icon images once.
  const embedded = new Map<string, Awaited<ReturnType<PDFDocument["embedPng"]>>>();
  for (const [key, bmp] of iconBitmaps) {
    try {
      const bytes = new Uint8Array(bmp.bytes);
      embedded.set(key, bmp.format === "png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes));
    } catch {
      /* fall back to default markers */
    }
  }

  for (const sheet of sheets) {
    let srcBytes: ArrayBuffer;
    try {
      srcBytes = await fetchSheetPdf(sheet);
    } catch {
      continue; // skip unreadable sheets rather than failing the export
    }
    const src = await PDFDocument.load(srcBytes, { ignoreEncryption: true });
    const [page] = await doc.copyPages(src, [0]);
    doc.addPage(page);
    drawSheetOverlays(page, font, bold, project, sheet, measurements, embedded, options, generatedAt);
  }

  return doc.save();
}

// ---------------------------------------------------------------------------
// Cover page(s)
// ---------------------------------------------------------------------------

function drawCoverPages(
  doc: PDFDocument,
  font: PDFFont,
  bold: PDFFont,
  project: ProjectDetail,
  measurements: Measurement[],
  generatedAt: Date
): void {
  const summary = buildSummary(measurements, project.conditions, project.sheets);

  // Roll up per item across sheets.
  const rolled = [
    ...summary
      .reduce((map, line) => {
        const existing = map.get(line.conditionName);
        if (existing) {
          existing.quantity += line.quantity;
          existing.extendedCost =
            existing.extendedCost != null && line.extendedCost != null
              ? existing.extendedCost + line.extendedCost
              : (existing.extendedCost ?? line.extendedCost);
        } else {
          map.set(line.conditionName, { ...line });
        }
        return map;
      }, new Map<string, (typeof summary)[number]>())
      .values(),
  ];
  const colorByName = new Map(project.conditions.map((c) => [c.name, c.color]));
  const grandTotal = rolled.reduce((sum, l) => sum + (l.extendedCost ?? 0), 0);

  const W = 612;
  const H = 792;
  const M = 54; // margin
  let page = doc.addPage([W, H]);
  let y = H;

  // Header band
  page.drawRectangle({ x: 0, y: H - 10, width: W, height: 10, color: ACCENT });
  y = H - 64;
  page.drawText("QUANTITY TAKEOFF", {
    x: M,
    y,
    size: 11,
    font: bold,
    color: ACCENT,
  });
  y -= 34;
  page.drawText(truncate(bold, ansi(project.name), 26, W - 2 * M), {
    x: M,
    y,
    size: 26,
    font: bold,
    color: INK,
  });
  y -= 24;
  const infoLines: Array<[string, string]> = [];
  if (project.clientName) infoLines.push(["Prepared for", project.clientName]);
  if (project.address) infoLines.push(["Site address", project.address]);
  infoLines.push([
    "Date",
    generatedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
  ]);
  for (const [label, value] of infoLines) {
    page.drawText(label.toUpperCase(), { x: M, y, size: 8, font: bold, color: MUTED });
    page.drawText(truncate(font, ansi(value), 11, W - M - 150 - M), {
      x: M + 110,
      y: y - 1,
      size: 11,
      font,
      color: INK,
    });
    y -= 18;
  }
  y -= 10;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: LIGHT });
  y -= 28;

  // Summary table
  const cols = {
    chip: M,
    item: M + 16,
    qty: 360,
    unit: 420,
    unitCost: 470,
    total: W - M,
  };
  const rowH = 21;

  const drawTableHeader = () => {
    page.drawRectangle({ x: M - 6, y: y - 6, width: W - 2 * M + 12, height: rowH, color: LIGHT });
    page.drawText("ITEM", { x: cols.item, y, size: 9, font: bold, color: MUTED });
    page.drawText("QTY", { x: cols.qty, y, size: 9, font: bold, color: MUTED });
    page.drawText("UNIT", { x: cols.unit, y, size: 9, font: bold, color: MUTED });
    page.drawText("UNIT COST", { x: cols.unitCost, y, size: 9, font: bold, color: MUTED });
    const w = bold.widthOfTextAtSize("TOTAL", 9);
    page.drawText("TOTAL", { x: cols.total - w, y, size: 9, font: bold, color: MUTED });
    y -= rowH + 2;
  };

  const newCoverPage = () => {
    page = doc.addPage([W, H]);
    page.drawRectangle({ x: 0, y: H - 10, width: W, height: 10, color: ACCENT });
    y = H - 60;
    page.drawText(`${ansi(project.name)} — summary (continued)`, {
      x: M,
      y,
      size: 12,
      font: bold,
      color: INK,
    });
    y -= 30;
    drawTableHeader();
  };

  if (rolled.length === 0) {
    page.drawText("No measurements yet.", { x: M, y, size: 12, font, color: MUTED });
  } else {
    drawTableHeader();
    let zebra = false;
    for (const line of rolled) {
      if (y < 90) newCoverPage();
      if (zebra) {
        page.drawRectangle({
          x: M - 6,
          y: y - 6,
          width: W - 2 * M + 12,
          height: rowH - 2,
          color: rgb(0.97, 0.98, 0.99),
        });
      }
      zebra = !zebra;
      const color = colorByName.get(line.conditionName);
      if (color) {
        page.drawRectangle({ x: cols.chip, y: y - 1, width: 9, height: 9, color: hexToRgb(color) });
      }
      page.drawText(truncate(font, ansi(line.conditionName), 10.5, cols.qty - cols.item - 12), {
        x: cols.item,
        y,
        size: 10.5,
        font,
        color: INK,
      });
      const qty = (Math.round(line.quantity * 100) / 100).toLocaleString("en-US");
      page.drawText(qty, { x: cols.qty, y, size: 10.5, font, color: INK });
      page.drawText(ansi(line.unit), { x: cols.unit, y, size: 10.5, font, color: MUTED });
      page.drawText(line.unitCost != null ? money(line.unitCost) : "—", {
        x: cols.unitCost,
        y,
        size: 10.5,
        font,
        color: MUTED,
      });
      const totalText = line.extendedCost != null ? money(line.extendedCost) : "—";
      const tw = font.widthOfTextAtSize(totalText, 10.5);
      page.drawText(totalText, { x: cols.total - tw, y, size: 10.5, font, color: INK });
      y -= rowH;
    }

    if (grandTotal > 0) {
      y -= 4;
      page.drawLine({ start: { x: M, y: y + 14 }, end: { x: W - M, y: y + 14 }, thickness: 1.2, color: ACCENT });
      page.drawText("PROJECT TOTAL", { x: cols.item, y, size: 11, font: bold, color: INK });
      const totalText = money(grandTotal);
      const tw = bold.widthOfTextAtSize(totalText, 12);
      page.drawText(totalText, { x: cols.total - tw, y, size: 12, font: bold, color: ACCENT });
    }
  }

  // Footer on every cover page
  for (const p of doc.getPages()) {
    p.drawText("Prepared with PlanSimple", { x: M, y: 36, size: 8, font, color: MUTED });
    const n = `${doc.getPages().indexOf(p) + 1}`;
    p.drawText(n, { x: W - M - font.widthOfTextAtSize(n, 8), y: 36, size: 8, font, color: MUTED });
  }
}

// ---------------------------------------------------------------------------
// Sheet overlays
// ---------------------------------------------------------------------------

function drawSheetOverlays(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  project: ProjectDetail,
  sheet: Sheet,
  allMeasurements: Measurement[],
  icons: Map<string, Awaited<ReturnType<PDFDocument["embedPng"]>>>,
  options: ExportOptions,
  generatedAt: Date
): void {
  const H = page.getHeight();
  const W = page.getWidth();
  // Annotation sizing scales with the sheet so exports read well at any size.
  const s = Math.max(0.7, Math.max(W, H) / 1500);
  const conditionById = new Map(project.conditions.map((c) => [c.id, c]));
  const measurements = allMeasurements.filter((m) => m.sheetId === sheet.id);

  const flipY = (y: number) => H - y;

  const drawLabel = (cx: number, cy: number, text: string, color: RGB) => {
    const size = 10 * s;
    const w = bold.widthOfTextAtSize(text, size) + 10 * s;
    const h = size + 8 * s;
    const x = Math.min(Math.max(cx - w / 2, 4), W - w - 4);
    const y = Math.min(Math.max(flipY(cy) - h / 2, 4), H - h - 4);
    page.drawRectangle({
      x,
      y,
      width: w,
      height: h,
      color: WHITE,
      borderColor: color,
      borderWidth: 0.8 * s,
      opacity: 0.92,
      borderOpacity: 0.9,
    });
    page.drawText(text, { x: x + 5 * s, y: y + 4.5 * s, size, font: bold, color: INK });
  };

  for (const m of measurements) {
    const c = conditionById.get(m.conditionId);
    if (!c) continue;
    const color = hexToRgb(c.color);
    const pts = m.geometry.points;

    if (c.measurementType === "linear" && pts.length >= 2) {
      for (let i = 1; i < pts.length; i++) {
        page.drawLine({
          start: { x: pts[i - 1].x, y: flipY(pts[i - 1].y) },
          end: { x: pts[i].x, y: flipY(pts[i].y) },
          thickness: 2.4 * s,
          color,
          opacity: 0.9,
        });
      }
      const mid = midpoint(pts[0], pts[pts.length - 1]);
      drawLabel(mid.x, mid.y, ansi(formatQuantity("linear", m.computedValue, sheet.unitSystem)), color);
    } else if (c.measurementType === "area" && pts.length >= 3) {
      const path = `M ${pts.map((p) => `${p.x} ${p.y}`).join(" L ")} Z`;
      page.drawSvgPath(path, {
        x: 0,
        y: H, // svg paths are y-down from this origin
        color,
        opacity: 0.18,
        borderColor: color,
        borderWidth: 1.8 * s,
        borderOpacity: 0.9,
      });
      const centroid = polygonCentroid(pts);
      drawLabel(
        centroid.x,
        centroid.y,
        ansi(formatQuantity("area", m.computedValue, sheet.unitSystem)),
        color
      );
    } else if (c.measurementType === "count" && pts.length >= 1) {
      const p = pts[0];
      const icon = c.iconKey ? icons.get(c.iconKey) : undefined;
      if (icon) {
        const size = 22 * s;
        page.drawImage(icon, {
          x: p.x - size / 2,
          y: flipY(p.y) - size / 2,
          width: size,
          height: size,
        });
      } else {
        page.drawCircle({
          x: p.x,
          y: flipY(p.y),
          size: 8 * s,
          borderColor: color,
          borderWidth: 2 * s,
          color,
          opacity: 0.3,
          borderOpacity: 0.95,
        });
      }
    }
  }

  // Per-sheet legend
  if (options.legend && measurements.length > 0) {
    const totals = new Map<string, number>();
    for (const m of measurements) {
      totals.set(m.conditionId, (totals.get(m.conditionId) ?? 0) + m.computedValue);
    }
    const rows = [...totals.entries()]
      .map(([id, total]) => ({ c: conditionById.get(id), total }))
      .filter((r): r is { c: Condition; total: number } => !!r.c);

    const size = 9.5 * s;
    const rowH = size + 7 * s;
    const boxW = 190 * s;
    const boxH = rows.length * rowH + 30 * s;
    const bx = 12 * s;
    const by = 12 * s;
    page.drawRectangle({
      x: bx,
      y: by,
      width: boxW,
      height: boxH,
      color: WHITE,
      opacity: 0.94,
      borderColor: rgb(0.75, 0.79, 0.83),
      borderWidth: 0.8 * s,
    });
    page.drawText("TAKEOFF LEGEND", {
      x: bx + 8 * s,
      y: by + boxH - 14 * s,
      size: 8 * s,
      font: bold,
      color: MUTED,
    });
    let ly = by + boxH - 14 * s - rowH;
    for (const { c, total } of rows) {
      page.drawRectangle({
        x: bx + 8 * s,
        y: ly,
        width: 8 * s,
        height: 8 * s,
        color: hexToRgb(c.color),
      });
      const qty = ansi(formatQuantity(c.measurementType, total, sheet.unitSystem));
      const qtyW = bold.widthOfTextAtSize(qty, size);
      page.drawText(truncate(font, ansi(c.name), size, boxW - 30 * s - qtyW), {
        x: bx + 21 * s,
        y: ly,
        size,
        font,
        color: INK,
      });
      page.drawText(qty, { x: bx + boxW - qtyW - 8 * s, y: ly, size, font: bold, color: INK });
      ly -= rowH;
    }
  }

  // Footer stamp (bottom-right)
  const stamp = ansi(
    `${project.name}  ·  ${sheet.name}  ·  ${generatedAt.toLocaleDateString("en-US")}  ·  PlanSimple`
  );
  const ssize = 8 * s;
  const sw = font.widthOfTextAtSize(stamp, ssize) + 14 * s;
  page.drawRectangle({
    x: W - sw - 10 * s,
    y: 10 * s,
    width: sw,
    height: ssize + 10 * s,
    color: WHITE,
    opacity: 0.9,
    borderColor: rgb(0.8, 0.83, 0.86),
    borderWidth: 0.6 * s,
  });
  page.drawText(stamp, {
    x: W - sw - 10 * s + 7 * s,
    y: 10 * s + 5 * s,
    size: ssize,
    font,
    color: MUTED,
  });
}
