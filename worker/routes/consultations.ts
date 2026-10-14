import { type Context, Hono } from "hono";
import { z } from "zod";
import type { ConsultationView, ErrorCode } from "../../shared/api";
import { philosopherById } from "../../shared/philosophers";
import { ANSWER_COUNT, BODY_MAX, MORE_COUNT, MY_ANSWER_MAX, NAME_MAX } from "../../shared/site";
import { type Loaded, deleteConsultation, loadConsultation, parseList, releaseMore, settleStale, takeMore } from "../db/consultations";
import { addHeart, heartCounts } from "../db/hearts";
import { indexShared, unindexShared } from "../db/shared";
import type { AppEnv } from "../env";
import { readBody } from "../http";
import { networkHash } from "../ipHash";
import { limitConsult } from "../limits";
import { ownerOf } from "../owner";
import { streamAnswers } from "./consult";

export const consultations = new Hono<AppEnv>();

/** ほかの哲学者に聞けるのは3回まで（7人＋2人×3） */
const MAX_ANSWERS = ANSWER_COUNT + MORE_COUNT * 3;
/** 相談者の「刺さった」でぬぬはらを選ぶときの id */
const NUNU_PICK = "nunu";

const notFound = (c: Context<AppEnv>) => c.json({ error: "not_found" satisfies ErrorCode }, 404);
const badRequest = (c: Context<AppEnv>) => c.json({ error: "bad_request" satisfies ErrorCode }, 400);

const isPublic = (l: Loaded) => l.row.shared_at !== null && l.row.hidden_at === null;

/** 「刺さった」に選べる id。答えた哲学者と、ぬぬはらの欄があるときだけぬぬはら */
const pickable = (l: Loaded) => new Set([...l.answers.map((a) => a.philosopher), ...(l.nunu ? [NUNU_PICK] : [])]);

function toView(l: Loaded, isOwner: boolean, hearts: Record<string, number>): ConsultationView {
	const r = l.row;
	return {
		id: r.id,
		mode: r.mode,
		body: r.body,
		category: r.category,
		tags: parseList(r.tags),
		crisis: r.crisis === 1,
		createdAt: r.created_at,
		sharedAt: r.shared_at,
		displayName: r.display_name,
		myAnswer: r.my_answer,
		myPicks: parseList(r.my_picks),
		answers: l.answers,
		nunu: l.nunu,
		hearts,
		isOwner,
		status: r.status,
	};
}

/** 相談と、見ている人が持ち主か。持ち主でなければ共有中で隠されていないものだけ（それ以外は null = 404） */
async function visible(c: Context<AppEnv>, id: string): Promise<{ loaded: Loaded; isOwner: boolean } | null> {
	const found = await loadConsultation(c.env.DB, id);
	const loaded = found && (await settleStale(c.env.DB, found, Date.now()));
	if (!loaded) return null;
	const owner = await ownerOf(c);
	const isOwner = owner?.id === loaded.row.owner_id;
	if (!isOwner && !isPublic(loaded)) return null;
	return { loaded, isOwner };
}

/** 持ち主の相談だけ。ほかの人には、あることも知らせない（404） */
async function owned(c: Context<AppEnv>, id: string): Promise<Loaded | null> {
	const v = await visible(c, id);
	return v?.isOwner ? v.loaded : null;
}

consultations.get("/:id", async (c) => {
	const v = await visible(c, c.req.param("id"));
	if (!v) return notFound(c);
	return c.json(toView(v.loaded, v.isOwner, await heartCounts(c.env.DB, v.loaded.row.id)));
});

const patchSchema = z.object({
	myAnswer: z.string().max(MY_ANSWER_MAX).nullable().optional(),
	myPicks: z.array(z.string()).max(MAX_ANSWERS + 1).optional(),
	displayName: z.string().max(NAME_MAX).nullable().optional(),
	body: z.string().max(BODY_MAX).optional(),
});

consultations.patch("/:id", async (c) => {
	const loaded = await owned(c, c.req.param("id"));
	if (!loaded) return notFound(c);
	const input = await readBody(c, patchSchema);
	if (!input) return badRequest(c);
	const sets: string[] = [];
	const values: (string | null)[] = [];
	if (input.body !== undefined) {
		// 共有したあとは本文を変えない（見た人が刺さったを押した相談が、あとから別の話にならないように）
		const body = input.body.trim();
		if (loaded.row.shared_at !== null || !body) return badRequest(c);
		sets.push("body = ?");
		values.push(body);
	}
	if (input.myAnswer !== undefined) {
		sets.push("my_answer = ?");
		values.push(input.myAnswer?.trim() || null);
	}
	if (input.displayName !== undefined) {
		sets.push("display_name = ?");
		values.push(input.displayName?.trim() || null);
	}
	if (input.myPicks !== undefined) {
		const choices = pickable(loaded);
		if (!input.myPicks.every((p) => choices.has(p))) return badRequest(c);
		sets.push("my_picks = ?");
		values.push(JSON.stringify([...new Set(input.myPicks)]));
	}
	if (sets.length === 0) return c.json({ ok: true });
	await c.env.DB.prepare(`UPDATE consultations SET ${sets.join(", ")} WHERE id = ?`)
		.bind(...values, loaded.row.id)
		.run();
	if (isPublic(loaded)) await indexShared(c.env.DB, loaded.row.id);
	return c.json({ ok: true });
});

consultations.put("/:id/share", async (c) => {
	const loaded = await owned(c, c.req.param("id"));
	if (!loaded) return notFound(c);
	if (loaded.row.status === "pending" || loaded.answers.length === 0) return badRequest(c);
	await c.env.DB.prepare("UPDATE consultations SET shared_at = COALESCE(shared_at, ?) WHERE id = ?").bind(Date.now(), loaded.row.id).run();
	await indexShared(c.env.DB, loaded.row.id);
	return c.json({ ok: true });
});

consultations.delete("/:id/share", async (c) => {
	const loaded = await owned(c, c.req.param("id"));
	if (!loaded) return notFound(c);
	await c.env.DB.prepare("UPDATE consultations SET shared_at = NULL WHERE id = ?").bind(loaded.row.id).run();
	await unindexShared(c.env.DB, loaded.row.id);
	return c.json({ ok: true });
});

consultations.delete("/:id", async (c) => {
	const loaded = await owned(c, c.req.param("id"));
	if (!loaded) return notFound(c);
	await deleteConsultation(c.env.DB, loaded.row.id);
	return c.json({ ok: true });
});

const heartSchema = z.object({ philosopherId: z.string() });

consultations.post("/:id/hearts", async (c) => {
	const loaded = await loadConsultation(c.env.DB, c.req.param("id"));
	if (!loaded || !isPublic(loaded)) return notFound(c);
	const input = await readBody(c, heartSchema);
	if (!input || !pickable(loaded).has(input.philosopherId)) return badRequest(c);
	const voter = await networkHash(c.env.REPORTER_KEY, c.req.header("cf-connecting-ip") ?? "local", `heart:${loaded.row.id}`);
	return c.json({ count: await addHeart(c.env.DB, loaded.row.id, input.philosopherId, voter, Date.now()) });
});

consultations.post("/:id/more", async (c) => {
	const loaded = await owned(c, c.req.param("id"));
	if (!loaded) return notFound(c);
	const exclude = loaded.answers.map((a) => a.philosopher).filter((id) => philosopherById(id));
	if (loaded.row.status === "pending" || exclude.length === 0 || exclude.length >= MAX_ANSWERS) return badRequest(c);
	const limited = await limitConsult(c);
	if (limited) return limited;
	// 同時に2回押されても1回だけ通す（slot が重なって、人数の上限を超えないように）。印は書き終えたら外す
	const startedAt = Date.now();
	if (!(await takeMore(c.env.DB, loaded.row.id, loaded.answers.length, startedAt))) return c.json({ error: "busy" satisfies ErrorCode }, 409);
	return streamAnswers(c, {
		id: loaded.row.id,
		body: loaded.row.body,
		mode: loaded.row.mode,
		count: MORE_COUNT,
		exclude,
		related: [],
		nunuExamples: [],
		onEnd: () => releaseMore(c.env.DB, loaded.row.id, startedAt),
	});
});
