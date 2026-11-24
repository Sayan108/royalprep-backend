import { randomUUID } from "node:crypto";
export function createNotificationController(pool) {
    const list = async (_req, res) => {
        const result = await pool.query('SELECT id, title, body, created_at AS "createdAt" FROM notifications ORDER BY created_at DESC LIMIT 50');
        res.json(result.rows);
    };
    const create = async (req, res) => {
        const { title, body } = req.body ?? {};
        if (typeof title !== "string" ||
            !title.trim() ||
            typeof body !== "string" ||
            !body.trim()) {
            res.status(422).json({ error: "Title and body are required." });
            return;
        }
        const notification = {
            id: randomUUID(),
            title: title.trim(),
            body: body.trim(),
        };
        await pool.query("INSERT INTO notifications (id,title,body) VALUES ($1,$2,$3)", [notification.id, notification.title, notification.body]);
        res.status(201).json(notification);
    };
    return { list, create };
}
