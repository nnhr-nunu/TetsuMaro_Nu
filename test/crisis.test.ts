import { describe, expect, it } from "vitest";
import { HOTLINES, looksCrisis } from "../shared/crisis";
import { findPersonalInfo } from "../shared/personalInfo";

describe("looksCrisis", () => {
	it.each(["もう死にたい", "消えたい気持ちが続く", "リスカしてしまう", "親から虐待されている", "自殺を考えてる"])("「%s」は重い相談", (text) => {
		expect(looksCrisis(text)).toBe(true);
	});
	it.each(["死生観について知りたい", "祖母が亡くなって悲しい", "仕事を辞めたい"])("「%s」は言葉だけでは重い相談にしない", (text) => {
		expect(looksCrisis(text)).toBe(false);
	});
	it("窓口には名前と URL がある", () => {
		expect(HOTLINES.length).toBeGreaterThan(2);
		for (const h of HOTLINES) expect(h.url).toMatch(/^https:\/\//);
	});
});

describe("findPersonalInfo", () => {
	it("電話番号を見つける", () => expect(findPersonalInfo("090-1234-5678 に連絡して")).toEqual(["tel"]));
	it("メールアドレスを見つける", () => expect(findPersonalInfo("a@b.jp まで")).toEqual(["email"]));
	it("URL を見つける", () => expect(findPersonalInfo("https://x.com/me を見て")).toEqual(["url"]));
	it("日付や数字だけなら何もない", () => expect(findPersonalInfo("2024年の春、3回目の受験")).toEqual([]));
});
