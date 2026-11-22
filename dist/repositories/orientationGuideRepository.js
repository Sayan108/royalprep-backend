import { randomUUID } from 'node:crypto';
export class OrientationGuideConflict extends Error {
}
export class OrientationGuideNotFound extends Error {
}
export function createOrientationGuideRepository(pool) {
    async function state(client, lock = false) {
        const result = await client.query(`SELECT current_revision AS "currentRevision", draft_revision AS "draftRevision",
        published_revision AS "publishedRevision"
       FROM orientation_guide_state WHERE singleton=true${lock ? ' FOR UPDATE' : ''}`);
        if (!result.rows[0])
            throw Error('Orientation guide state is missing; check PostgreSQL migrations.');
        return result.rows[0];
    }
    async function revision(client, number) {
        const result = await client.query('SELECT revision, content, created_at AS "createdAt" FROM orientation_guide_revisions WHERE revision=$1', [number]);
        return result.rows[0];
    }
    async function transact(operation) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const current = await state(client, true);
            const result = await operation(client, current);
            await client.query('COMMIT');
            return result;
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    function check(current, expected) {
        if (current.currentRevision !== expected)
            throw new OrientationGuideConflict('Orientation guide changed; reload before saving.');
    }
    async function audit(client, action, revisionNumber, sourceRevision = null) {
        await client.query('INSERT INTO orientation_guide_audit_events (id, action, revision, source_revision, actor) VALUES ($1, $2, $3, $4, $5)', [randomUUID(), action, revisionNumber, sourceRevision, 'shared-admin']);
    }
    return {
        async publicGuide() {
            const current = await state(pool);
            return current.publishedRevision === null ? undefined : revision(pool, current.publishedRevision);
        },
        async adminGuide() {
            const current = await state(pool);
            const draft = current.draftRevision === null ? null : await revision(pool, current.draftRevision);
            const history = await pool.query(`SELECT r.revision, r.content, r.created_at AS "createdAt"
         FROM orientation_guide_revisions r
         JOIN (SELECT DISTINCT revision FROM orientation_guide_audit_events
               WHERE action IN ('publish', 'restore')) a ON a.revision=r.revision
         ORDER BY r.revision DESC`);
            return { ...current, draft, history: history.rows };
        },
        async saveDraft(expected, content) {
            return transact(async (client, current) => {
                check(current, expected);
                const next = current.currentRevision + 1;
                await client.query('INSERT INTO orientation_guide_revisions (revision, content) VALUES ($1, $2::jsonb)', [next, JSON.stringify(content)]);
                await client.query('UPDATE orientation_guide_state SET current_revision=$1, draft_revision=$1 WHERE singleton=true', [next]);
                await audit(client, 'draft', next);
                return next;
            });
        },
        async publish(expected) {
            return transact(async (client, current) => {
                check(current, expected);
                if (current.draftRevision === null)
                    throw new OrientationGuideNotFound('Save an orientation guide draft before publishing.');
                if (current.publishedRevision !== current.draftRevision) {
                    await client.query('UPDATE orientation_guide_state SET published_revision=$1 WHERE singleton=true', [current.draftRevision]);
                    await audit(client, 'publish', current.draftRevision);
                }
                return current.draftRevision;
            });
        },
        async restore(expected, sourceRevision) {
            return transact(async (client, current) => {
                check(current, expected);
                const published = await client.query(`SELECT 1 FROM orientation_guide_audit_events
           WHERE revision=$1 AND action IN ('publish', 'restore') LIMIT 1`, [sourceRevision]);
                const source = published.rowCount ? await revision(client, sourceRevision) : undefined;
                if (!source)
                    throw new OrientationGuideNotFound('Published orientation guide revision not found.');
                const next = current.currentRevision + 1;
                await client.query('INSERT INTO orientation_guide_revisions (revision, content) VALUES ($1, $2::jsonb)', [next, JSON.stringify(source.content)]);
                await client.query(`UPDATE orientation_guide_state
           SET current_revision=$1, draft_revision=$1, published_revision=$1 WHERE singleton=true`, [next]);
                await audit(client, 'restore', next, sourceRevision);
                return next;
            });
        },
    };
}
