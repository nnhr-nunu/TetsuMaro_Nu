// 見本の相談（cases.json と answers/<id>.jsonl）を、D1 のマイグレーション（SQL）にする。
// 持ち主は "curated"（だれの端末でもない。画面は「運営が用意した相談の例」と出す）。みんなの相談に共有した状態で入れる。
// 使い方: `npx jiti scripts/curated/build.ts migrations/<番号>_curated.sql`。check.ts で × のある相談は入れない
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { relatedNunu } from "../../shared/nunu";
import { CURATED_OWNER } from "../../shared/site";
import { checkCase } from "./check";

const dir = path.resolve(import.meta.dirname);
const out = process.argv[2];
if (!out) throw new Error("出力先（migrations/<番号>_curated.sql）を指定してください");
const cases = JSON.parse(fs.readFileSync(path.join(dir, "cases.json"), "utf8")) as { id: string; body: string }[];

const q = (v: string | number | null) => (v === null ? "NULL" : typeof v === "number" ? String(v) : `'${v.replaceAll("'", "''")}'`);
/** 見本の id は決まった値にする（作り直しても URL と刺さったが変わらない）。形は newId() と同じ16文字 */
const idOf = (caseId: string) => crypto.createHash("sha256").update(`curated:${caseId}`).digest().subarray(0, 12).toString("base64url");
/** 共有した時刻（2026-10-14 0時 JST から1分ずつ前へ。後から来る本物の相談が上に並ぶ） */
const BASE = Date.parse("2026-10-14T00:00:00+09:00");

const sql = [
	"-- 見本の相談（scripts/curated/build.ts で作る。手で直さない）",
	`DELETE FROM shared_fts WHERE consultation_id IN (SELECT id FROM consultations WHERE owner_id = ${q(CURATED_OWNER)});`,
	`DELETE FROM answers WHERE consultation_id IN (SELECT id FROM consultations WHERE owner_id = ${q(CURATED_OWNER)});`,
	`DELETE FROM nunu_answers WHERE consultation_id IN (SELECT id FROM consultations WHERE owner_id = ${q(CURATED_OWNER)});`,
	`DELETE FROM consultations WHERE owner_id = ${q(CURATED_OWNER)};`,
];
let used = 0;
cases.forEach((c, i) => {
	const r = checkCase(c);
	if (r.problems.length) {
		console.log(`入れない: ${c.id}（${r.problems.join(" / ")}）`);
		return;
	}
	used++;
	const id = idOf(c.id);
	const at = BASE - i * 60_000;
	sql.push(
		`INSERT INTO consultations (id, owner_id, mode, body, category, tags, crisis, created_at, shared_at, model, status) VALUES (${[
			q(id),
			q(CURATED_OWNER),
			q("general"),
			q(c.body),
			q(r.meta.category),
			q(JSON.stringify(r.meta.tags)),
			0,
			at,
			at,
			q("claude"),
			q("done"),
		].join(", ")});`,
	);
	r.answers.forEach((a, slot) => {
		sql.push(
			`INSERT INTO answers (consultation_id, philosopher_id, slot, conclusion, body, concepts, quote_id) VALUES (${[
				q(id),
				q(a.philosopher),
				slot,
				q(a.conclusion),
				q(a.body),
				q(JSON.stringify(a.concepts)),
				q(a.quote),
			].join(", ")});`,
		);
	});
	// 関連するマシュマロ回答は、本番の相談と同じ探し方で（prompts.ts で書いた手本と同じ）
	const related = relatedNunu(c.body, "general", 3).map((n) => n.id);
	sql.push(`INSERT INTO nunu_answers (consultation_id, body, related) VALUES (${[q(id), q(r.nunu), q(JSON.stringify(related))].join(", ")});`);
	sql.push(`INSERT INTO shared_fts (consultation_id, body, my_answer) VALUES (${q(id)}, ${q(c.body)}, '');`);
});
fs.writeFileSync(path.resolve(out), `${sql.join("\n")}\n`);
console.log(`${used}/${cases.length}件 → ${out}`);
