import { createHash } from "node:crypto";
import { Script } from "node:vm";
import { z } from "zod";
const chapterSchema = z.object({ code: z.string().min(1), title: z.string().min(1) });
const questionSchema = z.object({
    id: z.string().min(1),
    chapter: z.string().min(1),
    source: z.enum(["recall", "fawzia"]),
    sitting: z.string(),
    stem: z.string().min(1),
    options: z.array(z.string().min(1)).length(5),
    correct: z.number().int().min(0).max(4),
    explanation: z.string(),
    topic: z.string(),
    number: z.number().int(),
    why: z.array(z.string()).length(5),
    pearl: z.string(),
    trick: z.string(),
    keyCheck: z.string(),
    alsoIn: z.array(z.string()),
}).passthrough();
const catalogSchema = z.object({
    sittings: z.array(z.object({ key: z.string(), name: z.string(), n: z.number(), expected: z.number(), held: z.boolean() }).passthrough()),
    items: z.array(questionSchema).min(1),
}).strict();
function scriptTag(pack) {
    const tags = [...pack.html.matchAll(/<script\b([^>]*)>\s*<\/script\s*>/gi)];
    const openingCount = [...pack.html.matchAll(/<script\b/gi)].length;
    const expected = /^\s+src\s*=\s*["']([^"']+)["']\s*$/i.exec(tags[0]?.[1] ?? "");
    if (tags.length !== 1 || openingCount !== 1 || expected?.[1] !== pack.scriptFilename ||
        /<\/script/i.test(pack.script) || /[\r\0]/.test(pack.script) ||
        /<\s*(iframe|object|embed|form|base)\b/i.test(pack.html) ||
        /<\s*meta\b[^>]*http-equiv\s*=\s*["']?\s*refresh/i.test(pack.html)) {
        throw new Error(`Unsafe or unexpected revision pack HTML: ${pack.chapterCode}`);
    }
    return tags[0][0];
}
export function renderRevisionPack(pack) {
    const tag = scriptTag(pack);
    const hash = createHash("sha256").update(pack.script).digest("base64");
    const policy = `default-src 'none'; script-src 'sha256-${hash}'; img-src data:; style-src 'unsafe-inline'; font-src data:; base-uri 'none'; form-action 'none'`;
    return `<meta http-equiv="Content-Security-Policy" content="${policy}">` +
        pack.html.replace(tag, `<script>${pack.script}</script>`);
}
export function prepareHandoverLearning(chapterData, recallData, packs) {
    const chapters = z.array(chapterSchema).min(1).parse(chapterData);
    const catalog = catalogSchema.parse(recallData);
    const titles = new Map(chapters.map((chapter) => [chapter.code, chapter.title]));
    if (titles.size !== chapters.length)
        throw new Error("Duplicate chapter code.");
    if (packs.length !== chapters.length || new Set(packs.map((pack) => pack.chapterCode)).size !== chapters.length)
        throw new Error("Expected one revision pack per chapter.");
    for (const pack of packs) {
        if (titles.get(pack.chapterCode) !== pack.title)
            throw new Error(`Unknown revision pack chapter: ${pack.chapterCode}`);
        scriptTag(pack);
        new Script(pack.script, { filename: pack.scriptFilename });
    }
    const ids = new Set();
    const questions = catalog.items.map((item) => {
        if (ids.has(item.id))
            throw new Error(`Duplicate recall question ID: ${item.id}`);
        ids.add(item.id);
        const title = titles.get(item.chapter);
        if (!title)
            throw new Error(`Unknown recall chapter: ${item.chapter}`);
        return { item, title };
    });
    return { packs, sittings: catalog.sittings, questions };
}
function stableJson(value) {
    return JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item)
        ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
        : item);
}
export async function insertHandoverLearning(client, data) {
    let packsInserted = 0;
    for (const pack of data.packs) {
        const existing = await client.query("SELECT title,html_filename,html,script_filename,script FROM handover_revision_packs WHERE chapter_code=$1", [pack.chapterCode]);
        if (existing.rows.length) {
            const row = existing.rows[0];
            if (row.title !== pack.title || row.html_filename !== pack.htmlFilename || row.html !== pack.html ||
                row.script_filename !== pack.scriptFilename || row.script !== pack.script)
                throw new Error(`Existing revision pack differs: ${pack.chapterCode}`);
            continue;
        }
        await client.query("INSERT INTO handover_revision_packs (chapter_code,title,html_filename,html,script_filename,script) VALUES ($1,$2,$3,$4,$5,$6)", [pack.chapterCode, pack.title, pack.htmlFilename, pack.html, pack.scriptFilename, pack.script]);
        packsInserted++;
    }
    const catalog = await client.query("SELECT sittings FROM handover_recall_catalog WHERE singleton=true");
    if (catalog.rows.length) {
        if (stableJson(catalog.rows[0].sittings) !== stableJson(data.sittings))
            throw new Error("Existing recall sittings differ.");
    }
    else {
        await client.query("INSERT INTO handover_recall_catalog (singleton,sittings) VALUES (true,$1::jsonb)", [JSON.stringify(data.sittings)]);
    }
    let questionsInserted = 0;
    for (let offset = 0; offset < data.questions.length; offset += 100) {
        const batch = data.questions.slice(offset, offset + 100);
        const existing = await client.query(`SELECT id,chapter_code,chapter_title,source,sitting,content FROM handover_recall_questions WHERE id IN (${batch.map((_, i) => `$${i + 1}`).join(",")})`, batch.map(({ item }) => item.id));
        const byId = new Map(existing.rows.map((row) => [row.id, row]));
        const additions = batch.filter(({ item, title }) => {
            const row = byId.get(item.id);
            if (!row)
                return true;
            if (row.chapter_code !== item.chapter || row.chapter_title !== title || row.source !== item.source ||
                row.sitting !== item.sitting || stableJson(row.content) !== stableJson(item))
                throw new Error(`Existing recall question differs: ${item.id}`);
            return false;
        });
        if (!additions.length)
            continue;
        const values = [];
        const rows = additions.map(({ item, title }) => {
            const start = values.length;
            values.push(item.id, item.chapter, title, item.source, item.sitting, JSON.stringify(item));
            return `(${Array.from({ length: 6 }, (_, i) => `$${start + i + 1}${i === 5 ? "::jsonb" : ""}`).join(",")})`;
        });
        await client.query(`INSERT INTO handover_recall_questions (id,chapter_code,chapter_title,source,sitting,content) VALUES ${rows.join(",")}`, values);
        questionsInserted += additions.length;
    }
    return { packsInserted, questionsInserted };
}
