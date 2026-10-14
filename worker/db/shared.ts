import type { SharedItem } from "../../shared/api";
import type { Mode } from "../../shared/site";
import type { CategoryId } from "../../shared/themes";
import { parseList } from "./consultations";

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

/** 1ページの件数 */
export const PAGE_SIZE = 20;
/** 一覧に出す相談の先頭の長さ */
const EXCERPT = 80;
/** 言葉は5つまで（それより多い分は使わない） */
const MAX_TERMS = 5;

export type SharedQuery = {
	mode: Mode;
	q?: string;
	category?: CategoryId;
	tag?: string;
	philosopher?: string;
	sort: "new" | "hearts";
	cursor?: string;
};

type Row = {
	id: string;
	excerpt: string;
	category: CategoryId;
	tags: string;
	shared_at: number;
	display_name: string | null;
	my_picks: string;
	top_hearted: string | null;
	heart_total: number;
};

/** 見た人の刺さったが一番多い哲学者（同じ数なら id の順） */
const TOP_HEARTED =
	"(SELECT philosopher_id FROM hearts h WHERE h.consultation_id = c.id GROUP BY philosopher_id ORDER BY COUNT(*) DESC, philosopher_id LIMIT 1)";
const HEART_TOTAL = "(SELECT COUNT(*) FROM hearts h WHERE h.consultation_id = c.id)";
const SELECT = `SELECT c.id, substr(c.body, 1, ${EXCERPT}) AS excerpt, c.category, c.tags, c.shared_at, c.display_name, c.my_picks, ${TOP_HEARTED} AS top_hearted, ${HEART_TOTAL} AS heart_total FROM consultations c`;
const PUBLIC = "c.shared_at IS NOT NULL AND c.hidden_at IS NULL AND c.mode = ?";

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

function toItem(r: Row): SharedItem {
	const picks = parseList(r.my_picks).filter((p) => p !== "nunu");
	return {
		id: r.id,
		excerpt: r.excerpt,
		category: r.category,
		tags: parseList(r.tags),
		sharedAt: r.shared_at,
		displayName: r.display_name,
		topPhilosopher: picks[0] ?? r.top_hearted,
		heartTotal: r.heart_total,
	};
}

/**
 * みんなの相談。言葉は3文字以上なら全文検索（trigram）、2文字以下なら LIKE（trigram は3文字より短い言葉を探せないため）。
 * 並びは新しい順（cursor は「共有した時刻_id」）か、刺さった数の順（cursor は何件目から）
 */
export async function listShared(db: D1Database, query: SharedQuery): Promise<{ items: SharedItem[]; next: string | null }> {
	const where = [PUBLIC];
	const binds: (string | number)[] = [query.mode];
	const terms = (query.q ?? "").trim().split(/\s+/).filter(Boolean).slice(0, MAX_TERMS);
	for (const term of terms) {
		if ([...term].length >= 3) {
			where.push("c.id IN (SELECT consultation_id FROM shared_fts WHERE shared_fts MATCH ?)");
			binds.push(`"${term.replaceAll('"', '""')}"`);
		} else {
			where.push("(c.body LIKE ? ESCAPE '\\' OR COALESCE(c.my_answer, '') LIKE ? ESCAPE '\\')");
			binds.push(`%${escapeLike(term)}%`, `%${escapeLike(term)}%`);
		}
	}
	if (query.category) {
		where.push("c.category = ?");
		binds.push(query.category);
	}
	if (query.tag) {
		where.push("EXISTS (SELECT 1 FROM json_each(c.tags) WHERE value = ?)");
		binds.push(query.tag);
	}
	if (query.philosopher) {
		where.push(`(EXISTS (SELECT 1 FROM json_each(c.my_picks) WHERE value = ?) OR ${TOP_HEARTED} = ?)`);
		binds.push(query.philosopher, query.philosopher);
	}

	let order: string;
	let offset = 0;
	if (query.sort === "hearts") {
		order = "heart_total DESC, c.shared_at DESC, c.id DESC";
		offset = Math.max(0, Number.parseInt(query.cursor ?? "0", 10) || 0);
	} else {
		order = "c.shared_at DESC, c.id DESC";
		const m = /^(\d+)_([A-Za-z0-9_-]+)$/.exec(query.cursor ?? "");
		if (m) {
			where.push("(c.shared_at < ? OR (c.shared_at = ? AND c.id < ?))");
			binds.push(Number(m[1]), Number(m[1]), m[2]);
		}
	}

	const { results } = await db
		.prepare(`${SELECT} WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT ? OFFSET ?`)
		.bind(...binds, PAGE_SIZE + 1, offset)
		.all<Row>();
	const items = results.slice(0, PAGE_SIZE).map(toItem);
	let next: string | null = null;
	if (results.length > PAGE_SIZE) {
		const last = items[items.length - 1];
		next = query.sort === "hearts" ? String(offset + PAGE_SIZE) : `${last.sharedAt}_${last.id}`;
	}
	return { items, next };
}

/** 似た悩み: 同じ大分類の中で、小分類が多く重なる順 → 新しい順。6件、自分は除く */
export async function similarShared(db: D1Database, base: { id: string; mode: Mode; category: CategoryId; tags: string[] }): Promise<SharedItem[]> {
	const { results } = await db
		.prepare(
			`${SELECT} WHERE ${PUBLIC} AND c.category = ? AND c.id != ? ORDER BY (SELECT COUNT(*) FROM json_each(c.tags) WHERE value IN (SELECT value FROM json_each(?))) DESC, c.shared_at DESC LIMIT 6`,
		)
		.bind(base.mode, base.category, base.id, JSON.stringify(base.tags))
		.all<Row>();
	return results.map(toItem);
}
