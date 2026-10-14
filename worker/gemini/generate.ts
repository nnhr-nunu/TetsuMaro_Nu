import { GeminiError, type StreamOptions, streamGemini } from "./client";
import { COOLDOWN_MS, GEMINI_MODELS } from "./models";

/** モデル → 後回しをやめる時刻。同じ Worker のインスタンスの中だけで覚える（次の人も同じモデルで待たされないように） */
const cooldown = new Map<string, number>();

export function clearCooldown(): void {
	cooldown.clear();
}

/** 後回し中のモデルを後ろへ回した順番 */
function modelOrder(now: number): string[] {
	const ready = GEMINI_MODELS.filter((m) => (cooldown.get(m) ?? 0) <= now);
	const cooling = GEMINI_MODELS.filter((m) => (cooldown.get(m) ?? 0) > now);
	return [...ready, ...cooling];
}

export type GenerateOptions = Omit<StreamOptions, "model"> & {
	/** 書き始めたモデルの名前を知らせる（保存用） */
	onModel?: (model: string) => void;
};

/**
 * モデルを順に試して生成する。書き始める前の混雑・時間切れ・使えないモデルは次へ。全部のモデルで日の上限なら daily_limit、
 * キーが違うなら auth を投げる。書き始めたあとの失敗はそのまま投げる（届いた分は呼ぶ側が保存する）
 */
export async function* generateText(opts: GenerateOptions): AsyncGenerator<string> {
	const models = modelOrder(Date.now());
	let daily = 0;
	let last: GeminiError | null = null;
	for (const model of models) {
		let started = false;
		try {
			for await (const text of streamGemini({ ...opts, model })) {
				if (!started) {
					started = true;
					opts.onModel?.(model);
				}
				yield text;
			}
			return;
		} catch (err) {
			if (started) throw err;
			const e = err instanceof GeminiError ? err : new GeminiError("network", String(err));
			if (e.kind === "auth") throw e;
			if (e.kind === "daily_limit") daily++;
			if (e.kind !== "bad_request") cooldown.set(model, Date.now() + COOLDOWN_MS);
			console.warn(`Gemini ${model} を諦めて次へ: ${e.kind} ${e.message}`);
			last = e;
			if (opts.signal?.aborted) break;
		}
	}
	if (daily === models.length) throw new GeminiError("daily_limit", "全部のモデルで日の上限");
	throw last ?? new GeminiError("busy", "使えるモデルがない");
}
