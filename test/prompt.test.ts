import { describe, expect, it } from "vitest";
import type { NunuAnswer } from "../shared/nunu";
import { PHILOSOPHERS } from "../shared/philosophers";
import { buildConsultPrompt } from "../shared/prompt";

const example: NunuAnswer = {
	id: "n1",
	url: "https://marshmallow-qa.com/messages/n1",
	date: "2026-01-01",
	question: "失恋して立ち直れません",
	answer: "つらいときは、つらいって言っていいんだよ",
	audience: "general",
	category: "love",
};

describe("buildConsultPrompt", () => {
	const first = buildConsultPrompt({ body: "彼氏と別れました", mode: "general", nunuExamples: [example], count: 7, exclude: [] });

	it("system に名簿の全員の id・概念・名言の id が入る", () => {
		for (const p of PHILOSOPHERS) {
			expect(first.system).toContain(p.id);
			for (const c of p.concepts) expect(first.system).toContain(c.id);
			for (const q of p.quotes) expect(first.system).toContain(q.id);
		}
	});

	it("user に相談・人数・ぬぬはらの手本が入る", () => {
		expect(first.user).toContain("彼氏と別れました");
		expect(first.user).toContain("7人");
		expect(first.user).toContain("つらいときは、つらいって言っていいんだよ");
	});

	it("ほかの哲学者に聞くときは、答えない人を挙げ、meta と nunu を書かせない", () => {
		const more = buildConsultPrompt({ body: "彼氏と別れました", mode: "general", nunuExamples: [], count: 2, exclude: ["socrates", "nietzsche"] });
		expect(more.user).toContain("2人");
		expect(more.user).toMatch(/答えない人[\s\S]*socrates[\s\S]*nietzsche/);
		expect(more.user).toContain("answer の行だけ");
	});

	it("一般向けのときだけ generalNote を足す", () => {
		const noted = PHILOSOPHERS.find((p) => p.generalNote);
		if (!noted) return;
		expect(first.system).toContain(noted.generalNote);
		const adult = buildConsultPrompt({ body: "x", mode: "adult", nunuExamples: [], count: 7, exclude: [] });
		expect(adult.system).not.toContain(noted.generalNote);
	});
});
