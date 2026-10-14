import { expect, test } from "@playwright/test";

test("名簿から一人のページを開き、学派の補足を読める", async ({ page }) => {
	await page.goto("/philosophers");
	await expect(page.getByRole("heading", { name: "哲学者の名簿" })).toBeVisible();
	await page.getByRole("link", { name: "ニーチェ" }).click();
	await expect(page).toHaveURL(/\/philosophers\/nietzsche$/);
	await expect(page.getByRole("heading", { name: "ニーチェ", level: 1 })).toBeVisible();
	await page.getByRole("button", { name: "生の哲学" }).first().click();
	await expect(page.getByRole("dialog")).toContainText("自分で価値を作る");
	await page.getByRole("button", { name: "閉じる" }).click();
	await expect(page.getByRole("dialog")).toBeHidden();
});

test("知らない哲学者のページは見つからないと出る", async ({ page }) => {
	const res = await page.goto("/philosophers/nobody");
	expect(res?.status()).toBe(404);
	await expect(page.getByText("見つかりませんでした")).toBeVisible();
});
