// 見本の相談の回答（scripts/curated/answers/<id>.jsonl）を、本番と同じ読み取り（shared/answerStream.ts）で確かめる。
// 使い方: `npx jiti scripts/curated/check.ts [id ...]`（id を省くと全部）。問題があれば一覧を出して終了コード 1
import fs from "node:fs";
import path from "node:path";
import { type PickState, acceptAnswer, parseEvent } from "../../shared/answerStream";
import type { AnswerEvent, MetaEvent } from "../../shared/api";
import { ANSWER_COUNT } from "../../shared/site";

const dir = path.resolve(import.meta.dirname);
const cases = JSON.parse(fs.readFileSync(path.join(dir, "cases.json"), "utf8")) as { id: string; body: string }[];
const only = process.argv.slice(2);
const len = (s: string) => [...s].length;

export type Checked = { id: string; body: string; meta: MetaEvent; answers: AnswerEvent[]; nunu: string; problems: string[]; notes: string[] };

/** 1件を読む。problems は直さないと使えないもの、notes は指示（字数など）からのはみ出し */
export function checkCase(c: { id: string; body: string }): Checked {
	const problems: string[] = [];
	const notes: string[] = [];
	const file = path.join(dir, "answers", `${c.id}.jsonl`);
	const out: Checked = { id: c.id, body: c.body, meta: { type: "meta", category: "other", tags: [], crisis: false, picks: [] }, answers: [], nunu: "", problems, notes };
	if (!fs.existsSync(file)) {
		problems.push("ファイルが無い");
		return out;
	}
	const lines = fs.readFileSync(file, "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
	const state: PickState = { answered: [], count: ANSWER_COUNT, exclude: [] };
	let sawMeta = false;
	lines.forEach((line, i) => {
		const ev = parseEvent(line);
		if (!ev) return problems.push(`${i + 1}行目が読めない`);
		if (ev.type === "meta") {
			if (sawMeta) problems.push("meta が2つある");
			sawMeta = true;
			out.meta = ev;
			if (ev.category === "other") notes.push("大分類が other");
			if (ev.tags.length === 0) notes.push("小分類が無い");
			return;
		}
		if (ev.type === "nunu") {
			out.nunu = ev.body;
			if (len(ev.body) < 200 || len(ev.body) > 400) notes.push(`AIぬぬはらが${len(ev.body)}字`);
			return;
		}
		const raw = JSON.parse(line.slice(line.indexOf("{"), line.lastIndexOf("}") + 1)) as { quote?: unknown; concepts?: unknown[] };
		if (!acceptAnswer(state, ev)) return problems.push(`${ev.philosopher} は選べない（重複・同じ学派・哲学者以外が多すぎる）`);
		state.answered.push(ev.philosopher);
		out.answers.push(ev);
		if (raw.quote != null && ev.quote === null) problems.push(`${ev.philosopher} の名言 ${String(raw.quote)} が名簿に無い`);
		if ((raw.concepts ?? []).length !== ev.concepts.length) problems.push(`${ev.philosopher} の概念に名簿に無いものがある`);
		if (ev.concepts.length === 0) problems.push(`${ev.philosopher} の概念が無い`);
		if (len(ev.conclusion) > 30) notes.push(`${ev.philosopher} の結論が${len(ev.conclusion)}字`);
		if (len(ev.body) < 250 || len(ev.body) > 400) notes.push(`${ev.philosopher} の本文が${len(ev.body)}字`);
	});
	if (!sawMeta) problems.push("meta が無い");
	if (out.answers.length !== ANSWER_COUNT) problems.push(`回答が${out.answers.length}人`);
	if (out.meta.picks.join() !== out.answers.map((a) => a.philosopher).join()) notes.push("picks と回答の順が違う");
	if (!out.nunu) problems.push("AIぬぬはらが無い");
	if (out.meta.crisis) problems.push("重い相談の印が付いている（見本には使わない）");
	return out;
}

if ((process.argv[1] ?? "").replaceAll("\\", "/").endsWith("scripts/curated/check.ts")) {
	let bad = 0;
	for (const c of cases.filter((c) => only.length === 0 || only.includes(c.id))) {
		const r = checkCase(c);
		if (r.problems.length) bad++;
		const mark = r.problems.length ? "NG" : r.notes.length ? "△" : "OK";
		console.log(`${mark} ${c.id} ${r.answers.map((a) => a.philosopher).join(",")}`);
		for (const p of r.problems) console.log(`   × ${p}`);
		for (const n of r.notes) console.log(`   - ${n}`);
	}
	process.exit(bad ? 1 : 0);
}
