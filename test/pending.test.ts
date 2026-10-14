import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { ConsultationView } from "../shared/api";
import { STALE_PENDING_MS } from "../worker/db/consultations";
import { hashKey } from "../worker/owner";
import app from "../worker/index";

const KEY = "k".repeat(43);
const cookie = `owner=${KEY}`;

async function setup(id: string, ageMs: number, answers: number) {
	await env.DB.prepare("INSERT OR IGNORE INTO owners (id, key_hash, created_at) VALUES ('pending-owner', ?, 1)").bind(await hashKey(KEY)).run();
	await env.DB.prepare("INSERT INTO consultations (id, owner_id, body, created_at, status) VALUES (?, 'pending-owner', '途中で切れた相談', ?, 'pending')")
		.bind(id, Date.now() - ageMs)
		.run();
	for (let i = 0; i < answers; i++) {
		await env.DB.prepare("INSERT INTO answers (consultation_id, philosopher_id, slot, conclusion, body) VALUES (?, ?, ?, 'c', 'b')")
			.bind(id, ["socrates", "plato", "buddha"][i], i)
			.run();
	}
}
const get = (path: string) => app.request(path, { headers: { Cookie: cookie } }, env);

describe("書いている途中で切れた相談", () => {
	it("時間がたち、回答があれば partial になり、共有できる", async () => {
		await setup("stale-some", STALE_PENDING_MS + 1000, 3);
		const view = (await (await get("/api/consultations/stale-some")).json()) as ConsultationView;
		expect(view.status).toBe("partial");
		const share = await app.request("/api/consultations/stale-some/share", { method: "PUT", headers: { Cookie: cookie } }, env);
		expect(share.status).toBe(200);
	});

	it("時間がたっても回答が0人なら消え、自分の相談にも出ない", async () => {
		await setup("stale-none", STALE_PENDING_MS + 1000, 0);
		expect((await get("/api/consultations/stale-none")).status).toBe(404);
		const list = (await (await get("/api/me/consultations")).json()) as { id: string }[];
		expect(list.map((x) => x.id)).not.toContain("stale-none");
	});

	it("書いている途中（時間がたっていない）の相談も、自分の相談に出る", async () => {
		await setup("fresh-pending", 1000, 1);
		const list = (await (await get("/api/me/consultations")).json()) as { id: string; status: string }[];
		expect(list.find((x) => x.id === "fresh-pending")?.status).toBe("pending");
		const view = (await (await get("/api/consultations/fresh-pending")).json()) as ConsultationView;
		expect(view.status).toBe("pending");
	});
});
