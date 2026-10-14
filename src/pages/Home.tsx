import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { SharedItem } from "../../shared/api";
import { PHILOSOPHERS } from "../../shared/philosophers";
import { getJson } from "../api";
import { btnSecondary } from "../buttons";
import { ConsultForm } from "../components/ConsultForm";
import { DeveloperFooter } from "../components/DeveloperFooter";
import { Portrait } from "../components/Portrait";
import { SharedList } from "../components/SharedList";
import { Icon } from "../icons";

/** トップの見出しの横に並べる顔ぶれ（考え方の違う人を選んで並べる） */
const HERO = ["socrates", "buddha", "nietzsche", "confucius", "adler", "kenko", "camus"];

export function HomePage() {
	const [latest, setLatest] = useState<SharedItem[] | null>(null);
	useEffect(() => {
		getJson<{ items: SharedItem[] }>("/api/shared")
			.then((r) => setLatest(r.items.slice(0, 6)))
			.catch(() => setLatest([]));
	}, []);

	return (
		<div className="space-y-12">
			<section className="relative isolate space-y-6 pt-2">
				{/* 飾り: 絵と同じ、大きな円とポリゴンの宝石。文字の後ろに置く */}
				<svg viewBox="0 0 200 200" className="pointer-events-none absolute -top-6 -right-4 -z-10 h-52 w-52 sm:h-72 sm:w-72" aria-hidden="true">
					<circle cx="120" cy="80" r="78" fill="#f6ead2" />
					<circle cx="60" cy="130" r="46" fill="none" stroke="#c9cff7" strokeWidth="2" />
					<polygon points="150,150 170,140 176,164" fill="#3b4fe0" />
					<polygon points="150,150 176,164 156,176" fill="#6b7bf5" />
					<polygon points="170,140 188,152 176,164" fill="#26339e" />
				</svg>
				<div className="flex -space-x-3" aria-hidden="true">
					{HERO.map((id, i) => (
						<span key={id} className="rounded-full ring-4 ring-paper" style={{ zIndex: HERO.length - i }}>
							<Portrait id={id} size={52} round />
						</span>
					))}
				</div>
				<div className="space-y-3">
					<h1 className="text-[2rem] leading-tight font-bold tracking-tight sm:text-5xl">
						その悩み、
						<br />
						哲学者たちに聞いてみる。
					</h1>
					<p className="leading-relaxed text-ink-soft">
						ソクラテス、ブッダ、ニーチェ、アドラー、兼好法師……。{PHILOSOPHERS.length}人の名簿から、考え方の違う7人が、あなたの悩みに答えます。見比べて、自分に合う答えを見つけてください。
					</p>
				</div>
				<ConsultForm />
			</section>

			<section aria-labelledby="latest-title" className="space-y-4">
				<div className="flex items-end justify-between gap-3">
					<h2 id="latest-title" className="text-xl font-bold">
						みんなの相談
					</h2>
					<Link to="/search" className="inline-flex items-center gap-1 text-sm text-brand-link underline-offset-4 hover:underline">
						探す
						<Icon name="search" className="h-3.5 w-3.5" />
					</Link>
				</div>
				{latest === null ? (
					<p className="text-sm text-ink-soft">読み込み中…</p>
				) : latest.length === 0 ? (
					<p className="rounded-3xl border border-dashed border-line p-6 text-center text-sm text-ink-soft">まだ共有された相談はありません。最初の相談者になりませんか。</p>
				) : (
					<SharedList items={latest} />
				)}
			</section>

			<section aria-labelledby="roster-title" className="space-y-4">
				<h2 id="roster-title" className="text-xl font-bold">
					答えてくれる哲学者たち
				</h2>
				<ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
					{PHILOSOPHERS.slice(0, 12).map((p) => (
						<li key={p.id}>
							<Link to={`/philosophers/${p.id}`} className="block text-center text-xs">
								<Portrait id={p.id} size={120} className="h-auto w-full" />
								<span className="mt-1 block">{p.name}</span>
							</Link>
						</li>
					))}
				</ul>
				<Link to="/philosophers" className={btnSecondary}>
					{PHILOSOPHERS.length}人の名簿を見る
					<Icon name="arrow" />
				</Link>
			</section>

			<DeveloperFooter />
		</div>
	);
}
