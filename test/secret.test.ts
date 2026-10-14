import { describe, expect, it } from "vitest";
import { sameSecret } from "../worker/secret";

describe("合言葉の比較", () => {
	it("同じ文字列だけが一致する", async () => {
		expect(await sameSecret("Bearer secret-token", "Bearer secret-token")).toBe(true);
		expect(await sameSecret("Bearer secret-token", "Bearer secret-tokeN")).toBe(false);
		expect(await sameSecret("Bearer secret-token", "Bearer secret-toke")).toBe(false);
		expect(await sameSecret("Bearer secret-token", "Bearer secret-token2")).toBe(false);
		expect(await sameSecret("", "Bearer secret-token")).toBe(false);
	});

	it("日本語や長さの違うものも比べられる", async () => {
		expect(await sameSecret("ひみつ🔑", "ひみつ🔑")).toBe(true);
		expect(await sameSecret("ひみつ🔑", "ひみつ")).toBe(false);
		expect(await sameSecret("a".repeat(5000), "a".repeat(5000))).toBe(true);
		expect(await sameSecret("a".repeat(5000), "a".repeat(4999))).toBe(false);
	});
});
