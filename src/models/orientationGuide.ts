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

export const orientationGuideContentSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    intro: z.string().trim().min(1).max(1000),
    sections: z.array(sectionSchema).min(1).max(20),
    documentHtml: z.string().min(1).max(1_000_000).refine(isPassiveDocumentHtml, "Document contains active HTML.").optional(),
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

export const orientationGuideDraftSchema = z
  .object({
    expectedRevision: revisionSchema,
    content: orientationGuideContentSchema,
  })
  .strict();
export const orientationGuidePublishSchema = z
  .object({ expectedRevision: revisionSchema })
  .strict();
export const orientationGuideRestoreSchema = z
  .object({
    expectedRevision: revisionSchema,
    sourceRevision: revisionSchema.min(1),
  })
  .strict();

export type OrientationGuideContent = z.infer<
  typeof orientationGuideContentSchema
>;
