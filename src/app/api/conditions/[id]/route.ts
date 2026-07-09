import { z } from "zod";
import { prisma } from "@/server/db";
import { requireUserId } from "@/server/session";
import { apiHandler, json } from "@/server/http";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z
  .object({
    name: z.string().min(1).max(200),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    measurementType: z.enum(["linear", "area", "count"]),
    unit: z.string().min(1).max(20),
    unitCost: z.number().nonnegative().nullable().optional(),
  })
  .partial();

export const PATCH = apiHandler<Ctx>(async (req, { params }) => {
  const userId = await requireUserId();
  const { id } = await params;
  const condition = await prisma.condition.findFirst({
    where: { id, project: { userId } },
  });
  if (!condition) return json({ error: "Condition not found" }, 404);
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return json({ error: "Invalid condition update" }, 400);
  // Changing the measurement type of a condition that already has
  // measurements would corrupt existing geometry semantics.
  if (parsed.data.measurementType && parsed.data.measurementType !== condition.measurementType) {
    const count = await prisma.measurement.count({ where: { conditionId: condition.id } });
    if (count > 0) {
      return json({ error: "Cannot change type of a condition with measurements" }, 400);
    }
  }
  const updated = await prisma.condition.update({ where: { id: condition.id }, data: parsed.data });
  return json(updated);
});

export const DELETE = apiHandler<Ctx>(async (_req, { params }) => {
  const userId = await requireUserId();
  const { id } = await params;
  const condition = await prisma.condition.findFirst({
    where: { id, project: { userId } },
  });
  if (!condition) return json({ error: "Condition not found" }, 404);
  await prisma.condition.delete({ where: { id: condition.id } });
  return json({ ok: true });
});
