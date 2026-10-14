import { Link } from "react-router";
import { type Group, PHILOSOPHERS } from "../../shared/philosophers";
import { Portrait } from "../components/Portrait";
import { SchoolChip } from "../components/InfoSheet";
import { useTitle } from "../useTitle";

/** 名簿の見出し。並びは名簿（shared/philosophers の ROSTER_IDS）と同じ */
const GROUPS: { id: Group; name: string }[] = [
	{ id: "ancient", name: "古代" },
	{ id: "eastern", name: "東洋" },
	{ id: "modern", name: "近世〜近代" },
	{ id: "contemporary", name: "現代" },
	{ id: "japan", name: "日本" },
	{ id: "psychology", name: "心理学" },
	{ id: "practical", name: "実践の知恵" },
];

export function PhilosophersPage() {
	useTitle("哲学者の名簿");
	return (
		<div className="space-y-10">
			<h1 className="text-2xl font-bold sm:text-3xl">哲学者の名簿</h1>
			{GROUPS.map((g) => (
				<section key={g.id} aria-labelledby={`group-${g.id}`} className="space-y-4">
					<h2 id={`group-${g.id}`} className="text-xl font-bold">
						{g.name}
					</h2>
					<ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
						{PHILOSOPHERS.filter((p) => p.group === g.id).map((p) => (
							// カード全体が名前のリンク（after で広げる）。学派のボタンはリンクの上に出して、別に押せるようにする
							<li
								key={p.id}
								className="relative flex flex-col gap-2 rounded-3xl border border-line bg-white p-3 transition hover:border-ink has-[a:focus-visible]:border-ink has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ink"
							>
								<span aria-hidden="true">
									<Portrait id={p.id} size={200} className="h-auto w-full" />
								</span>
								<div className="min-w-0 space-y-1">
									<h3 className="font-bold">
										<Link to={`/philosophers/${p.id}`} className="outline-none after:absolute after:inset-0 after:rounded-3xl">
											{p.name}
										</Link>
									</h3>
									<p className="text-xs text-ink-soft">{p.years}</p>
									<p className="phrase text-sm leading-snug">{p.oneLine}</p>
									{p.school && (
										<div className="relative pt-1">
											<SchoolChip id={p.school} className="min-h-9" />
										</div>
									)}
								</div>
							</li>
						))}
					</ul>
				</section>
			))}
		</div>
	);
}
