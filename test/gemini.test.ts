import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GeminiError, streamGemini } from "../worker/gemini/client";
import { clearCooldown, generateText } from "../worker/gemini/generate";
import { GEMINI_MODELS } from "../worker/gemini/models";

/** Gemini の SSE の応答（text を1つずつ data にする） */
function sse(...texts: string[]): Response {
	const body = texts.map((t) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: t }] } }] })}\r\n\r\n`).join("");
	return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}
/** 200 で1文字も書かない応答（安全のブロックなど）。finishReason・blockReason だけが届く */
function sseEmpty(why: { finishReason?: string; blockReason?: string }): Response {
	const json = { candidates: why.finishReason ? [{ finishReason: why.finishReason }] : undefined, promptFeedback: why.blockReason ? { blockReason: why.blockReason } : undefined };
	return new Response(`data: ${JSON.stringify(json)}\r\n\r\n`, { status: 200, headers: { "Content-Type": "text/event-stream" } });
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

	it("使ったトークン数（usageMetadata）を知らせる", async () => {
		const usage = `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: "答え" }] } }], usageMetadata: { promptTokenCount: 1200, candidatesTokenCount: 340 } })}\n\n`;
		const seen: { prompt: number; output: number }[] = [];
		await collect(streamGemini({ ...base, model: "m", fetch: async () => new Response(usage, { status: 200 }), onUsage: (u) => seen.push(u) }));
		expect(seen.at(-1)).toEqual({ prompt: 1200, output: 340 });
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

describe("200 で1文字も書かなかったとき（安全のブロックなど）", () => {
	afterEach(() => vi.restoreAllMocks());

	/** gemini_empty のログ（console.log の JSON） */
	const emptyLogs = (log: { mock: { calls: unknown[][] } }) =>
		log.mock.calls.map((c) => String(c[0])).filter((s) => s.includes("gemini_empty")).map((s) => JSON.parse(s) as Record<string, unknown>);

	it("streamGemini は理由（finishReason・blockReason）をログに出して empty を投げる", async () => {
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		const kind = async (res: Response) => {
			try {
				await collect(streamGemini({ ...base, model: "m", fetch: async () => res }));
			} catch (e) {
				return (e as GeminiError).kind;
			}
		};
		expect(await kind(sseEmpty({ finishReason: "SAFETY" }))).toBe("empty");
		expect(await kind(sseEmpty({ blockReason: "PROHIBITED_CONTENT" }))).toBe("empty");
		expect(emptyLogs(log)).toEqual([
			{ event: "gemini_empty", model: "m", finishReason: "SAFETY", blockReason: null },
			{ event: "gemini_empty", model: "m", finishReason: null, blockReason: "PROHIBITED_CONTENT" },
		]);
	});

	it("generateText は次のモデルへ移る。空だったモデルは後回しにしない", async () => {
		vi.spyOn(console, "log").mockImplementation(() => {});
		const asked: string[] = [];
		const fetchImpl = async (url: RequestInfo | URL) => {
			const model = String(url).match(/models\/([^:]+):/)?.[1] ?? "";
			asked.push(model);
			return model === GEMINI_MODELS[0] ? sseEmpty({ finishReason: "SAFETY" }) : sse("答え");
		};
		expect(await collect(generateText({ ...base, fetch: fetchImpl }))).toBe("答え");
		expect(asked.slice(0, 2)).toEqual([GEMINI_MODELS[0], GEMINI_MODELS[1]]);
		asked.length = 0;
		await collect(generateText({ ...base, fetch: fetchImpl }));
		expect(asked[0]).toBe(GEMINI_MODELS[0]);
	});

	it("どのモデルでも空なら empty を投げる", async () => {
		vi.spyOn(console, "log").mockImplementation(() => {});
		await expect(collect(generateText({ ...base, fetch: async () => sseEmpty({ finishReason: "SAFETY" }) }))).rejects.toMatchObject({ kind: "empty" });
	});
});
