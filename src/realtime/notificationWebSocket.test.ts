import { createServer } from "node:http";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import { WebSocket } from "ws";
import { attachNotificationWebSocket } from "./notificationWebSocket.js";

test("notification polling preserves timestamp precision and does not overlap", async () => {
  const timestamp = "2026-01-01T00:00:00.123456Z";
  const rows = [
    "00000000-0000-0000-0000-000000000001",
    "00000000-0000-0000-0000-000000000002",
  ].map((id) => ({
    id,
    title: "Title",
    body: "Body",
    createdAt: new Date(timestamp),
    cursorCreatedAt: timestamp,
  }));
  let polls = 0;
  const cursors: unknown[][] = [];
  const pool = {
    async query(sql: string, values: unknown[]) {
      if (sql.includes("student_sessions")) return { rows: [{}] };
      polls++;
      cursors.push(values);
      const cursor =
        values[0] instanceof Date
          ? values[0].toISOString().replace("Z", "000Z")
          : (values[0] as string | null);
      const result = rows.filter(
        (row) =>
          !cursor ||
          timestamp > cursor ||
          (timestamp === cursor && row.id > String(values[1])),
      );
      if (polls === 1) await delay(2500);
      return { rows: result };
    },
  } as Pool;
  const server = createServer();
  const closeNotifications = attachNotificationWebSocket(server, pool);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const socket = new WebSocket(`ws://127.0.0.1:${address.port}/ws?token=test`);
  const messages: Array<{
    type: string;
    notification?: { id: string; createdAt: string; cursorCreatedAt?: string };
  }> = [];
  socket.on("message", (data) => messages.push(JSON.parse(data.toString())));
  try {
    await once(socket, "open");
    await delay(6500);
    const notifications = messages.filter(
      (message) => message.type === "notification",
    );
    assert.deepEqual(
      notifications.map((message) => message.notification?.id),
      rows.map((row) => row.id),
    );
    assert.equal(
      notifications[0].notification?.createdAt,
      "2026-01-01T00:00:00.123Z",
    );
    assert.equal(notifications[0].notification?.cursorCreatedAt, undefined);
    assert.equal(polls, 2);
    assert.deepEqual(cursors[1], [timestamp, rows[1].id]);
  } finally {
    socket.terminate();
    closeNotifications();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
