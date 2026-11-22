# RoyalPrep backend

The PostgreSQL/Express API, separated from the RoyalPrep monorepo. Student and admin React applications are maintained in separate repositories.

## Local development

Use Node 22 or newer and PostgreSQL.

1. Run `npm ci`.
2. Copy `.env.example` to `.env` and configure `DATABASE_URL`, `ADMIN_PASSWORD`, `ADMIN_EMAIL` and `SESSION_SECRET`. Never commit credentials.
3. Back up the database, then run `node --import tsx scripts/migrate-postgres.ts` to apply the versioned migrations. Migrations 007 through 010 are required by the current features.
4. Run `npm run dev`. The example binds to `127.0.0.1:4000`.

Run `npm test` and `npm run build` to test and compile. Tests use an in-memory PostgreSQL emulator; real PostgreSQL migrations, locking, concurrency and backup/restore still require verification.

The development-only verification service logs codes to the backend console. Anyone with access to those logs can sign in. Do not expose this service publicly or use it with real users' data. Sessions are process-local. Student and admin production sign-in are unavailable until production authentication is implemented.

Account deactivation is a soft deletion that retains all records. Older backend versions do not enforce it; do not run or roll back to those versions without separately blocking deleted accounts.

## Deployment

For Render, use the repository root as the service root, `npm ci --include=dev && npm run build` as the build command, and `npm start` as the start command. Set `HOST=0.0.0.0`, `NODE_ENV=production`, `DUMMY_OTP_ENABLED=false`, the required credentials and the PostgreSQL connection via environment settings. Render supplies `PORT`. Apply the migrations using a safe, authorized database procedure before starting this backend; deploy the backend before frontends using the practice-answer API.

For a PostgreSQL server with a private CA, supply the CA via a secret file and configure certificate and hostname verification with `sslmode=verify-full` and `sslrootcert`. Never disable certificate verification. Set `CHAPTER_NOTES_ENABLED=true` only when the chapter feature is ready and enable `chapterNotesEnabled` in each frontend's `src/shared/config/index.ts` separately.
