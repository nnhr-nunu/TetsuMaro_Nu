import { Hono } from "hono";
import type { AppEnv } from "../env";
import { ownerOf } from "../owner";

export const me = new Hono<AppEnv>();

/** 一覧に出す相談の先頭の長さ */
const EXCERPT = 60;

/** この端末の相談（新しい順、100件まで）。Cookie が無ければ空 */
me.get("/consultations", async (c) => {
	const owner = await ownerOf(c);
	if (!owner) return c.json([]);
	const { results } = await c.env.DB.prepare(
		"SELECT id, substr(body, 1, ?) AS excerpt, created_at, shared_at, status FROM consultations WHERE owner_id = ? AND status != 'pending' ORDER BY created_at DESC LIMIT 100",
	)
		.bind(EXCERPT, owner.id)
		.all<{ id: string; excerpt: string; created_at: number; shared_at: number | null; status: string }>();
	return c.json(results.map((r) => ({ id: r.id, excerpt: r.excerpt, createdAt: r.created_at, sharedAt: r.shared_at, status: r.status })));
});
