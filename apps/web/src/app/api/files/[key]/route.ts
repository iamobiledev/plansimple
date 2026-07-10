import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { getSession } from "@/server/session";

type Ctx = { params: Promise<{ key: string }> };

/** Local-dev file serving when BLOB_READ_WRITE_TOKEN is unset. */
export async function GET(_req: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { key } = await ctx.params;
  const decoded = decodeURIComponent(key);
  if (decoded.includes("..")) return NextResponse.json({ message: "Invalid key" }, { status: 400 });
  const full = path.join(process.cwd(), "uploads", decoded);
  try {
    const buf = await fs.readFile(full);
    return new NextResponse(buf, {
      headers: {
        "Content-Type": decoded.endsWith(".pdf") ? "application/pdf" : "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
}
