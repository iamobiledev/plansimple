/**
 * Seed script: creates a demo user, a project with sensible starter
 * conditions, and a generated two-page sample floor plan PDF so the app is
 * usable immediately after `npm run seed`.
 *
 * Demo login: demo@plansimple.dev / plansimple123
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PDFDocument, PDFPage, rgb, StandardFonts, degrees } from "pdf-lib";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";

const prisma = new PrismaClient();
const uploadsDir = process.env.FILE_STORAGE_DIR || path.join(process.cwd(), "uploads");

const ink = rgb(0.15, 0.17, 0.2);
const light = rgb(0.45, 0.5, 0.55);

// Drawing scale for the generated plan: 40 PDF points per foot.
const PX_PER_FT = 40;

function wall(page: PDFPage, x1: number, y1: number, x2: number, y2: number, thickness = 6) {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color: ink });
}

function receptacle(page: PDFPage, x: number, y: number) {
  page.drawCircle({ x, y, size: 7, borderColor: ink, borderWidth: 1.6 });
  page.drawLine({ start: { x: x - 12, y }, end: { x: x - 7, y }, thickness: 1.6, color: ink });
  page.drawLine({ start: { x: x + 7, y }, end: { x: x + 12, y }, thickness: 1.6, color: ink });
}

function door(page: PDFPage, hingeX: number, hingeY: number, width: number, rotation: number) {
  // Door leaf + quarter-circle swing arc drawn as an SVG path, rotated about the hinge.
  page.drawSvgPath(`M 0 0 L ${width} 0 A ${width} ${width} 0 0 1 0 ${-width} Z`, {
    x: hingeX,
    y: hingeY,
    borderColor: light,
    borderWidth: 1.2,
    rotate: degrees(rotation),
  });
}

function dimension(page: PDFPage, font: Awaited<ReturnType<PDFDocument["embedFont"]>>, x1: number, x2: number, y: number, label: string) {
  page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: 1, color: ink });
  for (const x of [x1, x2]) {
    page.drawLine({ start: { x: x - 4, y: y - 4 }, end: { x: x + 4, y: y + 4 }, thickness: 1.2, color: ink });
  }
  const textWidth = font.widthOfTextAtSize(label, 14);
  page.drawRectangle({
    x: (x1 + x2) / 2 - textWidth / 2 - 4,
    y: y - 8,
    width: textWidth + 8,
    height: 18,
    color: rgb(1, 1, 1),
  });
  page.drawText(label, { x: (x1 + x2) / 2 - textWidth / 2, y: y - 4, size: 14, font, color: ink });
}

async function buildSamplePlan(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  // ---- Page 1: floor plan -------------------------------------------------
  const p1 = doc.addPage([1728, 1296]); // 24" x 18" at 72 dpi
  p1.drawRectangle({ x: 40, y: 40, width: 1648, height: 1216, borderColor: ink, borderWidth: 2 });
  p1.drawText("PLANSIMPLE DEMO — SUITE 210 FLOOR PLAN", { x: 70, y: 1200, size: 26, font: bold, color: ink });
  p1.drawText("SHEET A-101   SCALE: 40 PT = 1'-0\"", { x: 70, y: 1170, size: 14, font, color: light });

  // Exterior shell: 30' x 20' suite, origin at (200, 260).
  const ox = 200;
  const oy = 260;
  const W = 30 * PX_PER_FT; // 1200
  const H = 20 * PX_PER_FT; // 800
  wall(p1, ox, oy, ox + W, oy);
  wall(p1, ox + W, oy, ox + W, oy + H);
  wall(p1, ox + W, oy + H, ox, oy + H);
  wall(p1, ox, oy + H, ox, oy);

  // Interior wall splitting off a 12' wide office on the left, with a 3' door gap.
  const ix = ox + 12 * PX_PER_FT;
  wall(p1, ix, oy, ix, oy + H - 8 * PX_PER_FT, 4);
  wall(p1, ix, oy + H - 5 * PX_PER_FT, ix, oy + H, 4);
  door(p1, ix, oy + H - 5 * PX_PER_FT, 3 * PX_PER_FT, 270);

  // Interior wall splitting a conference room top-right, 3' door gap.
  const iy = oy + H - 8 * PX_PER_FT;
  wall(p1, ix, iy, ox + W - 5 * PX_PER_FT, iy, 4);
  wall(p1, ox + W - 2 * PX_PER_FT, iy, ox + W, iy, 4);
  door(p1, ox + W - 2 * PX_PER_FT, iy, 3 * PX_PER_FT, 180);

  // Entry door on the south wall.
  door(p1, ox + 16 * PX_PER_FT, oy, 3 * PX_PER_FT, 90);

  // Room labels
  p1.drawText("OFFICE 1", { x: ox + 4 * PX_PER_FT, y: oy + H / 2, size: 18, font: bold, color: light });
  p1.drawText("CONFERENCE", { x: ix + 5 * PX_PER_FT, y: iy + 4 * PX_PER_FT, size: 18, font: bold, color: light });
  p1.drawText("OPEN OFFICE", { x: ix + 5 * PX_PER_FT, y: oy + 5 * PX_PER_FT, size: 18, font: bold, color: light });

  // Receptacles around the perimeter and interior walls.
  const recepts: Array<[number, number]> = [
    [ox + 3 * PX_PER_FT, oy + 14],
    [ox + 9 * PX_PER_FT, oy + 14],
    [ox + 20 * PX_PER_FT, oy + 14],
    [ox + 26 * PX_PER_FT, oy + 14],
    [ox + W - 14, oy + 4 * PX_PER_FT],
    [ox + W - 14, oy + 10 * PX_PER_FT],
    [ox + W - 14, oy + 16 * PX_PER_FT],
    [ox + 14, oy + 6 * PX_PER_FT],
    [ox + 14, oy + 14 * PX_PER_FT],
    [ox + 6 * PX_PER_FT, oy + H - 14],
    [ix + 14, oy + 3 * PX_PER_FT],
    [ix + 8 * PX_PER_FT, iy + 14],
  ];
  for (const [x, y] of recepts) receptacle(p1, x, y);

  // Calibration dimension: the south wall is exactly 30'-0"; also add a 20'-0" string.
  dimension(p1, bold, ox, ox + W, oy - 60, `30'-0"`);
  dimension(p1, bold, ox, ox + 20 * PX_PER_FT, oy - 110, `20'-0"`);

  // ---- Page 2: roof plan --------------------------------------------------
  const p2 = doc.addPage([1728, 1296]);
  p2.drawRectangle({ x: 40, y: 40, width: 1648, height: 1216, borderColor: ink, borderWidth: 2 });
  p2.drawText("PLANSIMPLE DEMO — ROOF PLAN", { x: 70, y: 1200, size: 26, font: bold, color: ink });
  p2.drawText("SHEET A-102   SCALE: 40 PT = 1'-0\"", { x: 70, y: 1170, size: 14, font, color: light });
  wall(p2, ox, oy, ox + W, oy, 4);
  wall(p2, ox + W, oy, ox + W, oy + H, 4);
  wall(p2, ox + W, oy + H, ox, oy + H, 4);
  wall(p2, ox, oy + H, ox, oy, 4);
  p2.drawLine({ start: { x: ox, y: oy + H / 2 }, end: { x: ox + W, y: oy + H / 2 }, thickness: 1.5, color: light, dashArray: [10, 6] });
  p2.drawText("RIDGE", { x: ox + W / 2 - 30, y: oy + H / 2 + 10, size: 14, font, color: light });
  dimension(p2, bold, ox, ox + W, oy - 60, `30'-0"`);

  return doc.save();
}

async function main() {
  const passwordHash = await bcrypt.hash("plansimple123", 10);
  const user = await prisma.user.upsert({
    where: { email: "demo@plansimple.dev" },
    update: {},
    create: { email: "demo@plansimple.dev", passwordHash },
  });

  const existing = await prisma.project.findFirst({
    where: { userId: user.id, name: "Demo Office Building" },
  });
  if (existing) {
    console.log("Seed data already present — skipping.");
    return;
  }

  const project = await prisma.project.create({
    data: { userId: user.id, name: "Demo Office Building" },
  });

  await prisma.condition.createMany({
    data: [
      { projectId: project.id, name: "Interior Wall — 5/8\" Drywall", color: "#e05252", measurementType: "linear", unit: "LF", unitCost: 12.5 },
      { projectId: project.id, name: "Carpet Flooring", color: "#3b82c4", measurementType: "area", unit: "SF", unitCost: 4.25 },
      { projectId: project.id, name: "Duplex Receptacle", color: "#e8a33d", measurementType: "count", unit: "EA", unitCost: 45 },
    ],
  });

  // Generate the sample plan and split it into per-page sheet files, the same
  // way the upload endpoint does.
  const planBytes = await buildSamplePlan();
  const sourceDoc = await PDFDocument.load(planBytes);
  await fs.mkdir(uploadsDir, { recursive: true });

  const sheetNames = ["A-101 Floor Plan", "A-102 Roof Plan"];
  for (let i = 0; i < sourceDoc.getPageCount(); i++) {
    const single = await PDFDocument.create();
    const [page] = await single.copyPages(sourceDoc, [i]);
    single.addPage(page);
    const key = `${crypto.randomUUID()}.pdf`;
    await fs.writeFile(path.join(uploadsDir, key), Buffer.from(await single.save()));
    await prisma.sheet.create({
      data: {
        projectId: project.id,
        name: sheetNames[i] ?? `Sheet ${i + 1}`,
        pageNumber: i + 1,
        fileUrl: `/api/files/${key}`,
        // Sheet 1 comes pre-calibrated (the plan is drawn at 40 pt/ft);
        // sheet 2 is left uncalibrated so you can try the calibration tool
        // against its 30'-0" dimension string.
        scalePixelsPerUnit: i === 0 ? PX_PER_FT : null,
        unitSystem: "imperial",
      },
    });
  }

  console.log("Seeded demo data.");
  console.log("  Login:    demo@plansimple.dev / plansimple123");
  console.log("  Project:  Demo Office Building (2 sheets, 3 conditions)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
