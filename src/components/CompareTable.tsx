import type { AnswerEvent } from "../../shared/api";
import { philosopherById } from "../../shared/philosophers";
import { schoolById } from "../../shared/schools";
import { Portrait } from "./Portrait";

/** 結論の一言を縦に並べた比べ表。行を押すとその人のカードへ。waiting はまだ書いている人（名前だけ出す） */
export function CompareTable({ answers, waiting }: { answers: AnswerEvent[]; waiting: string[] }) {
	return (
		<section aria-labelledby="compare-title" className="space-y-3">
			<h2 id="compare-title" className="text-lg font-bold">
				答えを一言で見比べる
			</h2>
			<ol className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-white">
				{answers.map((a) => {
					const p = philosopherById(a.philosopher);
					if (!p) return null;
					return (
						<li key={a.philosopher}>
							<a href={`#a-${p.id}`} className="flex items-center gap-3 py-3 pr-4 pl-3 transition hover:bg-paper" style={{ borderLeft: `5px solid ${p.color}` }}>
								<Portrait id={p.id} size={44} round />
								<div className="min-w-0">
									<p className="text-xs text-ink-soft">
										{p.name}
										{schoolById(p.school) && `（${schoolById(p.school)?.name}）`}
									</p>
									<p className="phrase leading-snug font-bold">{a.conclusion}</p>
								</div>
							</a>
						</li>
					);
				})}
				{waiting.map((id) => {
					const p = philosopherById(id);
					if (!p) return null;
					return (
						<li key={id} className="flex items-center gap-3 py-3 pr-4 pl-3" style={{ borderLeft: `5px solid ${p.color}` }}>
							<Portrait id={p.id} size={44} round className="opacity-60" />
							<p className="animate-pulse text-sm text-ink-soft">{p.name}が考えています…</p>
						</li>
					);
				})}
			</ol>
		</section>
	);
}
