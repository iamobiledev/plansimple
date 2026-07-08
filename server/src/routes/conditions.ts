import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, currentUserId } from "../auth.js";

const router = Router();
router.use(requireAuth);

const conditionSchema = z.object({
  name: z.string().min(1).max(200),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  measurementType: z.enum(["linear", "area", "count"]),
  unit: z.string().min(1).max(20),
  unitCost: z.number().nonnegative().nullable().optional(),
});

router.post("/project/:projectId", async (req, res, next) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.projectId, userId: currentUserId(req) },
    });
    if (!project) return res.status(404).json({ error: "Project not found" });
    const parsed = conditionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
    const condition = await prisma.condition.create({
      data: { ...parsed.data, projectId: project.id },
    });
    res.json(condition);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const condition = await prisma.condition.findFirst({
      where: { id: req.params.id, project: { userId: currentUserId(req) } },
    });
    if (!condition) return res.status(404).json({ error: "Condition not found" });
    const parsed = conditionSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid condition update" });
    // Changing the measurement type of a condition that already has
    // measurements would corrupt existing geometry semantics.
    if (parsed.data.measurementType && parsed.data.measurementType !== condition.measurementType) {
      const count = await prisma.measurement.count({ where: { conditionId: condition.id } });
      if (count > 0) {
        return res.status(400).json({ error: "Cannot change type of a condition with measurements" });
      }
    }
    const updated = await prisma.condition.update({ where: { id: condition.id }, data: parsed.data });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const condition = await prisma.condition.findFirst({
      where: { id: req.params.id, project: { userId: currentUserId(req) } },
    });
    if (!condition) return res.status(404).json({ error: "Condition not found" });
    await prisma.condition.delete({ where: { id: condition.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
