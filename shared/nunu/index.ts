import type { Mode } from "../site";
import { buildIndex, rank } from "../similarity";
import type { CategoryId } from "../themes";
import data from "./answers.json";

/**
 * ぬぬはらのマシュマロ回答（`npm run nunu:fetch` で取り込む。scripts/nunu-fetch.mjs）。
 * audience が adult のものは、一般向けでは関連回答にも AIぬぬはらの手本にも使わない
 */
export type NunuAnswer = {
	id: string;
	url: string;
	/** 回答した日（YYYY-MM-DD） */
	date: string;
	question: string;
	answer: string;
	audience: "general" | "adult";
	category: CategoryId;
};

export const NUNU_ANSWERS: readonly NunuAnswer[] = data as NunuAnswer[];

/** 回答の一覧から、相談に近い回答を探す関数を作る（テストでは別の一覧を渡す） */
export function createNunuFinder(answers: readonly NunuAnswer[]) {
	let index: ReturnType<typeof buildIndex> | null = null;
	const byId = new Map(answers.map((a) => [a.id, a]));
	return (query: string, mode: Mode, k = 3): NunuAnswer[] => {
		index ??= buildIndex(answers.map((a) => ({ id: a.id, text: `${a.question}\n${a.answer}` })));
		return rank(index, query, answers.length)
			.map((r) => byId.get(r.id))
			.filter((a): a is NunuAnswer => a !== undefined && (mode === "adult" || a.audience === "general"))
			.slice(0, k);
	};
}

/** 相談に近いぬぬはらの回答（一般向けでは大人の印のものを除く） */
export const relatedNunu = createNunuFinder(NUNU_ANSWERS);

const BY_ID = new Map(NUNU_ANSWERS.map((a) => [a.id, a]));
export const nunuById = (id: string): NunuAnswer | undefined => BY_ID.get(id);
