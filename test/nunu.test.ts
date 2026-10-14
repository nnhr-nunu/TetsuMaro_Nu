import { describe, expect, it } from "vitest";
import { type NunuAnswer, createNunuFinder } from "../shared/nunu";

const base = { url: "https://marshmallow-qa.com/messages/x", date: "2026-01-01", category: "love" } as const;
const answers: NunuAnswer[] = [
	{ ...base, id: "a", question: "失恋して立ち直れません", answer: "失恋のつらさは時間が…", audience: "general" },
	{ ...base, id: "b", question: "失恋したあと性欲が強くなりました", answer: "…", audience: "adult" },
	{ ...base, id: "c", question: "仕事が続きません", answer: "仕事は…", audience: "general", category: "work" },
];
const find = createNunuFinder(answers);

describe("ぬぬはらの関連回答", () => {
	it("一般向けでは大人の印の回答を返さない", () => {
		const ids = find("失恋がつらい", "general", 3).map((a) => a.id);
		expect(ids).toContain("a");
		expect(ids).not.toContain("b");
	});
	it("大人向けでは大人の印の回答も返す", () => {
		expect(find("失恋がつらい", "adult", 3).map((a) => a.id)).toContain("b");
	});
});
