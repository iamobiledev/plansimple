import type { Request, Response, NextFunction } from "express";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
}

export function currentUserId(req: Request): string {
  return req.session.userId as string;
}
