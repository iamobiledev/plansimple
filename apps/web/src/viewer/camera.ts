export type Camera = { x: number; y: number; scale: number };

export type Point = { x: number; y: number };

export function screenToPdf(cam: Camera, sx: number, sy: number): Point {
  return { x: (sx - cam.x) / cam.scale, y: (sy - cam.y) / cam.scale };
}

export function pdfToScreen(cam: Camera, p: Point): Point {
  return { x: p.x * cam.scale + cam.x, y: p.y * cam.scale + cam.y };
}
