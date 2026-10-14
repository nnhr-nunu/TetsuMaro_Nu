import { useState } from "react";
import { useNavigate } from "react-router";
import { AGE_BANDS, type AgeBandId, BODY_MAX, GENDERS, type GenderId } from "../../shared/site";
import { errorText } from "../api";
import { btnPrimary } from "../buttons";
import { adultConfirmed, clearDraftBody, confirmAdult, loadDraft, saveDraft } from "../draft";
import { startConsult } from "../liveConsult";

/** 入力の例（押すと入力欄に入る） */
const EXAMPLES = ["仕事に行くのがつらい。辞めるべきか迷っている", "人の目が気になって、自分の意見が言えない", "将来がなんとなく不安で、夜眠れない", "好きな人に振られて、立ち直れない"];

const select = "min-h-11 w-full rounded-2xl border border-line bg-white px-3 outline-none focus:border-ink";

/** 相談の入力欄。書いた相談は端末に残り、送れたら消える */
export function ConsultForm() {
	const navigate = useNavigate();
	const [draft, setDraft] = useState(loadDraft);
	const [adult, setAdult] = useState(adultConfirmed);
	const [sending, setSending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const length = [...draft.body.trim()].length;

	const update = (patch: Partial<typeof draft>) => {
		const next = { ...draft, ...patch };
		setDraft(next);
		saveDraft(next);
		setError(null);
	};

	const submit = async () => {
		if (!length) return setError(errorText("empty"));
		if (length > BODY_MAX) return setError(errorText("too_long"));
		if (!adult) return setError("18歳以上の方だけが使えます。");
		confirmAdult();
		setSending(true);
		setError(null);
		try {
			await startConsult({ body: draft.body.trim(), ageBand: draft.ageBand, gender: draft.gender }, (id) => {
				clearDraftBody();
				navigate(`/c/${id}`);
			});
		} catch (err) {
			setError(errorText(err));
		} finally {
			setSending(false);
		}
	};

	return (
		<form
			className="space-y-4 rounded-[2rem] border border-line bg-white p-5 shadow-[0_8px_30px_-12px_rgba(30,27,58,0.18)]"
			onSubmit={(e) => {
				e.preventDefault();
				void submit();
			}}
		>
			<label className="block space-y-2">
				<span className="font-bold">あなたの悩み</span>
				<textarea
					value={draft.body}
					onChange={(e) => update({ body: e.target.value })}
					rows={6}
					maxLength={BODY_MAX + 100}
					placeholder="いま悩んでいることを、自由に書いてください"
					className="w-full resize-y rounded-2xl border border-line bg-paper/50 p-4 leading-relaxed outline-none focus:border-ink focus:bg-white"
				/>
			</label>
			<div className="flex items-start justify-between gap-3 text-xs text-ink-soft">
				<p>名前や学校・会社の名前など、個人が分かることは書かないでください。</p>
				<p className={`shrink-0 tabular-nums ${length > BODY_MAX ? "font-bold text-red-700" : ""}`}>
					{length}/{BODY_MAX}
				</p>
			</div>
			{!draft.body && (
				<div className="flex flex-wrap gap-2">
					{EXAMPLES.map((ex) => (
						<button key={ex} type="button" onClick={() => update({ body: ex })} className="rounded-full bg-mist px-3 py-1.5 text-left text-xs text-ink-soft hover:bg-line">
							{ex}
						</button>
					))}
				</div>
			)}
			<details className="rounded-2xl bg-paper/60 px-4 py-3 text-sm">
				<summary className="cursor-pointer font-bold">年代・性別（任意）</summary>
				<p className="mt-1 text-xs text-ink-soft">答えなくても送れます。どんな人にどの哲学者が刺さるかの集計にだけ使い、ほかの人には見せません。</p>
				<div className="mt-3 grid grid-cols-2 gap-3">
					<label className="space-y-1">
						<span className="text-xs">年代</span>
						<select value={draft.ageBand ?? ""} onChange={(e) => update({ ageBand: (e.target.value || undefined) as AgeBandId | undefined })} className={select}>
							<option value="">答えない</option>
							{AGE_BANDS.map((a) => (
								<option key={a.id} value={a.id}>
									{a.label}
								</option>
							))}
						</select>
					</label>
					<label className="space-y-1">
						<span className="text-xs">性別</span>
						<select value={draft.gender ?? ""} onChange={(e) => update({ gender: (e.target.value || undefined) as GenderId | undefined })} className={select}>
							<option value="">答えない</option>
							{GENDERS.map((g) => (
								<option key={g.id} value={g.id}>
									{g.label}
								</option>
							))}
						</select>
					</label>
				</div>
			</details>
			{!adultConfirmed() && (
				<label className="flex items-center gap-2 text-sm">
					<input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} className="h-5 w-5" />
					18歳以上です
				</label>
			)}
			<button type="submit" className={`${btnPrimary} w-full text-base`} disabled={sending}>
				{sending ? "送っています…" : "哲学者たちに聞く"}
			</button>
			{error && (
				<p role="alert" className="text-sm text-red-700">
					{error}
				</p>
			)}
		</form>
	);
}
