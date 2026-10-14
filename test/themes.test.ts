import { describe, expect, it } from "vitest";
import { CATEGORIES, TAGS, isCategory, normalizeTags } from "../shared/themes";

describe("テーマの表", () => {
	it("小分類はどれも大分類のどれかに属する", () => {
		const ids = new Set(CATEGORIES.map((c) => c.id));
		for (const tag of TAGS) expect(ids.has(tag.category), tag.id).toBe(true);
	});

	it("id は重ならない", () => {
		expect(new Set(TAGS.map((t) => t.id)).size).toBe(TAGS.length);
		expect(new Set(CATEGORIES.map((c) => c.id)).size).toBe(CATEGORIES.length);
	});

	it("大分類は10＋その他", () => {
		expect(CATEGORIES).toHaveLength(11);
		expect(isCategory("love")).toBe(true);
		expect(isCategory("other")).toBe(true);
		expect(isCategory("nope")).toBe(false);
	});
});

describe("normalizeTags", () => {
	const [a, b, c, d] = TAGS.map((t) => t.id);
	it("知っている小分類だけを、重ならず3つまで残す", () => {
		expect(normalizeTags(["x", a, a, b, c, d])).toEqual([a, b, c]);
	});
	it("配列でなければ空", () => {
		expect(normalizeTags("a")).toEqual([]);
		expect(normalizeTags(undefined)).toEqual([]);
	});
});
