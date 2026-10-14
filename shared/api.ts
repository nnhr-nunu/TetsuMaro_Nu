import type { Mode } from "./site";
import type { CategoryId } from "./themes";

/**
 * 相談の回答の流れ（POST /api/consult、POST /api/consultations/:id/more）。1行に1つの JSON（application/x-ndjson）。
 * start → meta → answer（届いた人から）→ nunu → done。途中で失敗したら error
 */
export type MetaEvent = { type: "meta"; category: CategoryId; tags: string[]; crisis: boolean; picks: string[] };

/** 哲学者1人の回答。concepts は概念の id、quote は名言の id（本文は名簿から差し込む） */
export type AnswerEvent = {
	type: "answer";
	philosopher: string;
	conclusion: string;
	body: string;
	concepts: string[];
	quote: string | null;
};

/** AIぬぬはらの回答。related は関連したマシュマロ回答の id（サーバーが付ける） */
export type NunuEvent = { type: "nunu"; body: string; related: string[] };

export type ErrorCode =
	| "empty"
	| "too_long"
	| "rate_limited"
	| "daily_owner_limit"
	| "turnstile"
	| "ai_daily_limit"
	| "ai_unavailable"
	| "ai_failed"
	| "not_found";

export type StreamEvent =
	| { type: "start"; id: string }
	| MetaEvent
	| AnswerEvent
	| NunuEvent
	| { type: "done"; status: "done" | "partial" }
	| { type: "error"; code: ErrorCode };

export type ConsultationStatus = "pending" | "done" | "partial";

/** GET /api/consultations/:id */
export type ConsultationView = {
	id: string;
	mode: Mode;
	body: string;
	category: CategoryId;
	tags: string[];
	crisis: boolean;
	createdAt: number;
	sharedAt: number | null;
	displayName: string | null;
	myAnswer: string | null;
	/** 相談者が刺さった人（哲学者の id。"nunu" はぬぬはら） */
	myPicks: string[];
	answers: AnswerEvent[];
	nunu: NunuEvent | null;
	/** 見た人の「刺さった」の数（哲学者の id → 数） */
	hearts: Record<string, number>;
	isOwner: boolean;
	status: ConsultationStatus;
};

/** みんなの相談の一覧の1行（GET /api/shared） */
export type SharedItem = {
	id: string;
	excerpt: string;
	category: CategoryId;
	tags: string[];
	sharedAt: number;
	displayName: string | null;
	/** 一番刺さった人（相談者の選んだ人、なければ見た人の刺さったが一番多い人） */
	topPhilosopher: string | null;
	heartTotal: number;
};
