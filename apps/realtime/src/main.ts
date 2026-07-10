/**
 * Minimal y-websocket-compatible server for PlanSimple Sessions.
 * Protocol: sync + awareness (y-protocols), room name from URL path.
 */
import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import pg from "pg";
import { Redis } from "ioredis";

const port = Number(process.env.REALTIME_PORT || 1234);
const messageSync = 0;
const messageAwareness = 1;

type Room = {
  name: string;
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  sockets: Set<WebSocket>;
};

const rooms = new Map<string, Room>();
const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://plansimple:plansimple@localhost:5432/plansimple",
  max: 5,
});

let redisPub: Redis | null = null;
let redisSub: Redis | null = null;
try {
  const url = process.env.REDIS_URL || "redis://127.0.0.1:6379";
  redisPub = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
  redisSub = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
  void redisPub.connect().catch(() => {
    redisPub = null;
  });
  void redisSub
    .connect()
    .then(() => {
      redisSub?.psubscribe("plansimple:yjs:*");
      redisSub?.on("pmessage", (_pattern: string, channel: string, message: string) => {
        const roomName = channel.replace("plansimple:yjs:", "");
        const room = rooms.get(roomName);
        if (!room) return;
        try {
          const update = Buffer.from(message, "base64");
          Y.applyUpdate(room.doc, update, "redis");
        } catch {
          /* ignore */
        }
      });
    })
    .catch(() => {
      redisSub = null;
    });
} catch {
  redisPub = null;
  redisSub = null;
}

async function loadRoomState(roomName: string, doc: Y.Doc) {
  try {
    await pool.query("SELECT set_config('app.bypass_rls', 'on', false)");
    const { rows } = await pool.query(
      `SELECT state FROM yjs_documents WHERE room_name = $1 LIMIT 1`,
      [roomName]
    );
    const state = rows[0]?.state;
    if (state?.updateBase64) {
      Y.applyUpdate(doc, Buffer.from(state.updateBase64, "base64"));
    }
  } catch (err) {
    console.warn("yjs load failed", err);
  }
}

async function persistRoom(roomName: string, doc: Y.Doc) {
  try {
    const update = Y.encodeStateAsUpdate(doc);
    const payload = JSON.stringify({ updateBase64: Buffer.from(update).toString("base64") });
    await pool.query("SELECT set_config('app.bypass_rls', 'on', false)");
    await pool.query(
      `INSERT INTO yjs_documents (organization_id, room_name, state, updated_at)
       VALUES (
         COALESCE(
           (SELECT organization_id FROM yjs_documents WHERE room_name = $1),
           '00000000-0000-0000-0000-000000000000'::uuid
         ),
         $1,
         $2::jsonb,
         now()
       )
       ON CONFLICT (room_name) DO UPDATE SET state = EXCLUDED.state, updated_at = now()`,
      [roomName, payload]
    );
  } catch (err) {
    // organization_id required — upsert with a placeholder org if missing row
    try {
      const update = Y.encodeStateAsUpdate(doc);
      const payload = JSON.stringify({ updateBase64: Buffer.from(update).toString("base64") });
      await pool.query(
        `INSERT INTO yjs_documents (id, organization_id, room_name, state, updated_at)
         SELECT gen_random_uuid(), o.id, $1, $2::jsonb, now()
         FROM organizations o
         ORDER BY created_at ASC
         LIMIT 1
         ON CONFLICT (room_name) DO UPDATE SET state = EXCLUDED.state, updated_at = now()`,
        [roomName, payload]
      );
    } catch (err2) {
      console.warn("yjs persist failed", err2);
    }
  }
}

async function getRoom(name: string): Promise<Room> {
  let room = rooms.get(name);
  if (room) return room;
  const doc = new Y.Doc();
  await loadRoomState(name, doc);
  const awareness = new awarenessProtocol.Awareness(doc);
  room = { name, doc, awareness, sockets: new Set() };
  rooms.set(name, room);

  doc.on("update", (update: Uint8Array, origin: unknown) => {
    if (origin !== "redis" && redisPub) {
      void redisPub.publish(`plansimple:yjs:${name}`, Buffer.from(update).toString("base64"));
    }
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeUpdate(encoder, update);
    const msg = encoding.toUint8Array(encoder);
    for (const sock of room!.sockets) {
      if (sock.readyState === WebSocket.OPEN && origin !== sock) {
        sock.send(msg);
      }
    }
    // debounce persist
    const r = room!;
    const key = `_persist_${name}`;
    const g = globalThis as unknown as Record<string, NodeJS.Timeout>;
    clearTimeout(g[key]);
    g[key] = setTimeout(() => {
      void persistRoom(name, r.doc);
    }, 1500);
  });

  awareness.on("update", ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
    const changed = added.concat(updated, removed);
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageAwareness);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(awareness, changed)
    );
    const msg = encoding.toUint8Array(encoder);
    for (const sock of room!.sockets) {
      if (sock.readyState === WebSocket.OPEN) sock.send(msg);
    }
  });

  return room;
}

function send(doc: Y.Doc, socket: WebSocket, encoder: encoding.Encoder) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(encoding.toUint8Array(encoder));
  }
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url?.startsWith("/health")) {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        service: "plansimple-realtime",
        rooms: rooms.size,
        redis: Boolean(redisPub),
      })
    );
    return;
  }
  res.writeHead(404).end();
});

const wss = new WebSocketServer({ noServer: true });

wss.on("connection", async (socket, request) => {
  const url = new URL(request.url || "/", `http://${request.headers.host}`);
  const roomName = decodeURIComponent(url.pathname.replace(/^\//, "") || "default");
  const room = await getRoom(roomName);
  room.sockets.add(socket);

  // Initial sync step 1
  {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeSyncStep1(encoder, room.doc);
    send(room.doc, socket, encoder);
  }
  // Awareness snapshot
  {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageAwareness);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(room.awareness, Array.from(room.awareness.getStates().keys()))
    );
    send(room.doc, socket, encoder);
  }

  socket.on("message", (data) => {
    try {
      const buf = new Uint8Array(data as Buffer);
      const decoder = decoding.createDecoder(buf);
      const messageType = decoding.readVarUint(decoder);
      switch (messageType) {
        case messageSync: {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, messageSync);
          syncProtocol.readSyncMessage(decoder, encoder, room.doc, socket);
          if (encoding.length(encoder) > 1) send(room.doc, socket, encoder);
          break;
        }
        case messageAwareness: {
          awarenessProtocol.applyAwarenessUpdate(
            room.awareness,
            decoding.readVarUint8Array(decoder),
            socket
          );
          break;
        }
      }
    } catch (err) {
      console.warn("ws message error", err);
    }
  });

  socket.on("close", () => {
    room.sockets.delete(socket);
    awarenessProtocol.removeAwarenessStates(
      room.awareness,
      Array.from(room.awareness.getStates().keys()).filter((clientId) => {
        // remove only if no other sockets — simplified: clear all local on empty room
        return room.sockets.size === 0;
      }),
      null
    );
    if (room.sockets.size === 0) {
      void persistRoom(roomName, room.doc);
    }
  });
});

server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`PlanSimple realtime (Yjs) listening on :${port}`);
});
