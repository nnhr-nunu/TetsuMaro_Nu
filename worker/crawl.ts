import { Hono } from "hono";
import { ROSTER_IDS } from "../shared/philosophers";
import { CATEGORIES } from "../shared/themes";
import type { AppEnv } from "./env";

/** 検索エンジン向けの robots.txt と sitemap.xml。URL は受けたリクエストの origin から作る（独自ドメインと workers.dev のどちらでも） */
export const crawl = new Hono<AppEnv>();

/** sitemap に入れる共有された相談の数（新しい順） */
const SITEMAP_CONSULTATIONS = 1000;

crawl.get("/robots.txt", (c) => {
	const origin = new URL(c.req.url).origin;
	return c.text(["User-agent: *", "Disallow: /api/", "Disallow: /me", "Disallow: /admin", "", `Sitemap: ${origin}/sitemap.xml`, ""].join("\n"));
});

crawl.get("/sitemap.xml", async (c) => {
	const origin = new URL(c.req.url).origin;
	const { results } = await c.env.DB.prepare(
		"SELECT id, shared_at FROM consultations WHERE shared_at IS NOT NULL AND hidden_at IS NULL AND mode = 'general' ORDER BY shared_at DESC LIMIT ?",
	)
		.bind(SITEMAP_CONSULTATIONS)
		.all<{ id: string; shared_at: number }>();
	const urls = [
		{ loc: "/" },
		{ loc: "/search" },
		{ loc: "/philosophers" },
		...ROSTER_IDS.map((id) => ({ loc: `/philosophers/${id}` })),
		...CATEGORIES.map((cat) => ({ loc: `/theme/${cat.id}` })),
		{ loc: "/terms" },
		{ loc: "/privacy" },
		...results.map((r) => ({ loc: `/c/${r.id}`, lastmod: new Date(r.shared_at).toISOString().slice(0, 10) })),
	];
	const body = urls.map((u) => `<url><loc>${origin}${u.loc}</loc>${"lastmod" in u ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`).join("");
	return c.body(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`, 200, {
		"Content-Type": "application/xml; charset=utf-8",
	});
});
