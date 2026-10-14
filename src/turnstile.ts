/** Cloudflare Turnstile（ロボットでないことの確認）。必要になったときだけスクリプトを読み込む */

import type { TurnstileChallenge } from "./api";

type Turnstile = {
	render: (el: HTMLElement, options: Record<string, unknown>) => string;
	remove: (id: string) => void;
};

declare global {
	interface Window {
		turnstile?: Turnstile;
	}
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** これより長くかかったら、確認できなかったとして画面にエラーを出す（「送信中…」のまま止まらないように） */
const TIMEOUT_MS = 45_000;

let loading: Promise<Turnstile> | null = null;

/** 確認の画面（チェックを押す箱）が出ているか。画面は「送信中…」に、チェックを押す案内を足すのに使う */
let interactive = false;
const listeners = new Set<() => void>();

function setInteractive(next: boolean): void {
	if (interactive === next) return;
	interactive = next;
	for (const listener of listeners) listener();
}

/** useSyncExternalStore 用: 確認の画面が出ているか */
export const turnstileInteractive = (): boolean => interactive;

/** useSyncExternalStore 用: 確認の画面が出たり消えたりしたら呼ぶ。戻り値で止める */
export function subscribeTurnstile(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

function load(): Promise<Turnstile> {
	if (window.turnstile) return Promise.resolve(window.turnstile);
	loading ??= new Promise<Turnstile>((resolve, reject) => {
		const script = document.createElement("script");
		script.src = SCRIPT;
		script.async = true;
		script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile を読み込めませんでした")));
		script.onerror = () => {
			loading = null;
			reject(new Error("Turnstile を読み込めませんでした"));
		};
		document.head.appendChild(script);
	});
	return loading;
}

/** 確認の箱を入れる枠の印。「送信中」の画面がこの印の付いた要素を置くと、箱がその中（案内のすぐ下）に出る */
export const TURNSTILE_SLOT = "data-turnstile-slot";

/**
 * Turnstile のトークンを取る。確認の画面は、Turnstile が必要と判断したときだけ出る（interaction-only）。
 * 画面に枠（TURNSTILE_SLOT）があればその中に、なければ画面の下に固定で出す。
 * トークンは1回しか使えないので、毎回ウィジェットを作り、取ったら消す
 */
export async function turnstileToken({ siteKey, action }: TurnstileChallenge): Promise<string> {
	const turnstile = await load();
	const box = document.createElement("div");
	const slot = document.querySelector(`[${TURNSTILE_SLOT}]`);
	if (slot) slot.appendChild(box);
	else {
		box.style.cssText = "position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:50;";
		document.body.appendChild(box);
	}
	let id: string | null = null;
	try {
		return await new Promise<string>((resolve, reject) => {
			id = turnstile.render(box, {
				sitekey: siteKey,
				action,
				appearance: "interaction-only",
				language: "ja",
				callback: (token: string) => resolve(token),
				// interaction-only では、チェックを押す必要があるときだけ箱が出る。その間だけ画面に案内を出す
				"before-interactive-callback": () => setInteractive(true),
				"after-interactive-callback": () => setInteractive(false),
				"error-callback": () => reject(new Error("確認できませんでした")),
				"expired-callback": () => reject(new Error("確認の期限が切れました")),
				"timeout-callback": () => reject(new Error("確認の時間が切れました")),
			});
			setTimeout(() => reject(new Error("確認に時間がかかりすぎました")), TIMEOUT_MS);
		});
	} finally {
		if (id) turnstile.remove(id);
		box.remove();
		setInteractive(false);
	}
}
