export function createAnalyticsController(pool) {
    const chapterAnalytics = async (_req, res) => {
        const owner = res.locals.student.email;
        const result = await pool.query('SELECT payload FROM custom_attempts WHERE owner_email=$1', [owner]);
        const totals = new Map();
        for (const row of result.rows) {
            if (row.payload.status !== 'submitted')
                continue;
            for (const question of row.payload.questions) {
                const current = totals.get(question.chapter) ?? { chapter: question.chapter, questions: 0, correct: 0, attempts: 0 };
                current.questions++;
                current.attempts++;
                if (row.payload.answers[question.id] === question.correct)
                    current.correct++;
                totals.set(question.chapter, current);
            }
        }
        res.json([...totals.values()].map(item => ({ ...item, percentage: item.questions ? Math.round(item.correct / item.questions * 100) : 0 })).sort((a, b) => a.chapter.localeCompare(b.chapter)));
    };
    return { chapterAnalytics };
}
