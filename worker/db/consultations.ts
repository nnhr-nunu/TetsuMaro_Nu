import type { AnswerEvent, ConsultationStatus, MetaEvent, NunuEvent } from "../../shared/api";
import type { AgeBandId, GenderId, Mode } from "../../shared/site";
import type { CategoryId } from "../../shared/themes";

/** 相談の行（D1 の consultations） */
export type ConsultationRow = {
	id: string;
	owner_id: string;
	mode: Mode;
	body: string;
	category: CategoryId;
	tags: string;
	crisis: number;
	age_band: string | null;
	gender: string | null;
	created_at: number;
	shared_at: number | null;
	display_name: string | null;
	my_answer: string | null;
	my_picks: string;
	hidden_at: number | null;
	model: string | null;
	status: ConsultationStatus;
};

export type Loaded = { row: ConsultationRow; answers: AnswerEvent[]; nunu: NunuEvent | null };

const parseList = (json: string | null): string[] => {
	try {
		const v: unknown = JSON.parse(json ?? "[]");
		return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
	} catch {
		return [];
	}
};
export { parseList };

export async function insertConsultation(
	db: D1Database,
	v: { id: string; ownerId: string; mode: Mode; body: string; crisis: boolean; ageBand?: AgeBandId; gender?: GenderId; now: number },
): Promise<void> {
	await db
		.prepare("INSERT INTO consultations (id, owner_id, mode, body, crisis, age_band, gender, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
		.bind(v.id, v.ownerId, v.mode, v.body, v.crisis ? 1 : 0, v.ageBand ?? null, v.gender ?? null, v.now)
		.run();
}

/** AI の meta を入れる。重い相談の印は、言葉で立てたものを消さない */
export async function applyMeta(db: D1Database, id: string, meta: MetaEvent): Promise<void> {
	await db
		.prepare("UPDATE consultations SET category = ?, tags = ?, crisis = MAX(crisis, ?) WHERE id = ?")
		.bind(meta.category, JSON.stringify(meta.tags), meta.crisis ? 1 : 0, id)
		.run();
}

export async function insertAnswer(db: D1Database, id: string, slot: number, a: AnswerEvent): Promise<void> {
	await db
		.prepare("INSERT OR IGNORE INTO answers (consultation_id, philosopher_id, slot, conclusion, body, concepts, quote_id) VALUES (?, ?, ?, ?, ?, ?, ?)")
		.bind(id, a.philosopher, slot, a.conclusion, a.body, JSON.stringify(a.concepts), a.quote)
		.run();
}

export async function saveNunu(db: D1Database, id: string, nunu: NunuEvent): Promise<void> {
	await db
		.prepare("INSERT OR REPLACE INTO nunu_answers (consultation_id, body, related) VALUES (?, ?, ?)")
		.bind(id, nunu.body, JSON.stringify(nunu.related))
		.run();
}

export async function finishConsultation(db: D1Database, id: string, status: ConsultationStatus, model: string | null): Promise<void> {
	await db.prepare("UPDATE consultations SET status = ?, model = COALESCE(?, model) WHERE id = ?").bind(status, model, id).run();
}

/** 相談と、それにつながるものを全部消す（回答・ぬぬはら・刺さった・通報・検索の索引） */
export async function deleteConsultation(db: D1Database, id: string): Promise<void> {
	await db.batch([
		db.prepare("DELETE FROM answers WHERE consultation_id = ?").bind(id),
		db.prepare("DELETE FROM nunu_answers WHERE consultation_id = ?").bind(id),
		db.prepare("DELETE FROM hearts WHERE consultation_id = ?").bind(id),
		db.prepare("DELETE FROM reports WHERE consultation_id = ?").bind(id),
		db.prepare("DELETE FROM shared_fts WHERE consultation_id = ?").bind(id),
		db.prepare("DELETE FROM consultations WHERE id = ?").bind(id),
	]);
}

export async function loadConsultation(db: D1Database, id: string): Promise<Loaded | null> {
	const [rows, answers, nunu] = await db.batch([
		db.prepare("SELECT * FROM consultations WHERE id = ?").bind(id),
		db.prepare("SELECT philosopher_id, conclusion, body, concepts, quote_id FROM answers WHERE consultation_id = ? ORDER BY slot").bind(id),
		db.prepare("SELECT body, related FROM nunu_answers WHERE consultation_id = ?").bind(id),
	]);
	const row = (rows.results as ConsultationRow[])[0];
	if (!row) return null;
	const n = (nunu.results as { body: string; related: string }[])[0];
	return {
		row,
		answers: (answers.results as { philosopher_id: string; conclusion: string; body: string; concepts: string; quote_id: string | null }[]).map((a) => ({
			type: "answer",
			philosopher: a.philosopher_id,
			conclusion: a.conclusion,
			body: a.body,
			concepts: parseList(a.concepts),
			quote: a.quote_id,
		})),
		nunu: n ? { type: "nunu", body: n.body, related: parseList(n.related) } : null,
	};
}

/** 日本時間のその日の 0 時（ミリ秒） */
export function startOfDayJst(now: number): number {
	const jst = 9 * 60 * 60 * 1000;
	return Math.floor((now + jst) / 86_400_000) * 86_400_000 - jst;
}

/** その持ち主が今日（日本時間）送った相談の数 */
export async function countToday(db: D1Database, ownerId: string, now: number): Promise<number> {
	const row = await db
		.prepare("SELECT COUNT(*) AS n FROM consultations WHERE owner_id = ? AND created_at >= ?")
		.bind(ownerId, startOfDayJst(now))
		.first<{ n: number }>();
	return row?.n ?? 0;
}
