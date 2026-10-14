import { Hono } from "hono";
import { z } from "zod";
import { isCategory, normalizeTags } from "../../shared/themes";
import { loadConsultation } from "../db/consultations";
import { hideConsultation } from "../db/reports";
import { indexShared } from "../db/shared";
import type { AppEnv } from "../env";
import { readBody } from "../http";
import { sameSecret } from "../secret";

export const admin = new Hono<AppEnv>();

/** 合言葉（Authorization: Bearer <ADMIN_TOKEN>）。合言葉が入っていなければ、管理用の API は無いものとして 404。比べるときは時間で探られないようにする */
admin.use("*", async (c, next) => {
	const token = c.env.ADMIN_TOKEN;
	if (!token) return c.json({ error: "not_found" }, 404);
	if (!(await sameSecret(c.req.header("authorization") ?? "", `Bearer ${token}`))) return c.json({ error: "unauthorized" }, 401);
	await next();
});

/** 通報された相談（通報の多い順）。理由は新しいものから5つ */
admin.get("/reports", async (c) => {
	const { results } = await c.env.DB.prepare(
		`SELECT r.consultation_id, COUNT(*) AS count, MAX(r.created_at) AS last_at, substr(c.body, 1, 120) AS excerpt, c.hidden_at,
			(SELECT json_group_array(reason) FROM (SELECT reason FROM reports WHERE consultation_id = r.consultation_id ORDER BY created_at DESC LIMIT 5)) AS reasons
		FROM reports r JOIN consultations c ON c.id = r.consultation_id
		GROUP BY r.consultation_id ORDER BY count DESC, last_at DESC LIMIT 100`,
	).all<{ consultation_id: string; count: number; last_at: number; excerpt: string; hidden_at: number | null; reasons: string }>();
	return c.json(
		results.map((r) => ({
			consultationId: r.consultation_id,
			count: r.count,
			lastAt: r.last_at,
			excerpt: r.excerpt,
			hidden: r.hidden_at !== null,
			reasons: JSON.parse(r.reasons) as string[],
		})),
	);
});

admin.post("/consultations/:id/hide", async (c) => {
	const loaded = await loadConsultation(c.env.DB, c.req.param("id"));
	if (!loaded) return c.json({ error: "not_found" }, 404);
	await hideConsultation(c.env.DB, loaded.row.id, Date.now());
	return c.json({ ok: true });
});

/** 戻す。通報も消す（戻したあと、残っていた通報だけで、また自動で隠れないように） */
admin.post("/consultations/:id/unhide", async (c) => {
	const loaded = await loadConsultation(c.env.DB, c.req.param("id"));
	if (!loaded) return c.json({ error: "not_found" }, 404);
	await c.env.DB.batch([
		c.env.DB.prepare("UPDATE consultations SET hidden_at = NULL WHERE id = ?").bind(loaded.row.id),
		c.env.DB.prepare("DELETE FROM reports WHERE consultation_id = ?").bind(loaded.row.id),
	]);
	await indexShared(c.env.DB, loaded.row.id);
	return c.json({ ok: true });
});

const themeSchema = z.object({ category: z.string(), tags: z.array(z.string()) });

admin.patch("/consultations/:id/theme", async (c) => {
	const input = await readBody(c, themeSchema);
	if (!input || !isCategory(input.category)) return c.json({ error: "bad_request" }, 400);
	const result = await c.env.DB.prepare("UPDATE consultations SET category = ?, tags = ? WHERE id = ?")
		.bind(input.category, JSON.stringify(normalizeTags(input.tags)), c.req.param("id"))
		.run();
	if (!result.meta.changes) return c.json({ error: "not_found" }, 404);
	return c.json({ ok: true });
});
