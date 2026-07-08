/**
 * pdf.js helpers: load a sheet's single-page PDF and render it to canvases
 * at various scales (viewer quality, thumbnails, AI snapshots).
 */
import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const docCache = new Map<string, Promise<PDFDocumentProxy>>();

export function loadSheetPdf(fileUrl: string): Promise<PDFDocumentProxy> {
  let cached = docCache.get(fileUrl);
  if (!cached) {
    cached = pdfjs.getDocument({ url: fileUrl }).promise;
    docCache.set(fileUrl, cached);
    cached.catch(() => docCache.delete(fileUrl));
  }
  return cached;
}

export interface RenderedPage {
  canvas: HTMLCanvasElement;
  /** Page size in base coordinates (viewport scale 1). All geometry is stored in this space. */
  baseWidth: number;
  baseHeight: number;
  /** canvas pixels per base pixel */
  renderScale: number;
}

/**
 * Render page 1 of a sheet PDF to an offscreen canvas.
 * `quality` is the multiplier over base (scale 1) resolution.
 */
export async function renderSheetPage(fileUrl: string, quality: number): Promise<RenderedPage> {
  const doc = await loadSheetPdf(fileUrl);
  const page = await doc.getPage(1);
  const base = page.getViewport({ scale: 1 });

  // Cap total canvas pixels to keep memory sane on huge sheets.
  const MAX_PIXELS = 32 * 1024 * 1024;
  let scale = quality;
  if (base.width * base.height * scale * scale > MAX_PIXELS) {
    scale = Math.sqrt(MAX_PIXELS / (base.width * base.height));
  }

  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport }).promise;

  return { canvas, baseWidth: base.width, baseHeight: base.height, renderScale: scale };
}

const thumbCache = new Map<string, Promise<string>>();

/** Render a small thumbnail data URL for the sheet sidebar (cached per file). */
export function renderThumbnail(fileUrl: string, width = 320): Promise<string> {
  let cached = thumbCache.get(fileUrl);
  if (!cached) {
    cached = (async () => {
      const doc = await loadSheetPdf(fileUrl);
      const page = await doc.getPage(1);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: width / base.width });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
      return canvas.toDataURL("image/png");
    })();
    thumbCache.set(fileUrl, cached);
    cached.catch(() => thumbCache.delete(fileUrl));
  }
  return cached;
}

/**
 * Snapshot a rectangular region of the sheet (in base coordinates) as a PNG
 * data URL, downscaled so its longest side is at most `maxSide` px.
 * Returns the image plus the scale factor from base coords to image pixels.
 */
export function snapshotRegion(
  rendered: RenderedPage,
  x: number,
  y: number,
  w: number,
  h: number,
  maxSide = 1568
): { dataUrl: string; width: number; height: number; scale: number } {
  const outScale = Math.min(maxSide / w, maxSide / h, rendered.renderScale);
  const width = Math.max(1, Math.round(w * outScale));
  const height = Math.max(1, Math.round(h * outScale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  const rs = rendered.renderScale;
  ctx.drawImage(rendered.canvas, x * rs, y * rs, w * rs, h * rs, 0, 0, width, height);
  return { dataUrl: canvas.toDataURL("image/png"), width, height, scale: outScale };
}
