import { LineSplitter } from "../shared/answerStream";
import type { StreamEvent } from "../shared/api";
import { BODY_MAX, DAILY_PER_OWNER } from "../shared/site";
import { turnstileToken } from "./turnstile";

/** Turnstile が要ると言われたときの情報（worker/turnstile.ts の 403） */
export type TurnstileChallenge = { siteKey: string; action: string };

export class ApiError extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
		readonly turnstile: TurnstileChallenge | null = null,
	) {
		super(code);
		this.name = "ApiError";
	}
}

async function errorOf(res: Response): Promise<ApiError> {
	const json = (await res.json().catch(() => null)) as { error?: string; siteKey?: string; action?: string } | null;
	const code = json?.error ?? (res.status === 404 ? "not_found" : "failed");
	const challenge = code === "turnstile" && json?.siteKey && json.action ? { siteKey: json.siteKey, action: json.action } : null;
	return new ApiError(res.status, code, challenge);
}

async function request(method: string, path: string, body?: Record<string, unknown>, signal?: AbortSignal): Promise<Response> {
	const send = (b?: Record<string, unknown>) =>
		fetch(path, {
			method,
			headers: b ? { "Content-Type": "application/json" } : undefined,
			body: b ? JSON.stringify(b) : undefined,
			credentials: "same-origin",
			signal,
		}).catch(() => {
			throw new ApiError(0, "network");
		});
	let res = await send(body);
	if (res.status === 403 && body) {
		// Turnstile が要ると言われたら、確かめてからトークンを付けて1回だけ送り直す
		const err = await errorOf(res.clone());
		if (err.turnstile) res = await send({ ...body, turnstile: await turnstileToken(err.turnstile) });
	}
	return res;
}

export async function getJson<T>(path: string): Promise<T> {
	const res = await request("GET", path);
	if (!res.ok) throw await errorOf(res);
	return (await res.json()) as T;
}

export async function sendJson<T = { ok: true }>(method: "POST" | "PUT" | "PATCH" | "DELETE", path: string, body?: Record<string, unknown>): Promise<T> {
	const res = await request(method, path, body);
	if (!res.ok) throw await errorOf(res);
	return (await res.json()) as T;
}

/**
 * 回答の流れ（改行区切りの JSON）を1つずつ返す。始まる前に断られたら ApiError を投げる。
 * signal で止めると、通信が切れたときと同じ ApiError（network）を投げる（止めたのは自分なので、呼び出し側は signal を見て無視する）
 */
export async function* streamEvents(path: string, body: Record<string, unknown> = {}, signal?: AbortSignal): AsyncGenerator<StreamEvent> {
	const res = await request("POST", path, body, signal);
	if (!res.ok || !res.body) throw await errorOf(res);
	const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
	const splitter = new LineSplitter();
	const parse = (line: string): StreamEvent | null => {
		try {
			return JSON.parse(line) as StreamEvent;
		} catch {
			return null;
		}
	};
	while (true) {
		const { done, value } = await reader.read().catch(() => {
			throw new ApiError(0, "network");
		});
		if (done) break;
		for (const line of splitter.push(value)) {
			const ev = parse(line);
			if (ev) yield ev;
		}
	}
	for (const line of splitter.flush()) {
		const ev = parse(line);
		if (ev) yield ev;
	}
}

/** 失敗を、画面に出す文にする */
export function errorText(err: unknown): string {
	const code = err instanceof ApiError ? err.code : typeof err === "string" ? err : "failed";
	switch (code) {
		case "empty":
			return "相談を書いてください。";
		case "too_long":
			return `相談は${BODY_MAX}字までです。`;
		case "rate_limited":
			return "続けて送られたので、少し止めています。1分ほどおいてから、もう一度送ってください。";
		case "daily_owner_limit":
			return `今日送れる相談の数（${DAILY_PER_OWNER}回）を超えました。明日また送れます。`;
		case "turnstile":
			return "ロボットでないことを確かめられませんでした。もう一度送ってください。";
		case "ai_daily_limit":
			return "今日の相談の受付は終わりました（無料で動かしているため、1日に答えられる数に限りがあります）。書いた相談はこの端末に残っているので、明日そのまま送れます。";
		case "ai_failed":
		case "ai_unavailable":
			return "回答を作れませんでした。少し時間をおいてから、もう一度送ってください。";
		case "not_found":
			return "見つかりませんでした。消されたか、共有をやめた相談かもしれません。";
		case "network":
			return "通信できませんでした。電波のよいところで、もう一度試してください。";
		default:
			return "うまくいきませんでした。もう一度試してください。";
	}
}
