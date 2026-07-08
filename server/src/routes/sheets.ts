import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { PDFDocument } from "pdf-lib";
import crypto from "node:crypto";
import { prisma } from "../db.js";
import { requireAuth, currentUserId } from "../auth.js";
import { storage } from "../storage/storage.js";

const router = Router();
router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

/**
 * Upload a PDF plan set to a project. Splits the PDF into one single-page
 * file per sheet, stores each, and creates Sheet rows.
 */
router.post("/upload/:projectId", upload.single("file"), async (req, res, next) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.projectId, userId: currentUserId(req) },
    });
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    if (req.file.mimetype !== "application/pdf" && !req.file.originalname.toLowerCase().endsWith(".pdf")) {
      return res.status(400).json({ error: "Only PDF files are supported" });
    }

    let sourceDoc: PDFDocument;
    try {
      sourceDoc = await PDFDocument.load(req.file.buffer, { ignoreEncryption: true });
    } catch {
      return res.status(400).json({ error: "Could not parse PDF file" });
    }

    const pageCount = sourceDoc.getPageCount();
    const baseName = req.file.originalname.replace(/\.pdf$/i, "");
    const existingCount = await prisma.sheet.count({ where: { projectId: project.id } });

    const sheets = [];
    for (let i = 0; i < pageCount; i++) {
      const singlePage = await PDFDocument.create();
      const [page] = await singlePage.copyPages(sourceDoc, [i]);
      singlePage.addPage(page);
      const bytes = await singlePage.save();
      const key = `${crypto.randomUUID()}.pdf`;
      await storage.save(key, Buffer.from(bytes));

      const sheet = await prisma.sheet.create({
        data: {
          projectId: project.id,
          name: pageCount === 1 ? baseName : `${baseName} — p${i + 1}`,
          pageNumber: existingCount + i + 1,
          fileUrl: `/api/files/${key}`,
        },
      });
      sheets.push(sheet);
    }

    res.json(sheets);
  } catch (err) {
    next(err);
  }
});

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  scalePixelsPerUnit: z.number().positive().nullable().optional(),
  unitSystem: z.enum(["imperial", "metric"]).optional(),
});

router.patch("/:id", async (req, res, next) => {
  try {
    const sheet = await prisma.sheet.findFirst({
      where: { id: req.params.id, project: { userId: currentUserId(req) } },
    });
    if (!sheet) return res.status(404).json({ error: "Sheet not found" });
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid sheet update" });
    const updated = await prisma.sheet.update({ where: { id: sheet.id }, data: parsed.data });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const sheet = await prisma.sheet.findFirst({
      where: { id: req.params.id, project: { userId: currentUserId(req) } },
    });
    if (!sheet) return res.status(404).json({ error: "Sheet not found" });
    await prisma.sheet.delete({ where: { id: sheet.id } });
    const key = sheet.fileUrl.split("/").pop();
    if (key) await storage.delete(key).catch(() => {});
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get("/:id/measurements", async (req, res, next) => {
  try {
    const sheet = await prisma.sheet.findFirst({
      where: { id: req.params.id, project: { userId: currentUserId(req) } },
      select: { id: true },
    });
    if (!sheet) return res.status(404).json({ error: "Sheet not found" });
    const measurements = await prisma.measurement.findMany({
      where: { sheetId: sheet.id },
      orderBy: { createdAt: "asc" },
    });
    res.json(measurements);
  } catch (err) {
    next(err);
  }
});

export default router;
