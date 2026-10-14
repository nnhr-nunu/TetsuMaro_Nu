import { type ReactNode, useEffect, useState } from "react";
import type { SharedItem } from "../../shared/api";
import { errorText, getJson } from "../api";
import { btnQuiet, btnSecondary } from "../buttons";
import { Icon } from "../icons";
import { SharedList } from "./SharedList";

type Page = { items: SharedItem[]; next: string | null };

/**
 * 条件に合うみんなの相談を読み込んで、SharedList に並べる（みんなの相談・テーマ・哲学者のページで共用）。
 * query は GET /api/shared に付ける条件（例 "category=love&sort=hearts"）。変わったら読み直す。
 * 読み直している間は、前の一覧を薄くして残す（画面が飛ばないように）。「もっと見る」で続きを足す
 */
export function SharedResults({ query, empty }: { query: string; empty: ReactNode }) {
	const [loaded, setLoaded] = useState<(Page & { query: string }) | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [retry, setRetry] = useState(0);
	const [more, setMore] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });

	useEffect(() => {
		let live = true;
		setError(null);
		setMore({ busy: false, error: null });
		getJson<Page>(`/api/shared?${query}`)
			.then((r) => live && setLoaded({ ...r, query }))
			.catch((err) => live && setError(errorText(err)));
		return () => {
			live = false;
		};
	}, [query, retry]);

	const loadMore = async () => {
		if (!loaded?.next) return;
		const asked = loaded.query;
		const params = new URLSearchParams(asked);
		params.set("cursor", loaded.next);
		setMore({ busy: true, error: null });
		try {
			const r = await getJson<Page>(`/api/shared?${params}`);
			// 待っている間に条件が変わっていたら、この続きは捨てる。同じ相談が重ならないようにする
			setLoaded((prev) => {
				if (!prev || prev.query !== asked) return prev;
				const seen = new Set(prev.items.map((i) => i.id));
				return { query: asked, items: [...prev.items, ...r.items.filter((i) => !seen.has(i.id))], next: r.next };
			});
			setMore({ busy: false, error: null });
		} catch (err) {
			setMore({ busy: false, error: errorText(err) });
		}
	};

	if (error)
		return (
			<div role="alert" className="space-y-3 rounded-3xl border border-line bg-white p-5">
				<p className="text-red-700">{error}</p>
				<button type="button" className={btnQuiet} onClick={() => setRetry((n) => n + 1)}>
					もう一度読み込む
				</button>
			</div>
		);
	if (!loaded)
		return (
			<p role="status" className="text-sm text-ink-soft">
				読み込み中…
			</p>
		);

	const stale = loaded.query !== query;
	if (!stale && loaded.items.length === 0) return <div className="rounded-3xl border border-dashed border-line p-6 text-center text-sm text-ink-soft">{empty}</div>;

	return (
		<div className="space-y-4" aria-busy={stale}>
			<div className={stale ? "opacity-50 transition-opacity" : undefined}>
				<SharedList items={loaded.items} />
			</div>
			{!stale && loaded.next && (
				<div className="space-y-2 text-center">
					<button type="button" className={btnSecondary} disabled={more.busy} onClick={() => void loadMore()}>
						<Icon name="plus" />
						{more.busy ? "読み込み中…" : "もっと見る"}
					</button>
					{more.error && <p className="text-sm text-red-700">{more.error}</p>}
				</div>
			)}
		</div>
	);
}
