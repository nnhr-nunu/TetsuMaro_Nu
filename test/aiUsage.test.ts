import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { afterEach, expect, it, vi } from "vitest";
import { jstDay } from "../worker/db/usage";
import type { AppEnv } from "../worker/env";
import { clearCooldown } from "../worker/gemini/generate";
import app from "../worker/index";

afterEach(() => {
	vi.restoreAllMocks();
	clearCooldown();
});

it("Gemini が全部のモデルで日の上限なら、呼んだ数と失敗を ai_usage に数える", async () => {
	vi.spyOn(globalThis, "fetch").mockImplementation(
		async () => new Response(JSON.stringify({ error: { code: 429, message: "quotaId: GenerateRequestsPerDayPerProjectPerModel-FreeTier" } }), { status: 429 }),
	);
	const ctx = createExecutionContext();
	const res = await app.request(
		"/api/consult",
		{ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: "上限の日" }) },
		{ ...env, GEMINI_API_KEY: "test-key", AI_FAKE: "" } as AppEnv["Bindings"],
		ctx,
	);
	expect(await res.text()).toContain("ai_daily_limit");
	await waitOnExecutionContext(ctx);
	const row = await env.DB.prepare("SELECT calls, failures FROM ai_usage WHERE day = ?").bind(jstDay(Date.now())).first<{ calls: number; failures: number }>();
	expect(row).toEqual({ calls: 1, failures: 1 });
});
