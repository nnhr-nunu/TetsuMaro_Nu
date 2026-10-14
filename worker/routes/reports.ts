import { Hono } from "hono";
import { z } from "zod";
import type { ErrorCode } from "../../shared/api";
import { loadConsultation } from "../db/consultations";
import { addReport } from "../db/reports";
import type { AppEnv } from "../env";
import { readBody } from "../http";
import { networkHash } from "../ipHash";
import { requireTurnstile } from "../turnstile";

export const reports = new Hono<AppEnv>();

const schema = z.object({ consultationId: z.string().max(64), reason: z.string().trim().min(1).max(500), turnstile: z.string().optional() });

reports.post("/", async (c) => {
	const input = await readBody(c, schema);
	if (!input) return c.json({ error: "bad_request" satisfies ErrorCode }, 400);
	const loaded = await loadConsultation(c.env.DB, input.consultationId);
	if (!loaded || loaded.row.shared_at === null || loaded.row.hidden_at !== null) return c.json({ error: "not_found" satisfies ErrorCode }, 404);
	const blocked = await requireTurnstile(c, input.turnstile, "report");
	if (blocked) return blocked;
	const reporter = await networkHash(c.env.REPORTER_KEY, c.req.header("cf-connecting-ip") ?? "local", "report");
	await addReport(c.env.DB, loaded.row.id, input.reason, reporter, Date.now());
	return c.json({ ok: true });
});
