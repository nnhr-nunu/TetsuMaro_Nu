import { acceptAnswer } from "../shared/answerStream";
import { looksCrisis } from "../shared/crisis";
import { PHILOSOPHERS } from "../shared/philosophers";
import type { Mode } from "../shared/site";
import { GeminiError } from "./gemini/client";

/**
 * 偽の AI。キーが無いとき（手元・テスト・E2E）に、本物と同じ形の行を返す。名簿の先頭から、選び方の決まりを満たす人を選ぶ。
 * behavior（AI_FAKE の値）: "1" ふつう / "stop:N" N 人答えたところで終わる（途中で切れたとき） / "daily" 日の上限 / "fail" 失敗
 */
export async function* fakeAiStream(opts: { count: number; exclude: readonly string[]; mode: Mode; body: string; behavior: string }): AsyncGenerator<string> {
	if (opts.behavior === "daily") throw new GeminiError("daily_limit", "偽の AI: 日の上限");
	if (opts.behavior === "fail") throw new GeminiError("busy", "偽の AI: 失敗");
	const stop = /^stop:(\d+)$/.exec(opts.behavior);
	const limit = stop ? Number(stop[1]) : opts.count;
	const more = opts.exclude.length > 0;

	const state = { answered: [] as string[], count: opts.count, exclude: [...opts.exclude] };
	for (const p of PHILOSOPHERS) {
		if (state.answered.length >= opts.count) break;
		if (acceptAnswer(state, { philosopher: p.id })) state.answered.push(p.id);
	}

	const lines: object[] = [];
	if (!more) lines.push({ type: "meta", category: "other", tags: [], crisis: looksCrisis(opts.body), picks: state.answered });
	for (const id of state.answered.slice(0, limit)) {
		const p = PHILOSOPHERS.find((x) => x.id === id);
		if (!p) continue;
		lines.push({
			type: "answer",
			philosopher: p.id,
			conclusion: p.oneLine.slice(0, 30),
			body: `（これは開発用の仮の回答です）${p.name}の考え方から答えます。${p.core}`,
			concepts: p.concepts.slice(0, 1).map((c) => c.id),
			quote: p.quotes[0]?.id ?? null,
		});
	}
	if (!more && !stop) lines.push({ type: "nunu", body: "（これは開発用の仮の回答です）話してくれてありがとう。まずは、今のしんどさをそのまま認めてあげてね。" });

	for (const line of lines) {
		const text = `${JSON.stringify(line)}\n`;
		const half = Math.floor(text.length / 2);
		yield text.slice(0, half);
		await new Promise((r) => setTimeout(r, 5));
		yield text.slice(half);
	}
}
