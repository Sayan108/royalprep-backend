import type { Server } from 'node:http'
import { WebSocketServer, WebSocket } from 'ws'
import type { Pool } from 'pg'

export function attachNotificationWebSocket(server: Server, pool: Pool) {
  const sockets = new Set<WebSocket>()
  const webSocketServer = new WebSocketServer({ server, path: '/ws' })
  webSocketServer.on('connection', async (socket, request) => {
    const token = new URL(request.url ?? '/', 'http://localhost').searchParams.get('token')
    if (!token) { socket.close(1008, 'Authentication required'); return }
    const session = await pool.query('SELECT 1 FROM student_sessions WHERE token=$1 AND revoked_at IS NULL AND expires_at > now()', [token])
    if (!session.rows[0]) { socket.close(1008, 'Invalid session'); return }
    sockets.add(socket)
    socket.send(JSON.stringify({ type: 'connected' }))
    socket.on('close', () => sockets.delete(socket))
  })
  let latest = new Date(0)
  const poll = setInterval(async () => {
    const result = await pool.query<{ id: string; title: string; body: string; createdAt: Date }>(
      `SELECT id, title, body, created_at AS "createdAt" FROM notifications WHERE created_at > $1 ORDER BY created_at ASC`,
      [latest],
    )
    for (const notification of result.rows) {
      latest = new Date(notification.createdAt)
      const message = JSON.stringify({ type: 'notification', notification })
      for (const socket of sockets) if (socket.readyState === WebSocket.OPEN) socket.send(message)
    }
  }, 2000)
  const close = () => { clearInterval(poll); webSocketServer.close(); for (const socket of sockets) socket.close() }
  return close
}
