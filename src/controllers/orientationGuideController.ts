import type { RequestHandler } from 'express'
import {
  orientationGuideDraftSchema,
  orientationGuidePublishSchema,
  orientationGuideRestoreSchema,
} from '../models/orientationGuide.js'
import {
  createOrientationGuideRepository,
  OrientationGuideConflict,
  OrientationGuideNotFound,
} from '../repositories/orientationGuideRepository.js'

export function createOrientationGuideController(repository: ReturnType<typeof createOrientationGuideRepository>) {
  const publicGuide: RequestHandler = async (_req, res) => {
    const guide = await repository.publicGuide()
    res.set('Cache-Control', 'no-store')
    if (!guide) { res.status(404).json({ error: 'Orientation guide has not been published.' }); return }
    res.json(guide)
  }
  const adminGuide: RequestHandler = async (_req, res) => { res.json(await repository.adminGuide()) }
  const saveDraft: RequestHandler = async (req, res) => {
    const input = orientationGuideDraftSchema.safeParse(req.body)
    if (!input.success) { res.status(422).json({ error: 'Provide a valid orientation guide and current revision.' }); return }
    try { res.json({ revision: await repository.saveDraft(input.data.expectedRevision, input.data.content) }) }
    catch (error) {
      if (error instanceof OrientationGuideConflict) { res.status(409).json({ error: error.message }); return }
      throw error
    }
  }
  const publish: RequestHandler = async (req, res) => {
    const input = orientationGuidePublishSchema.safeParse(req.body)
    if (!input.success) { res.status(422).json({ error: 'Provide the current orientation guide revision.' }); return }
    try { res.json({ revision: await repository.publish(input.data.expectedRevision) }) }
    catch (error) {
      if (error instanceof OrientationGuideConflict) { res.status(409).json({ error: error.message }); return }
      if (error instanceof OrientationGuideNotFound) { res.status(404).json({ error: error.message }); return }
      throw error
    }
  }
  const restore: RequestHandler = async (req, res) => {
    const input = orientationGuideRestoreSchema.safeParse(req.body)
    if (!input.success) { res.status(422).json({ error: 'Provide the current and source guide revisions.' }); return }
    try { res.json({ revision: await repository.restore(input.data.expectedRevision, input.data.sourceRevision) }) }
    catch (error) {
      if (error instanceof OrientationGuideConflict) { res.status(409).json({ error: error.message }); return }
      if (error instanceof OrientationGuideNotFound) { res.status(404).json({ error: error.message }); return }
      throw error
    }
  }
  return { publicGuide, adminGuide, saveDraft, publish, restore }
}
