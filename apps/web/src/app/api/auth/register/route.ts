import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { withBypass } from "@/db/client";
import { users } from "@/db/schema";
import { getSession } from "@/server/session";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(120).optional(),
});

export async function POST(req: Request) {
  const body = schema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ message: "Validation failed", issues: body.error.issues }, { status: 400 });
  }
  const email = body.data.email.toLowerCase();
  const passwordHash = await bcrypt.hash(body.data.password, 12);

  try {
    const user = await withBypass(async (db) => {
      const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existing[0]) throw new Error("EXISTS");
      const [created] = await db
        .insert(users)
        .values({ email, passwordHash, name: body.data.name ?? null })
        .returning();
      return created!;
    });

    const session = await getSession();
    session.userId = user.id;
    session.email = user.email;
    session.isLoggedIn = true;
    await session.save();

    return NextResponse.json({ id: user.id, email: user.email, name: user.name });
  } catch (err) {
    if (err instanceof Error && err.message === "EXISTS") {
      return NextResponse.json({ message: "Email already registered" }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ message: "Internal error" }, { status: 500 });
  }
}
