import { useEffect, useState } from "react";
import { Link } from "react-router";
import { errorText, getJson } from "../api";
import { btnPrimary } from "../buttons";
import { useTitle } from "../useTitle";

/** GET /api/me/consultations の1行（worker/routes/me.ts） */
type Mine = { id: string; excerpt: string; createdAt: number; sharedAt: number | null; status: string };

/** サーバーが返す相談の先頭の長さ（worker/routes/me.ts の EXCERPT）。この長さなら続きがあるので「…」を付ける */
const EXCERPT_MAX = 60;

const dateText = (ms: number) => new Date(ms).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });

export function MePage() {
	useTitle("自分の相談");
	const [list, setList] = useState<Mine[] | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		getJson<Mine[]>("/api/me/consultations")
			.then(setList)
			.catch((err) => setError(errorText(err)));
	}, []);

	return (
		<div className="space-y-6">
			<h1 className="text-2xl font-bold sm:text-3xl">自分の相談</h1>

			{error ? (
				<p role="alert" className="text-red-700">
					{error}
				</p>
			) : list === null ? (
				<p role="status" className="text-sm text-ink-soft">
					読み込み中…
				</p>
			) : list.length === 0 ? (
				<div className="space-y-4 rounded-3xl border border-dashed border-line p-6 text-center">
					<p>まだ相談していません</p>
					<Link to="/" className={btnPrimary}>
						相談する
					</Link>
				</div>
			) : (
				<ul className="space-y-3">
					{list.map((c) => (
						<li key={c.id}>
							<Link to={`/c/${c.id}`} className="block rounded-3xl border border-line bg-white p-4 transition hover:border-ink">
								<div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
									<span>{dateText(c.createdAt)}</span>
									{c.sharedAt !== null && <span className="rounded-full bg-ink px-2.5 py-0.5 font-bold text-white">共有中</span>}
								</div>
								<p className="mt-2 line-clamp-2 leading-relaxed">
									{c.excerpt}
									{[...c.excerpt].length >= EXCERPT_MAX && "…"}
								</p>
							</Link>
						</li>
					))}
				</ul>
			)}

			<p className="text-xs text-ink-soft">この端末に覚えている相談です。ブラウザのデータを消すと開けなくなります</p>
		</div>
	);
}
