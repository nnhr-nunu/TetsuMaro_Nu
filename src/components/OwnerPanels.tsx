import { useState } from "react";
import type { ConsultationView } from "../../shared/api";
import { findPersonalInfo } from "../../shared/personalInfo";
import { philosopherById } from "../../shared/philosophers";
import { BODY_MAX, MY_ANSWER_MAX, NAME_MAX } from "../../shared/site";
import { errorText, sendJson } from "../api";
import { btnPrimary, btnQuiet } from "../buttons";
import { Icon } from "../icons";
import { Logo } from "./Layout";
import { Portrait } from "./Portrait";
import { XPostLink } from "./XPostLink";

const field = "w-full rounded-2xl border border-line bg-white p-3 leading-relaxed outline-none focus:border-ink";

/** 刺さった人の小さな顔の並び（ぬぬはらは印の絵） */
export function PickFaces({ picks }: { picks: string[] }) {
	return (
		<ul className="flex flex-wrap gap-2">
			{picks.map((id) => (
				<li key={id} className="flex items-center gap-1.5 rounded-full bg-mist py-1 pr-3 pl-1 text-sm">
					{id === "nunu" ? <Logo className="h-7 w-7" /> : <Portrait id={id} size={28} round />}
					{id === "nunu" ? "AIぬぬはら" : philosopherById(id)?.name}
				</li>
			))}
		</ul>
	);
}

/** 持ち主の「自分の答え」。刺さった人はカードの「刺さった」で選ぶ */
export function MyAnswer({ view, onSaved }: { view: ConsultationView; onSaved: (myAnswer: string | null) => void }) {
	const [text, setText] = useState(view.myAnswer ?? "");
	const [state, setState] = useState<"idle" | "saving" | "saved" | string>("idle");
	const save = async () => {
		setState("saving");
		try {
			await sendJson("PATCH", `/api/consultations/${view.id}`, { myAnswer: text.trim() || null });
			onSaved(text.trim() || null);
			setState("saved");
		} catch (err) {
			setState(errorText(err));
		}
	};
	return (
		<section aria-labelledby="mine-title" className="space-y-3 rounded-3xl border border-line bg-white p-5">
			<h2 id="mine-title" className="text-lg font-bold">
				自分の答え
			</h2>
			{view.myPicks.length > 0 ? <PickFaces picks={view.myPicks} /> : <p className="text-sm text-ink-soft">カードの「刺さった」を押すと、ここに並びます。</p>}
			<label className="block space-y-1">
				<span className="text-sm font-bold">見比べて、自分ならどうするか（任意）</span>
				<textarea
					value={text}
					maxLength={MY_ANSWER_MAX}
					rows={3}
					onChange={(e) => {
						setText(e.target.value);
						setState("idle");
					}}
					placeholder="例：変えられない相手のことは手放して、自分の行いに集中してみる"
					className={field}
				/>
				<span className="block text-right text-xs text-ink-soft tabular-nums">
					{[...text].length}/{MY_ANSWER_MAX}
				</span>
			</label>
			<div className="flex items-center gap-3">
				<button type="button" className={btnPrimary} disabled={state === "saving"} onClick={() => void save()}>
					保存する
				</button>
				{state === "saved" && <span className="text-sm text-ink-soft">保存しました</span>}
				{state !== "idle" && state !== "saving" && state !== "saved" && <span className="text-sm text-red-700">{state}</span>}
			</div>
		</section>
	);
}

/** 持ち主の共有。公開の前に相談文と公開名を直せる。共有中は URL のコピー・X に投稿・共有をやめる */
export function SharePanel({ view, onChange }: { view: ConsultationView; onChange: (patch: Partial<ConsultationView>) => void }) {
	const [name, setName] = useState(view.displayName ?? "");
	const [editing, setEditing] = useState(false);
	const [body, setBody] = useState(view.body);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const url = `${window.location.origin}/c/${view.id}`;
	const found = findPersonalInfo(`${view.body}\n${view.myAnswer ?? ""}`);

	const run = async (fn: () => Promise<void>) => {
		setBusy(true);
		setError(null);
		try {
			await fn();
		} catch (err) {
			setError(errorText(err));
		} finally {
			setBusy(false);
		}
	};

	const share = () =>
		run(async () => {
			await sendJson("PATCH", `/api/consultations/${view.id}`, { displayName: name.trim() || null });
			await sendJson("PUT", `/api/consultations/${view.id}/share`, {});
			onChange({ sharedAt: Date.now(), displayName: name.trim() || null });
		});
	const unshare = () =>
		run(async () => {
			await sendJson("DELETE", `/api/consultations/${view.id}/share`);
			onChange({ sharedAt: null });
		});
	const saveBody = () =>
		run(async () => {
			await sendJson("PATCH", `/api/consultations/${view.id}`, { body });
			onChange({ body: body.trim() });
			setEditing(false);
		});

	if (view.sharedAt !== null) {
		return (
			<section aria-labelledby="share-title" className="space-y-3 rounded-3xl border border-line bg-white p-5">
				<h2 id="share-title" className="text-lg font-bold">
					みんなに共有しています
				</h2>
				<p className="text-sm text-ink-soft">公開名：{view.displayName ?? "匿名"}</p>
				<div className="flex flex-wrap gap-2">
					<XPostLink text="悩みを哲学者たちに相談してみた #哲マロ" url={url} />
					<button
						type="button"
						className={btnQuiet}
						onClick={() =>
							void navigator.clipboard?.writeText(url).then(() => {
								setCopied(true);
								setTimeout(() => setCopied(false), 2000);
							})
						}
					>
						<Icon name="copy" />
						{copied ? "コピーしました" : "URL をコピー"}
					</button>
					<button type="button" className={btnQuiet} disabled={busy} onClick={() => void unshare()}>
						共有をやめる
					</button>
				</div>
				{error && <p className="text-sm text-red-700">{error}</p>}
			</section>
		);
	}

	return (
		<section aria-labelledby="share-title" className="space-y-4 rounded-3xl border border-line bg-white p-5">
			<div>
				<h2 id="share-title" className="text-lg font-bold">
					同じ悩みの人に共有する
				</h2>
				<p className="mt-1 text-sm text-ink-soft">今はあなただけが見られます。共有すると、相談・回答・自分の答えが、みんなの相談に載ります。</p>
			</div>
			{found.length > 0 && (
				<p role="alert" className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
					相談か自分の答えに、{found.map((k) => ({ tel: "電話番号", email: "メールアドレス", url: "URL" })[k]).join("・")}
					のようなものがあります。共有する前に消してください。
				</p>
			)}
			{editing ? (
				<div className="space-y-2">
					<textarea value={body} maxLength={BODY_MAX} rows={5} onChange={(e) => setBody(e.target.value)} className={field} aria-label="相談文" />
					<div className="flex gap-2">
						<button type="button" className={btnPrimary} disabled={busy || !body.trim()} onClick={() => void saveBody()}>
							相談文を保存
						</button>
						<button type="button" className={btnQuiet} onClick={() => setEditing(false)}>
							やめる
						</button>
					</div>
				</div>
			) : (
				<button type="button" className={btnQuiet} onClick={() => setEditing(true)}>
					共有する前に相談文を直す
				</button>
			)}
			<label className="block space-y-1">
				<span className="text-sm font-bold">公開名（空なら匿名）</span>
				<input value={name} maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)} placeholder="匿名" className={field} />
			</label>
			<button type="button" className={`${btnPrimary} w-full`} disabled={busy || editing} onClick={() => void share()}>
				<Icon name="share" />
				みんなに共有する
			</button>
			{error && <p className="text-sm text-red-700">{error}</p>}
		</section>
	);
}

const REASONS = ["個人が分かることが書いてある", "誰かを傷つける内容", "宣伝・荒らし", "そのほか"] as const;

/** 見た人の通報（小さなリンクから開く） */
export function ReportForm({ consultationId }: { consultationId: string }) {
	const [open, setOpen] = useState(false);
	const [reason, setReason] = useState<string>(REASONS[0]);
	const [state, setState] = useState<"idle" | "sending" | "sent" | string>("idle");
	if (state === "sent") return <p className="text-sm text-ink-soft">通報を受け付けました。ありがとうございます。</p>;
	if (!open)
		return (
			<button type="button" className="text-sm text-ink-soft underline underline-offset-4" onClick={() => setOpen(true)}>
				この相談を通報する
			</button>
		);
	return (
		<div className="space-y-3 rounded-2xl border border-line bg-white p-4 text-sm">
			<fieldset className="space-y-1">
				<legend className="font-bold">通報の理由</legend>
				{REASONS.map((r) => (
					<label key={r} className="flex items-center gap-2">
						<input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} />
						{r}
					</label>
				))}
			</fieldset>
			<div className="flex gap-2">
				<button
					type="button"
					className={btnPrimary}
					disabled={state === "sending"}
					onClick={() => {
						setState("sending");
						sendJson("POST", "/api/reports", { consultationId, reason })
							.then(() => setState("sent"))
							.catch((err) => setState(errorText(err)));
					}}
				>
					通報する
				</button>
				<button type="button" className={btnQuiet} onClick={() => setOpen(false)}>
					やめる
				</button>
			</div>
			{state !== "idle" && state !== "sending" && <p className="text-red-700">{state}</p>}
		</div>
	);
}
