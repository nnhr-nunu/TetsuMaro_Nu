import { Hono } from "hono";
import type { ErrorCode } from "../../shared/api";
import { philosopherById } from "../../shared/philosophers";
import { isCategory, tagName } from "../../shared/themes";
import { loadConsultation, parseList } from "../db/consultations";
import { listShared, similarShared } from "../db/shared";
import type { AppEnv } from "../env";
import { modeOf } from "./consult";

export const shared = new Hono<AppEnv>();

/** 検索の言葉の長さの上限 */
const Q_MAX = 50;

shared.get("/", async (c) => {
	const category = c.req.query("category");
	const tag = c.req.query("tag");
	const philosopher = c.req.query("philosopher");
	return c.json(
		await listShared(c.env.DB, {
			mode: modeOf(c),
			q: c.req.query("q")?.slice(0, Q_MAX),
			category: isCategory(category) ? category : undefined,
			tag: tag && tagName(tag) ? tag : undefined,
			philosopher: philosopher && philosopherById(philosopher) ? philosopher : undefined,
			sort: c.req.query("sort") === "hearts" ? "hearts" : "new",
			cursor: c.req.query("cursor"),
		}),
	);
});

shared.get("/:id/similar", async (c) => {
	const loaded = await loadConsultation(c.env.DB, c.req.param("id"));
	if (!loaded || loaded.row.shared_at === null || loaded.row.hidden_at !== null) return c.json({ error: "not_found" satisfies ErrorCode }, 404);
	return c.json(
		await similarShared(c.env.DB, { id: loaded.row.id, mode: loaded.row.mode, category: loaded.row.category, tags: parseList(loaded.row.tags) }),
	);
});
