import { z } from "zod";
import type { AnswerEvent, MetaEvent, NunuEvent } from "./api";
import { type Philosopher, ROSTER_IDS, conceptById, philosopherById, quoteById } from "./philosophers";
import { ANSWER_COUNT, MIN_PHILOSOPHY } from "./site";
import { isCategory, normalizeTags } from "./themes";

/** 流れてきた文字を行に分ける。行の途中で切れて届いた分は、次の push までためておく */
export class LineSplitter {
	private rest = "";

	push(chunk: string): string[] {
		const parts = (this.rest + chunk).split("\n");
		this.rest = parts.pop() ?? "";
		return parts.map((l) => l.trim()).filter(Boolean);
	}

	flush(): string[] {
		const last = this.rest.trim();
		this.rest = "";
		return last ? [last] : [];
	}
}

/** 結論・本文・AIぬぬはらの長さの上限（指示は結論30字・本文400字・ぬぬはら400字。少しはみ出しても切らないよう余裕を持つ） */
const CONCLUSION_MAX = 40;
const BODY_MAX = 600;
const NUNU_MAX = 800;

const metaSchema = z.object({
	type: z.literal("meta"),
	category: z.unknown(),
	tags: z.unknown().optional(),
	crisis: z.boolean().optional(),
	picks: z.array(z.unknown()).optional(),
});
const answerSchema = z.object({
	type: z.literal("answer"),
	philosopher: z.string(),
	conclusion: z.string(),
	body: z.string(),
	concepts: z.array(z.unknown()).optional(),
	quote: z.unknown().optional(),
});
const nunuSchema = z.object({ type: z.literal("nunu"), body: z.string() });

/** 行の中の JSON の部分（最初の { から最後の } まで）。前置きや箇条書きの記号が付いていても読めるように */
function jsonPart(line: string): unknown {
	const start = line.indexOf("{");
	const end = line.lastIndexOf("}");
	if (start < 0 || end <= start) return null;
	try {
		return JSON.parse(line.slice(start, end + 1));
	} catch {
		return null;
	}
}

const ROSTER = new Set(ROSTER_IDS);

/**
 * AI の1行を読んで確かめる。読めない行・知らない種類・名簿にない人は null。
 * 概念と名言は本人のもので名簿にある id だけを残す（名言の本文は名簿から差し込むので、AI の書いた文は使わない）
 */
export function parseEvent(line: string): MetaEvent | AnswerEvent | Omit<NunuEvent, "related"> | null {
	const raw = jsonPart(line);
	const meta = metaSchema.safeParse(raw);
	if (meta.success) {
		const m = meta.data;
		return {
			type: "meta",
			category: isCategory(m.category) ? m.category : "other",
			tags: normalizeTags(m.tags),
			crisis: m.crisis ?? false,
			picks: (m.picks ?? []).filter((id): id is string => typeof id === "string" && ROSTER.has(id) && philosopherById(id) !== undefined),
		};
	}
	const answer = answerSchema.safeParse(raw);
	if (answer.success) {
		const a = answer.data;
		if (!philosopherById(a.philosopher)) return null;
		const own = (id: unknown): id is string => typeof id === "string" && id.startsWith(`${a.philosopher}.`);
		const concepts = (a.concepts ?? []).filter((id): id is string => own(id) && conceptById(id) !== undefined);
		return {
			type: "answer",
			philosopher: a.philosopher,
			conclusion: a.conclusion.trim().slice(0, CONCLUSION_MAX),
			body: a.body.trim().slice(0, BODY_MAX),
			concepts: [...new Set(concepts)],
			quote: own(a.quote) && quoteById(a.quote) ? a.quote : null,
		};
	}
	const nunu = nunuSchema.safeParse(raw);
	if (nunu.success) return { type: "nunu", body: nunu.data.body.trim().slice(0, NUNU_MAX) };
	return null;
}

/** 答える人の選び方の状態。answered はもう受け取った人、exclude は前に答えた人（ほかの哲学者にも聞くとき） */
export type PickState = { answered: string[]; count: number; exclude: string[] };

type Lookup = (id: string) => Pick<Philosopher, "id" | "school" | "field"> | undefined;

/**
 * 届いた答えを受け取るか。名簿にいる・まだ答えていない・前に答えた人でない・同じ学派の人がまだいない・人数に達していない、
 * 7人のときは哲学者以外（心理学・実践の知恵）が2人まで。受け取ったら、呼んだ側が answered に足す
 */
export function acceptAnswer(state: PickState, a: Pick<AnswerEvent, "philosopher">, lookup: Lookup = philosopherById): boolean {
	const p = lookup(a.philosopher);
	if (!p) return false;
	if (state.answered.length >= state.count) return false;
	if (state.answered.includes(p.id) || state.exclude.includes(p.id)) return false;
	const others = [...state.answered, ...state.exclude].map(lookup);
	if (p.school && others.some((o) => o?.school === p.school)) return false;
	if (state.count === ANSWER_COUNT && p.field !== "philosophy") {
		const nonPhilosophy = state.answered.map(lookup).filter((o) => o && o.field !== "philosophy").length;
		if (nonPhilosophy >= ANSWER_COUNT - MIN_PHILOSOPHY) return false;
	}
	return true;
}
