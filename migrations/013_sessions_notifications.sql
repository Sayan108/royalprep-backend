CREATE TABLE student_sessions (
  token text PRIMARY KEY,
  email text NOT NULL REFERENCES student_accounts(email) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);

CREATE INDEX student_sessions_email_idx ON student_sessions (email);

CREATE TABLE notifications (
  id uuid PRIMARY KEY,
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
