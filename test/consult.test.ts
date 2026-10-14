import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { StreamEvent } from "../shared/api";
import { ANSWER_COUNT, DAILY_PER_OWNER } from "../shared/site";
import { loadConsultation } from "../worker/db/consultations";
import type { AppEnv } from "../worker/env";
import app from "../worker/index";

type Env = AppEnv["Bindings"];

function post(body: unknown, init: { cookie?: string; env?: Partial<Env> } = {}) {
	const ctx = createExecutionContext();
	const res = app.request(
		"/api/consult",
		{
			method: "POST",
			headers: { "Content-Type": "application/json", ...(init.cookie ? { Cookie: init.cookie } : {}) },
			body: JSON.stringify(body),
		},
		{ ...env, ...init.env },
		ctx,
	);
	return { res: Promise.resolve(res), ctx };
}

async function readAll(res: Response): Promise<StreamEvent[]> {
	const text = await res.text();
	return text
		.split("\n")
		.filter(Boolean)
		.map((l) => JSON.parse(l) as StreamEvent);
}

const cookieOf = (res: Response) => res.headers.get("set-cookie")?.split(";")[0] ?? "";

describe("POST /api/consult", () => {
	it("start・meta・answer×7・nunu・done の順に流れ、保存される", async () => {
		const { res, ctx } = post({ body: "仕事がつらくて、毎朝会社に行くのが怖いです" });
		const r = await res;
		expect(r.status).toBe(200);
		expect(r.headers.get("content-type")).toContain("application/x-ndjson");
		const events = await readAll(r);
		await waitOnExecutionContext(ctx);
		expect(events.map((e) => e.type)).toEqual(["start", "meta", ...Array(ANSWER_COUNT).fill("answer"), "nunu", "done"]);
		expect(events.at(-1)).toEqual({ type: "done", status: "done" });
		const id = (events[0] as { id: string }).id;
		const saved = await loadConsultation(env.DB, id);
		expect(saved?.answers).toHaveLength(ANSWER_COUNT);
		expect(saved?.row.status).toBe("done");
		expect(saved?.row.model).toBe("fake");
		expect(saved?.nunu?.body).toBeTruthy();
	});

	it("空白だけは 400 empty、1001字は 400 too_long", async () => {
		const empty = await post({ body: "   \n " }).res;
		expect(empty.status).toBe(400);
		expect(await empty.json()).toEqual({ error: "empty" });
		const long = await post({ body: "あ".repeat(1001) }).res;
		expect(long.status).toBe(400);
		expect(await long.json()).toEqual({ error: "too_long" });
	});

	it("同じ端末の11回目は 429 daily_owner_limit", async () => {
		const first = post({ body: "1回目" });
		const r = await first.res;
		const cookie = cookieOf(r);
		await r.text();
		await waitOnExecutionContext(first.ctx);
		const owner = await env.DB.prepare("SELECT owner_id FROM consultations ORDER BY created_at DESC LIMIT 1").first<{ owner_id: string }>();
		for (let i = 1; i < DAILY_PER_OWNER; i++) {
			await env.DB.prepare("INSERT INTO consultations (id, owner_id, body, created_at) VALUES (?, ?, 'x', ?)").bind(`fill${i}`, owner?.owner_id, Date.now()).run();
		}
		const over = await post({ body: "11回目" }, { cookie }).res;
		expect(over.status).toBe(429);
		expect(await over.json()).toEqual({ error: "daily_owner_limit" });
	});

	it("途中で切れたら（3人で終わる）届いた3人を保存し、done は partial", async () => {
		const { res, ctx } = post({ body: "途中で切れる相談" }, { env: { AI_FAKE: "stop:3" } });
		const events = await readAll(await res);
		await waitOnExecutionContext(ctx);
		expect(events.at(-1)).toEqual({ type: "done", status: "partial" });
		const id = (events[0] as { id: string }).id;
		const saved = await loadConsultation(env.DB, id);
		expect(saved?.answers).toHaveLength(3);
		expect(saved?.row.status).toBe("partial");
	});

	it("流れを途中で読み捨てても、最後まで保存される", async () => {
		const { res, ctx } = post({ body: "すぐにタブを閉じる人の相談" });
		const r = await res;
		const reader = (r.body as ReadableStream<Uint8Array>).getReader();
		const first = new TextDecoder().decode((await reader.read()).value);
		const id = (JSON.parse(first.split("\n")[0]) as { id: string }).id;
		await reader.cancel();
		await waitOnExecutionContext(ctx);
		const saved = await loadConsultation(env.DB, id);
		expect(saved?.answers).toHaveLength(ANSWER_COUNT);
		expect(saved?.row.status).toBe("done");
	});

	it("AI が日の上限なら error ai_daily_limit を流し、相談は残さない", async () => {
		const { res, ctx } = post({ body: "上限の日の相談" }, { env: { AI_FAKE: "daily" } });
		const events = await readAll(await res);
		await waitOnExecutionContext(ctx);
		expect(events.at(-1)).toEqual({ type: "error", code: "ai_daily_limit" });
		const id = (events[0] as { id: string }).id;
		expect(await loadConsultation(env.DB, id)).toBeNull();
	});

	it("「死にたい」を含む相談は重い相談の印が立つ", async () => {
		const { res, ctx } = post({ body: "もう死にたいと思ってしまう" });
		const events = await readAll(await res);
		await waitOnExecutionContext(ctx);
		expect(events.find((e) => e.type === "meta")).toMatchObject({ crisis: true });
		const id = (events[0] as { id: string }).id;
		expect((await loadConsultation(env.DB, id))?.row.crisis).toBe(1);
	});

	it("年代・性別は決まった値だけ保存する", async () => {
		const ok = post({ body: "年代つき", ageBand: "20s", gender: "female" });
		const events = await readAll(await ok.res);
		await waitOnExecutionContext(ok.ctx);
		const saved = await loadConsultation(env.DB, (events[0] as { id: string }).id);
		expect(saved?.row.age_band).toBe("20s");
		expect(saved?.row.gender).toBe("female");
		const bad = await post({ body: "変な年代", ageBand: "200s" }).res;
		expect(bad.status).toBe(400);
	});
});
