import { useSyncExternalStore } from "react";
import type { AnswerEvent, ErrorCode, MetaEvent, NunuEvent, StreamEvent } from "../shared/api";

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
/** いま流れている相談を止めるための AbortController。流れは同時に1つだけ */
let running: AbortController | null = null;
const listeners = new Set<() => void>();

function set(next: Live | null): void {
	live = next;
	for (const l of listeners) l();
}

export function liveSnapshot(): Live | null {
	return live;
}

export function useLive(): Live | null {
	return useSyncExternalStore((l) => {
		listeners.add(l);
		return () => listeners.delete(l);
	}, liveSnapshot);
}

/**
 * 届いている途中の流れを止める（新しい相談を送るとき・別の相談へ移るとき）。
 * 止めた流れは以後 live を書き換えない。途中のままの live は、止まった表示が残らないよう消す
 */
export function abortLive(): void {
	running?.abort();
	running = null;
	if (live?.status === "streaming") set(null);
}

/**
 * 相談を送って、届いた順に live を更新する。start が届いたら onStart（相談のページへ移る）。
 * 通信のしかたは open で渡す（signal で止められる流れを返す）。始まる前に断られたら投げる（画面は入力欄の下に理由を出す）。
 * 前の流れがまだ届いていれば止める。止められた流れは、何も書き換えず、投げずに終わる
 */
export async function startConsult(body: string, open: (signal: AbortSignal) => AsyncIterable<StreamEvent>, onStart: (id: string) => void): Promise<void> {
	abortLive();
	const controller = new AbortController();
	running = controller;
	const stale = () => controller.signal.aborted;
	let current: Live = { id: null, body, meta: null, answers: [], nunu: null, status: "streaming", error: null };
	const update = (patch: Partial<Live>) => {
		if (stale()) return;
		current = { ...current, ...patch };
		set(current);
	};
	try {
		for await (const ev of open(controller.signal)) {
			if (stale()) return;
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
		if (stale()) return;
		if (current.id === null) {
			set(null);
			throw err;
		}
		update({ status: current.answers.length ? "partial" : "error", error: "network" });
	} finally {
		if (running === controller) running = null;
	}
}

/** 届き終わっていれば消す（相談のページを離れたとき。StrictMode の付け外しで、届いている途中のものを消さないように） */
export function clearLiveIfDone(): void {
	if (live && live.status !== "streaming") set(null);
}
