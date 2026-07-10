import { getIronSession, type IronSession } from "iron-session";
import { cookies } from "next/headers";
import { HttpError } from "./http";

export interface SessionData {
  userId?: string;
}

// iron-session requires a password of at least 32 characters.
const password =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32
    ? process.env.SESSION_SECRET
    : "dev-secret-change-me-dev-secret-change-me";

export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), {
    password,
    cookieName: "plansimple_session",
    ttl: 60 * 60 * 24 * 14, // 14 days
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  });
}

/** Return the authenticated user's id or fail the request with a 401. */
export async function requireUserId(): Promise<string> {
  const session = await getSession();
  if (!session.userId) {
    throw new HttpError(401, "Not authenticated");
  }
  return session.userId;
}
