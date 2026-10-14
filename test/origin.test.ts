import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import app from "../worker/index";

const HOST = "https://tetsumaro.example";

/** 相談の本文が空（400 empty）になるリクエスト。確かめを通ったかが、403 かそうでないかで分かる */
const consult = (headers: Record<string, string>) =>
	app.request(`${HOST}/api/consult`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ body: " " }) }, env);

describe("書き込みの API: 他のサイトからの送信を断る", () => {
	it("Sec-Fetch-Site が same-origin / none ならそのまま通る（ここでは本文が空で 400）", async () => {
		for (const site of ["same-origin", "none"]) {
			expect((await consult({ "Sec-Fetch-Site": site })).status).toBe(400);
		}
	});

	it("Sec-Fetch-Site が cross-site / same-site なら 403", async () => {
		for (const site of ["cross-site", "same-site"]) {
			const res = await consult({ "Sec-Fetch-Site": site });
			expect(res.status).toBe(403);
			expect(await res.json()).toEqual({ error: "forbidden" });
		}
	});

	it("Origin が自分のホストなら通り、違うホスト・null なら 403", async () => {
		expect((await consult({ Origin: HOST })).status).toBe(400);
		expect((await consult({ Origin: "https://evil.example" })).status).toBe(403);
		expect((await consult({ Origin: "null" })).status).toBe(403);
		// Sec-Fetch-Site が same-origin でも、Origin が違えば断る
		expect((await consult({ "Sec-Fetch-Site": "same-origin", Origin: "https://evil.example" })).status).toBe(403);
	});

	it("どちらのヘッダーも無ければ通す（Node の fetch・curl・scripts/eval.mjs）", async () => {
		expect((await consult({})).status).toBe(400);
	});

	it("PUT・PATCH・DELETE も、管理用の API も同じ。GET は断らない", async () => {
		const cross = { "Sec-Fetch-Site": "cross-site", "Content-Type": "application/json" };
		for (const [method, path] of [
			["PUT", "/api/consultations/x/share"],
			["PATCH", "/api/consultations/x"],
			["DELETE", "/api/consultations/x"],
			["POST", "/api/consultations/x/hearts"],
			["POST", "/api/admin/consultations/x/hide"],
		]) {
			expect((await app.request(`${HOST}${path}`, { method, headers: cross, body: method === "DELETE" ? undefined : "{}" }, env)).status, `${method} ${path}`).toBe(403);
		}
		expect((await app.request(`${HOST}/api/health`, { headers: { "Sec-Fetch-Site": "cross-site" } }, env)).status).toBe(200);
	});
});
