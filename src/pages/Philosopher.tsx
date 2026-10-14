import { Link, useParams } from "react-router";
import { philosopherById } from "../../shared/philosophers";
import { btnPrimary } from "../buttons";
import { shade, tint } from "../colors";
import { SchoolChip } from "../components/InfoSheet";
import { Portrait } from "../components/Portrait";
import { SharedResults } from "../components/SharedResults";
import { Icon } from "../icons";
import { useTitle } from "../useTitle";
import { NotFound } from "./NotFound";

const FIELD_LABEL = { philosophy: "哲学", psychology: "心理学", practical: "実践の知恵" } as const;

export function PhilosopherPage() {
	const { id = "" } = useParams();
	const p = philosopherById(id);
	useTitle(p?.name ?? null);
	if (!p) return <NotFound message="この哲学者は見つかりませんでした。" />;

	const accent = shade(p.color);
	return (
		<div className="space-y-10">
			{/* 上の帯は哲学者の色（Consultation の AnswerCard の帯と同じ作り） */}
			<header className="flex items-end gap-3 overflow-hidden rounded-3xl border border-line px-4 pt-4 sm:gap-5 sm:px-6 sm:pt-6" style={{ backgroundColor: tint(p.color) }}>
				<Portrait id={p.id} size={160} className="h-auto w-28 rounded-b-none sm:w-40" />
				<div className="min-w-0 pb-4 sm:pb-6">
					<p className="text-xs text-ink-soft">{p.kana}</p>
					<h1 className="text-xl font-bold sm:text-3xl">{p.name}</h1>
					<p className="mt-0.5 text-xs text-ink-soft">
						{p.years}・{p.region}
					</p>
					<div className="mt-2 flex flex-wrap items-center gap-1.5" style={{ color: accent }}>
						<span className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-bold">{FIELD_LABEL[p.field]}</span>
						<SchoolChip id={p.school} />
					</div>
				</div>
			</header>

			<section aria-labelledby="idea-title" className="space-y-3">
				<h2 id="idea-title" className="text-xl font-bold">
					この人の考え方
				</h2>
				<p className="phrase text-lg leading-snug font-bold">{p.oneLine}</p>
				<p className="leading-[1.9]">{p.core}</p>
				{p.heavyTheme && <p className="text-xs text-ink-soft">※ 哲学者の思想の紹介で、死を勧めるものではありません。</p>}
			</section>

			<section aria-labelledby="works-title" className="space-y-3">
				<h2 id="works-title" className="text-xl font-bold">
					代表作
				</h2>
				<ul className="list-disc space-y-1 rounded-3xl border border-line bg-white py-4 pr-5 pl-9 leading-relaxed">
					{p.works.map((w) => (
						<li key={w}>{w}</li>
					))}
				</ul>
			</section>

			<section aria-labelledby="concepts-title" className="space-y-3">
				<h2 id="concepts-title" className="text-xl font-bold">
					考え方のもと
				</h2>
				<dl className="divide-y divide-line rounded-3xl border border-line bg-white">
					{p.concepts.map((c) => (
						<div key={c.id} className="p-4">
							<dt className="font-bold" style={{ color: accent }}>
								{c.name}
							</dt>
							<dd className="mt-1 leading-relaxed">{c.desc}</dd>
						</div>
					))}
				</dl>
			</section>

			{p.quotes.length > 0 && (
				<section aria-labelledby="quotes-title" className="space-y-3">
					<h2 id="quotes-title" className="text-xl font-bold">
						名言
					</h2>
					<div className="space-y-3">
						{p.quotes.map((q) => (
							<figure key={q.id} className="rounded-2xl p-4" style={{ backgroundColor: tint(p.color, 10) }}>
								<blockquote className="leading-relaxed font-bold">{q.text}</blockquote>
								<figcaption className="mt-1 text-xs text-ink-soft">
									— {p.name}　{q.source}
								</figcaption>
							</figure>
						))}
					</div>
				</section>
			)}

			<section aria-labelledby="shared-title" className="space-y-3">
				<h2 id="shared-title" className="text-xl font-bold">
					この人が刺さった相談
				</h2>
				<SharedResults query={new URLSearchParams({ philosopher: p.id }).toString()} empty={<p>{p.name}が刺さった相談は、まだありません。</p>} />
			</section>

			<div className="text-center">
				<Link to="/" className={`${btnPrimary} w-full sm:w-auto`}>
					悩みを相談する
					<Icon name="arrow" />
				</Link>
			</div>
		</div>
	);
}
