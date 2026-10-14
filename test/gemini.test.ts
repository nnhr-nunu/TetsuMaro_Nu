import { beforeEach, describe, expect, it } from "vitest";
import { GeminiError, streamGemini } from "../worker/gemini/client";
import { clearCooldown, generateText } from "../worker/gemini/generate";
import { GEMINI_MODELS } from "../worker/gemini/models";

/** Gemini の SSE の応答（text を1つずつ data にする） */
function sse(...texts: string[]): Response {
	const body = texts.map((t) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: t }] } }] })}\r\n\r\n`).join("");
	return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}
const error = (status: number, message: string) => new Response(JSON.stringify({ error: { code: status, message } }), { status });
const DAILY = "Quota exceeded for quota metric 'generate_content_free_tier_requests', quotaId: GenerateRequestsPerDayPerProjectPerModel-FreeTier";

async function collect(gen: AsyncGenerator<string>): Promise<string> {
	let out = "";
	for await (const t of gen) out += t;
	return out;
}

const base = { apiKey: "k", system: "s", user: "u" };

beforeEach(() => clearCooldown());

describe("streamGemini", () => {
	it("SSE の data から文字を取り出す（思考の部分は捨てる）", async () => {
		const thought = `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: "考え中", thought: true }] } }] })}\n\n`;
		const fetchImpl = async () => new Response(thought + (await sse("こん", "にちは").text()), { status: 200 });
		expect(await collect(streamGemini({ ...base, model: "m", fetch: fetchImpl }))).toBe("こんにちは");
	});

	it("日の上限の 429 は daily_limit、それ以外の 429 と 503 は busy", async () => {
		const kind = async (res: Response) => {
			try {
				await collect(streamGemini({ ...base, model: "m", fetch: async () => res }));
			} catch (e) {
				return (e as GeminiError).kind;
			}
		};
		expect(await kind(error(429, DAILY))).toBe("daily_limit");
		expect(await kind(error(429, "Resource has been exhausted (per minute)"))).toBe("busy");
		expect(await kind(error(503, "The model is overloaded"))).toBe("busy");
		expect(await kind(error(403, "API key not valid"))).toBe("auth");
	});
});

describe("generateText", () => {
	it("1つ目のモデルが混んでいたら、次のモデルの答えを返す", async () => {
		const asked: string[] = [];
		const fetchImpl = async (url: RequestInfo | URL) => {
			const model = String(url).match(/models\/([^:]+):/)?.[1] ?? "";
			asked.push(model);
			return model === GEMINI_MODELS[0] ? error(503, "overloaded") : sse("答え");
		};
		expect(await collect(generateText({ ...base, fetch: fetchImpl }))).toBe("答え");
		expect(asked.slice(0, 2)).toEqual([GEMINI_MODELS[0], GEMINI_MODELS[1]]);
	});

	it("全部のモデルで日の上限なら daily_limit を投げる", async () => {
		await expect(collect(generateText({ ...base, fetch: async () => error(429, DAILY) }))).rejects.toMatchObject({ kind: "daily_limit" });
	});

	it("混んだモデルは次から後回しにする", async () => {
		const asked: string[] = [];
		const fetchImpl = async (url: RequestInfo | URL) => {
			const model = String(url).match(/models\/([^:]+):/)?.[1] ?? "";
			asked.push(model);
			return model === GEMINI_MODELS[0] ? error(503, "overloaded") : sse("ok");
		};
		await collect(generateText({ ...base, fetch: fetchImpl }));
		asked.length = 0;
		await collect(generateText({ ...base, fetch: fetchImpl }));
		expect(asked[0]).toBe(GEMINI_MODELS[1]);
	});
});
