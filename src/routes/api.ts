import { Router, type RequestHandler } from 'express'
import { rateLimit } from 'express-rate-limit'
import type { Pool } from 'pg'
import { createAdminAuth } from '../middleware/adminAuth.js'
import { createQuestionController } from '../controllers/questionController.js'
import { createHeroController } from '../controllers/heroController.js'
import { createDummyUserAuth } from '../services/dummyUserAuth.js'
import { createHeroRepository } from '../repositories/heroRepository.js'
import { createStudyPlanRepository } from '../repositories/studyPlanRepository.js'
import { createStudyPlanController } from '../controllers/studyPlanController.js'
import { createAttemptRepository } from '../repositories/attemptRepository.js'
import { createAttemptController } from '../controllers/attemptController.js'
import { createFlashcardRepository } from '../repositories/flashcardRepository.js'
import { createFlashcardController } from '../controllers/flashcardController.js'
import { createQuestionService } from '../services/questionService.js'
import { createChapterRepository } from '../repositories/chapterRepository.js'
import { createChapterController } from '../controllers/chapterController.js'
import { consoleVerificationEmail, type VerificationEmailService } from '../services/verificationEmail.js'
import { createPracticeRepository } from '../repositories/practiceRepository.js'
import { createOrientationGuideController } from '../controllers/orientationGuideController.js'
import { createOrientationGuideRepository } from '../repositories/orientationGuideRepository.js'
import { createLearningProductsController } from '../controllers/learningProductsController.js'
import { createLearningProductsRepository } from '../repositories/learningProductsRepository.js'
import { createDailyChallengeController } from '../controllers/dailyChallengeController.js'
import { createDailyChallengeRepository } from '../repositories/dailyChallengeRepository.js'
import { createAdminUsersController } from '../controllers/adminUsersController.js'
import { createAdminSessionsController } from '../controllers/adminSessionsController.js'
import { createNotificationController } from '../controllers/notificationController.js'
import { createAnalyticsController } from '../controllers/analyticsController.js'

export function createApiRouter(config: { adminPassword: string; secret: string; adminEmail?: string; dummyOtpEnabled?: boolean; chapterNotesEnabled?: boolean; verificationEmail?: VerificationEmailService; postgres: Pool }) {
  const router = Router()
  const service = createQuestionService(config.postgres)
  const practice = createPracticeRepository(config.postgres)
  const questions = createQuestionController(service, practice)
  const hero = createHeroController(createHeroRepository(config.postgres))
  const plans = createStudyPlanController(createStudyPlanRepository(config.postgres))
  const attempts = createAttemptController(createAttemptRepository(config.postgres), service, practice)
  const flashcards = createFlashcardController(createFlashcardRepository(config.postgres))
  const chapters = createChapterController(createChapterRepository(config.postgres))
  const orientationGuide = createOrientationGuideController(createOrientationGuideRepository(config.postgres))
  const learningProducts = createLearningProductsController(createLearningProductsRepository(config.postgres))
  const dailyChallenges = createDailyChallengeController(createDailyChallengeRepository(config.postgres))
  const adminUsers = createAdminUsersController(config.postgres)
  const adminSessions = createAdminSessionsController(config.postgres)
  const notifications = createNotificationController(config.postgres)
  const analytics = createAnalyticsController(config.postgres)
  const emailService = config.verificationEmail ?? consoleVerificationEmail
  const auth = createAdminAuth(config.adminPassword, config.adminEmail, config.dummyOtpEnabled ?? false, emailService)
  const studentAuth = createDummyUserAuth(config.dummyOtpEnabled ?? false, config.postgres, emailService)
  const requireChapterNotes: RequestHandler = (_req, res, next) => {
    if (!config.chapterNotesEnabled) { res.status(503).json({ error: 'Chapter notes are not enabled.' }); return }
    next()
  }

  router.use(rateLimit({ windowMs: 60_000, limit: 180 }))
  router.use('/admin', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next() })
  const adminLoginLimit = rateLimit({ windowMs: 15 * 60_000, limit: 10 })
  router.post('/admin/otp/request', adminLoginLimit, auth.requestOtp)
  router.post('/admin/login', adminLoginLimit, auth.login)
  router.use('/auth', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next() })
  router.post('/auth/otp/request', rateLimit({ windowMs: 15 * 60_000, limit: 5 }), studentAuth.requestOtp)
  router.post('/auth/otp/verify', rateLimit({ windowMs: 15 * 60_000, limit: 10 }), studentAuth.verifyOtp)
  router.get('/auth/session', studentAuth.requireStudent, studentAuth.getSession)
  router.post('/auth/logout', studentAuth.requireStudent, studentAuth.logout)
  router.post('/auth/delete', studentAuth.requireStudent, studentAuth.deleteAccount)
  router.use('/admin', auth.requireAdmin)
  router.get('/admin/session', (_req, res) => { res.json({ authenticated: true }) })
  router.post('/admin/logout', auth.logout)
  router.get('/health', async (_req, res) => {
    await config.postgres.query('SELECT 1')
    res.json({ ok: true, storage: 'postgresql' })
  })
  router.get('/admin/questions', questions.listQuestions)
  router.post('/admin/questions', questions.create)
  router.put('/admin/questions/:id', questions.update)
  router.get('/admin/question-reports', questions.listReports)
  router.post('/admin/questions/import', questions.importCsv)
  router.get('/admin/site/hero', hero.adminHero)
  router.put('/admin/site/hero/draft', hero.saveDraft)
  router.post('/admin/site/hero/publish', hero.publish)
  router.post('/admin/site/hero/restore', hero.restore)
  router.get('/admin/content/orientation-guide', orientationGuide.adminGuide)
  router.put('/admin/content/orientation-guide/draft', orientationGuide.saveDraft)
  router.post('/admin/content/orientation-guide/publish', orientationGuide.publish)
  router.post('/admin/content/orientation-guide/restore', orientationGuide.restore)
  router.get('/admin/learning-resources', learningProducts.adminResources)
  router.put('/admin/learning-resources/:id', learningProducts.saveResource)
  router.get('/admin/flashcard-decks', learningProducts.adminDecks)
  router.put('/admin/flashcard-decks', learningProducts.saveDeck)
  router.get('/admin/users', adminUsers.list)
  router.get('/admin/sessions', adminSessions.list)
  router.post('/admin/sessions/revoke', adminSessions.revoke)
  router.get('/admin/notifications', notifications.list)
  router.post('/admin/notifications', notifications.create)
  router.get('/admin/daily-challenges', dailyChallenges.adminList)
  router.put('/admin/daily-challenges', dailyChallenges.adminSave)
  router.use('/admin/chapters', requireChapterNotes)
  router.get('/admin/chapters', chapters.listAdmin)
  router.post('/admin/chapters', chapters.create)
  router.get('/admin/chapters/:id', chapters.getAdmin)
  router.put('/admin/chapters/:id/draft', chapters.saveDraft)
  router.post('/admin/chapters/:id/publish', chapters.publish)
  router.post('/admin/chapters/:id/restore', chapters.restore)
  router.get('/public/site/hero', hero.publicHero)
  router.get('/public/orientation-guide', orientationGuide.publicGuide)
  router.get('/public/learning-resources', learningProducts.publicResources)
  router.get('/public/flashcard-decks', learningProducts.decks)
  router.get('/public/daily-mock/leaderboard', dailyChallenges.leaderboard)
  router.get('/public/catalog-summary', questions.catalogSummary)
  router.get('/public/chapters', questions.listChapters)
  router.use('/student', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next() }, studentAuth.requireStudent)
  router.use('/student/chapters', requireChapterNotes)
  router.get('/student/chapters', chapters.listStudent)
  router.get('/student/chapters/:id', chapters.readStudent)
  router.put('/student/chapters/:id/progress', chapters.saveProgress)
  router.get('/student/study-plan', plans.read)
  router.put('/student/study-plan', plans.write)
  router.get('/student/attempts', attempts.list)
  router.get('/student/attempt-analytics', analytics.chapterAnalytics)
  router.get('/student/mistakes', attempts.mistakes)
  router.post('/student/attempts', attempts.start)
  router.get('/student/attempts/:id', attempts.get)
  router.put('/student/attempts/:id/answers/:questionId', attempts.answer)
  router.put('/student/attempts/:id/flags/:questionId', attempts.flag)
  router.post('/student/attempts/:id/submit', attempts.submit)
  router.get('/student/flashcards', flashcards.list)
  router.post('/student/flashcards', flashcards.create)
  router.post('/student/flashcards/:id/review', flashcards.review)
  router.get('/student/daily-quiz', dailyChallenges.quiz)
  router.post('/student/daily-quiz/submit', dailyChallenges.submitQuiz)
  router.get('/student/daily-mock', dailyChallenges.mock)
  router.post('/student/daily-mock/submit', dailyChallenges.submitMock)
  router.get('/student/saved-resources', learningProducts.saved)
  router.put('/student/saved-resources/:id', learningProducts.toggleSaved)
  router.delete('/student/flashcards/:id', flashcards.remove)
  router.use('/practice', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next() }, studentAuth.requireStudent)
  router.get('/practice/questions', questions.listPractice)
  router.get('/practice/answers', questions.practiceAnswers)
  router.post('/practice/questions/:id/answer', questions.answer)
  router.post('/practice/questions/:id/reports', rateLimit({ windowMs: 60_000, limit: 10, handler: (_req, res) => { res.status(429).json({ error: 'Too many reports. Please try again later.' }) } }), questions.report)
  return router
}
