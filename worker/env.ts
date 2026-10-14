/**
 * Worker のシークレット（ダッシュボードか `wrangler secret put` で入れる。wrangler types には出ない）。
 * どれも入っていなければ、その機能を止めたまま（または偽物で）動く
 */
export type Secrets = {
	/** Gemini API のキー。ないときは偽の AI が決まった回答を返す（worker/ai.ts） */
	GEMINI_API_KEY?: string;
	/** "1" なら、キーがあっても偽の AI を使う（テスト・E2E） */
	AI_FAKE?: string;
	/** 管理画面の合言葉。ないときは管理用の API がすべて 404 */
	ADMIN_TOKEN?: string;
	/** 刺さった・通報した人の識別子を作る鍵。ないときは決まった鍵（手元・テスト） */
	REPORTER_KEY?: string;
	/** Turnstile のシークレット。あるときだけ確かめる（サイトキーは shared/site.ts） */
	TURNSTILE_SECRET_KEY?: string;
	/** 手元で Cloudflare のテスト用キーを試すときだけ使う差し替え（.dev.vars）。本番では入れない */
	TURNSTILE_SITE_KEY?: string;
	TURNSTILE_HOSTNAMES?: string;
};

export type AppEnv = { Bindings: Env & Secrets };
