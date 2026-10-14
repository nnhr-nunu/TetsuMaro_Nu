import type { AnswerEvent } from "../../shared/api";
import { type Philosopher, quoteById } from "../../shared/philosophers";
import { shade, tint } from "../colors";
import { HeartButton } from "./HeartButton";
import { ConceptChip, SchoolChip } from "./InfoSheet";
import { Portrait } from "./Portrait";

const FIELD_LABEL: Record<Philosopher["field"], string | null> = { philosophy: null, psychology: "心理学者", practical: "実践の知恵" };

/** 哲学者1人の回答のカード。上の帯は哲学者の色。結論の一言 → 回答 → 名言 → 考え方のもと → 刺さった */
export function AnswerCard({
	answer,
	philosopher: p,
	index,
	heart,
}: {
	answer: AnswerEvent;
	philosopher: Philosopher;
	index: number;
	heart?: { on: boolean; count?: number; onClick: () => void; disabled?: boolean };
}) {
	const quote = answer.quote ? quoteById(answer.quote) : undefined;
	const field = FIELD_LABEL[p.field];
	return (
		<article id={`a-${p.id}`} className="overflow-hidden rounded-3xl border border-line bg-white" aria-labelledby={`a-${p.id}-name`}>
			<header className="flex items-end gap-4 px-5 pt-5" style={{ backgroundColor: tint(p.color) }}>
				<Portrait id={p.id} size={104} className="rounded-b-none" />
				<div className="min-w-0 pb-4">
					<p className="font-display text-2xl leading-none" style={{ color: shade(p.color) }}>
						{String(index + 1).padStart(2, "0")}
					</p>
					<h3 id={`a-${p.id}-name`} className="mt-1 text-xl font-bold">
						{p.name}
					</h3>
					<p className="text-xs text-ink-soft">
						{p.years}・{p.region}
					</p>
					<div className="mt-1.5 flex flex-wrap items-center gap-1.5" style={{ color: shade(p.color) }}>
						{field && <span className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-bold">{field}</span>}
						<SchoolChip id={p.school} />
					</div>
				</div>
			</header>
			<div className="space-y-4 p-5">
				<p className="text-sm text-ink-soft">
					<span className="font-bold">この人の考え方</span>　{p.oneLine}
				</p>
				<p className="phrase text-lg leading-snug font-bold">「{answer.conclusion}」</p>
				<div className="leading-[1.9] whitespace-pre-wrap">{answer.body}</div>
				{quote && (
					<figure className="rounded-2xl p-4" style={{ backgroundColor: tint(p.color, 10) }}>
						<blockquote className="leading-relaxed font-bold">{quote.text}</blockquote>
						<figcaption className="mt-1 text-xs text-ink-soft">
							— {p.name}　{quote.source}
						</figcaption>
					</figure>
				)}
				{answer.concepts.length > 0 && (
					<div className="flex flex-wrap items-center gap-1.5 text-sm" style={{ color: shade(p.color) }}>
						<span className="text-xs font-bold text-ink-soft">考え方のもと</span>
						{answer.concepts.map((c) => (
							<ConceptChip key={c} id={c} />
						))}
					</div>
				)}
				<p className="text-xs text-ink-soft">代表作：{p.works.slice(0, 3).join("・")}</p>
				{p.heavyTheme && <p className="text-xs text-ink-soft">※ 哲学者の思想の紹介で、死を勧めるものではありません。</p>}
				{heart && (
					<div className="pt-1">
						<HeartButton {...heart} />
					</div>
				)}
			</div>
		</article>
	);
}
