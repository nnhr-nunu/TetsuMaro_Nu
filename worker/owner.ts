import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import type { AppEnv } from "./env";
import { newId, newKey } from "./ids";

/**
 * 端末の持ち主（ログインの代わり）。Cookie owner に鍵を入れ、D1 には鍵の SHA-256 だけを残す（性癖カルテの owner.ts の簡略版）。
 * 端末を替えたときの引き継ぎは後回し（設計書 1章）
 */
const COOKIE = "owner";
const KEY_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const MAX_AGE_SECONDS = 60 * 60 * 24 * 400;

export type Owner = { id: string };

export async function hashKey(key: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function cookieKey(c: Context<AppEnv>): string | null {
	try {
		const key = getCookie(c, COOKIE);
		return key && KEY_PATTERN.test(key) ? key : null;
	} catch {
		return null;
	}
}

/** Cookie の持ち主。Cookie がない・知らない鍵なら null */
export async function ownerOf(c: Context<AppEnv>): Promise<Owner | null> {
	const key = cookieKey(c);
	if (!key) return null;
	const row = await c.env.DB.prepare("SELECT id FROM owners WHERE key_hash = ?").bind(await hashKey(key)).first<{ id: string }>();
	return row ? { id: row.id } : null;
}

/** 持ち主を返す。いなければ作って Cookie を渡す（相談を送るときだけ作る） */
export async function ensureOwner(c: Context<AppEnv>): Promise<Owner> {
	const found = await ownerOf(c);
	if (found) return found;
	const key = newKey();
	const id = newId();
	await c.env.DB.prepare("INSERT INTO owners (id, key_hash, created_at) VALUES (?, ?, ?)").bind(id, await hashKey(key), Date.now()).run();
	setCookie(c, COOKIE, key, { httpOnly: true, secure: true, sameSite: "Lax", path: "/", maxAge: MAX_AGE_SECONDS });
	return { id };
}
