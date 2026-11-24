import "dotenv/config";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";
import { insertHandoverFlashcards, prepareHandoverFlashcards } from "../src/services/handoverFlashcards.js";

const directory = process.argv[2];
const mode = process.argv[3];
if (!directory || !["--dry-run", "--apply"].includes(mode) || process.argv.length !== 4)
  throw new Error("Usage: node --import tsx scripts/import-handover-flashcards.ts <03-content directory> --dry-run|--apply");

const chapters = JSON.parse(await readFile(join(directory, "chapters.json"), "utf8")) as unknown;
const cards = JSON.parse(await readFile(join(directory, "flashcards", "all-flashcards.json"), "utf8")) as unknown;
const decks = prepareHandoverFlashcards(chapters, cards);
const totalCards = decks.reduce((sum, deck) => sum + deck.cards.length, 0);
console.log(`Validated ${totalCards} flashcards in ${decks.length} chapter decks.`);
if (mode === "--apply") {
  if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL before importing.");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await insertHandoverFlashcards(client, decks);
    await client.query("COMMIT");
    console.log(`Imported ${result.insertedCards} flashcards and ${result.insertedDecks} decks. Existing matching records were retained.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}
