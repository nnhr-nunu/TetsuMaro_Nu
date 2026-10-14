import { Hono } from "hono";
import { STALE_PENDING_MS, loadConsultation, settleStale } from "../db/consultations";
import type { AppEnv } from "../env";
import { ownerOf } from "../owner";

export const me = new Hono<AppEnv>();

/** 一覧に出す相談の先頭の長さ */
const EXCERPT = 60;

type Row = { id: string; excerpt: string; created_at: number; shared_at: number | null; status: string };

/** この端末の相談（新しい順、100件まで）。Cookie が無ければ空。書いている途中のものも出す（時間がたったものは確定させてから） */
me.get("/consultations", async (c) => {
	const owner = await ownerOf(c);
	if (!owner) return c.json([]);
	const select = () =>
		c.env.DB.prepare("SELECT id, substr(body, 1, ?) AS excerpt, created_at, shared_at, status FROM consultations WHERE owner_id = ? ORDER BY created_at DESC LIMIT 100")
			.bind(EXCERPT, owner.id)
			.all<Row>();
	let { results } = await select();
	const now = Date.now();
	const stale = results.filter((r) => r.status === "pending" && now - r.created_at >= STALE_PENDING_MS);
	if (stale.length > 0) {
		for (const r of stale) {
			const loaded = await loadConsultation(c.env.DB, r.id);
			if (loaded) await settleStale(c.env.DB, loaded, now);
		}
		({ results } = await select());
	}
	return c.json(results.map((r) => ({ id: r.id, excerpt: r.excerpt, createdAt: r.created_at, sharedAt: r.shared_at, status: r.status })));
});
