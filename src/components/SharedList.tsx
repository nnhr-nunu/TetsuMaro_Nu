import { Link } from "react-router";
import type { SharedItem } from "../../shared/api";
import { philosopherById } from "../../shared/philosophers";
import { categoryName, tagName } from "../../shared/themes";
import { Icon } from "../icons";
import { Portrait } from "./Portrait";

/** みんなの相談のカードの並び（トップ・みんなの相談・テーマ・似た悩み・哲学者のページで共用） */
export function SharedList({ items }: { items: SharedItem[] }) {
	return (
		<ul className="grid gap-3 sm:grid-cols-2">
			{items.map((item) => {
				const top = item.topPhilosopher ? philosopherById(item.topPhilosopher) : undefined;
				return (
					<li key={item.id}>
						<Link to={`/c/${item.id}`} className="flex h-full flex-col rounded-3xl border border-line bg-white p-4 transition hover:border-ink">
							<div className="flex flex-wrap items-center gap-1.5 text-xs">
								<span className="rounded-full bg-ink px-2.5 py-0.5 font-bold text-white">{categoryName(item.category)}</span>
								{item.tags.map((t) => (
									<span key={t} className="rounded-full bg-mist px-2.5 py-0.5 text-ink-soft">
										{tagName(t)}
									</span>
								))}
							</div>
							<p className="mt-2 line-clamp-3 flex-1 leading-relaxed">{item.excerpt}</p>
							<div className="mt-3 flex items-center justify-between gap-2 text-xs text-ink-soft">
								{top ? (
									<span className="flex items-center gap-1.5">
										<Portrait id={top.id} size={26} round />
										{top.name}が刺さった
									</span>
								) : (
									<span />
								)}
								{item.heartTotal > 0 && (
									<span className="inline-flex items-center gap-1 tabular-nums">
										<Icon name="heartFilled" className="h-3.5 w-3.5 text-[#e8467c]" />
										{item.heartTotal}
									</span>
								)}
							</div>
						</Link>
					</li>
				);
			})}
		</ul>
	);
}
