import type { RequestHandler } from 'express'
import { z } from 'zod'
import { createDailyChallengeRepository } from '../repositories/dailyChallengeRepository.js'

const answersSchema = z.object({ answers: z.record(z.string().min(1), z.number().int().min(0).max(3)) }).strict()
const challengeSchema = z.object({ date: z.string().date(), kind: z.enum(['quiz', 'mock']), questionIds: z.array(z.string().min(1)).min(5).max(100), durationMinutes: z.number().int().min(1).max(240) }).strict()
const today = () => new Date().toISOString().slice(0, 10)

export function createDailyChallengeController(repository: ReturnType<typeof createDailyChallengeRepository>) {
  const owner = (res: Parameters<RequestHandler>[1]) => (res.locals.student as { email: string }).email
  const get = (kind: 'quiz' | 'mock'): RequestHandler => async (_req, res) => res.json(await repository.get(kind, today(), owner(res)))
  const submit = (kind: 'quiz' | 'mock'): RequestHandler => async (req, res) => {
    const parsed = answersSchema.safeParse(req.body)
    if (!parsed.success) { res.status(422).json({ error: 'Provide answers for the challenge.' }); return }
    res.json(await repository.submit(kind, today(), owner(res), parsed.data.answers))
  }
  const leaderboard: RequestHandler = async (req, res) => res.json(await repository.leaderboard(typeof req.query.date === 'string' ? req.query.date : today()))
  const adminList: RequestHandler = async (_req, res) => res.json(await repository.adminChallenges())
  const adminSave: RequestHandler = async (req, res) => {
    const parsed = challengeSchema.safeParse(req.body)
    if (!parsed.success) { res.status(422).json({ error: 'Provide a valid dated challenge.' }); return }
    await repository.saveChallenge(parsed.data.date, parsed.data.kind, parsed.data.questionIds, parsed.data.durationMinutes)
    res.json(parsed.data)
  }
  return { quiz: get('quiz'), submitQuiz: submit('quiz'), mock: get('mock'), submitMock: submit('mock'), leaderboard, adminList, adminSave }
}
