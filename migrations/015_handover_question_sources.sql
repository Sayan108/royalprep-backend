CREATE TABLE handover_question_sources (
  question_id text PRIMARY KEY REFERENCES questions(id),
  content jsonb NOT NULL
);
