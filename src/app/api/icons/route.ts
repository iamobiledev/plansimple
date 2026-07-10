import crypto from "node:crypto";
import { prisma } from "@/server/db";
import { requireUserId } from "@/server/session";
import { apiHandler, json } from "@/server/http";
import { storage } from "@/server/storage";

const ALLOWED: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
};

const MAX_ICON_BYTES = 1024 * 1024; // 1 MB

export const GET = apiHandler(async () => {
  const userId = await requireUserId();
  const icons = await prisma.icon.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return json(icons);
});

export const POST = apiHandler(async (req) => {
  const userId = await requireUserId();
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "No file uploaded" }, 400);
  const ext = ALLOWED[file.type];
  if (!ext) return json({ error: "Icons must be PNG, JPEG, or SVG" }, 400);
  if (file.size > MAX_ICON_BYTES) return json({ error: "Icons must be under 1 MB" }, 400);

  const name =
    (typeof form.get("name") === "string" && (form.get("name") as string).trim()) ||
    file.name.replace(/\.[^.]+$/, "") ||
    "Icon";
  const fileKey = `icon-${crypto.randomUUID()}.${ext}`;
  await storage.save(fileKey, Buffer.from(await file.arrayBuffer()), file.type);

  const icon = await prisma.icon.create({
    data: { userId, name: name.slice(0, 100), fileKey, contentType: file.type },
  });
  return json(icon);
});
