import { requireUserId } from "@/server/session";
import { apiHandler, json } from "@/server/http";
import { storage, contentTypeForKey } from "@/server/storage";

type Ctx = { params: Promise<{ key: string }> };

export const GET = apiHandler<Ctx>(async (_req, { params }) => {
  await requireUserId();
  const { key } = await params;
  try {
    const data = await storage.load(key);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": contentTypeForKey(key),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return json({ error: "File not found" }, 404);
  }
});
