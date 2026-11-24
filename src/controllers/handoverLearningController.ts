import type { RequestHandler } from "express";
import type { Pool } from "pg";
import { z } from "zod";
import { renderRevisionPack, type RevisionPack } from "../services/handoverLearning.js";

const sourceSchema = z.enum(["recall", "fawzia"]);
const filterSchema = z.object({
  source: sourceSchema,
  chapter: z.string().min(1).max(64).optional(),
  sitting: z.string().max(64).optional(),
  offset: z.string().regex(/^\d{1,6}$/).optional(),
}).strict();

export function createHandoverLearningController(pool: Pool) {
  const packs: RequestHandler = async (_req, res) => {
    const result = await pool.query(
      'SELECT chapter_code AS "chapterCode",title FROM handover_revision_packs ORDER BY chapter_code',
    );
    res.json(result.rows);
  };
  const pack: RequestHandler = async (req, res) => {
    if (typeof req.params.code !== "string" || req.params.code.length > 64) {
      res.status(422).json({ error: "Invalid chapter code." });
      return;
    }
    const result = await pool.query<RevisionPack>(
      `SELECT chapter_code AS "chapterCode",title,html_filename AS "htmlFilename",html,
        script_filename AS "scriptFilename",script FROM handover_revision_packs WHERE chapter_code=$1`,
      [req.params.code],
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: "Revision pack not found." });
      return;
    }
    res.json({ title: result.rows[0].title, documentHtml: renderRevisionPack(result.rows[0]) });
  };
  const recallCatalog: RequestHandler = async (req, res) => {
    const source = sourceSchema.safeParse(req.query.source);
    if (!source.success) {
      res.status(422).json({ error: "Choose recall or fawzia." });
      return;
    }
    const [chapters, catalog] = await Promise.all([
      pool.query('SELECT DISTINCT chapter_code AS code,chapter_title AS title FROM handover_recall_questions WHERE source=$1 ORDER BY title', [source.data]),
      pool.query<{ sittings: unknown }>("SELECT sittings FROM handover_recall_catalog WHERE singleton=true"),
    ]);
    if (!catalog.rows[0]) {
      res.status(503).json({ error: "Recall catalog is not available." });
      return;
    }
    res.json({ chapters: chapters.rows, sittings: catalog.rows[0].sittings });
  };
  const recalls: RequestHandler = async (req, res) => {
    const parsed = filterSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(422).json({ error: "Invalid recall filters." });
      return;
    }
    const { source, chapter, sitting, offset = "0" } = parsed.data;
    const values: string[] = [source];
    let where = "source=$1";
    if (chapter) { values.push(chapter); where += ` AND chapter_code=$${values.length}`; }
    if (sitting) { values.push(sitting); where += ` AND sitting=$${values.length}`; }
    const [items, count] = await Promise.all([
      pool.query(`SELECT content FROM handover_recall_questions WHERE ${where} ORDER BY id LIMIT 20 OFFSET $${values.length + 1}`, [...values, offset]),
      pool.query<{ total: string }>(`SELECT count(*) AS total FROM handover_recall_questions WHERE ${where}`, values),
    ]);
    res.json({ items: items.rows.map((row) => row.content), total: Number(count.rows[0].total), offset: Number(offset), limit: 20 });
  };
  return { packs, pack, recallCatalog, recalls };
}
