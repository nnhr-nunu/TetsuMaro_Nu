import { FIRST_CHUNK_MS, GEMINI_HOST, MAX_OUTPUT_TOKENS, MODEL_DEADLINE_MS, thinkingConfigFor } from "./models";

/**
 * Gemini の失敗の種類。busy: 混雑・一時的な上限・時間切れ（次のモデルへ） / daily_limit: 日の無料枠を使い切った /
 * auth: キーが違う（どのモデルでも同じなので諦める） / bad_request: そのモデルが使えない（次のモデルへ） / network: つながらない /
 * empty: 200 で返ったが1文字も書かなかった（安全のブロックなど。次のモデルへ。モデルが混んでいるわけではないので後回しにはしない）
 */
export type GeminiErrorKind = "busy" | "daily_limit" | "auth" | "bad_request" | "network" | "empty";

export class GeminiError extends Error {
	constructor(
		readonly kind: GeminiErrorKind,
		message: string,
	) {
		super(message);
		this.name = "GeminiError";
	}
}

export type StreamOptions = {
	apiKey: string;
	model: string;
	system: string;
	user: string;
	signal?: AbortSignal;
	/** テストで差し替える */
	fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
	/** 使ったトークン数（入力・出力）が届くたびに呼ぶ。最後に届いたものがその回の合計 */
	onUsage?: (usage: { prompt: number; output: number }) => void;
};

function classify(status: number, text: string): GeminiError {
	if (status === 429) return new GeminiError(/PerDay|per day/i.test(text) ? "daily_limit" : "busy", text.slice(0, 300));
	if (status === 401 || status === 403) return new GeminiError("auth", text.slice(0, 300));
	if (status === 400 || status === 404) return new GeminiError("bad_request", text.slice(0, 300));
	return new GeminiError("busy", `${status} ${text.slice(0, 300)}`);
}

type Chunk = {
	candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
	promptFeedback?: { blockReason?: string };
	usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
};

/** 1文字も書かれなかったときの理由（届いた最後の値） */
type Why = { finishReason?: string; blockReason?: string };

/** SSE の1つの data から、思考でない部分の文字を取り出す。使ったトークン数があれば onUsage に、終わった理由・止めた理由があれば why に渡す */
function textOf(data: string, onUsage?: StreamOptions["onUsage"], why?: Why): string {
	try {
		const json = JSON.parse(data) as Chunk;
		const u = json.usageMetadata;
		if (u && onUsage) onUsage({ prompt: u.promptTokenCount ?? 0, output: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0) });
		if (why) {
			why.finishReason = json.candidates?.[0]?.finishReason ?? why.finishReason;
			why.blockReason = json.promptFeedback?.blockReason ?? why.blockReason;
		}
		return (json.candidates?.[0]?.content?.parts ?? [])
			.filter((p) => !p.thought && typeof p.text === "string")
			.map((p) => p.text)
			.join("");
	} catch {
		return "";
	}
}

/**
 * 1つのモデルでストリーミング生成し、届いた文字を順に返す。最初の文字が FIRST_CHUNK_MS 内に来なければ busy で失敗する
 * （呼ぶ側が次のモデルへ移る）。書き始めたあとの失敗はそのまま投げる（届いた分は呼ぶ側が使う）。
 * 200 で届いたのに1文字も書かなかったときは、理由（finishReason・promptFeedback.blockReason）をログに出して empty を投げる
 */
export async function* streamGemini(opts: StreamOptions): AsyncGenerator<string> {
	const doFetch = opts.fetch ?? fetch;
	const controller = new AbortController();
	const onAbort = () => controller.abort();
	opts.signal?.addEventListener("abort", onAbort);
	const firstTimer = setTimeout(() => controller.abort(), FIRST_CHUNK_MS);
	const deadline = setTimeout(() => controller.abort(), MODEL_DEADLINE_MS);
	let started = false;
	const why: Why = {};
	try {
		const thinking = thinkingConfigFor(opts.model);
		let res: Response;
		try {
			res = await doFetch(`https://${GEMINI_HOST}/v1beta/models/${encodeURIComponent(opts.model)}:streamGenerateContent?alt=sse`, {
				method: "POST",
				headers: { "Content-Type": "application/json", "x-goog-api-key": opts.apiKey },
				body: JSON.stringify({
					systemInstruction: { parts: [{ text: opts.system }] },
					contents: [{ role: "user", parts: [{ text: opts.user }] }],
					generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS, ...(thinking ? { thinkingConfig: thinking } : {}) },
				}),
				signal: controller.signal,
			});
		} catch (err) {
			throw controller.signal.aborted ? new GeminiError("busy", "時間切れ") : new GeminiError("network", String(err));
		}
		if (!res.ok) throw classify(res.status, await res.text().catch(() => ""));
		if (!res.body) throw new GeminiError("busy", "本文が空");

		const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
		let buffer = "";
		while (true) {
			let chunk: ReadableStreamReadResult<string>;
			try {
				chunk = await reader.read();
			} catch (err) {
				throw controller.signal.aborted ? new GeminiError("busy", "時間切れ") : new GeminiError("network", String(err));
			}
			if (chunk.done) break;
			buffer += chunk.value.replaceAll("\r\n", "\n");
			let end = buffer.indexOf("\n\n");
			while (end >= 0) {
				const event = buffer.slice(0, end);
				buffer = buffer.slice(end + 2);
				for (const line of event.split("\n")) {
					if (!line.startsWith("data:")) continue;
					const text = textOf(line.slice(5).trim(), opts.onUsage, why);
					if (!text) continue;
					if (!started) {
						started = true;
						clearTimeout(firstTimer);
					}
					yield text;
				}
				end = buffer.indexOf("\n\n");
			}
		}
		const rest = buffer.trim();
		if (rest.startsWith("data:")) {
			const text = textOf(rest.slice(5).trim(), opts.onUsage, why);
			if (text) {
				started = true;
				yield text;
			}
		}
		if (!started) {
			// 安全のブロックなどで、200 のまま1文字も書かれなかった。理由をログに残して、次のモデルへ移ってもらう
			console.log(JSON.stringify({ event: "gemini_empty", model: opts.model, finishReason: why.finishReason ?? null, blockReason: why.blockReason ?? null }));
			throw new GeminiError("empty", `1文字も書かなかった finishReason=${why.finishReason ?? "なし"} blockReason=${why.blockReason ?? "なし"}`);
		}
	} finally {
		clearTimeout(firstTimer);
		clearTimeout(deadline);
		opts.signal?.removeEventListener("abort", onAbort);
	}
}
