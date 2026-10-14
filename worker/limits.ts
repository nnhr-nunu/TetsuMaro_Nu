import type { Context, Next } from "hono";
import type { AppEnv } from "./env";
import { networkOf } from "./ipHash";

/** Gemini を呼ぶ操作（相談を送る・ほかの哲学者にも聞く） */
const CONSULT_PATH = /^\/api\/(consult|consultations\/[^/]+\/more)$/;

/**
 * API のどの歯止めで数えるか。通報は少なく、言葉の検索は読み込みより厳しく、ほかの書き込みはふつう。
 * Gemini を呼ぶもの（相談・ほかの哲学者にも聞く）は、ここでは書き込みとして数え、Turnstile を通ったあとに limitConsult で数える
 * （Turnstile が要るときは、画面がトークン無しで1回断られてから送り直すので、ここで数えると1回の相談が2回に数えられる）
 */
function limiterFor(c: Context<AppEnv>): RateLimit {
	if (c.req.method === "GET") return c.req.path === "/api/shared" && c.req.query("q") ? c.env.SEARCH_LIMIT : c.env.READ_LIMIT;
	if (c.req.path === "/api/reports") return c.env.REPORT_LIMIT;
	return c.env.WRITE_LIMIT;
}

/** Gemini を呼ぶ操作の歯止め（回線ごとに1分3回）。超えたら返す応答、超えなければ null。Turnstile を通ったあとに呼ぶ */
export async function limitConsult(c: Context<AppEnv>): Promise<Response | null> {
	const network = countedNetwork(c);
	if (network === null || !CONSULT_PATH.test(c.req.path)) return null;
	const { success } = await c.env.CONSULT_LIMIT.limit({ key: network });
	if (success) return null;
	c.header("Retry-After", "60");
	return c.json({ error: "rate_limited" }, 429);
}

/** 数える回線（IPv6 は /64）。手元（npm run dev や E2E）では IP がないかループバックなので数えない（null） */
export function countedNetwork(c: Context<AppEnv>): string | null {
	const ip = c.req.header("cf-connecting-ip");
	return !ip || ip === "127.0.0.1" || ip === "::1" ? null : networkOf(ip);
}

/**
 * 連投の歯止め。回線ごとに1分あたりの回数を数え、超えたら 429 を返す（性癖カルテと同じ考え方）。
 * Cloudflare の拠点ごとの大まかな数え方で、D1 には書かない
 */
export async function rateLimit(c: Context<AppEnv>, next: Next): Promise<Response | undefined> {
	const network = countedNetwork(c);
	if (network !== null) {
		const { success } = await limiterFor(c).limit({ key: network });
		if (!success) {
			c.header("Retry-After", "60");
			return c.json({ error: "rate_limited" }, 429);
		}
	}
	await next();
}
