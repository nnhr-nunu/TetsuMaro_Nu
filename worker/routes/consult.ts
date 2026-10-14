import { type Context, Hono } from "hono";
import { z } from "zod";
import { LineSplitter, type PickState, acceptAnswer, parseEvent } from "../../shared/answerStream";
import type { ConsultationStatus, ErrorCode, StreamEvent } from "../../shared/api";
import { looksCrisis } from "../../shared/crisis";
import { relatedNunu } from "../../shared/nunu";
import { buildConsultPrompt } from "../../shared/prompt";
import { AGE_BANDS, ANSWER_COUNT, BODY_MAX, DAILY_PER_OWNER, GENDERS, type Mode } from "../../shared/site";
import { aiStream } from "../ai";
import { applyMeta, countToday, deleteConsultation, finishConsultation, insertAnswer, insertConsultation, saveNunu } from "../db/consultations";
import { countAiCall } from "../db/usage";
import type { AppEnv } from "../env";
import { GeminiError } from "../gemini/client";
import { readBody } from "../http";
import { newId } from "../ids";
import { ensureOwner } from "../owner";

export const consult = new Hono<AppEnv>();

const bodySchema = z.object({
	body: z.string(),
	ageBand: z.enum(AGE_BANDS.map((a) => a.id) as [string, ...string[]]).optional(),
	gender: z.enum(GENDERS.map((g) => g.id) as [string, ...string[]]).optional(),
	turnstile: z.string().optional(),
});

/** 今は一般向けだけ。大人向けを開くときは、アドレス（seiheki.net の下）から決める */
export const modeOf = (_c: Context<AppEnv>): Mode => "general";

consult.post("/", async (c) => {
	const input = await readBody(c, bodySchema);
	if (!input) return c.json({ error: "bad_request" satisfies ErrorCode }, 400);
	const text = input.body.trim();
	if (!text) return c.json({ error: "empty" satisfies ErrorCode }, 400);
	if (text.length > BODY_MAX) return c.json({ error: "too_long" satisfies ErrorCode }, 400);

	const owner = await ensureOwner(c);
	const now = Date.now();
	if ((await countToday(c.env.DB, owner.id, now)) >= DAILY_PER_OWNER) return c.json({ error: "daily_owner_limit" satisfies ErrorCode }, 429);

	const id = newId();
	const mode = modeOf(c);
	await insertConsultation(c.env.DB, {
		id,
		ownerId: owner.id,
		mode,
		body: text,
		crisis: looksCrisis(text),
		ageBand: input.ageBand as (typeof AGE_BANDS)[number]["id"] | undefined,
		gender: input.gender as (typeof GENDERS)[number]["id"] | undefined,
		now,
	});
	const related = relatedNunu(text, mode, 3);
	return streamAnswers(c, { id, body: text, mode, count: ANSWER_COUNT, exclude: [], related: related.map((r) => r.id), nunuExamples: related });
});

/**
 * AI の答えを1行ずつ確かめて、届いた順に画面へ流しながら D1 に保存する。
 * 画面が途中で閉じられても（書き込みが失敗しても）最後まで読んで保存する（waitUntil）。1人も答えられなかった最初の相談は消す
 */
export function streamAnswers(
	c: Context<AppEnv>,
	opts: {
		id: string;
		body: string;
		mode: Mode;
		count: number;
		/** もう答えた人（ほかの哲学者にも聞くとき）。空なら最初の相談 */
		exclude: string[];
		related: string[];
		nunuExamples: Parameters<typeof buildConsultPrompt>[0]["nunuExamples"];
	},
): Response {
	const first = opts.exclude.length === 0;
	const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
	const writer = writable.getWriter();
	const encoder = new TextEncoder();
	const send = (ev: StreamEvent) => {
		writer.write(encoder.encode(`${JSON.stringify(ev)}\n`)).catch(() => {
			// 画面が閉じられた。保存は続ける
		});
	};
	const db = c.env.DB;
	const env = c.env;

	const work = (async () => {
		send({ type: "start", id: opts.id });
		const prompt = buildConsultPrompt({ body: opts.body, mode: opts.mode, nunuExamples: opts.nunuExamples, count: opts.count, exclude: opts.exclude });
		const run = aiStream(env, prompt, { count: opts.count, exclude: opts.exclude, mode: opts.mode, body: opts.body });
		const state: PickState = { answered: [], count: opts.count, exclude: opts.exclude };
		let slot = opts.exclude.length;
		let gotMeta = false;
		let gotNunu = false;
		let error: ErrorCode | null = null;

		const handle = async (line: string) => {
			const ev = parseEvent(line);
			if (!ev) return;
			if (ev.type === "meta" && first && !gotMeta) {
				gotMeta = true;
				const meta = { ...ev, crisis: ev.crisis || looksCrisis(opts.body) };
				await applyMeta(db, opts.id, meta);
				send(meta);
			} else if (ev.type === "answer" && acceptAnswer(state, ev)) {
				state.answered.push(ev.philosopher);
				await insertAnswer(db, opts.id, slot++, ev);
				send(ev);
			} else if (ev.type === "nunu" && first && !gotNunu) {
				gotNunu = true;
				const nunu = { ...ev, related: opts.related };
				await saveNunu(db, opts.id, nunu);
				send(nunu);
			}
		};

		try {
			const splitter = new LineSplitter();
			for await (const chunk of run.text) for (const line of splitter.push(chunk)) await handle(line);
			for (const line of splitter.flush()) await handle(line);
		} catch (err) {
			error = err instanceof GeminiError && err.kind === "daily_limit" ? "ai_daily_limit" : "ai_failed";
			console.error("回答を作れませんでした", err);
		}

		// AI がぬぬはらの回答を書かなかったときも、関連するマシュマロ回答は出す
		if (first && !gotNunu && state.answered.length > 0 && opts.related.length > 0) {
			const nunu = { type: "nunu" as const, body: "", related: opts.related };
			await saveNunu(db, opts.id, nunu);
			send(nunu);
		}

		const model = run.model();
		if (model && model !== "fake") await countAiCall(db, Date.now(), state.answered.length === 0).catch(() => {});

		if (state.answered.length === 0) {
			if (first) await deleteConsultation(db, opts.id);
			send({ type: "error", code: error ?? "ai_failed" });
		} else {
			const status: ConsultationStatus = state.answered.length >= opts.count ? "done" : "partial";
			if (first) await finishConsultation(db, opts.id, status, model);
			send({ type: "done", status });
		}
		await writer.close().catch(() => {});
	})().catch(async (err) => {
		console.error("相談の保存に失敗しました", err);
		send({ type: "error", code: "ai_failed" });
		await writer.close().catch(() => {});
	});

	try {
		c.executionCtx.waitUntil(work);
	} catch {
		// executionCtx が無い（テストで ctx を渡していない）。work はそのまま進む
	}

	// c.body で返す（ensureOwner が付けた Cookie をこの応答に載せるため）
	return c.body(readable, 200, {
		"Content-Type": "application/x-ndjson; charset=utf-8",
		"Cache-Control": "no-store",
		"X-Content-Type-Options": "nosniff",
	});
}
