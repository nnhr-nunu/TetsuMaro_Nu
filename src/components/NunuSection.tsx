import { useEffect, useState } from "react";
import type { NunuEvent } from "../../shared/api";
import type { NunuAnswer } from "../../shared/nunu";
import { Icon } from "../icons";
import { HeartButton, type HeartProps } from "./HeartButton";
import { Logo } from "./Layout";

const cut = (text: string, n: number) => ([...text].length > n ? `${[...text].slice(0, n).join("")}…` : text);

/** 関連したマシュマロ回答。全件は大きいので、関連があるときだけ読み込む（一般向けの印のものだけ出す） */
function useRelated(ids: string[]): NunuAnswer[] {
	const [items, setItems] = useState<NunuAnswer[]>([]);
	const key = ids.join(",");
	useEffect(() => {
		if (!key) return;
		let alive = true;
		void import("../../shared/nunu/answers.json").then((m) => {
			const all = m.default as NunuAnswer[];
			const byId = new Map(all.map((a) => [a.id, a]));
			if (alive) setItems(key.split(",").flatMap((id) => (byId.get(id)?.audience === "general" ? [byId.get(id) as NunuAnswer] : [])));
		});
		return () => {
			alive = false;
		};
	}, [key]);
	return items;
}

/** ぬぬはらの欄: AIぬぬはらの回答と、ぬぬはら本人の過去のマシュマロ回答 */
export function NunuSection({ nunu, heart }: { nunu: NunuEvent; heart?: HeartProps }) {
	const related = useRelated(nunu.related);
	if (!nunu.body && related.length === 0) return null;
	return (
		<section aria-labelledby="nunu-title" className="space-y-4 rounded-3xl border border-line bg-white p-5">
			<div className="flex items-center gap-3">
				<Logo className="h-10 w-10" />
				<div>
					<h2 id="nunu-title" className="text-lg font-bold">
						ぬぬはらの欄
					</h2>
					<p className="text-xs text-ink-soft">哲マロ(ぬ)の開発者。マシュマロでお悩み相談に答えています</p>
				</div>
			</div>

			{nunu.body && (
				<div className="space-y-2 rounded-2xl bg-brand-soft p-4">
					<h3 className="font-bold">AIぬぬはら</h3>
					<p className="text-xs text-ink-soft">ぬぬはらの過去の回答をもとに AI が書いた回答です。本人の発言ではありません。</p>
					<p className="leading-[1.9] whitespace-pre-wrap">{nunu.body}</p>
					{heart && <HeartButton {...heart} />}
				</div>
			)}

			{related.length > 0 && (
				<div className="space-y-3">
					<h3 className="font-bold">ぬぬはらの過去の回答</h3>
					<ul className="space-y-3">
						{related.map((n) => (
							<li key={n.id} className="rounded-2xl border border-line p-4 text-sm leading-relaxed">
								<p className="text-xs font-bold text-ink-soft">届いた質問</p>
								<p className="mt-0.5">{cut(n.question, 80)}</p>
								<p className="mt-2 text-xs font-bold text-ink-soft">ぬぬはらの回答</p>
								<p className="mt-0.5 whitespace-pre-wrap">{cut(n.answer, 140)}</p>
								<a href={n.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-brand-link underline underline-offset-4">
									マシュマロで全文を読む
									<Icon name="external" className="h-3.5 w-3.5" />
								</a>
							</li>
						))}
					</ul>
				</div>
			)}
		</section>
	);
}
