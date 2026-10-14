/** サイトの名前。画面の題名の「〇〇｜哲マロ(ぬ)」に使う */
export const SITE_NAME = "哲マロ(ぬ)";

/** トップの題名（index.html の <title> と同じ）。ほかの画面から戻ったときもこれにする */
export const TOP_TITLE = "哲マロ(ぬ)｜悩みを哲学者たちに相談できる";

/** サイトの説明（index.html の description と同じ） */
export const SITE_DESCRIPTION =
	"悩みを送ると、ソクラテスやニーチェ、ブッダ、孔子など、考え方の違う哲学者たちが答えてくれます。見比べて、自分に合う答えを見つけましょう。";

/** サイトの URL。リンクカードの画像など、絶対 URL が要るところで使う */
export const SITE_URL = "https://tetsumaro.oshilog.life";

/**
 * Turnstile のサイトキー（公開してよい値。アカウント nnhr のウィジェット「tetsumaro.oshilog.life」）。
 * 対になるシークレットは Worker のシークレット TURNSTILE_SECRET_KEY に入れる（入っていなければ確かめない）
 */
export const TURNSTILE_SITE_KEY = "0x4AAAAAAFWW-3T42SoYEFtU";

/** 相談は1000字まで。自分の答えは200字、公開名は20字まで */
export const BODY_MAX = 1000;
export const MY_ANSWER_MAX = 200;
export const NAME_MAX = 20;
/** 1つの端末から1日に送れる相談の数（D1 で数える。worker/routes/consult.ts） */
export const DAILY_PER_OWNER = 10;
/** 最初に答える人数と、「ほかの哲学者にも聞く」で足す人数。最初の7人のうち、哲学者（心理学・実践の知恵以外）は5人以上 */
export const ANSWER_COUNT = 7;
export const MORE_COUNT = 2;
export const MIN_PHILOSOPHY = 5;

/** 一般向けと大人向け（大人向けは後で seiheki.net の下に開く。今は general だけ） */
export type Mode = "general" | "adult";

/**
 * 任意で聞く年代・性別（集計にだけ使う。ほかの人には見せない）。
 * 18歳未満は使えない（Gemini API の規約: 18歳未満が使う・使いそうなアプリに使わない）ので、10代は「18〜19歳」
 */
export const AGE_BANDS = [
	{ id: "10s", label: "18〜19歳" },
	{ id: "20s", label: "20代" },
	{ id: "30s", label: "30代" },
	{ id: "40s", label: "40代" },
	{ id: "50s", label: "50代" },
	{ id: "60s", label: "60代以上" },
] as const;
export type AgeBandId = (typeof AGE_BANDS)[number]["id"];

export const GENDERS = [
	{ id: "female", label: "女性" },
	{ id: "male", label: "男性" },
	{ id: "other", label: "そのほか" },
] as const;
export type GenderId = (typeof GENDERS)[number]["id"];
