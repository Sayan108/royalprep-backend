import "dotenv/config";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";
import { insertHandoverQuestions, prepareHandoverQuestions } from "../src/services/handoverQuestions.js";

const directory = process.argv[2];
const mode = process.argv[3];
if (!directory || !["--dry-run", "--apply"].includes(mode) || process.argv.length !== 4)
  throw new Error("Usage: node --import tsx scripts/import-handover-questions.ts <03-content directory> --dry-run|--apply");

const chapters = JSON.parse(await readFile(join(directory, "chapters.json"), "utf8")) as unknown;
const questions = JSON.parse(await readFile(join(directory, "mcq-bank", "all-mcqs.json"), "utf8")) as unknown;
const prepared = prepareHandoverQuestions(chapters, questions);
console.log(`Validated ${prepared.length} handover questions.`);
if (mode === "--apply") {
  if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL before importing.");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = await insertHandoverQuestions(client, prepared);
    await client.query("COMMIT");
    console.log(`Imported ${inserted} questions; ${prepared.length - inserted} existing IDs were left unchanged.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}
