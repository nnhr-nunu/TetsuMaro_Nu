/** 共有の前に知らせる、個人が分かりそうなもの（文字で見分けられるものだけ。名前や学校名は見分けられないので、注意書きで頼む） */
export type PersonalInfoKind = "tel" | "email" | "url";

const PATTERNS: readonly [PersonalInfoKind, RegExp][] = [
	["tel", /(?<!\d)0\d{1,4}[-ー－ ]?\d{1,4}[-ー－ ]?\d{3,4}(?!\d)/],
	["email", /[\w.+-]+@[\w-]+\.[\w.-]+/],
	["url", /https?:\/\/\S+|www\.\S+/i],
];

export function findPersonalInfo(text: string): PersonalInfoKind[] {
	return PATTERNS.filter(([, re]) => re.test(text)).map(([kind]) => kind);
}
