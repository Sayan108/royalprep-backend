import type { PoolClient } from "pg";
import { z } from "zod";
import { chapterContentSchema } from "../models/chapter.js";
import { handoverId } from "./handoverId.js";
import { validatePassiveDocumentHtml } from "./handoverDocument.js";

const sourceChapterSchema = z.object({
  code: z.string().min(1),
  title: z.string().min(1),
  slug: z.string().min(1),
  paper: z.number().int(),
  subject: z.string().min(1),
  status: z.literal("published"),
  toc: z.array(z.object({ title: z.string(), previouslyAsked: z.boolean() })),
  summary: z.string(),
  freeSample: z.boolean(),
  revisePack: z.boolean(),
  mcqCount: z.number().int().nonnegative(),
}).strict();

export function prepareHandoverChapters(chapterData: unknown, documents: Map<string, string>) {
  const chapters = z.array(sourceChapterSchema).min(1).parse(chapterData);
  if (new Set(chapters.map((chapter) => chapter.code)).size !== chapters.length)
    throw new Error("Handover chapter codes must be unique.");
  return chapters.map(({ title, ...catalog }) => {
    const documentHtml = documents.get(catalog.code);
    if (!documentHtml) throw new Error(`Missing chapter document: ${catalog.code}`);
    validatePassiveDocumentHtml(documentHtml, `chapter ${catalog.code}`);
    const id = handoverId(`chapter:${catalog.code}`);
    const content = chapterContentSchema.parse({
      title,
      practiceChapter: title,
      sections: [{ id: handoverId(`chapter-section:${catalog.code}`), title: "Full chapter", body: "Read the chapter in the document viewer." }],
      documentHtml,
      catalog,
    });
    return { id, content };
  });
}

export async function insertHandoverChapters(
  client: PoolClient,
  chapters: ReturnType<typeof prepareHandoverChapters>,
) {
  let inserted = 0;
  for (const chapter of chapters) {
    const existing = await client.query<{ matches: boolean }>(
      `SELECT d.current_revision=1 AND d.draft_revision=1 AND d.published_revision=1
         AND r.content=$2::jsonb AS matches
       FROM chapter_documents d LEFT JOIN chapter_revisions r ON r.chapter_id=d.id AND r.revision=1
       WHERE d.id=$1`,
      [chapter.id, JSON.stringify(chapter.content)],
    );
    if (existing.rows.length) {
      if (!existing.rows[0].matches) throw new Error(`Existing chapter ${chapter.id} differs from the handover; no changes were made.`);
      continue;
    }
    await client.query(
      "INSERT INTO chapter_documents (id,current_revision,draft_revision,published_revision) VALUES ($1,1,1,1)",
      [chapter.id],
    );
    await client.query(
      "INSERT INTO chapter_revisions (chapter_id,revision,content) VALUES ($1,1,$2::jsonb)",
      [chapter.id, JSON.stringify(chapter.content)],
    );
    await client.query(
      "INSERT INTO chapter_publications (chapter_id,revision) VALUES ($1,1)",
      [chapter.id],
    );
    inserted++;
  }
  return inserted;
}
