import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [
		cloudflareTest(async () => {
			const migrations = await readD1Migrations(path.join(import.meta.dirname, "migrations"));
			return {
				miniflare: {
					compatibilityDate: "2026-10-13",
					d1Databases: ["DB"],
					// 連投の歯止め。テストでは数えない値にする（歯止めそのものは limits.test.ts で、偽のバインディングで確かめる）
					ratelimits: {
						CONSULT_LIMIT: { namespace_id: "2001", simple: { limit: 100000, period: 60 } },
						WRITE_LIMIT: { namespace_id: "2002", simple: { limit: 100000, period: 60 } },
						READ_LIMIT: { namespace_id: "2003", simple: { limit: 100000, period: 60 } },
						REPORT_LIMIT: { namespace_id: "2004", simple: { limit: 100000, period: 60 } },
						SEARCH_LIMIT: { namespace_id: "2005", simple: { limit: 100000, period: 60 } },
					},
					// マイグレーションをセットアップファイルへ渡すための、テスト専用のバインディング。AI はいつも偽物
					bindings: { TEST_MIGRATIONS: migrations, AI_FAKE: "1" },
				},
			};
		}),
	],
	test: {
		include: ["test/**/*.test.ts"],
		setupFiles: ["./test/apply-migrations.ts"],
	},
});
