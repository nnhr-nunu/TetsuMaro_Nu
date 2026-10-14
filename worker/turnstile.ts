import type { Context } from "hono";
import { SITE_URL, TURNSTILE_SITE_KEY } from "../shared/site";
import type { AppEnv } from "./env";

/** workers.dev のアドレス（独自ドメインと並べて動かす。アカウント nnhr のサブドメイン） */
const WORKERS_DEV_HOST = "tetsumaro-nu.nnhr.workers.dev";

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Turnstile で守る操作。画面はこの名前をウィジェットの action に入れ、確かめるときに一致を見る */
export type TurnstileAction = "consult" | "report";

/** Turnstile のトークンの長さの上限（Cloudflare の決まり） */
export const TURNSTILE_TOKEN_MAX = 2048;

/** Turnstile を使うか。シークレット（TURNSTILE_SECRET_KEY）が入っているときだけ */
export const turnstileEnabled = (c: Context<AppEnv>): boolean => Boolean(c.env.TURNSTILE_SECRET_KEY);

/** サイトキー。手元で Cloudflare のテスト用キーを試すときだけ、.dev.vars の TURNSTILE_SITE_KEY で差し替える */
const siteKeyOf = (c: Context<AppEnv>): string => c.env.TURNSTILE_SITE_KEY || TURNSTILE_SITE_KEY;

/**
 * トークンを受け付けるホスト名（ウィジェットを表示したページのホスト名）。本番はサイトの URL と workers.dev のアドレスのホスト名で、
 * localhost は入れない。手元で試すときだけ、.dev.vars の TURNSTILE_HOSTNAMES（カンマ区切り）で差し替える
 */
function expectedHostnames(c: Context<AppEnv>): Set<string> {
	const list = c.env.TURNSTILE_HOSTNAMES
		? c.env.TURNSTILE_HOSTNAMES.split(",")
		: [new URL(SITE_URL).hostname, WORKERS_DEV_HOST];
	return new Set(list.map((h) => h.trim()).filter(Boolean));
}

/**
 * 画面から送られたトークンを Cloudflare に確かめる。成功していて、操作（action）とホスト名が合うときだけ true。
 * 通信できない・応答が読めないときも false（守る側に倒す）
 */
async function verify(c: Context<AppEnv>, token: string, action: TurnstileAction): Promise<boolean> {
	const hostnames = expectedHostnames(c);
	if (token.length === 0 || token.length > TURNSTILE_TOKEN_MAX || hostnames.size === 0) return false;

	const body = new URLSearchParams({ secret: c.env.TURNSTILE_SECRET_KEY ?? "", response: token });
	const ip = c.req.header("cf-connecting-ip");
	if (ip) body.set("remoteip", ip);
	try {
		const res = await fetch(SITEVERIFY, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body,
			signal: AbortSignal.timeout(10_000),
		});
		if (!res.ok) throw new Error(`siteverify ${res.status}`);
		const result = (await res.json()) as { success?: unknown; action?: unknown; hostname?: unknown };
		return (
			result.success === true &&
			result.action === action &&
			typeof result.hostname === "string" &&
			hostnames.has(result.hostname)
		);
	} catch (err) {
		console.error("Turnstile を確かめられませんでした", err);
		return false;
	}
}

/**
 * Turnstile が要るときに確かめる。通れば null、通らなければ返す応答（403 とサイトキーと操作の名前）。
 * 画面はこの応答を受けて Turnstile を動かし、トークンを付けて送り直す
 */
export async function requireTurnstile(
	c: Context<AppEnv>,
	token: string | undefined,
	action: TurnstileAction,
): Promise<Response | null> {
	if (!turnstileEnabled(c)) return null;
	if (token && (await verify(c, token, action))) return null;
	return c.json({ error: "turnstile", siteKey: siteKeyOf(c), action }, 403);
}
