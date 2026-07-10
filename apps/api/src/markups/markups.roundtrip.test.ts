import { describe, it, expect, beforeAll } from "vitest";

const API = process.env.API_URL || "http://127.0.0.1:3000/api";
const run = process.env.RUN_MARKUP_E2E === "1";

async function json<T>(res: Response): Promise<T> {
  const body = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(body));
  return body as T;
}

describe.skipIf(!run)("markup round-trip", () => {
  let token = "";
  let orgId = "";
  let pageId = "";
  let revisionId = "";

  beforeAll(async () => {
    const login = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "demo@plansimple.dev", password: "plansimple123" }),
    });
    const loginBody = await json<{ accessToken: string }>(login);
    token = loginBody.accessToken;
    const orgs = await json<Array<{ id: string }>>(
      await fetch(`${API}/organizations`, { headers: { Authorization: `Bearer ${token}` } })
    );
    orgId = orgs[0]!.id;
    const projects = await json<Array<{ id: string }>>(
      await fetch(`${API}/organizations/${orgId}/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    );
    const docs = await json<Array<{ id: string; processingStatus: string }>>(
      await fetch(`${API}/organizations/${orgId}/projects/${projects[0]!.id}/documents`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    );
    const ready = docs.find((d) => d.processingStatus === "ready")!;
    const detail = await json<{
      currentRevisionId: string;
      pages: Array<{ id: string }>;
    }>(
      await fetch(`${API}/organizations/${orgId}/documents/${ready.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    );
    revisionId = detail.currentRevisionId;
    pageId = detail.pages[0]!.id;
  });

  it("creates two of several markup types and reloads them", async () => {
    const types = [
      "rectangle",
      "ellipse",
      "line",
      "arrow",
      "polyline",
      "polygon",
      "cloud",
      "freehand",
      "highlighter",
      "textbox",
    ] as const;

    const createdIds: string[] = [];
    for (const type of types) {
      for (let n = 0; n < 2; n++) {
        const geometry =
          type === "rectangle" || type === "ellipse" || type === "highlighter" || type === "textbox"
            ? { x: 20 + n * 10, y: 30 + n * 10, w: 80, h: 40, text: "Note" }
            : type === "line" || type === "arrow"
              ? { x1: 10, y1: 10, x2: 120 + n, y2: 80 + n }
              : {
                  points: [
                    { x: 10, y: 10 },
                    { x: 90 + n, y: 15 },
                    { x: 80, y: 70 + n },
                    { x: 20, y: 60 },
                  ],
                };
        const res = await fetch(`${API}/organizations/${orgId}/markups`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pageId,
            revisionId,
            type,
            geometry,
            style: { stroke: "#e11d48", strokeWidth: 2 },
            subject: `${type}-${n}`,
            status: "open",
          }),
        });
        const body = await json<{ id: string; type: string }>(res);
        expect(body.type).toBe(type);
        createdIds.push(body.id);
      }
    }

    const list = await json<Array<{ id: string; type: string; subject: string | null }>>(
      await fetch(`${API}/organizations/${orgId}/revisions/${revisionId}/markups`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    );
    for (const id of createdIds) {
      expect(list.some((m) => m.id === id)).toBe(true);
    }
    for (const type of types) {
      expect(list.filter((m) => m.type === type).length).toBeGreaterThanOrEqual(2);
    }
  });
});
