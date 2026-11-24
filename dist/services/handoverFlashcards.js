import { z } from "zod";
import { deckSchema } from "../models/learningProducts.js";
import { handoverId } from "./handoverId.js";
const chapterSchema = z.object({
    code: z.string().min(1),
    title: z.string().min(1),
});
const cardSchema = z.object({
    card_id: z.string().min(1),
    chapter_code: z.string().min(1),
    front: z.string(),
    back: z.string(),
});
export function prepareHandoverFlashcards(chapterData, cardData) {
    const chapters = z.array(chapterSchema).min(1).parse(chapterData);
    const cards = z.array(cardSchema).min(1).parse(cardData);
    const codes = new Set(chapters.map((chapter) => chapter.code));
    if (codes.size !== chapters.length)
        throw new Error("Handover chapter codes must be unique.");
    const cardIds = new Set();
    const byChapter = new Map();
    for (const card of cards) {
        if (!codes.has(card.chapter_code))
            throw new Error(`Unknown chapter code for card ${card.card_id}: ${card.chapter_code}`);
        if (cardIds.has(card.card_id))
            throw new Error(`Duplicate handover flashcard ID: ${card.card_id}`);
        cardIds.add(card.card_id);
        const list = byChapter.get(card.chapter_code) ?? [];
        list.push({ id: handoverId(`card:${card.card_id}`), front: card.front, back: card.back });
        byChapter.set(card.chapter_code, list);
    }
    return chapters.filter((chapter) => byChapter.has(chapter.code)).map((chapter) => deckSchema.parse({
        id: handoverId(`deck:${chapter.code}`),
        title: chapter.title,
        description: `Shared flashcards for ${chapter.title}.`,
        published: true,
        cards: byChapter.get(chapter.code),
    }));
}
export async function insertHandoverFlashcards(client, decks) {
    let insertedDecks = 0;
    let insertedCards = 0;
    for (const deck of decks) {
        const existing = await client.query("SELECT title, description, published FROM shared_flashcard_decks WHERE id=$1", [deck.id]);
        if (existing.rows[0]) {
            const current = existing.rows[0];
            if (current.title !== deck.title || current.description !== deck.description || current.published !== deck.published)
                throw new Error(`Existing deck ${deck.id} differs from the handover; no changes were made.`);
        }
        else {
            await client.query("INSERT INTO shared_flashcard_decks (id,title,description,published) VALUES ($1,$2,$3,$4)", [deck.id, deck.title, deck.description, deck.published]);
            insertedDecks++;
        }
        for (let offset = 0; offset < deck.cards.length; offset += 100) {
            const batch = deck.cards.slice(offset, offset + 100);
            const found = await client.query(`SELECT id, deck_id, front, back FROM shared_flashcards WHERE id IN (${batch.map((_, i) => `$${i + 1}`).join(",")})`, batch.map((card) => card.id));
            const existingCards = new Map(found.rows.map((card) => [card.id, card]));
            const newCards = batch.filter((card) => {
                const current = existingCards.get(card.id);
                if (!current)
                    return true;
                if (current.deck_id !== deck.id || current.front !== card.front || current.back !== card.back)
                    throw new Error(`Existing flashcard ${card.id} differs from the handover; no changes were made.`);
                return false;
            });
            if (!newCards.length)
                continue;
            const values = [];
            const rows = newCards.map((card) => {
                values.push(card.id, deck.id, card.front, card.back);
                const n = values.length;
                return `($${n - 3},$${n - 2},$${n - 1},$${n})`;
            });
            await client.query(`INSERT INTO shared_flashcards (id,deck_id,front,back) VALUES ${rows.join(",")}`, values);
            insertedCards += newCards.length;
        }
    }
    return { insertedDecks, insertedCards };
}
