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
    iconKey: z.string().max(100).nullable().optional(),
  })
  .partial();

export const PATCH = apiHandler<Ctx>(async (req, { params }) => {
  const userId = await requireUserId();
  const { id } = await params;
  const item = await prisma.libraryItem.findFirst({ where: { id, userId } });
  if (!item) return json({ error: "Library item not found" }, 404);
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return json({ error: "Invalid library item update" }, 400);
  const updated = await prisma.libraryItem.update({ where: { id: item.id }, data: parsed.data });
  return json(updated);
});

export const DELETE = apiHandler<Ctx>(async (_req, { params }) => {
  const userId = await requireUserId();
  const { id } = await params;
  const item = await prisma.libraryItem.findFirst({ where: { id, userId } });
  if (!item) return json({ error: "Library item not found" }, 404);
  await prisma.libraryItem.delete({ where: { id: item.id } });
  return json({ ok: true });
});
