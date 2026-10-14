/** 分野。7人のうち、哲学（philosophy）が5人以上になるように選ぶ */
export type Field = "philosophy" | "psychology" | "practical";

/** 名簿のページでの並びのまとまり */
export type Group = "ancient" | "eastern" | "modern" | "contemporary" | "japan" | "psychology" | "practical";

/** 回答の「考え方のもと」に出す概念。id は "<人の id>.<英小文字>"。AI はこの id で選ぶ */
export type Concept = { id: string; name: string; desc: string };

/** 名言。id は "<人の id>.q<番号>"。AI は id で選び、本文は名簿から差し込む（AI に書き写させない）。確かな出典が言えるものだけ載せる */
export type Quote = { id: string; text: string; source: string };

export type Philosopher = {
	id: string;
	name: string;
	kana: string;
	/** 生没年（例「前470頃〜前399」） */
	years: string;
	/** 生きた地域（例「古代ギリシャ（アテナイ）」） */
	region: string;
	field: Field;
	group: Group;
	/** shared/schools.ts の id。同じ学派の人は7人の中に1人まで */
	school: string | null;
	/** 絵の背景と画面の色（"#RRGGBB"） */
	color: string;
	/** この人の考え方（40字以内）。比べ表・カード・名簿で使う */
	oneLine: string;
	/** 中心の考え（数行）。AI への指示と名簿のページで使う */
	core: string;
	works: string[];
	concepts: Concept[];
	quotes: Quote[];
	/** 言わせないこと（よくある誤解・俗説・出典の怪しい言葉・時代に合わない話） */
	avoid: string[];
	/** 語り口（一人称・相手の呼び方・口ぐせ・答え方） */
	voice: string;
	/** 死や苦しみを扱う思想。カードに「思想の紹介で、死を勧めるものではありません」を添える */
	heavyTheme?: boolean;
	/** 一般向けのときだけ指示文に足す注意（フロイトなど） */
	generalNote?: string;
};
