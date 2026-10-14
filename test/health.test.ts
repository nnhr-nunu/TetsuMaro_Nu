import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import app from "../worker/index";

it("API が応答する", async () => {
	const res = await app.request("/api/health", {}, env);
	expect(res.status).toBe(200);
	expect(await res.json()).toEqual({ ok: true });
});

it("ない API は 404 を JSON で返す", async () => {
	const res = await app.request("/api/nothing", {}, env);
	expect(res.status).toBe(404);
	expect(await res.json()).toEqual({ error: "not_found" });
});

it("API の応答はキャッシュさせず、検索にも載せない", async () => {
	const res = await app.request("/api/health", {}, env);
	expect(res.headers.get("cache-control")).toBe("no-store");
	expect(res.headers.get("x-robots-tag")).toBe("noindex");
});
