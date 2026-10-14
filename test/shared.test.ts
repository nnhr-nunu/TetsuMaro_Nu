import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import type { SharedItem } from "../shared/api";
import { deleteConsultation } from "../worker/db/consultations";
import { indexShared, unindexShared } from "../worker/db/shared";
import app from "../worker/index";

// ほかのテストの相談より新しくする（同じ DB を使うことがあるため）
let t = 4_000_000_000_000;
async function add(id: string, body: string, opts: { category?: string; tags?: string[]; shared?: boolean; hidden?: boolean; picks?: string[] } = {}) {
	t += 1000;
	await env.DB.prepare(
		"INSERT INTO consultations (id, owner_id, body, category, tags, created_at, shared_at, hidden_at, my_picks, status) VALUES (?, 'o', ?, ?, ?, ?, ?, ?, ?, 'done')",
	)
		.bind(id, body, opts.category ?? "other", JSON.stringify(opts.tags ?? []), t, opts.shared === false ? null : t, opts.hidden ? t : null, JSON.stringify(opts.picks ?? []))
		.run();
	await indexShared(env.DB, id);
}

const list = async (query: string): Promise<{ items: SharedItem[]; next: string | null }> =>
	(await app.request(`/api/shared${query}`, {}, env)).json();
const ids = async (query: string) => (await list(query)).items.map((i) => i.id);

beforeAll(async () => {
	await add("love1", "恋愛がうまくいかず、彼氏と喧嘩ばかりです", { category: "love", tags: ["partner"] });
	await add("love2", "片思いの相手に告白するか迷っています", { category: "love", tags: ["crush", "indecision"] });
	await add("love3", "恋人と別れて、ずっと引きずっています", { category: "love", tags: ["partner", "heartbreak"] });
	await add("work1", "上司が怖いので会社に行きたくありません", { category: "work", tags: ["boss"], picks: ["epictetus"] });
	await add("private", "恋愛の相談だけど非公開", { category: "love", tags: ["partner"], shared: false });
	await add("hidden", "恋愛の相談だけど隠された", { category: "love", tags: ["partner"], hidden: true });
});

describe("GET /api/shared", () => {
	it("2文字の言葉（恋愛）でも見つかる", async () => {
		expect(await ids("?q=恋愛")).toEqual(["love1"]);
	});
	it("3文字以上の言葉（上司が怖い）で見つかる", async () => {
		expect(await ids(`?q=${encodeURIComponent("上司が怖い")}`)).toEqual(["work1"]);
	});
	it("非公開・隠したものは出ない", async () => {
		const all = await ids("");
		expect(all).not.toContain("private");
		expect(all).not.toContain("hidden");
	});
	it("大分類・小分類・刺さった哲学者で絞れる", async () => {
		expect(await ids("?category=work")).toEqual(["work1"]);
		expect((await ids("?tag=partner")).sort()).toEqual(["love1", "love3"]);
		expect(await ids("?philosopher=epictetus")).toEqual(["work1"]);
	});
	it("新しい順に並び、相談者が刺さった人が出る", async () => {
		const res = await list("");
		expect(res.items.map((i) => i.id).slice(0, 4)).toEqual(["work1", "love3", "love2", "love1"]);
		expect(res.items[0].topPhilosopher).toBe("epictetus");
	});
	it("非公開に戻したもの・消したものは検索に出ない", async () => {
		await add("gone1", "削除される相談のテキスト", { category: "life" });
		await add("gone2", "非公開に戻す相談のテキスト", { category: "life" });
		await deleteConsultation(env.DB, "gone1");
		await env.DB.prepare("UPDATE consultations SET shared_at = NULL WHERE id = 'gone2'").run();
		await unindexShared(env.DB, "gone2");
		expect(await ids(`?q=${encodeURIComponent("相談のテキスト")}`)).toEqual([]);
		expect(await ids("?category=life")).toEqual([]);
	});
});

describe("GET /api/shared/:id/similar", () => {
	it("同じ大分類で小分類が多く重なる順。自分は含まない", async () => {
		const res = await app.request("/api/shared/love3/similar", {}, env);
		const items = (await res.json()) as SharedItem[];
		expect(items.map((i) => i.id)).toEqual(["love1", "love2"]);
	});
	it("共有されていない相談は 404", async () => {
		expect((await app.request("/api/shared/private/similar", {}, env)).status).toBe(404);
	});
});
