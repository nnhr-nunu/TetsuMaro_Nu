import type { Mode } from "../shared/site";
import type { AppEnv } from "./env";
import { fakeAiStream } from "./fakeAi";
import { generateText } from "./gemini/generate";

export type AiRun = {
	/** 届いた文字（行の途中で切れていることがある。LineSplitter で行に分ける） */
	text: AsyncGenerator<string>;
	/** 書き始めたモデルの名前（偽の AI は "fake"）。書き始める前は null */
	model(): string | null;
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
		return { text: fakeAiStream({ ...opts, behavior: env.AI_FAKE || "1" }), model: () => "fake" };
	}
	let used: string | null = null;
	const text = generateText({
		apiKey: env.GEMINI_API_KEY,
		system: prompt.system,
		user: prompt.user,
		signal: opts.signal,
		onModel: (m) => {
			used = m;
		},
	});
	return { text, model: () => used };
}
