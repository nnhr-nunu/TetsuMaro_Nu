/**
 * 文の近さ（文字2つずつの TF-IDF とコサイン）。日本語は単語に区切らなくても、2文字ずつの重なりでおおよその近さが分かる。
 * API を呼ばないので無料枠を使わない。ぬぬはらの関連回答を探すのに使う（後で意味の近さ＝埋め込みに替えるなら、ここを差し替える）
 */

export type TextIndex = {
	idf: Map<string, number>;
	docs: { id: string; vec: Map<string, number>; norm: number }[];
};

/** これより近くないものは「関係ない」として返さない */
const MIN_SCORE = 0.05;

/** ひらがなだけの2文字（「して」「です」など）は、どの文にも出やすいので軽く数える */
const KANA_ONLY = /^[\p{Script=Hiragana}ー]+$/u;
const KANA_WEIGHT = 0.3;

function grams(text: string): Map<string, number> {
	const counts = new Map<string, number>();
	const segments = text.normalize("NFKC").toLowerCase().split(/[^\p{L}\p{N}]+/u);
	for (const seg of segments) {
		for (let i = 0; i + 2 <= seg.length; i++) {
			const g = seg.slice(i, i + 2);
			counts.set(g, (counts.get(g) ?? 0) + 1);
		}
	}
	return counts;
}

function weigh(counts: Map<string, number>, idf: Map<string, number>): { vec: Map<string, number>; norm: number } {
	const vec = new Map<string, number>();
	let sum = 0;
	for (const [g, tf] of counts) {
		const w = tf * (idf.get(g) ?? 0) * (KANA_ONLY.test(g) ? KANA_WEIGHT : 1);
		if (w <= 0) continue;
		vec.set(g, w);
		sum += w * w;
	}
	return { vec, norm: Math.sqrt(sum) };
}

export function buildIndex(docs: readonly { id: string; text: string }[]): TextIndex {
	const counted = docs.map((d) => ({ id: d.id, counts: grams(d.text) }));
	const df = new Map<string, number>();
	for (const { counts } of counted) for (const g of counts.keys()) df.set(g, (df.get(g) ?? 0) + 1);
	const n = docs.length;
	const idf = new Map<string, number>();
	for (const [g, f] of df) idf.set(g, Math.log((n + 1) / (f + 1)) + 1);
	return { idf, docs: counted.map(({ id, counts }) => ({ id, ...weigh(counts, idf) })) };
}

/** query に近い順に k 件まで。近さが MIN_SCORE に届かないものは返さない */
export function rank(index: TextIndex, query: string, k: number): { id: string; score: number }[] {
	const q = weigh(grams(query), index.idf);
	if (q.norm === 0) return [];
	const scored: { id: string; score: number }[] = [];
	for (const d of index.docs) {
		if (d.norm === 0) continue;
		let dot = 0;
		for (const [g, w] of q.vec) dot += w * (d.vec.get(g) ?? 0);
		const score = dot / (q.norm * d.norm);
		if (score >= MIN_SCORE) scored.push({ id: d.id, score });
	}
	return scored.sort((a, b) => b.score - a.score).slice(0, k);
}
