import { expect, test } from "@playwright/test";
import { consult, share } from "./helpers";

test("似た悩みから別の相談へ移ると、前の相談の中身を出さない", async ({ page, browser }) => {
	const a = await consult(page, "相談Aの本文です。上司との関係に悩んでいます");
	await share(page);
	const b = await consult(page, "相談Bの本文です。同僚との関係に悩んでいます");
	await share(page);

	const other = await browser.newContext({ locale: "ja-JP" });
	const viewer = await other.newPage();
	await viewer.goto(`/c/${a}`);
	const link = viewer.getByRole("link", { name: /相談Bの本文です/ });
	await expect(link).toBeVisible();
	// B を読み込むのを遅らせ、その間に A の中身が出ていないかを見る
	await viewer.route(`**/api/consultations/${b}`, async (route) => {
		await new Promise((r) => setTimeout(r, 1500));
		await route.continue();
	});
	await link.click();
	await viewer.waitForURL(`**/c/${b}`);
	await expect(viewer.getByText("相談Aの本文です。上司との関係に悩んでいます")).toHaveCount(0, { timeout: 500 });
	await expect(viewer.getByText("相談Bの本文です。同僚との関係に悩んでいます").first()).toBeVisible();
	await other.close();
});
