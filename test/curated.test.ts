import { env } from "cloudflare:workers";
import { beforeAll, expect, it } from "vitest";
import type { ConsultationView, SharedItem } from "../shared/api";
import { CURATED_OWNER } from "../shared/site";
import { indexShared } from "../worker/db/shared";
import app from "../worker/index";

// 運営が用意した見本の相談（scripts/curated/）。持ち主は CURATED_OWNER で、だれの端末でもない
beforeAll(async () => {
	const t = 4_100_000_000_000;
	await env.DB.prepare(
		"INSERT INTO consultations (id, owner_id, body, category, tags, created_at, shared_at, model, status) VALUES (?, ?, ?, 'self', '[]', ?, ?, 'claude', 'done')",
	)
		.bind("curated1", CURATED_OWNER, "見本の相談です", t, t)
		.run();
	await indexShared(env.DB, "curated1");
});

it("見本の相談は、相談のページでも一覧でも curated が true になり、だれも持ち主にならない", async () => {
	const view = (await (await app.request("/api/consultations/curated1", {}, env)).json()) as ConsultationView;
	expect(view.curated).toBe(true);
	expect(view.isOwner).toBe(false);
	const list = (await (await app.request("/api/shared?q=見本の相談", {}, env)).json()) as { items: SharedItem[] };
	expect(list.items.find((i) => i.id === "curated1")?.curated).toBe(true);
});
