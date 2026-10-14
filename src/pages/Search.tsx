import { type FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { PHILOSOPHERS, philosopherById } from "../../shared/philosophers";
import { CATEGORIES, type CategoryId, TAGS, categoryName, isCategory, tagsOf } from "../../shared/themes";
import { btnPrimary, btnQuiet } from "../buttons";
import { FilterChips } from "../components/FilterChips";
import { SharedResults } from "../components/SharedResults";
import { Icon } from "../icons";
import { useTitle } from "../useTitle";

/** 探す言葉の長さの上限（worker/routes/shared.ts と同じ） */
const Q_MAX = 50;
const field = "min-h-11 w-full rounded-2xl border border-line bg-white px-3 outline-none focus:border-ink";

type Filters = { q: string; category: CategoryId | null; tag: string | null; philosopher: string; sort: "new" | "hearts" };

/** URL の query から絞り込みを読む。知らない値は捨てる。小分類だけ指定されたら、その大分類も選んだことにする */
function readFilters(params: URLSearchParams): Filters {
	const tag = TAGS.find((t) => t.id === params.get("tag"));
	const c = params.get("category");
	const category = isCategory(c) ? c : (tag?.category ?? null);
	const philosopher = params.get("philosopher") ?? "";
	return {
		q: (params.get("q") ?? "").trim().slice(0, Q_MAX),
		category,
		tag: tag && tag.category === category ? tag.id : null,
		philosopher: philosopherById(philosopher) ? philosopher : "",
		sort: params.get("sort") === "hearts" ? "hearts" : "new",
	};
}

/** 絞り込みを URL の query にする。空のものと既定の並び（新しい順）は付けない */
function toParams(f: Filters): URLSearchParams {
	const p = new URLSearchParams();
	if (f.q) p.set("q", f.q);
	if (f.category) p.set("category", f.category);
	if (f.tag) p.set("tag", f.tag);
	if (f.philosopher) p.set("philosopher", f.philosopher);
	if (f.sort !== "new") p.set("sort", f.sort);
	return p;
}

export function SearchPage() {
	useTitle("みんなの相談");
	const [params, setParams] = useSearchParams();
	const f = readFilters(params);
	const [text, setText] = useState(f.q);
	// 戻る・進むで絞り込みが変わったら、検索欄の言葉も合わせる
	useEffect(() => setText(f.q), [f.q]);

	/** 検索欄に打ってある言葉も一緒に反映する（打ったあとにチップを押しても、言葉が消えないように） */
	const update = (patch: Partial<Filters>) => setParams(toParams({ ...f, q: text.trim().slice(0, Q_MAX), ...patch }));
	const submit = (e: FormEvent) => {
		e.preventDefault();
		update({});
	};

	const filtered = Boolean(f.q || f.category || f.philosopher);
	const query = toParams(f).toString();

	return (
		<div className="space-y-6">
			<h1 className="text-2xl font-bold sm:text-3xl">みんなの相談</h1>

			<section aria-label="絞り込み" className="space-y-4 rounded-3xl border border-line bg-white p-4 sm:p-5">
				<form role="search" onSubmit={submit} className="flex gap-2">
					<input
						type="search"
						value={text}
						maxLength={Q_MAX}
						enterKeyHint="search"
						onChange={(e) => setText(e.target.value)}
						placeholder="相談の中の言葉で探す"
						aria-label="相談の中の言葉"
						className={`${field} min-w-0 flex-1`}
					/>
					<button type="submit" className={btnPrimary}>
						<Icon name="search" />
						探す
					</button>
				</form>

				<FilterChips label="テーマ" options={CATEGORIES} value={f.category} onChange={(category) => update({ category: category as CategoryId | null, tag: null })} />
				{f.category && tagsOf(f.category).length > 0 && (
					<div className="border-l-2 border-line pl-3">
						<FilterChips label={`${categoryName(f.category)}の内容`} options={tagsOf(f.category)} value={f.tag} onChange={(tag) => update({ tag })} />
					</div>
				)}

				<div className="grid gap-3 sm:grid-cols-2">
					<label className="block space-y-1">
						<span className="text-sm font-bold">刺さった哲学者</span>
						<select value={f.philosopher} onChange={(e) => update({ philosopher: e.target.value })} className={field}>
							<option value="">指定しない</option>
							{PHILOSOPHERS.map((p) => (
								<option key={p.id} value={p.id}>
									{p.name}
								</option>
							))}
						</select>
					</label>
					<label className="block space-y-1">
						<span className="text-sm font-bold">並び</span>
						<select value={f.sort} onChange={(e) => update({ sort: e.target.value === "hearts" ? "hearts" : "new" })} className={field}>
							<option value="new">新しい順</option>
							<option value="hearts">刺さった数の順</option>
						</select>
					</label>
				</div>
			</section>

			<SharedResults
				query={query}
				empty={
					filtered ? (
						<>
							<p>条件に合う相談は見つかりませんでした。</p>
							<button
								type="button"
								className={`${btnQuiet} mt-3`}
								onClick={() => {
									setText("");
									setParams({});
								}}
							>
								絞り込みをやめる
							</button>
						</>
					) : (
						<p>まだ共有された相談はありません。</p>
					)
				}
			/>
		</div>
	);
}
