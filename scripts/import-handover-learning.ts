import "dotenv/config";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";
import { z } from "zod";
import { insertHandoverLearning, prepareHandoverLearning, type RevisionPack } from "../src/services/handoverLearning.js";
import { prepareHandoverOrientation, stageHandoverOrientation } from "../src/services/handoverOrientation.js";

const root = process.argv[2];
const mode = process.argv[3];
if (!root || !["--dry-run", "--apply"].includes(mode) || process.argv.length !== 4)
  throw new Error("Usage: node --import tsx scripts/import-handover-learning.ts <extracted handover root> --dry-run|--apply");

const content = join(root, "03-content");
const chapterData: unknown = JSON.parse(await readFile(join(content, "chapters.json"), "utf8"));
const chapters = z.array(z.object({ code: z.string().min(1), title: z.string().min(1) })).parse(chapterData);
const recallData: unknown = JSON.parse(await readFile(join(content, "recalls", "recalls-and-fawzia.json"), "utf8"));
const packDirectory = join(content, "revision-packs");
const files = await readdir(packDirectory);
const packs: RevisionPack[] = [];
for (const chapter of chapters) {
  const htmlFiles = files.filter((file) => file.startsWith(`${chapter.code}-`) && file.endsWith("-revise.html"));
  const scriptFilename = `${chapter.code}-recall-oneliners.js`;
  if (htmlFiles.length !== 1 || !files.includes(scriptFilename))
    throw new Error(`Missing or ambiguous revision pack for ${chapter.code}.`);
  packs.push({
    chapterCode: chapter.code,
    title: chapter.title,
    htmlFilename: htmlFiles[0],
    html: await readFile(join(packDirectory, htmlFiles[0]), "utf8"),
    scriptFilename,
    script: await readFile(join(packDirectory, scriptFilename), "utf8"),
  });
}
const prepared = prepareHandoverLearning(chapterData, recallData, packs);
const orientation = prepareHandoverOrientation(await readFile(join(root, "02-documents", "RoyalPrep-MRCS-Orientation-Guide.html"), "utf8"));
console.log(`Validated ${prepared.packs.length} revision packs, ${prepared.questions.length} recall/Fawzia questions, ${prepared.sittings.length} sittings, and the orientation guide.`);
if (mode === "--apply") {
  if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL before importing.");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await insertHandoverLearning(client, prepared);
    const staged = await stageHandoverOrientation(client, orientation);
    await client.query("COMMIT");
    console.log(`Imported ${result.packsInserted} revision packs and ${result.questionsInserted} recall/Fawzia questions. Orientation guide ${staged ? "staged as a draft" : "already staged"}; existing published guide remains live.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}
