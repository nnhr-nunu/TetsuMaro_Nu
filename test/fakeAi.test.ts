import { describe, expect, it } from "vitest";
import { LineSplitter, parseEvent } from "../shared/answerStream";
import { fakeAiStream } from "../worker/fakeAi";

async function events(gen: AsyncGenerator<string>) {
	const splitter = new LineSplitter();
	const out = [];
	for await (const chunk of gen) for (const line of splitter.push(chunk)) out.push(parseEvent(line));
	for (const line of splitter.flush()) out.push(parseEvent(line));
	return out;
}

describe("偽の AI", () => {
	it("meta 1行・answer が人数分・nunu 1行を、読み取れる形で返す", async () => {
		const out = await events(fakeAiStream({ count: 2, exclude: [], mode: "general", body: "仕事がつらい", behavior: "1" }));
		expect(out.every((e) => e !== null)).toBe(true);
		expect(out.filter((e) => e?.type === "meta")).toHaveLength(1);
		expect(out.filter((e) => e?.type === "answer")).toHaveLength(2);
		expect(out.filter((e) => e?.type === "nunu")).toHaveLength(1);
	});

	it("ほかの哲学者に聞くときは answer だけを、答えた人を除いて返す", async () => {
		const out = await events(fakeAiStream({ count: 1, exclude: ["socrates"], mode: "general", body: "x", behavior: "1" }));
		expect(out.map((e) => e?.type)).toEqual(["answer"]);
		expect(out[0]).toMatchObject({ philosopher: expect.not.stringMatching(/^socrates$/) });
	});

	it("「死にたい」を含む相談は crisis を立てる", async () => {
		const out = await events(fakeAiStream({ count: 1, exclude: [], mode: "general", body: "もう死にたい", behavior: "1" }));
		expect(out[0]).toMatchObject({ type: "meta", crisis: true });
	});

	it("stop:N なら N 人で止まる、daily なら日の上限で失敗する", async () => {
		const out = await events(fakeAiStream({ count: 2, exclude: [], mode: "general", body: "x", behavior: "stop:1" }));
		expect(out.filter((e) => e?.type === "answer")).toHaveLength(1);
		expect(out.some((e) => e?.type === "nunu")).toBe(false);
		await expect(events(fakeAiStream({ count: 2, exclude: [], mode: "general", body: "x", behavior: "daily" }))).rejects.toMatchObject({
			kind: "daily_limit",
		});
	});
});
