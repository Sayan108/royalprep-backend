export function createLearningProductsRepository(pool) {
    const mapResource = (row) => ({
        id: row.id,
        kind: row.kind,
        title: row.title,
        summary: row.summary,
        body: row.body,
        published: row.published,
    });
    return {
        async adminResources() {
            const result = await pool.query("SELECT id, kind, title, summary, body, published FROM learning_resources ORDER BY kind, title");
            return result.rows.map(mapResource);
        },
        async saveResource(resource) {
            await pool.query(`INSERT INTO learning_resources (id, kind, title, summary, body, published) VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (id) DO UPDATE SET kind=EXCLUDED.kind,title=EXCLUDED.title,summary=EXCLUDED.summary,body=EXCLUDED.body,published=EXCLUDED.published,updated_at=now()`, [
                resource.id,
                resource.kind,
                resource.title,
                resource.summary,
                resource.body,
                resource.published,
            ]);
            return resource;
        },
        async publicResources(kind) {
            const result = await pool.query("SELECT id, kind, title, summary, body, published FROM learning_resources WHERE published=true AND ($1::text IS NULL OR kind=$1) ORDER BY kind, title", [kind ?? null]);
            return result.rows.map(mapResource);
        },
        async saved(ownerEmail) {
            const result = await pool.query(`SELECT r.id, r.kind, r.title, r.summary, r.body, r.published
        FROM learning_resources r JOIN saved_learning_resources s ON s.resource_id=r.id WHERE s.owner_email=$1 ORDER BY s.created_at DESC`, [ownerEmail]);
            return result.rows.map(mapResource);
        },
        async saveToggle(ownerEmail, resourceId, saved) {
            if (saved)
                await pool.query("INSERT INTO saved_learning_resources (owner_email, resource_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [ownerEmail, resourceId]);
            else
                await pool.query("DELETE FROM saved_learning_resources WHERE owner_email=$1 AND resource_id=$2", [ownerEmail, resourceId]);
        },
        async decks(publishedOnly) {
            const decks = await pool.query("SELECT id, title, description, published FROM shared_flashcard_decks WHERE ($1=false OR published=true) ORDER BY title", [publishedOnly]);
            const cards = await pool.query("SELECT id, deck_id, front, back FROM shared_flashcards ORDER BY id");
            return decks.rows.map((deck) => ({
                ...deck,
                cards: cards.rows
                    .filter((card) => card.deck_id === deck.id)
                    .map(({ id, front, back }) => ({ id, front, back })),
            }));
        },
        async saveDeck(deck) {
            const client = await pool.connect();
            try {
                await client.query("BEGIN");
                await client.query(`INSERT INTO shared_flashcard_decks (id,title,description,published) VALUES ($1,$2,$3,$4)
        ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title,description=EXCLUDED.description,published=EXCLUDED.published,updated_at=now()`, [deck.id, deck.title, deck.description, deck.published]);
                await client.query("DELETE FROM shared_flashcards WHERE deck_id=$1", [
                    deck.id,
                ]);
                for (const card of deck.cards)
                    await client.query("INSERT INTO shared_flashcards (id,deck_id,front,back) VALUES ($1,$2,$3,$4)", [card.id, deck.id, card.front, card.back]);
                await client.query("COMMIT");
            }
            catch (error) {
                await client.query("ROLLBACK");
                throw error;
            }
            finally {
                client.release();
            }
        },
    };
}
