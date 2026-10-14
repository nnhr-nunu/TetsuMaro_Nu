import { expect, test } from "@playwright/test";
import { consult } from "./helpers";

test("相談すると、比べ表と7人のカードが並び、補足・刺さった・自分の答えが使える", async ({ page }) => {
	await consult(page, "仕事に行くのがつらくて、毎朝会社の前で足が止まります");

	// 比べ表の行は7つ。押すとその人のカードへ
	const table = page.getByRole("list").filter({ has: page.locator('a[href^="#a-"]') });
	await expect(table.locator("li")).toHaveCount(7);

	// 学派の名前を押すと補足が出て、Esc で閉じる
	await page.locator("article").first().getByRole("button", { name: "問答法" }).click();
	const sheet = page.getByRole("dialog");
	await expect(sheet).toBeVisible();
	await expect(sheet).toContainText("学派・思想の流れ");
	await page.keyboard.press("Escape");
	await expect(sheet).toBeHidden();

	// 刺さった → 自分の答えに並ぶ
	await page.locator("article").first().getByRole("button", { name: "刺さった" }).click();
	await expect(page.locator("#mine-title").locator("..")).toContainText("ソクラテス");
	await page.getByRole("textbox", { name: "見比べて、自分ならどうするか（任意）" }).fill("まず自分が本当に何を怖がっているのか問い直す");
	await page.getByRole("button", { name: "保存する" }).click();
	await expect(page.getByText("保存しました")).toBeVisible();

	// 読み直しても残っている
	await page.reload();
	await expect(page.getByRole("textbox", { name: "見比べて、自分ならどうするか（任意）" })).toHaveValue("まず自分が本当に何を怖がっているのか問い直す");
	await expect(page.locator("article").first().getByRole("button", { name: "刺さった" })).toHaveAttribute("aria-pressed", "true");
});

test("ほかの哲学者にも聞くと、カードが2枚増える", async ({ page }) => {
	await consult(page, "将来がなんとなく不安です");
	await page.getByRole("button", { name: "ほかの哲学者にも聞く（2人）" }).click();
	await expect(page.locator("article")).toHaveCount(9);
});

test("重い相談には、回答の上に相談窓口が出る", async ({ page }) => {
	await consult(page, "もう消えたいと毎日思ってしまう");
	await expect(page.getByRole("heading", { name: "ひとりで抱えこまないでください" })).toBeVisible();
});
