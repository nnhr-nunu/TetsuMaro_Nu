import { HOTLINES } from "../../shared/crisis";
import { Icon } from "../icons";

/** 重い相談のとき、回答の上に出す相談窓口 */
export function CrisisBanner() {
	return (
		<aside aria-labelledby="crisis-title" className="rounded-3xl border-2 border-sky-200 bg-sky-50 p-5">
			<h2 id="crisis-title" className="text-lg font-bold text-sky-950">
				ひとりで抱えこまないでください
			</h2>
			<p className="mt-1 text-sm leading-relaxed text-sky-950">話を聞いてくれる窓口があります。電話がつらいときは、SNS やチャットで相談できる窓口もあります。</p>
			<ul className="mt-3 space-y-2 text-sm">
				{HOTLINES.map((h) => (
					<li key={h.name} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-white px-4 py-2.5">
						<a href={h.url} target="_blank" rel="noopener noreferrer" className="font-bold text-sky-900 underline underline-offset-4">
							{h.name}
						</a>
						{h.tel && (
							<a href={`tel:${h.tel.replaceAll("-", "")}`} className="inline-flex items-center gap-1 font-bold tabular-nums text-sky-900">
								<Icon name="phone" className="h-3.5 w-3.5" />
								{h.tel}
							</a>
						)}
						<span className="text-xs text-sky-800">{h.hours}</span>
					</li>
				))}
			</ul>
		</aside>
	);
}
