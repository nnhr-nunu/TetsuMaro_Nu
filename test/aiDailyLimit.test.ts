import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { afterEach, expect, it, vi } from "vitest";
import { jstDay } from "../worker/db/usage";
import type { AppEnv } from "../worker/env";
import app from "../worker/index";

afterEach(() => {
	vi.restoreAllMocks();
});

const realAi = (limit: string) => ({ ...env, GEMINI_API_KEY: "test-key", AI_FAKE: "", AI_DAILY_LIMIT: limit }) as AppEnv["Bindings"];

it("今日 Gemini を呼んだ回数が AI_DAILY_LIMIT に達していたら、Gemini を呼ばずに ai_daily_limit で断り、相談も残さない", async () => {
	const fetch = vi.spyOn(globalThis, "fetch");
	await env.DB.prepare("INSERT OR REPLACE INTO ai_usage (day, calls, failures) VALUES (?, 5, 0)").bind(jstDay(Date.now())).run();
	const before = await env.DB.prepare("SELECT COUNT(*) AS n FROM consultations").first<{ n: number }>();
	const ctx = createExecutionContext();
	const res = await app.request(
		"/api/consult",
		{ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: "上限の日の相談" }) },
		realAi("5"),
		ctx,
	);
	await waitOnExecutionContext(ctx);
	expect(res.status).toBe(429);
	expect(await res.json()).toEqual({ error: "ai_daily_limit" });
	expect(fetch).not.toHaveBeenCalled();
	const after = await env.DB.prepare("SELECT COUNT(*) AS n FROM consultations").first<{ n: number }>();
	expect(after?.n).toBe(before?.n);
});

it("偽の AI のときは上限を見ない", async () => {
	await env.DB.prepare("INSERT OR REPLACE INTO ai_usage (day, calls, failures) VALUES (?, 999, 0)").bind(jstDay(Date.now())).run();
	const ctx = createExecutionContext();
	const res = await app.request(
		"/api/consult",
		{ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: "偽の AI の相談" }) },
		{ ...env, AI_DAILY_LIMIT: "1" } as AppEnv["Bindings"],
		ctx,
	);
	await res.text();
	await waitOnExecutionContext(ctx);
	expect(res.status).toBe(200);
});
