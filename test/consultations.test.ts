import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { ConsultationView, StreamEvent } from "../shared/api";
import { ANSWER_COUNT, MORE_COUNT } from "../shared/site";
import app from "../worker/index";

async function consultAs(body: string, cookie?: string): Promise<{ id: string; cookie: string }> {
	const ctx = createExecutionContext();
	const res = await app.request(
		"/api/consult",
		{ method: "POST", headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify({ body }) },
		env,
		ctx,
	);
	const first = (await res.text()).split("\n")[0];
	await waitOnExecutionContext(ctx);
	return { id: (JSON.parse(first) as { id: string }).id, cookie: cookie ?? res.headers.get("set-cookie")?.split(";")[0] ?? "" };
}

const call = (method: string, path: string, opts: { cookie?: string; body?: unknown; ip?: string } = {}) =>
	app.request(
		path,
		{
			method,
			headers: {
				...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
				...(opts.cookie ? { Cookie: opts.cookie } : {}),
				...(opts.ip ? { "cf-connecting-ip": opts.ip } : {}),
			},
			body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
		},
		env,
	);

describe("相談のページの API", () => {
	it("持ち主は非公開の相談を読める。ほかの人は 404、共有すると読め、非公開に戻すとまた 404", async () => {
		const { id, cookie } = await consultAs("友だちとの距離感がわからない");
		const mine = await call("GET", `/api/consultations/${id}`, { cookie });
		expect(mine.status).toBe(200);
		const view = (await mine.json()) as ConsultationView;
		expect(view.isOwner).toBe(true);
		expect(view.answers).toHaveLength(ANSWER_COUNT);

		expect((await call("GET", `/api/consultations/${id}`)).status).toBe(404);
		expect((await call("PUT", `/api/consultations/${id}/share`, { cookie, body: {} })).status).toBe(200);
		const shared = await call("GET", `/api/consultations/${id}`);
		expect(shared.status).toBe(200);
		expect(((await shared.json()) as ConsultationView).isOwner).toBe(false);
		expect((await call("DELETE", `/api/consultations/${id}/share`, { cookie })).status).toBe(200);
		expect((await call("GET", `/api/consultations/${id}`)).status).toBe(404);
	});

	it("持ち主でない人は共有も削除もできない", async () => {
		const { id } = await consultAs("持ち主の確かめ");
		const other = await consultAs("別の人の相談");
		expect((await call("PUT", `/api/consultations/${id}/share`, { cookie: other.cookie, body: {} })).status).toBe(404);
		expect((await call("DELETE", `/api/consultations/${id}`, { cookie: other.cookie })).status).toBe(404);
	});

	it("消すと読めなくなり、刺さったも残らない", async () => {
		const { id, cookie } = await consultAs("消す相談");
		await call("PUT", `/api/consultations/${id}/share`, { cookie, body: {} });
		const view = (await (await call("GET", `/api/consultations/${id}`, { cookie })).json()) as ConsultationView;
		await call("POST", `/api/consultations/${id}/hearts`, { body: { philosopherId: view.answers[0].philosopher }, ip: "203.0.113.1" });
		expect((await call("DELETE", `/api/consultations/${id}`, { cookie })).status).toBe(200);
		expect((await call("GET", `/api/consultations/${id}`, { cookie })).status).toBe(404);
		const left = await env.DB.prepare("SELECT COUNT(*) AS n FROM hearts WHERE consultation_id = ?").bind(id).first<{ n: number }>();
		expect(left?.n).toBe(0);
	});

	it("同じ人が同じ哲学者に何度刺さったを押しても1つ、別の人なら2つ", async () => {
		const { id, cookie } = await consultAs("刺さったを数える");
		await call("PUT", `/api/consultations/${id}/share`, { cookie, body: {} });
		const view = (await (await call("GET", `/api/consultations/${id}`)).json()) as ConsultationView;
		const philosopherId = view.answers[0].philosopher;
		await call("POST", `/api/consultations/${id}/hearts`, { body: { philosopherId }, ip: "203.0.113.5" });
		const again = await call("POST", `/api/consultations/${id}/hearts`, { body: { philosopherId }, ip: "203.0.113.5" });
		expect(await again.json()).toEqual({ count: 1 });
		const other = await call("POST", `/api/consultations/${id}/hearts`, { body: { philosopherId }, ip: "198.51.100.7" });
		expect(await other.json()).toEqual({ count: 2 });
		const after = (await (await call("GET", `/api/consultations/${id}`)).json()) as ConsultationView;
		expect(after.hearts[philosopherId]).toBe(2);
	});

	it("共有していない相談・答えていない哲学者には刺さったを押せない", async () => {
		const { id, cookie } = await consultAs("押せない刺さった");
		const view = (await (await call("GET", `/api/consultations/${id}`, { cookie })).json()) as ConsultationView;
		expect((await call("POST", `/api/consultations/${id}/hearts`, { body: { philosopherId: view.answers[0].philosopher } })).status).toBe(404);
		await call("PUT", `/api/consultations/${id}/share`, { cookie, body: {} });
		expect((await call("POST", `/api/consultations/${id}/hearts`, { body: { philosopherId: "carnegie-not-here" } })).status).toBe(400);
	});

	it("自分の答え・刺さった人・公開名を直せる。共有したあとは本文を直せない", async () => {
		const { id, cookie } = await consultAs("自分の答えを書く");
		const view = (await (await call("GET", `/api/consultations/${id}`, { cookie })).json()) as ConsultationView;
		const pick = view.answers[1].philosopher;
		const patched = await call("PATCH", `/api/consultations/${id}`, {
			cookie,
			body: { myAnswer: "まず自分を責めるのをやめる", myPicks: [pick, "nunu"], displayName: "ぬー", body: "書き直した相談" },
		});
		expect(patched.status).toBe(200);
		const after = (await (await call("GET", `/api/consultations/${id}`, { cookie })).json()) as ConsultationView;
		expect(after).toMatchObject({ myAnswer: "まず自分を責めるのをやめる", myPicks: [pick, "nunu"], displayName: "ぬー", body: "書き直した相談" });

		await call("PUT", `/api/consultations/${id}/share`, { cookie, body: {} });
		expect((await call("PATCH", `/api/consultations/${id}`, { cookie, body: { body: "共有後に直す" } })).status).toBe(400);
		expect((await call("PATCH", `/api/consultations/${id}`, { cookie, body: { myAnswer: "あ".repeat(201) } })).status).toBe(400);
	});

	it("ほかの哲学者にも聞くと2人増え、前の人と重ならない", async () => {
		const { id, cookie } = await consultAs("もっと聞きたい");
		const ctx = createExecutionContext();
		const res = await app.request(`/api/consultations/${id}/more`, { method: "POST", headers: { Cookie: cookie } }, env, ctx);
		const events = (await res.text())
			.split("\n")
			.filter(Boolean)
			.map((l) => JSON.parse(l) as StreamEvent);
		await waitOnExecutionContext(ctx);
		expect(events.filter((e) => e.type === "answer")).toHaveLength(MORE_COUNT);
		const view = (await (await call("GET", `/api/consultations/${id}`, { cookie })).json()) as ConsultationView;
		expect(view.answers).toHaveLength(ANSWER_COUNT + MORE_COUNT);
		expect(new Set(view.answers.map((a) => a.philosopher)).size).toBe(ANSWER_COUNT + MORE_COUNT);
	});

	it("この端末の相談の一覧", async () => {
		const { id, cookie } = await consultAs("一覧に出る相談");
		const list = (await (await call("GET", "/api/me/consultations", { cookie })).json()) as { id: string }[];
		expect(list.map((x) => x.id)).toContain(id);
		expect(await (await call("GET", "/api/me/consultations")).json()).toEqual([]);
	});
});
