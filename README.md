# RoyalPrep backend

The PostgreSQL/Express API, separated from the RoyalPrep monorepo. Student and admin React applications are maintained in separate repositories.

## Local development

Use Node 22 or newer and PostgreSQL.

1. Run `npm ci`.
2. Copy `.env.example` to `.env` and configure `DATABASE_URL`, `ADMIN_PASSWORD`, `ADMIN_EMAIL` and `SESSION_SECRET`. Never commit credentials.
3. Back up the database, then run `node --import tsx scripts/migrate-postgres.ts` to apply the versioned migrations. Apply migration 014 before deploying code that accepts five-option questions.
4. Run `npm run seed` to insert the repeatable demo question bank, hero, chapters, and student activity. The command is idempotent and uses `DATABASE_URL` directly; run migrations first.
5. Run `npm run dev`. The example binds to `127.0.0.1:4000`.

Run `npm test` and `npm run build` to test and compile. Tests use an in-memory PostgreSQL emulator; real PostgreSQL migrations, locking, concurrency and backup/restore still require verification.

## Handover question import

Extract the handover archive to a private location. Run `node --import tsx scripts/import-handover-questions.ts <path-to-03-content> --dry-run` to validate the chapter catalog and MCQ bank without connecting to a database. After backing up the target database, applying all migrations, and deploying five-option support to all readers and writers, replace `--dry-run` with `--apply` to import the reviewed questions as published. Existing question IDs are left unchanged and reported; source records are retained in `handover_question_sources`. This command imports the MCQ bank only, not chapter notes, recalls, flashcards, revision packs, or media.

To import shared flashcards, run `node --import tsx scripts/import-handover-flashcards.ts <path-to-03-content> --dry-run`, then use `--apply` against the backed-up database. Chapter decks and card IDs are stable across runs. Existing matching records are retained; changed records cause the transaction to fail rather than overwrite edits. Personal flashcards and review history are not changed.

To import published chapter notes, run `node --import tsx scripts/import-handover-chapters.ts <path-to-03-content> --dry-run`, then use `--apply` against the backed-up database. The importer stores each complete document and catalog metadata as a published chapter revision; matching records are retained and changed records abort the transaction. The reader isolates the documents in a sandbox and blocks network access. Admins can preview and edit imported HTML as versioned drafts; scripts and embedded frames are rejected. Reading progress marks the chapter, not an individual position within the document.

After migration 016 is applied, run `node --import tsx scripts/import-handover-learning.ts <extracted-handover-root> --dry-run`, then use `--apply` against the backed-up database. This imports revision packs with their recall scripts and a separate recall/Fawzia bank, retaining all source metadata. Existing matching records are retained; changed records abort the transaction. The orientation guide is staged as a draft only if the existing draft and publication are the seeded guide. Deploy the updated student and admin frontends before publishing that draft in the admin editor. The existing published guide remains available until then. Radio content is not imported.

Revision packs are served on demand to signed-in students. Their scripts run in an opaque sandbox with a hash-restricted Content Security Policy and no network access. The recall banks are separate from regular practice and mocks and remain free to signed-in students. Admins can review these imported packs and banks in Learning resources; they are read-only there.

The development-only verification service logs codes to the backend console. When `DUMMY_OTP_ENABLED=true` in development, `123456` is also accepted for student and admin OTP challenges. Anyone with access to the service can sign in. Do not expose this service publicly or use it with real users' data. Sessions are process-local. Student and admin production sign-in are unavailable until production authentication is implemented.

Account deactivation is a soft deletion that retains all records. Older backend versions do not enforce it; do not run or roll back to those versions without separately blocking deleted accounts.

## Deployment

For Render, use the repository root as the service root, `npm ci --include=dev && npm run build` as the build command, and `npm start` as the start command. Set `HOST=0.0.0.0`, `NODE_ENV=production`, `DUMMY_OTP_ENABLED=false`, the required credentials and the PostgreSQL connection via environment settings. Render supplies `PORT`. Apply the migrations using a safe, authorized database procedure before starting this backend; deploy the backend before frontends using the practice-answer API.

For a PostgreSQL server with a private CA, supply the CA via a secret file and configure certificate and hostname verification with `sslmode=verify-full` and `sslrootcert`. Never disable certificate verification. Chapter notes are enabled by default; `CHAPTER_NOTES_ENABLED=false` disables the backend feature and `VITE_CHAPTER_NOTES_ENABLED=false` disables it in a frontend build. Remove any existing `false` overrides, or set both variables to `true`, when deploying the backend and frontends together.
