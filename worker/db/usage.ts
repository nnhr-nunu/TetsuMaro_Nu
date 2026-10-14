import { startOfDayJst } from "./consultations";

/** 日本時間の日付（YYYY-MM-DD） */
export function jstDay(now: number): string {
	return new Date(startOfDayJst(now) + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Gemini を呼んだ回数と失敗を数える（無料枠に近いかを見る。偽の AI は数えない） */
export async function countAiCall(db: D1Database, now: number, failed: boolean): Promise<void> {
	await db
		.prepare("INSERT INTO ai_usage (day, calls, failures) VALUES (?, 1, ?) ON CONFLICT (day) DO UPDATE SET calls = calls + 1, failures = failures + excluded.failures")
		.bind(jstDay(now), failed ? 1 : 0)
		.run();
}
