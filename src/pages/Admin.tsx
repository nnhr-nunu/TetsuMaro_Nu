import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { CATEGORIES, type CategoryId, MAX_TAGS, isCategory, tagsOf } from "../../shared/themes";
import { ApiError, errorText } from "../api";
import { btnPrimary, btnQuiet } from "../buttons";
import { useTitle } from "../useTitle";

/** GET /api/admin/reports の1行（worker/routes/admin.ts） */
type Report = { consultationId: string; count: number; lastAt: number; excerpt: string; hidden: boolean; reasons: string[] };

const TOKEN_KEY = "tetsumaro-admin-token";
const field = "min-h-11 w-full rounded-2xl border border-line bg-white px-3 outline-none focus:border-ink";

// 合言葉はこのタブを閉じるまで覚える（sessionStorage）。使えない環境でも画面は動くように、読み書きは失敗を無視する
function loadToken(): string {
	try {
		return sessionStorage.getItem(TOKEN_KEY) ?? "";
	} catch {
		return "";
	}
}
function saveToken(token: string): void {
	try {
		if (token) sessionStorage.setItem(TOKEN_KEY, token);
		else sessionStorage.removeItem(TOKEN_KEY);
	} catch {
		// 覚えられなくても、そのまま使える
	}
}

/** 管理用の API。合言葉を Authorization に付ける（src/api.ts の getJson・sendJson は付けられないので、ここだけ別に持つ） */
async function adminFetch<T>(token: string, method: "GET" | "POST" | "PATCH", path: string, body?: Record<string, unknown>): Promise<T> {
	const res = await fetch(`/api/admin${path}`, {
		method,
		headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
		body: body ? JSON.stringify(body) : undefined,
	}).catch(() => {
		throw new ApiError(0, "network");
	});
	if (!res.ok) {
		const json = (await res.json().catch(() => null)) as { error?: string } | null;
		throw new ApiError(res.status, json?.error ?? (res.status === 404 ? "not_found" : "failed"));
	}
	return (await res.json()) as T;
}

const adminErrorText = (err: unknown) => (err instanceof ApiError && err.status === 401 ? "合言葉が違います。" : errorText(err));

const timeText = (ms: number) => new Date(ms).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

export function AdminPage() {
	useTitle("管理");
	const [token, setToken] = useState(loadToken);
	const [reports, setReports] = useState<Report[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState<string | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);
	const [fixId, setFixId] = useState("");

	const forget = useCallback(() => {
		saveToken("");
		setToken("");
		setReports(null);
	}, []);

	const load = useCallback(
		async (t: string) => {
			try {
				setReports(await adminFetch<Report[]>(t, "GET", "/reports"));
				setError(null);
			} catch (err) {
				if (err instanceof ApiError && err.status === 401) forget();
				setError(err instanceof ApiError && err.status === 404 ? "管理画面は使えません（サーバーに合言葉が設定されていません）。" : adminErrorText(err));
			}
		},
		[forget],
	);

	useEffect(() => {
		if (token) void load(token);
	}, [token, load]);

	const open = (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const value = String(new FormData(e.currentTarget).get("token") ?? "").trim();
		if (!value) return;
		saveToken(value);
		setError(null);
		setToken(value);
	};

	const act = async (r: Report, action: "hide" | "unhide") => {
		setBusy(r.consultationId);
		setActionError(null);
		try {
			await adminFetch(token, "POST", `/consultations/${r.consultationId}/${action}`);
			await load(token);
		} catch (err) {
			setActionError(adminErrorText(err));
		} finally {
			setBusy(null);
		}
	};

	if (!token)
		return (
			<form onSubmit={open} className="max-w-sm space-y-4">
				<h1 className="text-2xl font-bold">管理</h1>
				<label className="block space-y-1">
					<span className="text-sm font-bold">合言葉</span>
					<input name="token" type="password" autoComplete="off" required className={field} />
				</label>
				<button type="submit" className={btnPrimary}>
					開く
				</button>
				{error && (
					<p role="alert" className="text-sm text-red-700">
						{error}
					</p>
				)}
			</form>
		);

	return (
		<div className="space-y-10">
			<h1 className="text-2xl font-bold">管理</h1>

			<section aria-labelledby="reports-title" className="space-y-4">
				<h2 id="reports-title" className="text-xl font-bold">
					通報された相談
				</h2>
				{error && (
					<p role="alert" className="text-sm text-red-700">
						{error}
					</p>
				)}
				{actionError && (
					<p role="alert" className="text-sm text-red-700">
						{actionError}
					</p>
				)}
				{reports === null ? (
					!error && <p className="text-sm text-ink-soft">読み込み中…</p>
				) : reports.length === 0 ? (
					<p className="rounded-3xl border border-dashed border-line p-6 text-center text-sm text-ink-soft">通報はありません。</p>
				) : (
					<ul className="space-y-3">
						{reports.map((r) => (
							<li key={r.consultationId} className="space-y-3 rounded-3xl border border-line bg-white p-4">
								<div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
									<span className="font-bold text-ink">通報 {r.count}件</span>
									<span>最後の通報 {timeText(r.lastAt)}</span>
									{r.hidden && <span className="rounded-full bg-mist px-2.5 py-0.5 font-bold text-ink">隠しています</span>}
								</div>
								<p className="leading-relaxed">{r.excerpt}</p>
								{r.reasons.length > 0 && (
									<ul className="flex flex-wrap gap-1.5">
										{r.reasons.map((reason, i) => (
											// 同じ理由が重なることがあるので、番号も key に入れる
											<li key={`${i}-${reason}`} className="rounded-2xl bg-mist px-3 py-1 text-xs whitespace-pre-wrap">
												{reason}
											</li>
										))}
									</ul>
								)}
								<div className="flex flex-wrap items-center gap-2">
									{r.hidden ? (
										<button type="button" className={btnQuiet} disabled={busy !== null} onClick={() => void act(r, "unhide")}>
											戻す
										</button>
									) : (
										<button type="button" className={btnPrimary} disabled={busy !== null} onClick={() => void act(r, "hide")}>
											隠す
										</button>
									)}
									<button
										type="button"
										className={btnQuiet}
										onClick={() => {
											setFixId(r.consultationId);
											document.getElementById("fix-theme")?.scrollIntoView({ behavior: "smooth" });
										}}
									>
										分類を直す
									</button>
									{!r.hidden && (
										<Link to={`/c/${r.consultationId}`} className="inline-flex min-h-11 items-center text-sm text-brand-link underline underline-offset-4">
											相談を開く
										</Link>
									)}
								</div>
								{r.hidden && <p className="text-xs text-ink-soft">戻すと、この相談への通報は消えます。</p>}
							</li>
						))}
					</ul>
				)}
			</section>

			<ThemeFixer token={token} id={fixId} onId={setFixId} />

			<div>
				<button type="button" className={btnQuiet} onClick={forget}>
					合言葉を忘れる
				</button>
			</div>
		</div>
	);
}

/** 相談の分類（大分類と小分類）を直す。相談は ID か、/c/ の付いた URL で指す */
function ThemeFixer({ token, id, onId }: { token: string; id: string; onId: (id: string) => void }) {
	const [category, setCategory] = useState<CategoryId | "">("");
	const [tags, setTags] = useState<string[]>([]);
	const [state, setState] = useState<"idle" | "saving" | "saved" | string>("idle");
	const consultationId = /\/c\/([A-Za-z0-9_-]+)/.exec(id)?.[1] ?? id.trim();

	const save = async () => {
		if (!consultationId || !category) return;
		setState("saving");
		try {
			await adminFetch(token, "PATCH", `/consultations/${encodeURIComponent(consultationId)}/theme`, { category, tags });
			setState("saved");
		} catch (err) {
			setState(adminErrorText(err));
		}
	};

	return (
		<section id="fix-theme" aria-labelledby="fix-title" className="space-y-4 rounded-3xl border border-line bg-white p-5">
			<h2 id="fix-title" className="text-xl font-bold">
				分類を直す
			</h2>
			<label className="block space-y-1">
				<span className="text-sm font-bold">相談の ID（または URL）</span>
				<input
					value={id}
					onChange={(e) => {
						onId(e.target.value);
						setState("idle");
					}}
					className={field}
				/>
			</label>
			<label className="block space-y-1">
				<span className="text-sm font-bold">テーマ</span>
				<select
					value={category}
					onChange={(e) => {
						setCategory(isCategory(e.target.value) ? e.target.value : "");
						setTags([]);
						setState("idle");
					}}
					className={field}
				>
					<option value="">選んでください</option>
					{CATEGORIES.map((c) => (
						<option key={c.id} value={c.id}>
							{c.name}
						</option>
					))}
				</select>
			</label>
			{category && tagsOf(category).length > 0 && (
				<fieldset className="space-y-1">
					<legend className="text-sm font-bold">内容（{MAX_TAGS}つまで）</legend>
					<div className="grid sm:grid-cols-2">
						{tagsOf(category).map((t) => {
							const on = tags.includes(t.id);
							return (
								<label key={t.id} className="flex min-h-11 items-center gap-2">
									<input
										type="checkbox"
										checked={on}
										disabled={!on && tags.length >= MAX_TAGS}
										onChange={() => {
											setTags(on ? tags.filter((x) => x !== t.id) : [...tags, t.id]);
											setState("idle");
										}}
										className="h-5 w-5"
									/>
									{t.name}
								</label>
							);
						})}
					</div>
				</fieldset>
			)}
			<div className="flex flex-wrap items-center gap-3">
				<button type="button" className={btnPrimary} disabled={!consultationId || !category || state === "saving"} onClick={() => void save()}>
					保存する
				</button>
				{state === "saved" && <span className="text-sm text-ink-soft">保存しました</span>}
				{state !== "idle" && state !== "saving" && state !== "saved" && <span className="text-sm text-red-700">{state}</span>}
			</div>
		</section>
	);
}
