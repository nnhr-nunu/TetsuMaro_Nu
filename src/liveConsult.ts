import { useSyncExternalStore } from "react";
import type { AnswerEvent, ErrorCode, MetaEvent, NunuEvent } from "../shared/api";
import { streamEvents } from "./api";

/**
 * いま届いている回答（相談を送ってから done まで）。トップで送り、start が届いたら相談のページへ移るので、
 * ページをまたいで同じ流れを見られるよう、ここに1つだけ持つ
 */
export type Live = {
	id: string | null;
	body: string;
	meta: MetaEvent | null;
	answers: AnswerEvent[];
	nunu: NunuEvent | null;
	status: "streaming" | "done" | "partial" | "error";
	error: ErrorCode | "network" | null;
};

let live: Live | null = null;
const listeners = new Set<() => void>();

function set(next: Live | null): void {
	live = next;
	for (const l of listeners) l();
}

export function useLive(): Live | null {
	return useSyncExternalStore(
		(l) => {
			listeners.add(l);
			return () => listeners.delete(l);
		},
		() => live,
	);
}

/**
 * 相談を送って、届いた順に live を更新する。start が届いたら onStart（相談のページへ移る）。
 * 始まる前に断られたら投げる（画面は入力欄の下に理由を出す）
 */
export async function startConsult(input: { body: string; ageBand?: string; gender?: string }, onStart: (id: string) => void): Promise<void> {
	let current: Live = { id: null, body: input.body, meta: null, answers: [], nunu: null, status: "streaming", error: null };
	const update = (patch: Partial<Live>) => {
		current = { ...current, ...patch };
		set(current);
	};
	const events = streamEvents("/api/consult", input);
	try {
		for await (const ev of events) {
			if (ev.type === "start") {
				update({ id: ev.id });
				onStart(ev.id);
			} else if (ev.type === "meta") update({ meta: ev });
			else if (ev.type === "answer") update({ answers: [...current.answers, ev] });
			else if (ev.type === "nunu") update({ nunu: ev });
			else if (ev.type === "done") update({ status: ev.status });
			else if (ev.type === "error") update({ status: "error", error: ev.code });
		}
		if (current.status === "streaming") update({ status: current.answers.length ? "partial" : "error", error: current.answers.length ? null : "network" });
	} catch (err) {
		if (current.id === null) {
			set(null);
			throw err;
		}
		update({ status: current.answers.length ? "partial" : "error", error: "network" });
	}
}

/** 届き終わっていれば消す（相談のページを離れたとき。StrictMode の付け外しで、届いている途中のものを消さないように） */
export function clearLiveIfDone(): void {
	if (live && live.status !== "streaming") set(null);
}
