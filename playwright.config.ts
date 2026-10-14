import { defineConfig } from "@playwright/test";

export default defineConfig({
	testDir: "./e2e",
	// テストは同じローカルの DB を使うので、1つずつ順に動かす
	fullyParallel: false,
	workers: 1,
	expect: { timeout: 15_000 },
	// 端末に入っている Chrome を使う（Playwright 同梱の Chromium は入れていない）
	use: { baseURL: "http://localhost:5183", channel: "chrome", locale: "ja-JP" },
	webServer: {
		// AI はいつも偽物（.dev.vars にキーがあっても、E2E では本物を呼ばない）
		command: "npm run db:local && npm run dev -- --port 5183 --strictPort",
		env: { CLOUDFLARE_ENV: "", AI_FAKE: "1" },
		url: "http://localhost:5183/api/health",
		reuseExistingServer: false,
		timeout: 120_000,
	},
});
