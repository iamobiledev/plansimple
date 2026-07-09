import { NextResponse } from "next/server";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/**
 * Wrap a route handler with uniform error handling. HttpError becomes a
 * JSON error response with its status; anything else is a logged 500.
 */
export function apiHandler<Ctx>(
  fn: (req: Request, ctx: Ctx) => Promise<Response>
): (req: Request, ctx: Ctx) => Promise<Response> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) {
        return json({ error: err.message }, err.status);
      }
      console.error(err);
      return json({ error: "Internal server error" }, 500);
    }
  };
}
