import { z } from 'zod';
export const resourceKinds = ['revision-pack', 'radio', 'masterclass', 'mixed-bag', 'fawzia-sheet', 'last-week', 'exam-eve'];
export const resourceKindSchema = z.enum(resourceKinds);
export const resourceSchema = z.object({
    id: z.string().uuid(), kind: resourceKindSchema, title: z.string().trim().min(1).max(200),
    summary: z.string().trim().min(1).max(500), body: z.string().trim().min(1).max(20_000), published: z.boolean(),
}).strict();
export const resourceInputSchema = resourceSchema.omit({ id: true }).strict();
export const deckSchema = z.object({ id: z.string().uuid(), title: z.string().trim().min(1).max(200), description: z.string().trim().min(1).max(500), published: z.boolean(), cards: z.array(z.object({ id: z.string().uuid(), front: z.string().trim().min(1).max(1000), back: z.string().trim().min(1).max(2000) })) }).strict();
export const dailyAnswerSchema = z.object({ questionId: z.string().min(1), option: z.number().int().min(0).max(3) }).strict();
