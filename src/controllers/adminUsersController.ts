import type { RequestHandler } from "express";
import type { Pool } from "pg";

export function createAdminUsersController(pool: Pool) {
  const list: RequestHandler = async (_req, res) => {
    const result =
      await pool.query(`SELECT email, created_at AS "createdAt", deleted_at AS "deletedAt"
      FROM student_accounts ORDER BY created_at DESC`);
    res.json(
      result.rows.map((row) => ({
        ...row,
        status: row.deletedAt ? "deactivated" : "active",
      })),
    );
  };
  return { list };
}
