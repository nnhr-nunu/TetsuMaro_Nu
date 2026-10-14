import type { AgeBandId, GenderId } from "../shared/site";

/**
 * 書きかけの相談と、18歳以上の確認をこの端末に覚える。送れなかったとき（上限・通信）も、書いた相談が消えないように。
 * 覚えられない端末（プライベートブラウズなど）では、覚えないだけで動く
 */
export type Draft = { body: string; ageBand?: AgeBandId; gender?: GenderId };

const DRAFT_KEY = "consult-draft";
const ADULT_KEY = "adult-confirmed";

export function loadDraft(): Draft {
	try {
		const v = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null") as Draft | null;
		return v && typeof v.body === "string" ? v : { body: "" };
	} catch {
		return { body: "" };
	}
}

export function saveDraft(draft: Draft): void {
	try {
		localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
	} catch {
		// 覚えられなくても送れる
	}
}

/** 送れて回答が届き始めたら消す（年代・性別は次の相談でも使えるよう残す） */
export function clearDraftBody(): void {
	const { ageBand, gender } = loadDraft();
	saveDraft({ body: "", ageBand, gender });
}

export function adultConfirmed(): boolean {
	try {
		return localStorage.getItem(ADULT_KEY) === "1";
	} catch {
		return false;
	}
}

export function confirmAdult(): void {
	try {
		localStorage.setItem(ADULT_KEY, "1");
	} catch {
		// 覚えられなければ、次も聞く
	}
}

/** 見た人が押した「刺さった」（相談 id:哲学者 id）。同じ端末で2回押さないように覚える */
const HEARTS_KEY = "hearted";
export function heartedSet(): Set<string> {
	try {
		return new Set(JSON.parse(localStorage.getItem(HEARTS_KEY) ?? "[]") as string[]);
	} catch {
		return new Set();
	}
}
export function rememberHeart(key: string): void {
	try {
		const s = heartedSet();
		s.add(key);
		localStorage.setItem(HEARTS_KEY, JSON.stringify([...s].slice(-500)));
	} catch {
		// 覚えられなくても、サーバーが同じ人の2回目を数えない
	}
}
