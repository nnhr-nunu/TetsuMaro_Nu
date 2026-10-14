/** 共有された相談の全文検索の索引に入れる（入っていれば入れ直す）。共有・自分の答えを直したときに呼ぶ */
export async function indexShared(db: D1Database, id: string): Promise<void> {
	await db.batch([
		db.prepare("DELETE FROM shared_fts WHERE consultation_id = ?").bind(id),
		db
			.prepare(
				"INSERT INTO shared_fts (consultation_id, body, my_answer) SELECT id, body, COALESCE(my_answer, '') FROM consultations WHERE id = ? AND shared_at IS NOT NULL AND hidden_at IS NULL",
			)
			.bind(id),
	]);
}

/** 索引から外す（非公開に戻す・隠す・消すとき） */
export async function unindexShared(db: D1Database, id: string): Promise<void> {
	await db.prepare("DELETE FROM shared_fts WHERE consultation_id = ?").bind(id).run();
}
