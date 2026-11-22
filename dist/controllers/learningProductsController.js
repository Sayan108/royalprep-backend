import { randomUUID } from 'node:crypto';
import { resourceInputSchema, resourceKindSchema, deckSchema } from '../models/learningProducts.js';
export function createLearningProductsController(repository) {
    const adminResources = async (_req, res) => res.json(await repository.adminResources());
    const saveResource = async (req, res) => {
        const parsed = resourceInputSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(422).json({ error: 'Provide valid learning resource content.' });
            return;
        }
        const resource = { id: typeof req.params.id === 'string' ? req.params.id : randomUUID(), ...parsed.data };
        res.json(await repository.saveResource(resource));
    };
    const publicResources = async (req, res) => {
        const kind = req.query.kind === undefined ? undefined : resourceKindSchema.safeParse(req.query.kind).data;
        if (req.query.kind !== undefined && !kind) {
            res.status(422).json({ error: 'Unknown resource type.' });
            return;
        }
        res.json(await repository.publicResources(kind));
    };
    const saved = async (req, res) => res.json(await repository.saved(res.locals.student.email));
    const toggleSaved = async (req, res) => {
        if (typeof req.body?.saved !== 'boolean') {
            res.status(422).json({ error: 'saved must be boolean.' });
            return;
        }
        if (typeof req.params.id !== 'string') {
            res.status(422).json({ error: 'Resource ID is required.' });
            return;
        }
        await repository.saveToggle(res.locals.student.email, req.params.id, req.body.saved);
        res.json({ saved: req.body.saved });
    };
    const decks = async (_req, res) => res.json(await repository.decks(true));
    const adminDecks = async (_req, res) => res.json(await repository.decks(false));
    const saveDeck = async (req, res) => {
        const parsed = deckSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(422).json({ error: 'Provide a valid shared flashcard deck.' });
            return;
        }
        await repository.saveDeck(parsed.data);
        res.json(parsed.data);
    };
    return { adminResources, saveResource, publicResources, saved, toggleSaved, decks, adminDecks, saveDeck };
}
