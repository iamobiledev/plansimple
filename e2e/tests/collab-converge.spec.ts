import { test, expect } from "@playwright/test";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

test.skip(process.env.E2E !== "1", "Set E2E=1 to run PlanSimple e2e tests.");

/**
 * Phase 3 acceptance (headless): two Yjs clients on the realtime server
 * converge to identical markup map state (CRDT).
 */
test("two Yjs clients converge via realtime server", async () => {
  const room = `e2e-converge-${Date.now()}`;
  const url = process.env.REALTIME_URL || "ws://127.0.0.1:1234";

  const doc1 = new Y.Doc();
  const doc2 = new Y.Doc();
  const p1 = new WebsocketProvider(url, room, doc1, { connect: true });
  const p2 = new WebsocketProvider(url, room, doc2, { connect: true });

  await Promise.all([
    new Promise<void>((resolve) => p1.on("status", (e: { status: string }) => e.status === "connected" && resolve())),
    new Promise<void>((resolve) => p2.on("status", (e: { status: string }) => e.status === "connected" && resolve())),
  ]);

  // Allow sync handshake
  await new Promise((r) => setTimeout(r, 300));

  const map1 = doc1.getMap("markups");
  const map2 = doc2.getMap("markups");

  map1.set("m1", { id: "m1", type: "cloud", subject: "from-client-1" });
  map2.set("m2", { id: "m2", type: "rectangle", subject: "from-client-2" });

  // Wait for cross-sync
  await expect
    .poll(() => {
      const a = map1.get("m2");
      const b = map2.get("m1");
      return Boolean(a && b);
    }, { timeout: 5000 })
    .toBe(true);

  expect(map1.get("m1")).toEqual(map2.get("m1"));
  expect(map1.get("m2")).toEqual(map2.get("m2"));

  // Offline edit: disconnect client 2, edit on 1, reconnect, converge
  p2.disconnect();
  map1.set("m3", { id: "m3", type: "line", subject: "offline-parent" });
  await new Promise((r) => setTimeout(r, 200));
  p2.connect();
  await expect
    .poll(() => Boolean(map2.get("m3")), { timeout: 8000 })
    .toBe(true);
  expect(map2.get("m3")).toEqual(map1.get("m3"));

  p1.destroy();
  p2.destroy();
  doc1.destroy();
  doc2.destroy();
});
