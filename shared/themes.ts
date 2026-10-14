/**
 * 相談のテーマ。大分類（10＋その他）と小分類。どちらも AI にこの表から選ばせる（表にないものは捨てる）。
 * 自由に作らせると表記が揺れて、みんなの相談を探せなくなるため
 */

export const CATEGORIES = [
	{ id: "love", name: "恋愛" },
	{ id: "family", name: "家族" },
	{ id: "relationships", name: "友人・人間関係" },
	{ id: "work", name: "仕事" },
	{ id: "school", name: "学校・勉強" },
	{ id: "money", name: "お金" },
	{ id: "self", name: "自分のこと" },
	{ id: "life", name: "生き方・将来" },
	{ id: "health", name: "心と体" },
	{ id: "loss", name: "死・別れ" },
	{ id: "other", name: "その他" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export const TAGS: readonly { id: string; name: string; category: CategoryId }[] = [
	{ id: "crush", name: "片思い", category: "love" },
	{ id: "heartbreak", name: "失恋", category: "love" },
	{ id: "cheating", name: "浮気・不倫", category: "love" },
	{ id: "marriage", name: "結婚", category: "love" },
	{ id: "partner", name: "恋人との関係", category: "love" },
	{ id: "no-encounter", name: "出会いがない", category: "love" },
	{ id: "parents", name: "親との関係", category: "family" },
	{ id: "parenting", name: "子育て", category: "family" },
	{ id: "siblings", name: "きょうだい", category: "family" },
	{ id: "spouse", name: "夫婦", category: "family" },
	{ id: "caregiving", name: "介護", category: "family" },
	{ id: "friends", name: "友だち", category: "relationships" },
	{ id: "coworkers", name: "職場の人間関係", category: "relationships" },
	{ id: "loneliness", name: "孤独", category: "relationships" },
	{ id: "others-eyes", name: "人の目が気になる", category: "relationships" },
	{ id: "jealousy", name: "嫉妬", category: "relationships" },
	{ id: "dislike", name: "苦手な人", category: "relationships" },
	{ id: "bullying", name: "いじめ", category: "relationships" },
	{ id: "job-fit", name: "仕事が合わない", category: "work" },
	{ id: "job-change", name: "転職", category: "work" },
	{ id: "overwork", name: "働きすぎ", category: "work" },
	{ id: "motivation", name: "やる気が出ない", category: "work" },
	{ id: "boss", name: "上司", category: "work" },
	{ id: "failure", name: "失敗", category: "work" },
	{ id: "career", name: "将来のキャリア", category: "work" },
	{ id: "exam", name: "受験", category: "school" },
	{ id: "study", name: "勉強が続かない", category: "school" },
	{ id: "path", name: "進路", category: "school" },
	{ id: "school-refusal", name: "学校に行けない", category: "school" },
	{ id: "money-worry", name: "お金の不安", category: "money" },
	{ id: "debt", name: "借金", category: "money" },
	{ id: "inequality", name: "貧しさ・格差", category: "money" },
	{ id: "self-esteem", name: "自己肯定感", category: "self" },
	{ id: "inferiority", name: "劣等感", category: "self" },
	{ id: "identity", name: "自分が分からない", category: "self" },
	{ id: "change-self", name: "性格を変えたい", category: "self" },
	{ id: "anger", name: "怒り", category: "self" },
	{ id: "indecision", name: "決められない", category: "self" },
	{ id: "perfectionism", name: "完璧主義", category: "self" },
	{ id: "sexuality", name: "性・セクシュアリティ", category: "self" },
	{ id: "meaning", name: "生きる意味", category: "life" },
	{ id: "future-anxiety", name: "将来の不安", category: "life" },
	{ id: "dream", name: "夢", category: "life" },
	{ id: "regret", name: "後悔", category: "life" },
	{ id: "choice", name: "人生の選択", category: "life" },
	{ id: "no-time", name: "時間がない", category: "life" },
	{ id: "happiness", name: "幸せとは", category: "life" },
	{ id: "anxiety", name: "不安・心配", category: "health" },
	{ id: "depressed", name: "落ち込み", category: "health" },
	{ id: "sleep", name: "眠れない", category: "health" },
	{ id: "illness", name: "病気", category: "health" },
	{ id: "body", name: "体の悩み", category: "health" },
	{ id: "addiction", name: "やめられない", category: "health" },
	{ id: "fear-of-death", name: "死が怖い", category: "loss" },
	{ id: "bereavement", name: "大切な人を亡くした", category: "loss" },
	{ id: "pet-loss", name: "ペットとの別れ", category: "loss" },
	{ id: "parting", name: "別れ", category: "loss" },
];

const CATEGORY_IDS = new Set<string>(CATEGORIES.map((c) => c.id));
const TAG_BY_ID = new Map(TAGS.map((t) => [t.id, t]));

/** 小分類は1つの相談に3つまで */
export const MAX_TAGS = 3;

export function isCategory(v: unknown): v is CategoryId {
	return typeof v === "string" && CATEGORY_IDS.has(v);
}

/** AI が返した小分類から、表にあるものだけを重ならず3つまで残す */
export function normalizeTags(v: unknown): string[] {
	if (!Array.isArray(v)) return [];
	const out: string[] = [];
	for (const id of v) {
		if (typeof id === "string" && TAG_BY_ID.has(id) && !out.includes(id)) out.push(id);
		if (out.length === MAX_TAGS) break;
	}
	return out;
}

export const categoryName = (id: string): string => CATEGORIES.find((c) => c.id === id)?.name ?? "その他";
export const tagName = (id: string): string | undefined => TAG_BY_ID.get(id)?.name;
export const tagsOf = (category: CategoryId) => TAGS.filter((t) => t.category === category);
