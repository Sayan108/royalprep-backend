import type { RequestHandler } from 'express'
import type { Pool } from 'pg'

export function createAdminSessionsController(pool: Pool) {
  const list: RequestHandler = async (_req, res) => {
    const result = await pool.query(`SELECT token, email, expires_at AS "expiresAt", revoked_at AS "revokedAt"
      FROM student_sessions ORDER BY expires_at DESC LIMIT 200`)
    res.json(result.rows.map(row => ({ ...row, token: row.token.slice(0, 8) + '...' })))
  }
  const revoke: RequestHandler = async (req, res) => {
    if (typeof req.body?.token !== 'string' && typeof req.body?.email !== 'string') { res.status(422).json({ error: 'Session token or email is required.' }); return }
    if (typeof req.body.token === 'string') await pool.query('UPDATE student_sessions SET revoked_at=now() WHERE token=$1', [req.body.token])
    else await pool.query('UPDATE student_sessions SET revoked_at=now() WHERE email=$1 AND revoked_at IS NULL', [req.body.email])
    res.json({ revoked: true })
  }
  return { list, revoke }
}
