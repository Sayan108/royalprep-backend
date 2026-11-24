import "dotenv/config";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";
import { z } from "zod";
import { insertHandoverChapters, prepareHandoverChapters } from "../src/services/handoverChapters.js";

const directory = process.argv[2];
const mode = process.argv[3];
if (!directory || !["--dry-run", "--apply"].includes(mode) || process.argv.length !== 4)
  throw new Error("Usage: node --import tsx scripts/import-handover-chapters.ts <03-content directory> --dry-run|--apply");

const chapterData: unknown = JSON.parse(await readFile(join(directory, "chapters.json"), "utf8"));
const codes = z.array(z.object({ code: z.string().min(1) })).parse(chapterData).map((chapter) => chapter.code);
const notesDirectory = join(directory, "chapter-notes");
const files = await readdir(notesDirectory);
const documents = new Map<string, string>();
for (const code of codes) {
  const matches = files.filter((file) => file.startsWith(`${code}-`) && file.endsWith(".html"));
  if (matches.length !== 1) throw new Error(`Expected exactly one chapter document for ${code}; found ${matches.length}.`);
  documents.set(code, await readFile(join(notesDirectory, matches[0]), "utf8"));
}
const chapters = prepareHandoverChapters(chapterData, documents);
console.log(`Validated ${chapters.length} chapter documents.`);
if (mode === "--apply") {
  if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL before importing.");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = await insertHandoverChapters(client, chapters);
    await client.query("COMMIT");
    console.log(`Imported ${inserted} chapters; ${chapters.length - inserted} matching chapters were retained.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}
