import { describe, expect, it } from "vitest";
import { buildIndex, rank } from "../shared/similarity";

const docs = [
	{ id: "love", text: "彼氏と別れてから毎日つらいです。恋人のことが忘れられません。" },
	{ id: "work", text: "上司に怒られてばかりで、会社に行くのが怖いです。仕事を辞めたい。" },
	{ id: "family", text: "母親と喧嘩ばかりしてしまいます。親とどう向き合えばいいですか。" },
	{ id: "death", text: "夜になると死ぬのが怖くなって眠れません。" },
];
const index = buildIndex(docs);

describe("rank", () => {
	it("恋愛の相談には恋愛の文書を一番に返す", () => {
		expect(rank(index, "彼氏と別れた", 3)[0]?.id).toBe("love");
	});
	it("仕事の相談には仕事の文書を一番に返す", () => {
		expect(rank(index, "上司が怖い", 3)[0]?.id).toBe("work");
	});
	it("関係のない文には何も返さない", () => {
		expect(rank(index, "量子コンピューターの仕組みを教えて", 3)).toEqual([]);
	});
	it("k 件までしか返さない", () => {
		expect(rank(index, "怖い", 1)).toHaveLength(1);
	});
	it("空の文には何も返さない", () => {
		expect(rank(index, "   ", 3)).toEqual([]);
	});
});
