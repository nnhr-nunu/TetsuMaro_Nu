import { newId } from "../ids";
import { unindexShared } from "./shared";

/** この人数の通報で、共有された相談を自動で隠す（管理画面で戻せる） */
export const AUTO_HIDE_REPORTS = 3;

/** 通報を足す（同じ人は1回）。人数が AUTO_HIDE_REPORTS に達したら隠す。返り値は通報した人の数 */
export async function addReport(db: D1Database, consultationId: string, reason: string, reporterHash: string, now: number): Promise<number> {
	const [, count] = await db.batch([
		db
			.prepare("INSERT OR IGNORE INTO reports (id, consultation_id, reason, reporter_hash, created_at) VALUES (?, ?, ?, ?, ?)")
			.bind(newId(), consultationId, reason, reporterHash, now),
		db.prepare("SELECT COUNT(*) AS n FROM reports WHERE consultation_id = ?").bind(consultationId),
	]);
	const n = (count.results[0] as { n: number } | undefined)?.n ?? 0;
	if (n >= AUTO_HIDE_REPORTS) await hideConsultation(db, consultationId, now);
	return n;
}

export async function hideConsultation(db: D1Database, id: string, now: number): Promise<void> {
	await db.prepare("UPDATE consultations SET hidden_at = COALESCE(hidden_at, ?) WHERE id = ?").bind(now, id).run();
	await unindexShared(db, id);
}
