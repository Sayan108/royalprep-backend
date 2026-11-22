CREATE TABLE learning_resources (
  id uuid PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('revision-pack', 'radio', 'masterclass', 'mixed-bag', 'fawzia-sheet', 'last-week', 'exam-eve')),
  title text NOT NULL,
  summary text NOT NULL,
  body text NOT NULL,
  published boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX learning_resources_kind_published_idx ON learning_resources (kind, published);

CREATE TABLE saved_learning_resources (
  owner_email text NOT NULL,
  resource_id uuid NOT NULL REFERENCES learning_resources(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_email, resource_id)
);

CREATE TABLE shared_flashcard_decks (
  id uuid PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL,
  published boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE shared_flashcards (
  id uuid PRIMARY KEY,
  deck_id uuid NOT NULL REFERENCES shared_flashcard_decks(id) ON DELETE CASCADE,
  front text NOT NULL,
  back text NOT NULL
);

CREATE TABLE daily_challenges (
  challenge_date date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('quiz', 'mock')),
  question_ids jsonb NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  PRIMARY KEY (challenge_date, kind)
);

CREATE TABLE daily_quiz_attempts (
  owner_email text NOT NULL,
  challenge_date date NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz,
  PRIMARY KEY (owner_email, challenge_date)
);

CREATE TABLE daily_mock_results (
  owner_email text NOT NULL,
  challenge_date date NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  score integer,
  submitted_at timestamptz,
  PRIMARY KEY (owner_email, challenge_date)
);
