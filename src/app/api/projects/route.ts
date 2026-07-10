import { z } from "zod";
import { prisma } from "@/server/db";
import { requireUserId } from "@/server/session";
import { apiHandler, json } from "@/server/http";

export const GET = apiHandler(async () => {
  const userId = await requireUserId();
  const projects = await prisma.project.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { sheets: true } } },
  });
  return json(projects);
});

export const POST = apiHandler(async (req) => {
  const userId = await requireUserId();
  const parsed = z
    .object({
      name: z.string().min(1).max(200),
      address: z.string().max(300).nullable().optional(),
      clientName: z.string().max(200).nullable().optional(),
    })
    .safeParse(await req.json());
  if (!parsed.success) return json({ error: "Project name is required" }, 400);
  const project = await prisma.project.create({
    data: { ...parsed.data, userId },
  });
  return json(project);
});
