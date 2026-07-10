import { useCallback, useEffect, useRef, useState } from "react";

type Camera = { x: number; y: number; scale: number };

export type TileViewportProps = {
  /** Page size in PDF points */
  widthPts: number;
  heightPts: number;
  tilePrefix: string;
  maxZoom?: number;
  tileSize?: number;
  /** Auth header value e.g. Bearer … */
  authHeader?: string | null;
  searchQuery?: string;
  textSpans?: Array<{ text: string; x0: number; y0: number; x1: number; y1: number }>;
};

function tileUrl(prefix: string, z: number, x: number, y: number) {
  return `/api/storage/object/${encodeURIComponent(`${prefix}/${z}/${x}/${y}.webp`)}`;
}

/**
 * Canvas tile viewport — streams 512px WebP tiles for the visible region.
 * Camera is in CSS pixels; page content is mapped from PDF points.
 */
export default function TileViewport({
  widthPts,
  heightPts,
  tilePrefix,
  maxZoom = 4,
  tileSize = 512,
  authHeader,
  searchQuery,
  textSpans = [],
}: TileViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const cameraRef = useRef<Camera>({ x: 40, y: 40, scale: 1 });
  const [, bump] = useState(0);
  const cacheRef = useRef(new Map<string, HTMLImageElement | "loading" | "error">());
  const dragRef = useRef<{ ox: number; oy: number; cx: number; cy: number } | null>(null);

  // Fit width on mount / page change
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
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const loadTile = useCallback(
    (z: number, x: number, y: number) => {
      const key = `${z}/${x}/${y}`;
      const cached = cacheRef.current.get(key);
      if (cached) return cached;
      cacheRef.current.set(key, "loading");
      const img = new Image();
      img.crossOrigin = "anonymous";
      const url = tileUrl(tilePrefix, z, x, y);
      // Fetch with auth then object URL (img cannot set Authorization)
      fetch(url, {
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

  // Choose zoom level from camera scale (PDF pts → CSS px)
  const pickZ = (scale: number) => {
    // At scale 1, 1pt = 1px. Tile z maps page width to TILE*2^z px at that z.
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
    const worldScale = (tileSize * 2 ** z) / widthPts; // px at this z per PDF pt
    // Camera maps PDF pts → screen: screen = pdf * cam.scale + cam.x
    // Tile (tx,ty) covers PDF region...
    const pageWpx = tileSize * 2 ** z;
    const pageHpx = Math.ceil((heightPts / widthPts) * pageWpx);
    const cols = Math.ceil(pageWpx / tileSize);
    const rows = Math.ceil(pageHpx / tileSize);

    // Visible PDF bounds
    const pdfLeft = (-cam.x) / cam.scale;
    const pdfTop = (-cam.y) / cam.scale;
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
        if (img instanceof HTMLImageElement) {
          ctx.drawImage(img, sx, sy, sw, sh);
        } else {
          // Low-res placeholder: try z=0
          const lo = cacheRef.current.get(`0/${tx}/${ty}`);
          if (lo instanceof HTMLImageElement) {
            ctx.globalAlpha = 0.85;
            ctx.drawImage(lo, sx, sy, sw, sh);
            ctx.globalAlpha = 1;
          } else {
            loadTile(0, Math.min(tx, 0), Math.min(ty, 0));
            ctx.fillStyle = "#334155";
            ctx.fillRect(sx, sy, sw, sh);
          }
        }
      }
    }

    // Search highlights
    if (searchQuery && textSpans.length) {
      const q = searchQuery.toLowerCase();
      ctx.save();
      for (const span of textSpans) {
        if (!span.text.toLowerCase().includes(q)) continue;
        const x = cam.x + span.x0 * cam.scale;
        const y = cam.y + span.y0 * cam.scale;
        const w = (span.x1 - span.x0) * cam.scale;
        const h = Math.max((span.y1 - span.y0) * cam.scale, 4);
        ctx.fillStyle = "rgba(250, 204, 21, 0.45)";
        ctx.fillRect(x, y, w, h);
      }
      ctx.restore();
    }
  });

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const cam = cameraRef.current;
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const next = Math.min(24, Math.max(0.05, cam.scale * factor));
    const pdfX = (mx - cam.x) / cam.scale;
    const pdfY = (my - cam.y) / cam.scale;
    cameraRef.current = {
      scale: next,
      x: mx - pdfX * next,
      y: my - pdfY * next,
    };
    bump((n) => n + 1);
  };

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-slate-800">
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-grab active:cursor-grabbing"
        onWheel={onWheel}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          dragRef.current = {
            ox: e.clientX,
            oy: e.clientY,
            cx: cameraRef.current.x,
            cy: cameraRef.current.y,
          };
        }}
        onPointerMove={(e) => {
          if (!dragRef.current) return;
          cameraRef.current = {
            ...cameraRef.current,
            x: dragRef.current.cx + (e.clientX - dragRef.current.ox),
            y: dragRef.current.cy + (e.clientY - dragRef.current.oy),
          };
          bump((n) => n + 1);
        }}
        onPointerUp={() => {
          dragRef.current = null;
        }}
      />
    </div>
  );
}
