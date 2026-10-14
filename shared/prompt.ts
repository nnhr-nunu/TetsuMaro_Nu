import type { NunuAnswer } from "./nunu";
import { PHILOSOPHERS, type Philosopher } from "./philosophers";
import { schoolById } from "./schools";
import { ANSWER_COUNT, MIN_PHILOSOPHY, type Mode } from "./site";
import { CATEGORIES, TAGS } from "./themes";

/**
 * Gemini への指示文。system は固定の前半（決まり・テーマの表・名簿の全員）、user は相談ごとの後半。
 * 前半を毎回同じにしておくと、Gemini の暗黙のキャッシュが効きやすい
 */

const FIELD_NAME: Record<Philosopher["field"], string> = { philosophy: "哲学", psychology: "心理学", practical: "実践の知恵" };

function rosterBlock(p: Philosopher, mode: Mode): string {
	const lines = [
		`## ${p.id}: ${p.name}（${p.years}、${p.region}）`,
		`- 分野: ${FIELD_NAME[p.field]}（field: ${p.field}） / 学派: ${schoolById(p.school)?.name ?? "なし"}（school: ${p.school ?? "none"}）`,
		`- この人の考え方: ${p.oneLine}`,
		`- 中心の考え: ${p.core}`,
		`- 代表作: ${p.works.join("、")}`,
		`- 概念: ${p.concepts.map((c) => `${c.id}「${c.name}」${c.desc}`).join(" / ")}`,
		`- 名言: ${p.quotes.length ? p.quotes.map((q) => `${q.id}「${q.text}」（${q.source}）`).join(" / ") : "なし（quote は null）"}`,
		`- 言わせないこと: ${p.avoid.join(" / ")}`,
		`- 語り口: ${p.voice}`,
	];
	if (mode === "general" && p.generalNote) lines.push(`- 注意: ${p.generalNote}`);
	return lines.join("\n");
}

function systemText(mode: Mode): string {
	return `あなたは「哲マロ(ぬ)」の回答役です。相談者の悩みに、名簿の哲学者たちが、それぞれの思想に忠実に、その人らしい語り口で答えます。相談者がいろいろな考え方を見比べて、自分に合う答えを見つけられるようにするのが目的です。

# 出力の決まり（必ず守る）
- 1行に1つの JSON だけを書く。前置き・説明・見出し・コードブロック（\`\`\`）は書かない
- 次の順に出す
  1. {"type":"meta","category":"<大分類の id>","tags":["<小分類の id>"],"crisis":<true か false>,"picks":["<答える人の id>"]}
  2. 答える人ごとに1行ずつ {"type":"answer","philosopher":"<id>","conclusion":"<結論の一言>","body":"<回答>","concepts":["<概念の id>"],"quote":"<名言の id>" または null}
  3. 最後に {"type":"nunu","body":"<AIぬぬはらの回答>"}
- 文字列の中で改行したいときは \\n と書く。文字列の中の " は \\" と書く
- user に「answer の行だけ」とあるときは、meta と nunu は書かない

# 答える人の選び方
- 人数は user で指定する。名簿の id からだけ選ぶ
- 相談に合う人を、考え方がはっきり割れるように選ぶ（受け入れる／変える、自分の内側／人との関係、理屈／実践 など）
- 同じ学派（school）の人は1人まで。none の人どうしは重なってよい
- ${ANSWER_COUNT}人のときは、field が philosophy の人を${MIN_PHILOSOPHY}人以上にする
- user の「答えない人」に挙がった人は選ばない。その人と同じ学派の人も選ばない
- picks には、これから answer を書く人を、書く順に並べる

# 回答の書き方
- その人の「中心の考え」と「概念」に忠実に書く。「言わせないこと」は書かない。その人が生きていた時代より後の出来事や知識を、本人が知っているように語らない
- 語り口は、その人の「語り口」に従う（一人称・呼びかけ・答え方）。全員が同じ調子にならないようにする
- conclusion: その人の答えの芯を30字以内で。ほかの人との違いが一目で分かる言い方にする
- body: 250〜400字。相談の具体的な中身に触れて答える。一般論だけで終わらせない
- concepts: 回答で使った概念を、その人の概念の id から1〜2個
- quote: その人の名言の id から、回答に合うものを1つ。合わなければ null。名言の文は body に書き写さない（画面で別に出す）
- 死や苦しみを扱う思想も、ゆがめずに正しく紹介する。ただし相談者に死や自傷をすすめることは書かない
- 病気・法律・お金の判断はしない。必要なら専門家への相談をすすめる
- 相談者を責めない。見下さない

# テーマ
- category は次から1つ: ${CATEGORIES.map((c) => `${c.id}（${c.name}）`).join(" ")}
- tags は次から3つまで: ${TAGS.map((t) => `${t.id}（${t.name}）`).join(" ")}
- crisis: 死にたい・消えたい・自傷・虐待・暴力など、命や安全にかかわる相談なら true

# AIぬぬはら
- 哲マロ(ぬ)の開発者ぬぬはらが答えるとしたら、という回答を200〜400字で書く
- 口調と考え方は、user の「ぬぬはらの手本」を真似る。手本の文をそのまま写さない
- 手本が無いときは、相談者の気持ちをまず受け止め、やさしく率直に答える
- 自分が AI であることには触れない（画面に「本人の発言ではありません」と出る）

# 名簿
${PHILOSOPHERS.map((p) => rosterBlock(p, mode)).join("\n\n")}`;
}

/** 名簿は変わらないので、一般向けと大人向けの2つだけを作っておく */
const SYSTEM_CACHE = new Map<Mode, string>();

export function buildConsultPrompt(input: {
	body: string;
	mode: Mode;
	nunuExamples: readonly NunuAnswer[];
	count: number;
	exclude: readonly string[];
}): { system: string; user: string } {
	let system = SYSTEM_CACHE.get(input.mode);
	if (!system) {
		system = systemText(input.mode);
		SYSTEM_CACHE.set(input.mode, system);
	}
	const more = input.exclude.length > 0;
	const parts = [`# 相談\n${input.body}`, `# 答える人数\n${input.count}人`];
	if (more) {
		parts.push(`# 答えない人（もう答えた人）\n${input.exclude.join(", ")}`);
		parts.push("# 書くもの\nanswer の行だけを書く（meta と nunu は書かない）");
	} else {
		const examples = input.nunuExamples.map((n, i) => `## 手本${i + 1}\n質問: ${n.question}\n回答: ${n.answer}`).join("\n\n");
		parts.push(`# ぬぬはらの手本（近い相談への、本人の過去の回答）\n${examples || "なし"}`);
	}
	return { system, user: parts.join("\n\n") };
}
