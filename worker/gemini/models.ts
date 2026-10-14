/**
 * 使う Gemini のモデル。上から順に試し、混んでいる（503・時間切れ・一時的な 429）・日の上限のときは次へ。
 * 無料枠で使えるモデルは変わるので、キーができたら models API（GET /v1beta/models）で確かめて並べ直す。
 * 出発点は TopicStream の一覧（2026-09-25 の実測で 3.5-flash-lite が速く安定、3.6-flash は 503 が多い）。
 * 哲学者らしさを優先して 3.6-flash を先に試し、混んでいれば軽いモデルへ
 */
export const GEMINI_MODELS: readonly string[] = ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-flash-latest"];

export const GEMINI_HOST = "generativelanguage.googleapis.com";

/** 7人分の回答は長いので、途中で切れないよう多めに */
export const MAX_OUTPUT_TOKENS = 8192;

/** 最初の文字がこの時間内に来ないモデルは諦めて次へ（名簿の指示文が長いので、TopicStream より長めに待つ） */
export const FIRST_CHUNK_MS = 20_000;

/** 1つのモデルで書き終えるまでの上限 */
export const MODEL_DEADLINE_MS = 120_000;

/** 混んでいたモデルを後回しにする時間 */
export const COOLDOWN_MS = 120_000;

/** 思考の設定（TopicStream の gemini-models.ts と同じ。思考に時間を使いすぎない） */
export function thinkingConfigFor(model: string): Record<string, unknown> | undefined {
	if (/^gemini-2\.5-flash/.test(model)) return { thinkingBudget: 0 };
	if (/^gemini-3\.[78]-flash/.test(model)) return { thinkingLevel: "low" };
	if (/^gemini-3(\.[56])?-flash/.test(model)) return { thinkingLevel: "minimal" };
	return undefined;
}
