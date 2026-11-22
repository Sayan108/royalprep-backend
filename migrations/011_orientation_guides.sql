CREATE TABLE orientation_guide_revisions (
  revision integer PRIMARY KEY CHECK (revision > 0),
  content jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE orientation_guide_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  current_revision integer NOT NULL DEFAULT 0 CHECK (current_revision >= 0),
  draft_revision integer REFERENCES orientation_guide_revisions(revision),
  published_revision integer REFERENCES orientation_guide_revisions(revision)
);

INSERT INTO orientation_guide_state (singleton) VALUES (true);

CREATE TABLE orientation_guide_audit_events (
  id text PRIMARY KEY,
  action text NOT NULL CHECK (action IN ('draft', 'publish', 'restore')),
  revision integer NOT NULL REFERENCES orientation_guide_revisions(revision),
  source_revision integer REFERENCES orientation_guide_revisions(revision),
  actor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX orientation_guide_audit_revision_idx ON orientation_guide_audit_events (revision);
