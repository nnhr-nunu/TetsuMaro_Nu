import { FIRST_CHUNK_MS, GEMINI_HOST, MAX_OUTPUT_TOKENS, MODEL_DEADLINE_MS, thinkingConfigFor } from "./models";

/**
 * Gemini の失敗の種類。busy: 混雑・一時的な上限・時間切れ（次のモデルへ） / daily_limit: 日の無料枠を使い切った /
 * auth: キーが違う（どのモデルでも同じなので諦める） / bad_request: そのモデルが使えない（次のモデルへ） / network: つながらない
 */
export type GeminiErrorKind = "busy" | "daily_limit" | "auth" | "bad_request" | "network";

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
};

function classify(status: number, text: string): GeminiError {
	if (status === 429) return new GeminiError(/PerDay|per day/i.test(text) ? "daily_limit" : "busy", text.slice(0, 300));
	if (status === 401 || status === 403) return new GeminiError("auth", text.slice(0, 300));
	if (status === 400 || status === 404) return new GeminiError("bad_request", text.slice(0, 300));
	return new GeminiError("busy", `${status} ${text.slice(0, 300)}`);
}

/** SSE の1つの data から、思考でない部分の文字を取り出す */
function textOf(data: string): string {
	try {
		const json = JSON.parse(data) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
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
 * （呼ぶ側が次のモデルへ移る）。書き始めたあとの失敗はそのまま投げる（届いた分は呼ぶ側が使う）
 */
export async function* streamGemini(opts: StreamOptions): AsyncGenerator<string> {
	const doFetch = opts.fetch ?? fetch;
	const controller = new AbortController();
	const onAbort = () => controller.abort();
	opts.signal?.addEventListener("abort", onAbort);
	const firstTimer = setTimeout(() => controller.abort(), FIRST_CHUNK_MS);
	const deadline = setTimeout(() => controller.abort(), MODEL_DEADLINE_MS);
	let started = false;
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
					const text = textOf(line.slice(5).trim());
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
			const text = textOf(rest.slice(5).trim());
			if (text) yield text;
		}
	} finally {
		clearTimeout(firstTimer);
		clearTimeout(deadline);
		opts.signal?.removeEventListener("abort", onAbort);
	}
}
