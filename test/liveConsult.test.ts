import { afterEach, describe, expect, it } from "vitest";
import type { AnswerEvent, StreamEvent } from "../shared/api";
import { abortLive, clearLiveIfDone, liveSnapshot, startConsult } from "../src/liveConsult";

const answer = (philosopher: string): AnswerEvent => ({ type: "answer", philosopher, conclusion: "", body: "", concepts: [], quote: null });
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

/**
 * 手で流す回答の流れ。signal を見ない（止めた後も届き続ける）ので、止めた流れの更新を画面が無視できているかも確かめられる
 */
function flow() {
	const queue: (StreamEvent | Error | null)[] = [];
	let wake: (() => void) | null = null;
	let signal: AbortSignal | null = null;
	const push = (ev: StreamEvent | Error | null) => {
		queue.push(ev);
		wake?.();
	};
	async function* events(): AsyncGenerator<StreamEvent> {
		while (true) {
			while (!queue.length) await new Promise<void>((r) => (wake = r));
			const next = queue.shift();
			if (next === null) return;
			if (next instanceof Error) throw next;
			if (next) yield next;
		}
	}
	return {
		open: (s: AbortSignal) => {
			signal = s;
			return events();
		},
		push,
		end: () => push(null),
		fail: (err: Error) => push(err),
		get aborted() {
			return signal?.aborted ?? false;
		},
	};
}

afterEach(() => {
	abortLive();
	clearLiveIfDone();
});

describe("startConsult", () => {
	it("届いた順に live を更新し、start で onStart を呼ぶ", async () => {
		const a = flow();
		const started: string[] = [];
		const run = startConsult("悩み", a.open, (id) => started.push(id));
		a.push({ type: "start", id: "a" });
		a.push(answer("socrates"));
		a.push({ type: "done", status: "done" });
		a.end();
		await run;
		expect(started).toEqual(["a"]);
		expect(liveSnapshot()).toMatchObject({ id: "a", body: "悩み", status: "done" });
		expect(liveSnapshot()?.answers.map((x) => x.philosopher)).toEqual(["socrates"]);
	});

	it("届いている途中に次の相談を送ると、前の流れを止め、止めた流れの更新は live に出ない", async () => {
		const a = flow();
		const runA = startConsult("前の悩み", a.open, () => {});
		a.push({ type: "start", id: "a" });
		a.push(answer("socrates"));
		await tick();
		expect(liveSnapshot()).toMatchObject({ id: "a", status: "streaming" });

		const b = flow();
		const runB = startConsult("次の悩み", b.open, () => {});
		expect(a.aborted).toBe(true);
		expect(liveSnapshot()).toBeNull();

		b.push({ type: "start", id: "b" });
		a.push(answer("plato"));
		a.push({ type: "done", status: "done" });
		b.push(answer("buddha"));
		await tick();
		expect(liveSnapshot()).toMatchObject({ id: "b", body: "次の悩み", status: "streaming" });
		expect(liveSnapshot()?.answers.map((x) => x.philosopher)).toEqual(["buddha"]);

		a.end();
		b.push({ type: "done", status: "done" });
		b.end();
		await Promise.all([runA, runB]);
		expect(liveSnapshot()).toMatchObject({ id: "b", status: "done" });
	});

	it("止められた流れが start より前に失敗しても、投げず、次の流れの live を消さない", async () => {
		const a = flow();
		const runA = startConsult("前の悩み", a.open, () => {});
		await tick();

		const b = flow();
		const runB = startConsult("次の悩み", b.open, () => {});
		b.push({ type: "start", id: "b" });
		a.fail(new Error("network"));
		await expect(runA).resolves.toBeUndefined();
		expect(liveSnapshot()).toMatchObject({ id: "b" });

		b.end();
		await runB;
	});

	it("止められた流れは、止めた後に start が届いても onStart を呼ばない", async () => {
		const a = flow();
		const started: string[] = [];
		const runA = startConsult("前の悩み", a.open, (id) => started.push(id));
		await tick();
		abortLive();
		a.push({ type: "start", id: "a" });
		a.end();
		await runA;
		expect(started).toEqual([]);
		expect(liveSnapshot()).toBeNull();
	});

	it("止められていない流れが start より前に失敗したら、live を消して投げる", async () => {
		const a = flow();
		const run = startConsult("悩み", a.open, () => {});
		a.fail(new Error("rate_limited"));
		await expect(run).rejects.toThrow("rate_limited");
		expect(liveSnapshot()).toBeNull();
	});
});

describe("abortLive", () => {
	it("届いている途中なら止めて live を消す", async () => {
		const a = flow();
		const run = startConsult("悩み", a.open, () => {});
		a.push({ type: "start", id: "a" });
		await tick();
		abortLive();
		expect(a.aborted).toBe(true);
		expect(liveSnapshot()).toBeNull();
		a.end();
		await run;
	});

	it("届き終わった live は残す", async () => {
		const a = flow();
		const run = startConsult("悩み", a.open, () => {});
		a.push({ type: "start", id: "a" });
		a.push({ type: "done", status: "done" });
		a.end();
		await run;
		abortLive();
		expect(liveSnapshot()).toMatchObject({ id: "a", status: "done" });
	});
});
