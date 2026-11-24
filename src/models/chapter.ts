import { z } from "zod";
import { revisionSchema } from "./hero.js";
import { isPassiveDocumentHtml } from "../services/handoverDocument.js";

const sectionSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().trim().min(1).max(160),
    body: z.string().trim().min(1).max(4000),
  })
  .strict();

export const chapterContentSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    practiceChapter: z.string().trim().max(120),
    sections: z.array(sectionSchema).min(1).max(25),
    documentHtml: z.string().min(1).max(1_000_000).refine(isPassiveDocumentHtml, "Document contains active HTML.").optional(),
    catalog: z.object({
      code: z.string().min(1),
      slug: z.string().min(1),
      paper: z.number().int(),
      subject: z.string().min(1),
      status: z.string().min(1),
      toc: z.array(z.object({ title: z.string(), previouslyAsked: z.boolean() })),
      summary: z.string(),
      freeSample: z.boolean(),
      revisePack: z.boolean(),
      mcqCount: z.number().int().nonnegative(),
    }).strict().optional(),
  })
  .strict()
  .refine(
    (content) =>
      new Set(content.sections.map((section) => section.id)).size ===
      content.sections.length,
    {
      message: "Section IDs must be unique.",
    },
  );

export const chapterDraftSchema = z
  .object({ expectedRevision: revisionSchema, content: chapterContentSchema })
  .strict();
export const chapterPublishSchema = z
  .object({ expectedRevision: revisionSchema })
  .strict();
export const chapterRestoreSchema = z
  .object({
    expectedRevision: revisionSchema,
    sourceRevision: revisionSchema.min(1),
  })
  .strict();
export const chapterProgressSchema = z
  .object({
    expectedVersion: revisionSchema,
    revision: revisionSchema.min(1),
    sectionId: z.string().uuid(),
  })
  .strict();

export type ChapterContent = z.infer<typeof chapterContentSchema>;
