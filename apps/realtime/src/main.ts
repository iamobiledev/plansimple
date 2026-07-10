import http from "node:http";
import { WebSocketServer, type RawData } from "ws";

const port = Number(process.env.REALTIME_PORT || 1234);

function messageByteLength(message: RawData) {
  if (Array.isArray(message)) {
    return message.reduce((total, chunk) => total + chunk.byteLength, 0);
  }

  return message.byteLength;
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "plansimple-realtime" }));
    return;
  }

  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "not_found" }));
});

const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (socket, request) => {
  const remoteAddress = request.socket.remoteAddress || "unknown";
  console.log(`PlanSimple realtime websocket connected from ${remoteAddress}`);

  socket.on("message", (message) => {
    console.log(`PlanSimple realtime stub received ${messageByteLength(message)} bytes`);
  });

  socket.on("close", () => {
    console.log(`PlanSimple realtime websocket closed for ${remoteAddress}`);
  });

  socket.send(
    JSON.stringify({
      type: "hello",
      service: "plansimple-realtime",
      message: "Yjs synchronization arrives in a later phase.",
    })
  );
});

server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`PlanSimple realtime listening on :${port}`);
});
