import { expect, test } from "@playwright/test";
import { consult } from "./helpers";

test("共有すると別の人が見られ、刺さったを押せて、みんなの相談で見つかる。共有をやめると見えなくなる", async ({ page, browser }) => {
	const id = await consult(page, "人の目が気になって自分の意見が言えません");
	await page.getByRole("textbox", { name: "公開名（空なら匿名）" }).fill("ぬー");
	await page.getByRole("button", { name: "みんなに共有する" }).click();
	await expect(page.getByRole("heading", { name: "みんなに共有しています" })).toBeVisible();

	// 別の人（Cookie のない新しい context）
	const other = await browser.newContext({ locale: "ja-JP" });
	const viewer = await other.newPage();
	await viewer.goto(`/c/${id}`);
	await expect(viewer.getByText("ぬーさんの相談")).toBeVisible();
	await expect(viewer.getByRole("heading", { name: "同じ悩みの人に共有する" })).toHaveCount(0);
	const heart = viewer.locator("article").first().getByRole("button", { name: /刺さった/ });
	await heart.click();
	await expect(heart).toHaveAttribute("aria-pressed", "true");
	await expect(heart).toContainText("1");

	// みんなの相談の検索で見つかる
	await viewer.goto(`/search?q=${encodeURIComponent("人の目")}`);
	await expect(viewer.getByRole("link", { name: /人の目が気になって自分の意見/ })).toBeVisible();

	// 持ち主が共有をやめると、別の人には見えない
	await page.getByRole("button", { name: "共有をやめる" }).click();
	await expect(page.getByRole("heading", { name: "同じ悩みの人に共有する" })).toBeVisible();
	await viewer.goto(`/c/${id}`);
	await expect(viewer.getByText("この相談は見つかりませんでした")).toBeVisible();
	await other.close();
});
