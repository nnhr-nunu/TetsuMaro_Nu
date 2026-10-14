import type { Context, Next } from "hono";
import type { AppEnv } from "./env";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Origin のホストが、このリクエストのホストと同じか。読めない Origin（"null" など）は違うものとして扱う */
function sameHost(origin: string, requestUrl: string): boolean {
	try {
		return new URL(origin).host === new URL(requestUrl).host;
	} catch {
		return false;
	}
}

/**
 * 他のサイトからの書き込み（POST・PUT・PATCH・DELETE）を断る。Cookie の SameSite=Lax と、JSON しか読まない readBody（worker/http.ts）に重ねた守り。
 * ブラウザが付ける Sec-Fetch-Site が same-origin / none 以外、または Origin が自分のホストと違うときは 403。
 * どちらのヘッダーも無いとき（Node の fetch・curl。scripts/eval.mjs）はブラウザの画面からの送信ではないので通す
 */
export async function sameOriginWrites(c: Context<AppEnv>, next: Next): Promise<Response | undefined> {
	if (WRITE_METHODS.has(c.req.method)) {
		const site = c.req.header("sec-fetch-site");
		const origin = c.req.header("origin");
		const crossSite = site !== undefined && site !== "same-origin" && site !== "none";
		if (crossSite || (origin !== undefined && !sameHost(origin, c.req.url))) return c.json({ error: "forbidden" }, 403);
	}
	await next();
}
