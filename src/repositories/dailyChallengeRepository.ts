import type { Pool } from "pg";
import type { Question } from "../models/question.js";

export class DailyInvalidAnswer extends Error {}

export function createDailyChallengeRepository(pool: Pool) {
  async function challenge(kind: "quiz" | "mock", date: string) {
    const existing = await pool.query<{
      question_ids: string[];
      duration_minutes: number;
    }>(
      "SELECT question_ids, duration_minutes FROM daily_challenges WHERE challenge_date=$1 AND kind=$2",
      [date, kind],
    );
    if (!existing.rows[0]) {
      const questions = await pool.query<{ id: string }>(
        "SELECT id FROM questions WHERE published=true ORDER BY id LIMIT 5",
      );
      if (questions.rows.length < 5)
        throw Error(
          "At least five published questions are required for daily challenges.",
        );
      const ids = questions.rows.map((row) => row.id);
      await pool.query(
        "INSERT INTO daily_challenges (challenge_date, kind, question_ids, duration_minutes) VALUES ($1,$2,$3::jsonb,$4)",
        [date, kind, JSON.stringify(ids), kind === "quiz" ? 10 : 60],
      );
      return { questionIds: ids, durationMinutes: kind === "quiz" ? 10 : 60 };
    }
    return {
      questionIds: existing.rows[0].question_ids,
      durationMinutes: existing.rows[0].duration_minutes,
    };
  }
  async function questions(ids: string[]) {
    const result = await pool.query<Question>(
      "SELECT id, version, chapter, published, stem, options, correct, explanation, source FROM questions WHERE published=true",
    );
    return ids
      .map((id) => result.rows.find((question) => question.id === id))
      .filter((question): question is Question => Boolean(question));
  }
  return {
    async adminChallenges() {
      const result = await pool.query(
        'SELECT challenge_date AS date, kind, question_ids AS "questionIds", duration_minutes AS "durationMinutes" FROM daily_challenges ORDER BY challenge_date DESC, kind',
      );
      return result.rows;
    },
    async saveChallenge(
      date: string,
      kind: "quiz" | "mock",
      questionIds: string[],
      durationMinutes: number,
    ) {
      await pool.query(
        `INSERT INTO daily_challenges (challenge_date,kind,question_ids,duration_minutes) VALUES ($1,$2,$3::jsonb,$4)
        ON CONFLICT (challenge_date,kind) DO UPDATE SET question_ids=EXCLUDED.question_ids,duration_minutes=EXCLUDED.duration_minutes`,
        [date, kind, JSON.stringify(questionIds), durationMinutes],
      );
    },
    async get(kind: "quiz" | "mock", date: string, owner: string) {
      const item = await challenge(kind, date);
      const found =
        kind === "quiz"
          ? await pool.query<{
              answers: Record<string, number>;
              submitted_at: Date | null;
            }>(
              "SELECT answers, submitted_at FROM daily_quiz_attempts WHERE owner_email=$1 AND challenge_date=$2",
              [owner, date],
            )
          : await pool.query<{
              answers: Record<string, number>;
              score: number | null;
              submitted_at: Date | null;
            }>(
              "SELECT answers, score, submitted_at FROM daily_mock_results WHERE owner_email=$1 AND challenge_date=$2",
              [owner, date],
            );
      return {
        date,
        kind,
        durationMinutes: item.durationMinutes,
        questions: (await questions(item.questionIds)).map(
          ({ id, version, chapter, stem, options }) => ({
            id,
            version,
            chapter,
            stem,
            options,
          }),
        ),
        attempt: found.rows[0] ?? {
          answers: {},
          ...(kind === "mock" ? { score: null } : {}),
          submittedAt: null,
        },
      };
    },
    async submit(
      kind: "quiz" | "mock",
      date: string,
      owner: string,
      answers: Record<string, number>,
    ) {
      const item = await challenge(kind, date);
      const found = await questions(item.questionIds);
      for (const [id, option] of Object.entries(answers)) {
        const question = found.find((value) => value.id === id);
        if (!question || option >= question.options.length)
          throw new DailyInvalidAnswer();
      }
      const score = found.reduce(
        (sum, question) =>
          sum + (answers[question.id] === question.correct ? 1 : 0),
        0,
      );
      if (kind === "quiz")
        await pool.query(
          `INSERT INTO daily_quiz_attempts (owner_email,challenge_date,answers,submitted_at) VALUES ($1,$2,$3::jsonb,now())
        ON CONFLICT (owner_email,challenge_date) DO UPDATE SET answers=EXCLUDED.answers,submitted_at=EXCLUDED.submitted_at`,
          [owner, date, JSON.stringify(answers)],
        );
      else
        await pool.query(
          `INSERT INTO daily_mock_results (owner_email,challenge_date,answers,score,submitted_at) VALUES ($1,$2,$3::jsonb,$4,now())
        ON CONFLICT (owner_email,challenge_date) DO UPDATE SET answers=EXCLUDED.answers,score=EXCLUDED.score,submitted_at=EXCLUDED.submitted_at`,
          [owner, date, JSON.stringify(answers), score],
        );
      return { score, total: found.length, date, kind };
    },
    async leaderboard(date: string) {
      const result = await pool.query<{ score: number; owner_email: string }>(
        "SELECT score, owner_email FROM daily_mock_results WHERE challenge_date=$1 AND submitted_at IS NOT NULL ORDER BY score DESC, submitted_at ASC LIMIT 100",
        [date],
      );
      return result.rows.map((row, index) => ({
        rank: index + 1,
        score: row.score,
        student: row.owner_email.replace(/^(.{2}).*(@.*)$/, "$1***$2"),
      }));
    },
  };
}
