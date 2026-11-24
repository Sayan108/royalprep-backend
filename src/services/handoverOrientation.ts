import type { PoolClient } from "pg";
import { orientationGuideContentSchema } from "../models/orientationGuide.js";
import { validatePassiveDocumentHtml } from "./handoverDocument.js";
import { handoverId } from "./handoverId.js";

export function prepareHandoverOrientation(html: string) {
  validatePassiveDocumentHtml(html, "orientation guide");
  return orientationGuideContentSchema.parse({
    title: "RoyalPrep MRCS orientation guide",
    intro: "Read the complete orientation guide below.",
    sections: [{ id: handoverId("orientation-guide-section"), title: "Complete guide", body: "Read the guide in the document viewer." }],
    documentHtml: html,
  });
}

export async function stageHandoverOrientation(client: PoolClient, content: ReturnType<typeof prepareHandoverOrientation>) {
  const result = await client.query<{ current_revision: number; draft_revision: number | null; published_revision: number | null }>(
    "SELECT current_revision,draft_revision,published_revision FROM orientation_guide_state WHERE singleton=true FOR UPDATE",
  );
  const state = result.rows[0];
  if (!state) throw new Error("Orientation guide state is missing.");
  if (state.draft_revision !== null) {
    const draft = await client.query<{ matches: boolean }>(
      "SELECT content=$2::jsonb AS matches FROM orientation_guide_revisions WHERE revision=$1",
      [state.draft_revision, JSON.stringify(content)],
    );
    if (draft.rows[0]?.matches) return false;
  }
  const seed = await client.query(
    "SELECT 1 FROM orientation_guide_audit_events WHERE id='seed-orientation-guide-publish-001' AND revision=$1 AND actor='seed'",
    [state.current_revision],
  );
  if (state.current_revision !== state.draft_revision || state.current_revision !== state.published_revision || !seed.rowCount)
    throw new Error("Orientation guide has non-seed changes; refusing to replace the draft.");
  const next = state.current_revision + 1;
  await client.query("INSERT INTO orientation_guide_revisions (revision,content) VALUES ($1,$2::jsonb)", [next, JSON.stringify(content)]);
  await client.query("UPDATE orientation_guide_state SET current_revision=$1,draft_revision=$1 WHERE singleton=true", [next]);
  await client.query("INSERT INTO orientation_guide_audit_events (id,action,revision,actor) VALUES ($1,'draft',$2,'handover-import')", [handoverId("orientation-guide-import"), next]);
  return true;
}
