// ぬぬはらのマシュマロ公開回答を取り込み、shared/nunu/answers.json に書く（`npm run nunu:fetch`）。
// 読むだけ・ログインなし。1リクエストごとに 500ms 空ける。
//
// - 一覧: /users/<id>/answers を Accept: application/json で GET。続きは ?before=<最後の項目の updated_at>。404 か空で終わり
// - 1件: /messages/<uuid> の HTML から質問と回答を読む（入れ子の div があるので HTML パーサで読む）
// - すでに answers.json にある id の audience / category は上書きしない（人が直した印を守る）
// - 新しい件は audience: "adult", category: "other" の仮の値で入れる（あとで人か AI が直す）
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parse } from "node-html-parser";

const ORIGIN = "https://marshmallow-qa.com";
const LIST_URL = `${ORIGIN}/users/3745329/answers`;
const OUT = fileURLToPath(new URL("../shared/nunu/answers.json", import.meta.url));
const WAIT_MS = 500;
const MAX_PAGES = 200; // 無限ループよけ
const UA = "tetsumaro-nunu-fetch (read-only; public answers of the developer)";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 500ms 空けつつ GET。一時的な失敗（ネットワーク・5xx・429）は 3 回まで待ち直す。404 はそのまま返す */
async function get(url, accept) {
	for (let attempt = 1; ; attempt++) {
		await sleep(WAIT_MS * attempt);
		let res;
		try {
			res = await fetch(url, { headers: { Accept: accept, "User-Agent": UA } });
		} catch (e) {
			if (attempt >= 3) throw e;
			continue;
		}
		if (res.ok || res.status === 404) return res;
		if (attempt >= 3 || (res.status < 500 && res.status !== 429)) throw new Error(`${res.status} ${url}`);
	}
}

/** 要素の中の文字を、改行（<br> と元の改行）を残して取り出す。実体参照は戻す。伏せ字の画像（<img alt="□">）は alt の文字にする */
function textOf(node) {
	let out = "";
	for (const child of node.childNodes) {
		if (child.nodeType === 3) out += child.text; // TextNode（text は実体参照を戻した文字）
		else if (child.nodeType === 1) {
			if (child.tagName === "BR") out += "\n";
			else if (child.tagName === "IMG") out += child.getAttribute("alt") ?? "";
			else out += textOf(child);
		}
	}
	return out;
}

const clean = (s) => s.replace(/\r\n?/g, "\n").trim();

/** 質問と回答を取り出す。質問は .message-card__text の中、回答は .answer-content */
function readBlocks(root) {
	const q = root.querySelector(".message-card__text");
	const a = root.querySelector(".answer-content");
	return { question: q ? clean(textOf(q)) : "", answer: a ? clean(textOf(a)) : "" };
}

/** 一覧の 1 項目（fragment）から uuid と更新日時を取る */
function readListItem(fragment) {
	const root = parse(fragment);
	const updatedAt = root.querySelector("[data-updated-at]")?.getAttribute("data-updated-at");
	const href = root.querySelector('a[href^="/messages/"]')?.getAttribute("href");
	const uuid = href?.match(/^\/messages\/([0-9a-f-]{36})/)?.[1];
	if (!updatedAt || !uuid) throw new Error("一覧の項目から uuid / updated_at を読めませんでした");
	return { uuid, updatedAt, ...readBlocks(root) };
}

const norm = (s) => s.replace(/\s+/g, "");

async function main() {
	let existing = [];
	try {
		existing = JSON.parse(await readFile(OUT, "utf8"));
	} catch {
		// 無ければ最初から
	}
	const marks = new Map(existing.map((a) => [a.id, a]));

	// 1) 一覧を最後まで集める
	const items = [];
	const seen = new Set();
	let before = null;
	let listComplete = false;
	for (let page = 1; page <= MAX_PAGES; page++) {
		const url = before ? `${LIST_URL}?before=${encodeURIComponent(before)}` : LIST_URL;
		const res = await get(url, "application/json");
		if (res.status === 404) {
			listComplete = true;
			break;
		}
		const rows = await res.json();
		if (!Array.isArray(rows) || rows.length === 0) {
			listComplete = true;
			break;
		}
		for (const row of rows) {
			const it = readListItem(row.fragment);
			if (!seen.has(it.uuid)) {
				seen.add(it.uuid);
				items.push(it);
			}
		}
		const last = items[items.length - 1].updatedAt;
		if (last === before) break; // 進まないとき
		before = last;
		process.stdout.write(`\r一覧 ${page} ページ目まで（${items.length} 件）`);
	}
	console.log(`\n一覧: ${items.length} 件${listComplete ? "" : "（最後まで読めていません）"}`);

	// 2) 1 件ずつ読む
	const results = [];
	const problems = [];
	let i = 0;
	for (const it of items) {
		i++;
		const url = `${ORIGIN}/messages/${it.uuid}`;
		process.stdout.write(`\r本文 ${i}/${items.length}`);
		let blocks;
		try {
			const res = await get(url, "text/html");
			if (res.status === 404) throw new Error("404");
			blocks = readBlocks(parse(await res.text()));
		} catch (e) {
			problems.push(`${it.uuid}: 取得に失敗（${e.message}）`);
			const old = marks.get(it.uuid);
			if (old) results.push(old); // すでにあるものは残す
			continue;
		}
		if (!blocks.question || !blocks.answer) {
			problems.push(`${it.uuid}: 質問か回答が空でした`);
			const old = marks.get(it.uuid);
			if (old) results.push(old);
			continue;
		}
		// 一覧の中の本文と食い違うなら、どちらかが途中で切れている
		if (norm(it.question) !== norm(blocks.question) || norm(it.answer) !== norm(blocks.answer)) {
			problems.push(`${it.uuid}: 一覧と個別ページで本文が食い違います`);
		}
		const old = marks.get(it.uuid);
		results.push({
			id: it.uuid,
			url,
			date: it.updatedAt.slice(0, 10),
			question: blocks.question,
			answer: blocks.answer,
			audience: old?.audience ?? "adult",
			category: old?.category ?? "other",
			_updatedAt: it.updatedAt,
		});
	}
	console.log();

	// 3) 新しい順に並べて書く（一覧が最後まで読めたときだけ、一覧から消えたものを外す）
	const fetchedIds = new Set(items.map((x) => x.uuid));
	if (!listComplete) for (const a of existing) if (!fetchedIds.has(a.id)) results.push(a);
	results.sort((a, b) => {
		const ka = a._updatedAt ?? `${a.date} 00:00:00`;
		const kb = b._updatedAt ?? `${b.date} 00:00:00`;
		return ka < kb ? 1 : ka > kb ? -1 : 0;
	});
	const out = results.map(({ _updatedAt, ...a }) => a);
	await writeFile(OUT, `${JSON.stringify(out, null, "\t")}\n`);

	const fresh = out.filter((a) => !marks.has(a.id)).length;
	const dropped = existing.filter((a) => !out.some((b) => b.id === a.id)).length;
	console.log(`書き込み: ${out.length} 件（新しい件 ${fresh}、印を引き継いだ件 ${out.length - fresh}、一覧から消えた件 ${dropped}）`);
	if (fresh > 0) console.log(`新しい ${fresh} 件は audience: "adult", category: "other" の仮の値です。あとで直してください`);
	if (problems.length > 0) {
		console.error(`\n注意 ${problems.length} 件:`);
		for (const p of problems) console.error(`- ${p}`);
		process.exitCode = 1;
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
