import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, currentUserId } from "../auth.js";

const router = Router();
router.use(requireAuth);

const pointSchema = z.object({ x: z.number(), y: z.number() });
const geometrySchema = z.object({ points: z.array(pointSchema).min(1).max(10000) });

const createSchema = z.object({
  sheetId: z.string(),
  conditionId: z.string(),
  geometry: geometrySchema,
  computedValue: z.number(),
  source: z.enum(["manual", "ai"]).default("manual"),
});

router.post("/", async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid measurement" });
    const { sheetId, conditionId, geometry, computedValue, source } = parsed.data;

    const sheet = await prisma.sheet.findFirst({
      where: { id: sheetId, project: { userId: currentUserId(req) } },
    });
    if (!sheet) return res.status(404).json({ error: "Sheet not found" });
    const condition = await prisma.condition.findFirst({
      where: { id: conditionId, projectId: sheet.projectId },
    });
    if (!condition) return res.status(404).json({ error: "Condition not found" });

    const measurement = await prisma.measurement.create({
      data: { sheetId, conditionId, geometry, computedValue, source },
    });
    res.json(measurement);
  } catch (err) {
    next(err);
  }
});

const patchSchema = z.object({
  geometry: geometrySchema.optional(),
  computedValue: z.number().optional(),
  conditionId: z.string().optional(),
});

router.patch("/:id", async (req, res, next) => {
  try {
    const measurement = await prisma.measurement.findFirst({
      where: { id: req.params.id, sheet: { project: { userId: currentUserId(req) } } },
      include: { sheet: true },
    });
    if (!measurement) return res.status(404).json({ error: "Measurement not found" });
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid measurement update" });
    if (parsed.data.conditionId) {
      const condition = await prisma.condition.findFirst({
        where: { id: parsed.data.conditionId, projectId: measurement.sheet.projectId },
      });
      if (!condition) return res.status(404).json({ error: "Condition not found" });
    }
    const updated = await prisma.measurement.update({
      where: { id: measurement.id },
      data: parsed.data,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const measurement = await prisma.measurement.findFirst({
      where: { id: req.params.id, sheet: { project: { userId: currentUserId(req) } } },
    });
    if (!measurement) return res.status(404).json({ error: "Measurement not found" });
    await prisma.measurement.delete({ where: { id: measurement.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
