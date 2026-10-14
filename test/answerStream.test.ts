import { describe, expect, it } from "vitest";
import { LineSplitter, acceptAnswer, parseEvent } from "../shared/answerStream";
import type { AnswerEvent } from "../shared/api";
import type { Philosopher } from "../shared/philosophers";

describe("LineSplitter", () => {
	it("分かれて届いた行をつなぎ、空の行は捨てる", () => {
		const s = new LineSplitter();
		expect(s.push('{"a":')).toEqual([]);
		expect(s.push('1}\n\n{"b"')).toEqual(['{"a":1}']);
		expect(s.push(":2}\n")).toEqual(['{"b":2}']);
		expect(s.push('{"c":3}')).toEqual([]);
		expect(s.flush()).toEqual(['{"c":3}']);
	});
});

describe("parseEvent", () => {
	it("壊れた JSON・知らない type・前置きは null", () => {
		expect(parseEvent('{"type":"answer",')).toBeNull();
		expect(parseEvent('{"type":"weather"}')).toBeNull();
		expect(parseEvent("```json")).toBeNull();
		expect(parseEvent("はい、答えます")).toBeNull();
	});

	it("meta の大分類・小分類・選んだ人を表のものだけにする", () => {
		expect(parseEvent('{"type":"meta","category":"nope","tags":["crush","x"],"crisis":false,"picks":["socrates","nobody"]}')).toEqual({
			type: "meta",
			category: "other",
			tags: ["crush"],
			crisis: false,
			picks: ["socrates"],
		});
	});

	it("名簿にない人の答えは null", () => {
		expect(parseEvent('{"type":"answer","philosopher":"nobody","conclusion":"a","body":"b","concepts":[],"quote":null}')).toBeNull();
	});

	it("名簿にない概念を捨て、他人の名言は null にする", () => {
		const line = JSON.stringify({
			type: "answer",
			philosopher: "socrates",
			conclusion: "問い直そう",
			body: "きみは本当に知っているのかね。",
			concepts: ["socrates.ignorance", "socrates.nothing", "nietzsche.overman"],
			quote: "nietzsche.q1",
		});
		expect(parseEvent(line)).toEqual({
			type: "answer",
			philosopher: "socrates",
			conclusion: "問い直そう",
			body: "きみは本当に知っているのかね。",
			concepts: ["socrates.ignorance"],
			quote: null,
		});
	});

	it("本人の名言の id は残す", () => {
		const line = '{"type":"answer","philosopher":"socrates","conclusion":"a","body":"b","concepts":[],"quote":"socrates.q1"}';
		expect((parseEvent(line) as AnswerEvent).quote).toBe("socrates.q1");
	});

	it("結論は40字、本文は600字で切る", () => {
		const line = JSON.stringify({ type: "answer", philosopher: "socrates", conclusion: "あ".repeat(50), body: "い".repeat(700), concepts: [], quote: null });
		const ev = parseEvent(line) as AnswerEvent;
		expect(ev.conclusion).toHaveLength(40);
		expect(ev.body).toHaveLength(600);
	});

	it("行の前後に余計な文字があっても JSON の部分を読む", () => {
		expect(parseEvent('- {"type":"nunu","body":"大丈夫だよ"}')).toEqual({ type: "nunu", body: "大丈夫だよ" });
	});
});

describe("acceptAnswer", () => {
	const roster: Record<string, Pick<Philosopher, "id" | "school" | "field">> = {
		seneca: { id: "seneca", school: "stoicism", field: "philosophy" },
		epictetus: { id: "epictetus", school: "stoicism", field: "philosophy" },
		adler: { id: "adler", school: "individual-psychology", field: "psychology" },
		freud: { id: "freud", school: "psychoanalysis", field: "psychology" },
		jung: { id: "jung", school: "analytical-psychology", field: "psychology" },
		...Object.fromEntries(["p1", "p2", "p3", "p4", "p5", "p6", "p7"].map((id) => [id, { id, school: id, field: "philosophy" as const }])),
	};
	const lookup = (id: string) => roster[id] as Philosopher | undefined;
	const ans = (philosopher: string): AnswerEvent => ({ type: "answer", philosopher, conclusion: "", body: "", concepts: [], quote: null });

	it("同じ学派の2人目を断る", () => {
		expect(acceptAnswer({ answered: ["seneca"], count: 7, exclude: [] }, ans("epictetus"), lookup)).toBe(false);
	});
	it("「答えない人」の学派とも重ねない", () => {
		expect(acceptAnswer({ answered: [], count: 2, exclude: ["seneca"] }, ans("epictetus"), lookup)).toBe(false);
	});
	it("人数に達したら断る", () => {
		expect(acceptAnswer({ answered: ["p1", "p2", "p3", "p4", "p5", "p6", "p7"], count: 7, exclude: [] }, ans("seneca"), lookup)).toBe(false);
	});
	it("7人のときは哲学者以外を2人までにする", () => {
		expect(acceptAnswer({ answered: ["adler", "freud"], count: 7, exclude: [] }, ans("jung"), lookup)).toBe(false);
		expect(acceptAnswer({ answered: ["adler"], count: 7, exclude: [] }, ans("freud"), lookup)).toBe(true);
	});
	it("答え済み・答えない人・名簿にない人を断る", () => {
		expect(acceptAnswer({ answered: ["p1"], count: 7, exclude: [] }, ans("p1"), lookup)).toBe(false);
		expect(acceptAnswer({ answered: [], count: 2, exclude: ["p1"] }, ans("p1"), lookup)).toBe(false);
		expect(acceptAnswer({ answered: [], count: 7, exclude: [] }, ans("nobody"), lookup)).toBe(false);
	});
});
