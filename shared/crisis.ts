/**
 * 重い相談（死にたい・自傷・虐待など）。AI の印（meta の crisis）か、ここの言葉のどちらかで、回答の上に窓口を出す。
 * 言葉は AI の取りこぼしに備えるためのもの。「死生観」「亡くなった」のように、言葉だけでは重いと決められないものは入れない
 */
const CRISIS_PATTERNS: readonly RegExp[] = [
	/死にたい/,
	/消えたい/,
	/いなくなりたい/,
	/生きていたくない/,
	/生きるのが(つらい|辛い|しんどい)/,
	/自殺/,
	/自死/,
	/自傷/,
	/リスカ|リストカット|アムカ/,
	/オーバードーズ|\bOD\b/,
	/首(を|吊)/,
	/飛び降り/,
	/虐待/,
	/殴られ|暴力を(振|ふ)るわれ/,
	/\bDV\b/,
];

export function looksCrisis(text: string): boolean {
	return CRISIS_PATTERNS.some((re) => re.test(text));
}

/**
 * 相談窓口。番号と時間は厚生労働省「まもろうよ こころ」の電話相談のページ（https://www.mhlw.go.jp/mamorouyokokoro/soudan/tel/）で
 * 2026-10-14 に確かめた。変わることがあるので、最後に「まもろうよ こころ」へのリンクを置く
 */
export const HOTLINES: readonly { name: string; tel?: string; hours: string; url: string }[] = [
	{ name: "#いのちSOS", tel: "0120-061-338", hours: "24時間", url: "https://www.lifelink.or.jp/inochisos/" },
	{ name: "よりそいホットライン", tel: "0120-279-338", hours: "24時間", url: "https://www.since2011.net/yorisoi/" },
	{ name: "いのちの電話", tel: "0120-783-556", hours: "毎日16時〜21時", url: "https://www.inochinodenwa.org/" },
	{ name: "24時間子供SOSダイヤル", tel: "0120-0-78310", hours: "24時間", url: "https://www.mext.go.jp/a_menu/shotou/seitoshidou/06112210.htm" },
	{ name: "まもろうよ こころ（SNS・チャットの相談も）", hours: "窓口ごと", url: "https://www.mhlw.go.jp/mamorouyokokoro/" },
];
