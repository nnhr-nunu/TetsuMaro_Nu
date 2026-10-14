import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import type { AppEnv } from "../worker/env";
import { indexShared } from "../worker/db/shared";
import app from "../worker/index";

const ID = "report-target";
const ADMIN = { ...env, ADMIN_TOKEN: "secret-token" } as AppEnv["Bindings"];

beforeAll(async () => {
	await env.DB.prepare(
		"INSERT INTO consultations (id, owner_id, body, category, created_at, shared_at, status) VALUES (?, 'o', '通報される相談', 'other', 1, 1, 'done')",
	)
		.bind(ID)
		.run();
	await indexShared(env.DB, ID);
});

const report = (ip: string) =>
	app.request(
		"/api/reports",
		{ method: "POST", headers: { "Content-Type": "application/json", "cf-connecting-ip": ip }, body: JSON.stringify({ consultationId: ID, reason: "個人情報が書いてある" }) },
		env,
	);

describe("通報", () => {
	it("同じ人の2回目は数えず、3人の通報で一覧から隠れる", async () => {
		expect((await report("203.0.113.10")).status).toBe(200);
		expect((await report("203.0.113.10")).status).toBe(200);
		expect((await report("203.0.113.11")).status).toBe(200);
		const before = (await (await app.request("/api/shared", {}, env)).json()) as { items: { id: string }[] };
		expect(before.items.map((i) => i.id)).toContain(ID);
		expect((await report("203.0.113.12")).status).toBe(200);
		const after = (await (await app.request("/api/shared", {}, env)).json()) as { items: { id: string }[] };
		expect(after.items.map((i) => i.id)).not.toContain(ID);
		expect((await app.request(`/api/consultations/${ID}`, {}, env)).status).toBe(404);
	});

	it("共有されていない相談は通報できない", async () => {
		const res = await app.request(
			"/api/reports",
			{ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ consultationId: "nothing", reason: "x" }) },
			env,
		);
		expect(res.status).toBe(404);
	});
});

describe("管理", () => {
	it("合言葉が無いと 404、違う合言葉は 401", async () => {
		expect((await app.request("/api/admin/reports", {}, env)).status).toBe(404);
		expect((await app.request("/api/admin/reports", { headers: { Authorization: "Bearer wrong" } }, ADMIN)).status).toBe(401);
	});

	it("通報の一覧を見て、隠した相談を戻し、分類を直せる", async () => {
		const auth = { Authorization: "Bearer secret-token" };
		const list = (await (await app.request("/api/admin/reports", { headers: auth }, ADMIN)).json()) as { consultationId: string; count: number }[];
		expect(list.find((r) => r.consultationId === ID)?.count).toBe(3);
		expect((await app.request(`/api/admin/consultations/${ID}/unhide`, { method: "POST", headers: auth }, ADMIN)).status).toBe(200);
		expect((await app.request(`/api/consultations/${ID}`, {}, env)).status).toBe(200);
		const theme = await app.request(
			`/api/admin/consultations/${ID}/theme`,
			{ method: "PATCH", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ category: "work", tags: ["boss", "nope"] }) },
			ADMIN,
		);
		expect(theme.status).toBe(200);
		const row = await env.DB.prepare("SELECT category, tags FROM consultations WHERE id = ?").bind(ID).first<{ category: string; tags: string }>();
		expect(row).toEqual({ category: "work", tags: '["boss"]' });
		expect((await app.request(`/api/admin/consultations/${ID}/hide`, { method: "POST", headers: auth }, ADMIN)).status).toBe(200);
		expect((await app.request(`/api/consultations/${ID}`, {}, env)).status).toBe(404);
	});
});

describe("連投の歯止め", () => {
	const blocked = { limit: async () => ({ success: false }) } as unknown as RateLimit;
	it("相談の歯止めにかかると 429 rate_limited", async () => {
		const res = await app.request(
			"/api/consult",
			{ method: "POST", headers: { "Content-Type": "application/json", "cf-connecting-ip": "203.0.113.99" }, body: JSON.stringify({ body: "x" }) },
			{ ...env, CONSULT_LIMIT: blocked },
		);
		expect(res.status).toBe(429);
		expect(await res.json()).toEqual({ error: "rate_limited" });
	});
	it("手元（IP なし）では数えない", async () => {
		const res = await app.request("/api/health", {}, { ...env, READ_LIMIT: blocked });
		expect(res.status).toBe(200);
	});
	it("言葉の検索は検索の歯止めで数える", async () => {
		const res = await app.request("/api/shared?q=abc", { headers: { "cf-connecting-ip": "203.0.113.98" } }, { ...env, SEARCH_LIMIT: blocked });
		expect(res.status).toBe(429);
	});
});

describe("Turnstile", () => {
	it("シークレットが入っていて、トークンが無い相談は 403 turnstile（サイトキーと操作の名前を返す）", async () => {
		const res = await app.request(
			"/api/consult",
			{ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: "ロボットかもしれない相談" }) },
			{ ...env, TURNSTILE_SECRET_KEY: "secret" } as AppEnv["Bindings"],
		);
		expect(res.status).toBe(403);
		expect(await res.json()).toMatchObject({ error: "turnstile", action: "consult" });
	});
});

describe("Turnstile と相談の歯止め", () => {
	it("トークン無しで断られた1回目は、相談の歯止めを使わない（403 turnstile になり、429 にならない）", async () => {
		const blocked = { limit: async () => ({ success: false }) } as unknown as RateLimit;
		const res = await app.request(
			"/api/consult",
			{ method: "POST", headers: { "Content-Type": "application/json", "cf-connecting-ip": "203.0.113.50" }, body: JSON.stringify({ body: "相談" }) },
			{ ...env, TURNSTILE_SECRET_KEY: "secret", CONSULT_LIMIT: blocked } as AppEnv["Bindings"],
		);
		expect(res.status).toBe(403);
		expect(await res.json()).toMatchObject({ error: "turnstile" });
	});
});
