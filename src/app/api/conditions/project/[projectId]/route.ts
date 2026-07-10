import { z } from "zod";
import { prisma } from "@/server/db";
import { requireUserId } from "@/server/session";
import { apiHandler, json } from "@/server/http";

type Ctx = { params: Promise<{ projectId: string }> };

const conditionSchema = z.object({
  name: z.string().min(1).max(200),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  measurementType: z.enum(["linear", "area", "count"]),
  unit: z.string().min(1).max(20),
  unitCost: z.number().nonnegative().nullable().optional(),
  iconKey: z.string().max(100).nullable().optional(),
});

export const POST = apiHandler<Ctx>(async (req, { params }) => {
  const userId = await requireUserId();
  const { projectId } = await params;
  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) return json({ error: "Project not found" }, 404);
  const parsed = conditionSchema.safeParse(await req.json());
  if (!parsed.success) return json({ error: parsed.error.errors[0].message }, 400);
  const condition = await prisma.condition.create({
    data: { ...parsed.data, projectId: project.id },
  });
  return json(condition);
});
