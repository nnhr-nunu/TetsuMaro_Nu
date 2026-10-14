// 見本の相談（scripts/curated/cases.json）を Claude に書いてもらうための指示文を書き出す。
// 本番の Gemini と同じ指示文（shared/prompt.ts）を使う。system は1つ、user は相談ごと（ぬぬはらの手本つき）。
// 使い方: `npx jiti scripts/curated/prompts.ts` → scripts/curated/work/（git の対象外）
import fs from "node:fs";
import path from "node:path";
import { relatedNunu } from "../../shared/nunu";
import { buildConsultPrompt } from "../../shared/prompt";
import { ANSWER_COUNT } from "../../shared/site";

const dir = path.resolve(import.meta.dirname);
const work = path.join(dir, "work");
const cases = JSON.parse(fs.readFileSync(path.join(dir, "cases.json"), "utf8")) as { id: string; body: string }[];

fs.mkdirSync(work, { recursive: true });
for (const c of cases) {
	const related = relatedNunu(c.body, "general", 3);
	const { system, user } = buildConsultPrompt({ body: c.body, mode: "general", nunuExamples: related, count: ANSWER_COUNT, exclude: [] });
	fs.writeFileSync(path.join(work, "system.md"), system);
	fs.writeFileSync(path.join(work, `${c.id}.user.md`), user);
}
console.log(`${cases.length}件 → ${work}`);
