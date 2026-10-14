import { describe, expect, it } from "vitest";
import type { AnswerEvent } from "../shared/api";
import { visibleAnswers } from "../src/answersView";

const a = (philosopher: string): AnswerEvent => ({ type: "answer", philosopher, conclusion: "", body: "", concepts: [], quote: null });

describe("visibleAnswers", () => {
	it("読み直しが古いまま（0人の書きかけ）でも、届いた7人を消さない", () => {
		const live = ["p1", "p2", "p3", "p4", "p5", "p6", "p7"].map(a);
		expect(visibleAnswers({ saved: [], live, more: [] })).toHaveLength(7);
	});
	it("保存された分・届いた分・ほかの哲学者の分を、重ねずに届いた順でつなぐ", () => {
		const out = visibleAnswers({ saved: [a("p1"), a("p2")], live: [a("p1"), a("p2"), a("p3")], more: [a("p4"), a("p2")] });
		expect(out.map((x) => x.philosopher)).toEqual(["p1", "p2", "p3", "p4"]);
	});
});
