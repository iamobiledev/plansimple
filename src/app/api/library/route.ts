import { z } from "zod";
import { prisma } from "@/server/db";
import { requireUserId } from "@/server/session";
import { apiHandler, json } from "@/server/http";

const itemSchema = z.object({
  name: z.string().min(1).max(200),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  measurementType: z.enum(["linear", "area", "count"]),
  unit: z.string().min(1).max(20),
  unitCost: z.number().nonnegative().nullable().optional(),
  iconKey: z.string().max(100).nullable().optional(),
});

export const GET = apiHandler(async () => {
  const userId = await requireUserId();
  const items = await prisma.libraryItem.findMany({
    where: { userId },
    orderBy: [{ name: "asc" }],
  });
  return json(items);
});

export const POST = apiHandler(async (req) => {
  const userId = await requireUserId();
  const parsed = itemSchema.safeParse(await req.json());
  if (!parsed.success) return json({ error: parsed.error.errors[0].message }, 400);
  const item = await prisma.libraryItem.create({ data: { ...parsed.data, userId } });
  return json(item);
});
