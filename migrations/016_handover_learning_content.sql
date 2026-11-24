CREATE TABLE handover_revision_packs (
  chapter_code text PRIMARY KEY,
  title text NOT NULL,
  html_filename text NOT NULL,
  html text NOT NULL,
  script_filename text NOT NULL,
  script text NOT NULL
);

CREATE TABLE handover_recall_catalog (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  sittings jsonb NOT NULL
);

CREATE TABLE handover_recall_questions (
  id text PRIMARY KEY,
  chapter_code text NOT NULL,
  chapter_title text NOT NULL,
  source text NOT NULL CHECK (source IN ('recall', 'fawzia')),
  sitting text NOT NULL,
  content jsonb NOT NULL
);

CREATE INDEX handover_recall_questions_filter_idx
  ON handover_recall_questions (source, chapter_code, sitting, id);
