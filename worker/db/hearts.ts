/** 見た人の「刺さった」。同じ人（voter_hash）・同じ哲学者は1回だけ数える */
export async function addHeart(db: D1Database, consultationId: string, philosopherId: string, voterHash: string, now: number): Promise<number> {
	const [, count] = await db.batch([
		db
			.prepare("INSERT OR IGNORE INTO hearts (consultation_id, philosopher_id, voter_hash, created_at) VALUES (?, ?, ?, ?)")
			.bind(consultationId, philosopherId, voterHash, now),
		db.prepare("SELECT COUNT(*) AS n FROM hearts WHERE consultation_id = ? AND philosopher_id = ?").bind(consultationId, philosopherId),
	]);
	return (count.results[0] as { n: number } | undefined)?.n ?? 0;
}

/** 相談ごとの「刺さった」の数（哲学者の id → 数） */
export async function heartCounts(db: D1Database, consultationId: string): Promise<Record<string, number>> {
	const { results } = await db
		.prepare("SELECT philosopher_id, COUNT(*) AS n FROM hearts WHERE consultation_id = ? GROUP BY philosopher_id")
		.bind(consultationId)
		.all<{ philosopher_id: string; n: number }>();
	return Object.fromEntries(results.map((r) => [r.philosopher_id, r.n]));
}
