import { describe, expect, it } from "vitest";
import { PHILOSOPHERS, ROSTER_IDS, conceptById, philosopherById, quoteById } from "../shared/philosophers";
import { SCHOOLS } from "../shared/schools";

describe("哲学者の名簿", () => {
	it("名簿は38人", () => {
		expect(ROSTER_IDS).toHaveLength(38);
		expect(new Set(ROSTER_IDS).size).toBe(38);
	});

	it("名簿の38人が全員そろっている", () => {
		expect(PHILOSOPHERS.map((p) => p.id)).toEqual([...ROSTER_IDS]);
	});

	it("書いてある人は名簿の順に並ぶ", () => {
		const order = PHILOSOPHERS.map((p) => ROSTER_IDS.indexOf(p.id));
		expect(order.every((i) => i >= 0)).toBe(true);
		expect([...order].sort((a, b) => a - b)).toEqual(order);
	});

	describe.each(PHILOSOPHERS.map((p) => [p.id, p] as const))("%s", (id, p) => {
		it("概念は2〜6個で、id は本人の id で始まり重ならない", () => {
			expect(p.concepts.length).toBeGreaterThanOrEqual(2);
			expect(p.concepts.length).toBeLessThanOrEqual(6);
			for (const c of p.concepts) expect(c.id).toMatch(new RegExp(`^${id}\\.[a-z0-9-]+$`));
			expect(new Set(p.concepts.map((c) => c.id)).size).toBe(p.concepts.length);
		});
		it("名言は0〜4個で、出典がある", () => {
			expect(p.quotes.length).toBeLessThanOrEqual(4);
			for (const q of p.quotes) {
				expect(q.id).toMatch(new RegExp(`^${id}\\.q\\d+$`));
				expect(q.source.length).toBeGreaterThan(0);
			}
		});
		it("学派は名簿にある", () => {
			if (p.school !== null) expect(SCHOOLS[p.school], p.school).toBeDefined();
		});
		it("色・一言・語り口・言わせないことがある", () => {
			expect(p.color).toMatch(/^#[0-9A-F]{6}$/i);
			expect(p.oneLine.length).toBeLessThanOrEqual(40);
			expect(p.voice.length).toBeGreaterThan(20);
			expect(p.avoid.length).toBeGreaterThan(0);
			expect(p.works.length).toBeGreaterThan(0);
		});
	});

	it("id から人・概念・名言を引ける", () => {
		expect(philosopherById("socrates")?.name).toBe("ソクラテス");
		expect(conceptById("socrates.ignorance")?.name).toBe("無知の知");
		expect(quoteById("nietzsche.q1")?.source).toContain("悦ばしき知識");
		expect(philosopherById("nobody")).toBeUndefined();
		expect(conceptById("nietzsche.nothing")).toBeUndefined();
	});
});
