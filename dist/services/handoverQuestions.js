import { z } from "zod";
import { questionInputSchema } from "../models/question.js";
const chapterSchema = z.object({
    code: z.string().min(1),
    title: z.string().min(1),
});
const sourceQuestionSchema = z.object({
    id: z.string().min(1),
    chapter: z.string().min(1),
    stem: z.string(),
    options: z.array(z.string()),
    correct: z.number(),
    explanation: z.string(),
}).passthrough();
export function prepareHandoverQuestions(chapterData, questionData) {
    const chapters = z.array(chapterSchema).min(1).parse(chapterData);
    const source = z.array(sourceQuestionSchema).min(1).parse(questionData);
    const titles = new Map(chapters.map((chapter) => [chapter.code, chapter.title]));
    if (titles.size !== chapters.length || new Set(chapters.map((chapter) => chapter.title)).size !== chapters.length)
        throw new Error("Handover chapter codes and titles must be unique.");
    const ids = new Set();
    return source.map((item) => {
        if (ids.has(item.id))
            throw new Error(`Duplicate handover question ID: ${item.id}`);
        ids.add(item.id);
        const chapter = titles.get(item.chapter);
        if (!chapter)
            throw new Error(`Unknown chapter code for question ${item.id}: ${item.chapter}`);
        const input = questionInputSchema.parse({
            chapter,
            published: true,
            stem: item.stem,
            options: item.options,
            correct: item.correct,
            explanation: item.explanation,
            source: "RoyalPrep MRCS handover",
        });
        const question = { id: item.id, version: 1, ...input };
        return { question, source: item };
    });
}
export async function insertHandoverQuestions(client, prepared) {
    let inserted = 0;
    for (let offset = 0; offset < prepared.length; offset += 100) {
        const candidates = prepared.slice(offset, offset + 100);
        const existing = await client.query(`SELECT id FROM questions WHERE id IN (${candidates.map((_, i) => `$${i + 1}`).join(",")})`, candidates.map(({ question }) => question.id));
        const existingIds = new Set(existing.rows.map((row) => row.id));
        const batch = candidates.filter(({ question }) => !existingIds.has(question.id));
        if (!batch.length)
            continue;
        const values = [];
        const rows = batch.map(({ question }) => {
            const start = values.length;
            values.push(question.id, question.version, question.chapter, question.published, question.stem, JSON.stringify(question.options), question.correct, question.explanation, question.source);
            return `(${Array.from({ length: 9 }, (_, i) => `$${start + i + 1}${i === 5 ? "::jsonb" : ""}`).join(",")})`;
        });
        const result = await client.query(`INSERT INTO questions (id, version, chapter, published, stem, options, correct, explanation, source)
       VALUES ${rows.join(",")} ON CONFLICT (id) DO NOTHING RETURNING id`, values);
        const newIds = new Set(result.rows.map((row) => row.id));
        const sources = batch.filter(({ question }) => newIds.has(question.id));
        if (sources.length) {
            const sourceValues = [];
            const sourceRows = sources.map(({ question, source }) => {
                sourceValues.push(question.id, JSON.stringify(source));
                return `($${sourceValues.length - 1},$${sourceValues.length}::jsonb)`;
            });
            await client.query(`INSERT INTO handover_question_sources (question_id, content) VALUES ${sourceRows.join(",")}`, sourceValues);
        }
        inserted += result.rows.length;
    }
    return inserted;
}
