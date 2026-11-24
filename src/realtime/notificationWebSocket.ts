import type { Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import type { Pool } from "pg";

export function attachNotificationWebSocket(server: Server, pool: Pool) {
  const sockets = new Set<WebSocket>();
  const webSocketServer = new WebSocketServer({ server, path: "/ws" });
  webSocketServer.on("connection", async (socket, request) => {
    const token = new URL(
      request.url ?? "/",
      "http://localhost",
    ).searchParams.get("token");
    if (!token) {
      socket.close(1008, "Authentication required");
      return;
    }
    const session = await pool.query(
      "SELECT 1 FROM student_sessions WHERE token=$1 AND revoked_at IS NULL AND expires_at > now()",
      [token],
    );
    if (!session.rows[0]) {
      socket.close(1008, "Invalid session");
      return;
    }
    sockets.add(socket);
    socket.send(JSON.stringify({ type: "connected" }));
    socket.on("close", () => sockets.delete(socket));
  });
  let latest: { createdAt: string; id: string } | null = null;
  let polling = false;
  let closed = false;
  const poll = setInterval(async () => {
    if (polling) return;
    polling = true;
    try {
      const result = await pool.query<{
        id: string;
        title: string;
        body: string;
        createdAt: Date;
        cursorCreatedAt: string;
      }>(
        `SELECT id, title, body, created_at AS "createdAt", created_at::text AS "cursorCreatedAt"
         FROM notifications
         WHERE $1::timestamptz IS NULL OR (created_at, id) > ($1::timestamptz, $2::uuid)
         ORDER BY created_at ASC, id ASC`,
        [latest?.createdAt ?? null, latest?.id ?? null],
      );
      if (closed) return;
      for (const { cursorCreatedAt, ...notification } of result.rows) {
        latest = { createdAt: cursorCreatedAt, id: notification.id };
        const message = JSON.stringify({ type: "notification", notification });
        for (const socket of sockets)
          if (socket.readyState === WebSocket.OPEN) socket.send(message);
      }
    } catch (error) {
      console.error("Failed to poll notifications:", error);
    } finally {
      polling = false;
    }
  }, 2000);
  const close = () => {
    closed = true;
    clearInterval(poll);
    webSocketServer.close();
    for (const socket of sockets) socket.close();
  };
  return close;
}
