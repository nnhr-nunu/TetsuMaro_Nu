// 回答の質を確かめる: 試験用の相談（scripts/eval/cases.json）を手元の開発サーバーに1件ずつ送り、
// 7人の結論・本文・概念・名言を docs/eval/<日付>.md に書き出す。読み比べて、名簿（shared/philosophers）と指示文（shared/prompt.ts）を直す。
// 使い方: .dev.vars に GEMINI_API_KEY を入れて `npm run dev` → 別の端末で `npm run eval`（件数を絞るなら `npm run eval -- love-breakup crisis`）。
// 本物の Gemini の無料枠を使う（20件で20回）。Cookie を付けないので、1端末1日10回の上限にはかからない
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const BASE = process.env.EVAL_BASE ?? "http://localhost:5183";
const only = process.argv.slice(2);
const cases = JSON.parse(fs.readFileSync(path.join(root, "scripts/eval/cases.json"), "utf8")).filter((c) => only.length === 0 || only.includes(c.id));

/** 1件送って、流れてきた行を全部読む */
async function consult(body) {
	const res = await fetch(`${BASE}/api/consult`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) });
	if (!res.ok) return { error: `${res.status} ${await res.text()}` };
	const events = (await res.text())
		.split("\n")
		.filter(Boolean)
		.map((l) => JSON.parse(l));
	return { events };
}

const day = new Date().toISOString().slice(0, 10);
const out = [`# 回答の確かめ（${day}）`, "", `開発サーバー: ${BASE}`, ""];
for (const c of cases) {
	process.stdout.write(`${c.id} … `);
	const started = Date.now();
	const { events, error } = await consult(c.body);
	const sec = ((Date.now() - started) / 1000).toFixed(1);
	out.push(`## ${c.id}`, "", `> ${c.body}`, "");
	if (error) {
		out.push(`失敗: ${error}`, "");
		console.log(`失敗 ${error}`);
		continue;
	}
	const meta = events.find((e) => e.type === "meta");
	const done = events.find((e) => e.type === "done" || e.type === "error");
	out.push(`- 大分類: ${meta?.category ?? "-"} / 小分類: ${(meta?.tags ?? []).join(", ") || "-"} / 重い相談: ${meta?.crisis ?? "-"} / 終わり: ${JSON.stringify(done)} / ${sec}秒`, "");
	for (const a of events.filter((e) => e.type === "answer")) {
		out.push(`### ${a.philosopher}「${a.conclusion}」`, "", a.body, "", `- 概念: ${a.concepts.join(", ") || "なし"} / 名言: ${a.quote ?? "なし"}`, "");
	}
	const nunu = events.find((e) => e.type === "nunu");
	if (nunu) out.push("### AIぬぬはら", "", nunu.body || "（なし）", "", `- 関連: ${nunu.related.join(", ") || "なし"}`, "");
	console.log(`${events.filter((e) => e.type === "answer").length}人 ${sec}秒`);
}
fs.mkdirSync(path.join(root, "docs/eval"), { recursive: true });
const file = path.join(root, "docs/eval", `${day}.md`);
fs.writeFileSync(file, out.join("\n"));
console.log(file);
