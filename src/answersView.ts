import type { AnswerEvent } from "../shared/api";

/**
 * 画面に出す回答。保存された分（読み直した中身）・いま届いている分・ほかの哲学者の分を、同じ人を重ねずに届いた順でつなぐ。
 * 読み直しが失敗して保存された分が古いまま（書きかけの0人など）でも、届いた分を消さないため
 */
export function visibleAnswers(parts: { saved: AnswerEvent[]; live: AnswerEvent[]; more: AnswerEvent[] }): AnswerEvent[] {
	const seen = new Set<string>();
	return [...parts.saved, ...parts.live, ...parts.more].filter((a) => !seen.has(a.philosopher) && seen.add(a.philosopher));
}
