import type { RequestHandler } from "express";
import type { Pool } from "pg";
import type { Attempt } from "../models/attempt.js";

export function createAnalyticsController(pool: Pool) {
  const chapterAnalytics: RequestHandler = async (_req, res) => {
    const owner = (res.locals.student as { email: string }).email;
    const result = await pool.query<{ payload: Attempt }>(
      "SELECT payload FROM custom_attempts WHERE owner_email=$1",
      [owner],
    );
    const totals = new Map<
      string,
      { chapter: string; questions: number; correct: number; attempts: number }
    >();
    for (const row of result.rows) {
      if (row.payload.status !== "submitted") continue;
      for (const question of row.payload.questions) {
        const current = totals.get(question.chapter) ?? {
          chapter: question.chapter,
          questions: 0,
          correct: 0,
          attempts: 0,
        };
        current.questions++;
        current.attempts++;
        if (row.payload.answers[question.id] === question.correct)
          current.correct++;
        totals.set(question.chapter, current);
      }
    }
    res.json(
      [...totals.values()]
        .map((item) => ({
          ...item,
          percentage: item.questions
            ? Math.round((item.correct / item.questions) * 100)
            : 0,
        }))
        .sort((a, b) => a.chapter.localeCompare(b.chapter)),
    );
  };
  return { chapterAnalytics };
}
