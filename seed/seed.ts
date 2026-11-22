import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { z } from 'zod'
import { chapterContentSchema } from '../src/models/chapter.js'
import { flashcardInputSchema } from '../src/models/flashcard.js'
import { heroContentSchema } from '../src/models/hero.js'
import { orientationGuideContentSchema } from '../src/models/orientationGuide.js'
import { deckSchema, resourceInputSchema } from '../src/models/learningProducts.js'
import { questionInputSchema, type Question } from '../src/models/question.js'
import { studyPlanSchema } from '../src/models/studyPlan.js'
import { seedQuestions } from './questions.js'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('Set DATABASE_URL in backend/.env before seeding.')

const demoEmail = 'demo.student@royalprep.test'
const secondDemoEmail = 'revision.student@royalprep.test'
const chapterIds = {
  anatomy: '11111111-1111-4111-8111-111111111111',
  physiology: '22222222-2222-4222-8222-222222222222',
} as const
const sectionIds = {
  anatomyOverview: '11111111-1111-4111-8111-111111111112',
  anatomyClinical: '11111111-1111-4111-8111-111111111113',
  physiologyOverview: '22222222-2222-4222-8222-222222222223',
  physiologyClinical: '22222222-2222-4222-8222-222222222224',
} as const

const hero = heroContentSchema.parse({
  eyebrow: 'RoyalPrep',
  headline: 'Prepare with confidence.',
  highlight: 'Practice smarter',
  description: 'Build a consistent study habit with focused questions, custom mocks, flashcards and progress tracking.',
  primaryLabel: 'Start practising',
  primaryPath: '/practice',
  secondaryLabel: 'Build a study plan',
  secondaryPath: '/study-plan',
})

const orientationGuide = orientationGuideContentSchema.parse({
  title: 'Your RoyalPrep orientation guide',
  intro: 'Use this guide to turn the RoyalPrep resources into a consistent preparation routine.',
  sections: [
    {
      id: '77777777-7777-4777-8777-777777777771',
      title: '1. Set your target',
      body: 'Choose your target exam date and create a realistic weekly study plan. Leave time for revision and mock exams.',
    },
    {
      id: '77777777-7777-4777-8777-777777777772',
      title: '2. Learn the chapters',
      body: 'Start with the chapter library and read the published notes. Use practice questions to check your understanding immediately.',
    },
    {
      id: '77777777-7777-4777-8777-777777777773',
      title: '3. Retain what you learn',
      body: 'Create flashcards for difficult facts, review your mistakes and return to weak chapters each week.',
    },
    {
      id: '77777777-7777-4777-8777-777777777774',
      title: '4. Measure your progress',
      body: 'Complete custom mocks under timed conditions, review the analytics and adjust your study plan based on the results.',
    },
  ],
})

const learningResources = [
  ['88888888-8888-4888-8888-888888888881', 'revision-pack', 'Core revision pack', 'A compact review of high-yield topics.', 'Review the key facts, then complete a timed practice set.'],
  ['88888888-8888-4888-8888-888888888882', 'radio', 'RoyalPrep Radio: exam mindset', 'Audio-style recall notes for a focused commute.', 'Use this recall script to revisit prioritisation, timing and exam-day routines.'],
  ['88888888-8888-4888-8888-888888888883', 'masterclass', 'Masterclass: anatomy patterns', 'A structured lesson on recognising common anatomy patterns.', 'Start with relationships, connect them to clinical signs, then test yourself without notes.'],
  ['88888888-8888-4888-8888-888888888884', 'mixed-bag', 'Mixed Bag: rapid recall', 'A mixed set of short recall prompts.', 'Name the structure, state the mechanism and give one clinical application for each prompt.'],
  ['88888888-8888-4888-8888-888888888885', 'fawzia-sheet', 'Fawzia sheet: last-minute facts', 'A quick-reference sheet for final revision.', 'Use this only after understanding the underlying chapter content.'],
  ['88888888-8888-4888-8888-888888888886', 'last-week', 'Last week plan', 'A focused seven-day revision sequence.', 'Day 1-4: weak topics. Day 5: mixed practice. Day 6: full mock. Day 7: light review and rest.'],
  ['88888888-8888-4888-8888-888888888887', 'exam-eve', 'Exam eve checklist', 'Practical reminders for the evening before the exam.', 'Prepare identification, route, timing and essentials. Stop heavy study early and sleep.'],
].map(([id, kind, title, summary, body]) => ({ id, ...resourceInputSchema.parse({ kind, title, summary, body, published: true }) }))

const sharedDeck = deckSchema.parse({
  id: '99999999-9999-4999-8999-999999999991',
  title: 'Shared high-yield recall',
  description: 'Starter flashcards for the most common revision prompts.',
  published: true,
  cards: [
    { id: '99999999-9999-4999-8999-999999999992', front: 'What nerve is injured in a surgical neck fracture?', back: 'The axillary nerve.' },
    { id: '99999999-9999-4999-8999-999999999993', front: 'What is the main extracellular cation?', back: 'Sodium.' },
  ],
})

const chapters = [
  chapterContentSchema.parse({
    title: 'Applied Anatomy',
    practiceChapter: 'Applied Anatomy',
    sections: [
      { id: sectionIds.anatomyOverview, title: 'Core relationships', body: 'Review the major anatomical relationships and clinically important landmarks.' },
      { id: sectionIds.anatomyClinical, title: 'Clinical application', body: 'Apply anatomy to common injuries, examinations and operative approaches.' },
    ],
  }),
  chapterContentSchema.parse({
    title: 'Physiology',
    practiceChapter: 'Physiology',
    sections: [
      { id: sectionIds.physiologyOverview, title: 'Homeostasis', body: 'Revise the mechanisms that maintain the internal environment.' },
      { id: sectionIds.physiologyClinical, title: 'Clinical physiology', body: 'Connect physiological principles to common clinical measurements.' },
    ],
  }),
]

const plan = studyPlanSchema.parse({
  targetDate: '2027-03-31',
  daysPerWeek: 5,
  studyDays: [0, 1, 2, 3, 4],
  hoursPerWeek: 8,
  tasks: [
    { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', chapter: 'Applied Anatomy', title: 'Review upper limb anatomy', dueDate: '2026-12-01', done: true },
    { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', chapter: 'Physiology', title: 'Complete renal physiology questions', dueDate: '2026-12-04', done: false },
    { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', chapter: 'Pathology', title: 'Revise inflammation', dueDate: '2026-12-08', done: false },
  ],
})

const cards = [
  {
    ...flashcardInputSchema.parse({ chapter: 'Applied Anatomy', front: 'What nerve is injured in a surgical neck fracture?', back: 'The axillary nerve.' }),
    id: '33333333-3333-4333-8333-333333333331', version: 2, dueAt: Date.now() + 86_400_000, intervalDays: 1,
  },
  {
    ...flashcardInputSchema.parse({ chapter: 'Physiology', front: 'What is the main extracellular cation?', back: 'Sodium.' }),
    id: '33333333-3333-4333-8333-333333333332', version: 1, dueAt: Date.now(), intervalDays: 0,
  },
]

for (const question of seedQuestions) questionInputSchema.parse(question)

const pool = new pg.Pool({ connectionString: databaseUrl })
const client = await pool.connect()
try {
  await client.query('BEGIN')
  await client.query('SELECT 1 FROM questions LIMIT 0')

  const seededQuestions: Question[] = []
  for (const [index, input] of seedQuestions.entries()) {
    const id = `seed-question-${String(index + 1).padStart(3, '0')}`
    const question: Question = { ...input, id, version: 1 }
    await client.query(
      `INSERT INTO questions (id, version, chapter, published, stem, options, correct, explanation, source)
       VALUES ($1, 1, $2, $3, $4, $5::jsonb, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET chapter=EXCLUDED.chapter, published=EXCLUDED.published,
         stem=EXCLUDED.stem, options=EXCLUDED.options, correct=EXCLUDED.correct,
         explanation=EXCLUDED.explanation, source=EXCLUDED.source`,
      [id, question.chapter, question.published, question.stem, JSON.stringify(question.options), question.correct, question.explanation, 'RoyalPrep sample bank'],
    )
    seededQuestions.push(question)
  }

  await client.query(
    `INSERT INTO question_reports (id, question_id, question_version, question_stem, message, created_at)
     VALUES ($1, $2, 1, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
    ['seed-report-001', seededQuestions[0].id, seededQuestions[0].stem, 'Sample report for demonstrating the admin review queue.', Date.now()],
  )

  const heroState = await client.query<{ current_revision: number }>('SELECT current_revision FROM hero_state WHERE singleton=true FOR UPDATE')
  if (!heroState.rows[0]) throw new Error('Hero state is missing; run migrations before seeding.')
  if (heroState.rows[0].current_revision === 0) {
    await client.query('INSERT INTO hero_revisions (revision, content) VALUES (1, $1::jsonb) ON CONFLICT (revision) DO NOTHING', [JSON.stringify(hero)])
    await client.query('UPDATE hero_state SET current_revision=1, draft_revision=1, published_revision=1 WHERE singleton=true')
    await client.query(
      `INSERT INTO hero_audit_events (id, action, revision, actor)
       VALUES ($1, 'publish', 1, 'seed') ON CONFLICT (id) DO NOTHING`,
      ['seed-hero-publish-001'],
    )
  }

  const orientationState = await client.query<{ current_revision: number }>(
    'SELECT current_revision FROM orientation_guide_state WHERE singleton=true FOR UPDATE',
  )
  if (!orientationState.rows[0]) throw new Error('Orientation guide state is missing; run migrations before seeding.')
  if (orientationState.rows[0].current_revision === 0) {
    await client.query(
      'INSERT INTO orientation_guide_revisions (revision, content) VALUES (1, $1::jsonb) ON CONFLICT (revision) DO NOTHING',
      [JSON.stringify(orientationGuide)],
    )
    await client.query(
      'UPDATE orientation_guide_state SET current_revision=1, draft_revision=1, published_revision=1 WHERE singleton=true',
    )
    await client.query(
      `INSERT INTO orientation_guide_audit_events (id, action, revision, actor)
       VALUES ($1, 'publish', 1, 'seed') ON CONFLICT (id) DO NOTHING`,
      ['seed-orientation-guide-publish-001'],
    )
  }

  for (const resource of learningResources) {
    await client.query(
      `INSERT INTO learning_resources (id, kind, title, summary, body, published)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (id) DO UPDATE SET kind=EXCLUDED.kind,title=EXCLUDED.title,summary=EXCLUDED.summary,body=EXCLUDED.body,published=EXCLUDED.published,updated_at=now()`,
      [resource.id, resource.kind, resource.title, resource.summary, resource.body, resource.published],
    )
  }
  await client.query(
    `INSERT INTO notifications (id, title, body)
     VALUES ($1,$2,$3) ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title,body=EXCLUDED.body`,
    ['aaaaaaaa-2222-4222-8222-222222222222', 'Welcome to RoyalPrep', 'Your daily quiz, mock and learning resources are ready.'],
  )
  await client.query(
    `INSERT INTO shared_flashcard_decks (id, title, description, published)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title,description=EXCLUDED.description,published=EXCLUDED.published,updated_at=now()`,
    [sharedDeck.id, sharedDeck.title, sharedDeck.description, sharedDeck.published],
  )
  for (const card of sharedDeck.cards) {
    await client.query(
      `INSERT INTO shared_flashcards (id, deck_id, front, back) VALUES ($1,$2,$3,$4)
       ON CONFLICT (id) DO UPDATE SET front=EXCLUDED.front,back=EXCLUDED.back`,
      [card.id, sharedDeck.id, card.front, card.back],
    )
  }

  for (const [index, content] of chapters.entries()) {
    const id = Object.values(chapterIds)[index]
    await client.query(
      `INSERT INTO chapter_documents (id, current_revision, draft_revision, published_revision)
       VALUES ($1, 1, 1, 1)
       ON CONFLICT (id) DO NOTHING`,
      [id],
    )
    await client.query(
      `INSERT INTO chapter_revisions (chapter_id, revision, content)
       VALUES ($1, 1, $2::jsonb)
       ON CONFLICT (chapter_id, revision) DO UPDATE SET content=EXCLUDED.content`,
      [id, JSON.stringify(content)],
    )
    await client.query(
      `INSERT INTO chapter_publications (chapter_id, revision, source_revision)
       VALUES ($1, 1, NULL) ON CONFLICT (chapter_id, revision) DO NOTHING`,
      [id],
    )
  }

  await client.query(
    `INSERT INTO student_accounts (email) VALUES ($1), ($2)
     ON CONFLICT (email) DO UPDATE SET deleted_at=NULL`,
    [demoEmail, secondDemoEmail],
  )
  await client.query(
    `INSERT INTO student_study_plans (owner_email, version, plan)
     VALUES ($1, 1, $2::jsonb)
     ON CONFLICT (owner_email) DO UPDATE SET version=1, plan=EXCLUDED.plan, updated_at=now()`,
    [demoEmail, JSON.stringify(plan)],
  )
  await client.query(
    `INSERT INTO student_flashcards (owner_email, state)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (owner_email) DO UPDATE SET state=EXCLUDED.state`,
    [demoEmail, JSON.stringify({ cards, events: [{ id: '44444444-4444-4444-8444-444444444441', cardId: cards[0].id, rating: 'good' }] })],
  )
  await client.query(
    `INSERT INTO student_chapter_progress (owner_email, chapter_id, revision, section_id, version)
     VALUES ($1, $2, 1, $3, 1)
     ON CONFLICT (owner_email, chapter_id) DO UPDATE SET revision=1, section_id=EXCLUDED.section_id, version=1, updated_at=now()`,
    [demoEmail, chapterIds.anatomy, sectionIds.anatomyClinical],
  )

  const practiceQuestion = seededQuestions.find(question => question.chapter === 'Applied Anatomy') ?? seededQuestions[0]
  await client.query(
    `INSERT INTO student_practice_answers
       (owner_email, question_id, question_version, chapter, stem, selected_option, correct_option, explanation, answered_at)
     VALUES ($1, $2, 1, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (owner_email, question_id) DO UPDATE SET selected_option=EXCLUDED.selected_option,
       correct_option=EXCLUDED.correct_option, explanation=EXCLUDED.explanation, answered_at=EXCLUDED.answered_at`,
    [demoEmail, practiceQuestion.id, practiceQuestion.chapter, practiceQuestion.stem, (practiceQuestion.correct + 1) % 4, practiceQuestion.correct, practiceQuestion.explanation, Date.now()],
  )

  const attemptQuestions = seededQuestions.slice(0, 3)
  const dailyQuestions = seededQuestions.slice(0, 5)
  for (const kind of ['quiz', 'mock'] as const) {
    await client.query(
      `INSERT INTO daily_challenges (challenge_date, kind, question_ids, duration_minutes)
       VALUES (CURRENT_DATE, $1, $2::jsonb, $3)
       ON CONFLICT (challenge_date, kind) DO UPDATE SET question_ids=EXCLUDED.question_ids,duration_minutes=EXCLUDED.duration_minutes`,
      [kind, JSON.stringify(dailyQuestions.map(question => question.id)), kind === 'quiz' ? 10 : 60],
    )
  }
  await client.query(
    `INSERT INTO daily_quiz_attempts (owner_email, challenge_date, answers, submitted_at)
     VALUES ($1, CURRENT_DATE, $2::jsonb, now())
     ON CONFLICT (owner_email, challenge_date) DO UPDATE SET answers=EXCLUDED.answers,submitted_at=EXCLUDED.submitted_at`,
    [demoEmail, JSON.stringify(Object.fromEntries(dailyQuestions.map((question, index) => [question.id, index % 4])))],
  )
  await client.query(
    `INSERT INTO daily_mock_results (owner_email, challenge_date, answers, score, submitted_at)
     VALUES ($1, CURRENT_DATE, $2::jsonb, $3, now())
     ON CONFLICT (owner_email, challenge_date) DO UPDATE SET answers=EXCLUDED.answers,score=EXCLUDED.score,submitted_at=EXCLUDED.submitted_at`,
    [demoEmail, JSON.stringify(Object.fromEntries(dailyQuestions.map(question => [question.id, question.correct]))), dailyQuestions.length],
  )
  await client.query(
    `INSERT INTO saved_learning_resources (owner_email, resource_id)
     VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [demoEmail, learningResources[0].id],
  )

  const submittedAttempt = {
    id: '55555555-5555-4555-8555-555555555551',
    requestId: '66666666-6666-4666-8666-666666666661',
    fingerprint: 'seed-submitted',
    version: 2,
    status: 'submitted',
    createdAt: Date.now() - 3_600_000,
    deadline: Date.now() - 1_800_000,
    submittedAt: Date.now() - 1_800_000,
    questions: attemptQuestions,
    answers: Object.fromEntries(attemptQuestions.map((question, index) => [question.id, index === 0 ? question.correct : (question.correct + 1) % 4])),
    flags: [attemptQuestions[1].id],
  }
  await client.query(
    `INSERT INTO custom_attempts (id, owner_email, request_id, fingerprint, payload)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     ON CONFLICT (id) DO UPDATE SET payload=EXCLUDED.payload, fingerprint=EXCLUDED.fingerprint`,
    [submittedAttempt.id, demoEmail, submittedAttempt.requestId, submittedAttempt.fingerprint, JSON.stringify(submittedAttempt)],
  )

  const activeAttempt = {
    ...submittedAttempt,
    id: '55555555-5555-4555-8555-555555555552',
    requestId: '66666666-6666-4666-8666-666666666662',
    fingerprint: 'seed-active',
    version: 1,
    status: 'active',
    createdAt: Date.now(),
    deadline: Date.now() + 3_600_000,
    submittedAt: null,
    answers: {},
    flags: [],
  }
  await client.query(
    `INSERT INTO custom_attempts (id, owner_email, request_id, fingerprint, payload)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     ON CONFLICT (id) DO UPDATE SET payload=EXCLUDED.payload, fingerprint=EXCLUDED.fingerprint`,
    [activeAttempt.id, demoEmail, activeAttempt.requestId, activeAttempt.fingerprint, JSON.stringify(activeAttempt)],
  )

  await client.query('COMMIT')
  console.log(`Seeded ${seededQuestions.length} questions, hero content, orientation guide, ${learningResources.length} learning resources, shared flashcards, daily challenges, ${chapters.length} chapters, and demo student activity.`)
} catch (error) {
  await client.query('ROLLBACK')
  throw error
} finally {
  client.release()
  await pool.end()
}
