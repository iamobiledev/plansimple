import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, currentUserId } from "../auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const projects = await prisma.project.findMany({
      where: { userId: currentUserId(req) },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { sheets: true } } },
    });
    res.json(projects);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const parsed = z.object({ name: z.string().min(1).max(200) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Project name is required" });
    const project = await prisma.project.create({
      data: { name: parsed.data.name, userId: currentUserId(req) },
    });
    res.json(project);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, userId: currentUserId(req) },
      include: {
        sheets: { orderBy: [{ createdAt: "asc" }, { pageNumber: "asc" }] },
        conditions: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json(project);
  } catch (err) {
    next(err);
  }
});

// All measurements across the project (for the quantity summary).
router.get("/:id/measurements", async (req, res, next) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, userId: currentUserId(req) },
      select: { id: true },
    });
    if (!project) return res.status(404).json({ error: "Project not found" });
    const measurements = await prisma.measurement.findMany({
      where: { sheet: { projectId: project.id } },
      orderBy: { createdAt: "asc" },
    });
    res.json(measurements);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, userId: currentUserId(req) },
    });
    if (!project) return res.status(404).json({ error: "Project not found" });
    await prisma.project.delete({ where: { id: project.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
