import { type Page, expect } from "@playwright/test";

/** 偽の AI の回答に必ず入る文（worker/fakeAi.ts）。これが出なければ本物の AI を呼んでいる */
export const FAKE_MARK = "これは開発用の仮の回答です";

/** トップから相談を送り、7人の回答が届くまで待つ。相談の id を返す */
export async function consult(page: Page, body: string): Promise<string> {
	await page.goto("/");
	await page.getByRole("textbox", { name: "あなたの悩み" }).fill(body);
	const adult = page.getByLabel("18歳以上です");
	if (await adult.isVisible()) await adult.check();
	await page.getByRole("button", { name: "哲学者たちに聞く" }).click();
	await page.waitForURL(/\/c\/[\w-]+$/);
	await expect(page.locator("article")).toHaveCount(7);
	await expect(page.getByText(FAKE_MARK).first()).toBeVisible();
	return new URL(page.url()).pathname.split("/").pop() as string;
}
