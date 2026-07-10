import { prisma } from "@/server/db";
import { requireUserId } from "@/server/session";
import { apiHandler, json } from "@/server/http";
import { storage } from "@/server/storage";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = apiHandler<Ctx>(async (_req, { params }) => {
  const userId = await requireUserId();
  const { id } = await params;
  const icon = await prisma.icon.findFirst({ where: { id, userId } });
  if (!icon) return json({ error: "Icon not found" }, 404);
  // Items keep their iconKey reference; the marker falls back to the default
  // circle if the file disappears. Clear references so the UI stays tidy.
  await prisma.condition.updateMany({
    where: { iconKey: icon.fileKey, project: { userId } },
    data: { iconKey: null },
  });
  await prisma.libraryItem.updateMany({
    where: { iconKey: icon.fileKey, userId },
    data: { iconKey: null },
  });
  await prisma.icon.delete({ where: { id: icon.id } });
  await storage.delete(icon.fileKey).catch(() => {});
  return json({ ok: true });
});
