import type { Mode } from "../shared/site";
import type { AppEnv } from "./env";
import { fakeAiStream } from "./fakeAi";
import { generateText } from "./gemini/generate";

export type AiRun = {
	/** 届いた文字（行の途中で切れていることがある。LineSplitter で行に分ける） */
	text: AsyncGenerator<string>;
	/** 書き始めたモデルの名前（偽の AI は "fake"）。書き始める前は null */
	model(): string | null;
	/** 使ったトークン数（Gemini が知らせた最後の値）。偽の AI と、まだ届いていないときは null */
	usage(): { prompt: number; output: number } | null;
	/** 本物の Gemini を呼んだか（呼んだ回数と失敗を ai_usage に数えるかどうか。1文字も書かれずに失敗したときも true） */
	real: boolean;
};

/**
 * 相談の回答を作る。キーが無いとき・AI_FAKE が入っているときは偽の AI（worker/fakeAi.ts）。
 * テストは AI_FAKE に "stop:3" などを入れて、途中で切れたときや上限のときを試す
 */
export function aiStream(
	env: AppEnv["Bindings"],
	prompt: { system: string; user: string },
	opts: { count: number; exclude: readonly string[]; mode: Mode; body: string; signal?: AbortSignal },
): AiRun {
	if (!env.GEMINI_API_KEY || env.AI_FAKE) {
		return { text: fakeAiStream({ ...opts, behavior: env.AI_FAKE || "1" }), model: () => "fake", usage: () => null, real: false };
	}
	let used: string | null = null;
	let usage: { prompt: number; output: number } | null = null;
	const text = generateText({
		apiKey: env.GEMINI_API_KEY,
		system: prompt.system,
		user: prompt.user,
		signal: opts.signal,
		onModel: (m) => {
			used = m;
		},
		onUsage: (u) => {
			usage = u;
		},
	});
	return { text, model: () => used, usage: () => usage, real: true };
}
