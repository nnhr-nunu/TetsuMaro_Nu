import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import type { AnswerEvent, ConsultationView, SharedItem } from "../../shared/api";
import { philosopherById } from "../../shared/philosophers";
import { ANSWER_COUNT, MORE_COUNT } from "../../shared/site";
import { ApiError, errorText, getJson, sendJson, streamEvents } from "../api";
import { btnPrimary, btnSecondary } from "../buttons";
import { visibleAnswers } from "../answersView";
import { AnswerCard } from "../components/AnswerCard";
import { CompareTable } from "../components/CompareTable";
import { ConfirmButton } from "../components/ConfirmButton";
import { CrisisBanner } from "../components/CrisisBanner";
import { NunuSection } from "../components/NunuSection";
import { MyAnswer, PickFaces, ReportForm, SharePanel } from "../components/OwnerPanels";
import { Portrait } from "../components/Portrait";
import { SharedList } from "../components/SharedList";
import { heartedSet, loadDraft, rememberHeart, saveDraft } from "../draft";
import { Icon } from "../icons";
import { clearLiveIfDone, useLive } from "../liveConsult";
import { useTitle } from "../useTitle";
import { NotFound } from "./NotFound";

/** ほかの哲学者に聞けるのは3回まで（worker/routes/consultations.ts と同じ） */
const MAX_ANSWERS = ANSWER_COUNT + MORE_COUNT * 3;
/** 待っている間に並べる顔ぶれ（どの人が選ばれるかが届く前） */
const WAITING_FACES = ["socrates", "buddha", "kant", "nietzsche", "confucius"];

const dateText = (ms: number) => new Date(ms).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });

/** 相談の id が変わったら（似た悩みから別の相談へ移ったとき）、前の相談の中身を持ち越さないよう作り直す */
export function ConsultationRoute() {
	const { id = "" } = useParams();
	return <ConsultationPage key={id} id={id} />;
}

/** 書きかけ（pending）の相談を、届いている流れが無いまま開いたときに読み直す間隔 */
const PENDING_POLL_MS = 3000;

function ConsultationPage({ id }: { id: string }) {
	const navigate = useNavigate();
	const live = useLive();
	const here = live?.id === id ? live : null;
	const streaming = here?.status === "streaming";
	const [view, setView] = useState<ConsultationView | null>(null);
	const [missing, setMissing] = useState(false);
	const [more, setMore] = useState<{ answers: AnswerEvent[]; busy: boolean; error: string | null }>({ answers: [], busy: false, error: null });
	const [hearted, setHearted] = useState(heartedSet);
	const [similar, setSimilar] = useState<SharedItem[]>([]);

	/**
	 * 保存された中身を読み直す。読めたら true。通信の失敗（404 以外）は少し待って2回までやり直す
	 * （回答が流れ終わった直後の読み直しが、たまに失敗するため。失敗したままなら、届いた回答の表示を残す）
	 */
	const load = useCallback(async (): Promise<boolean> => {
		for (let attempt = 0; attempt < 3; attempt++) {
			try {
				setView(await getJson<ConsultationView>(`/api/consultations/${id}`));
				setMissing(false);
				return true;
			} catch (err) {
				if (err instanceof ApiError && err.status === 404) {
					setMissing(true);
					return false;
				}
				await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
			}
		}
		return false;
	}, [id]);

	useEffect(() => {
		void load();
	}, [load]);

	// 届き終わったら、保存された中身を読み直す。1人も答えられなかったときは、書いた相談を入力欄に戻す
	const hereStatus = here?.status;
	useEffect(() => {
		if (!here || hereStatus === "streaming") return;
		if (hereStatus === "error" && here.answers.length === 0) saveDraft({ ...loadDraft(), body: here.body });
		void load();
	}, [hereStatus, load, here]);

	useEffect(() => () => clearLiveIfDone(), []);

	useEffect(() => {
		if (!view?.sharedAt) return;
		getJson<SharedItem[]>(`/api/shared/${id}/similar`)
			.then(setSimilar)
			.catch(() => setSimilar([]));
	}, [view?.sharedAt, id]);

	// 書きかけの相談を、届いている流れが無いまま開いた（開き直した・通信が切れた）ときは、書き終わるまで読み直す
	const waitingSaved = view?.status === "pending" && !here;
	useEffect(() => {
		if (!waitingSaved) return;
		const timer = setInterval(() => void load(), PENDING_POLL_MS);
		return () => clearInterval(timer);
	}, [waitingSaved, load]);

	const body = view?.body ?? here?.body ?? "";
	useTitle(body ? `相談「${[...body].slice(0, 20).join("")}…」` : null);

	if (missing && !here) return <NotFound message="この相談は見つかりませんでした。消されたか、共有をやめた相談かもしれません。" />;
	if (!view && !here) return <p className="py-12 text-center text-ink-soft">読み込み中…</p>;

	const answers = visibleAnswers({ saved: view?.answers ?? [], live: here?.answers ?? [], more: more.answers });
	const isOwner = view?.isOwner ?? here !== null;
	const crisis = Boolean(view?.crisis || here?.meta?.crisis);
	const nunu = (streaming ? here?.nunu : (view?.nunu ?? here?.nunu)) ?? null;
	const waiting = streaming ? (here?.meta?.picks ?? []).filter((p) => !answers.some((a) => a.philosopher === p)) : [];
	const failed = here?.status === "error" && answers.length === 0;
	/** 書き終わった相談だけ、自分の答え・共有・ほかの哲学者にも聞くを出す */
	const settled = Boolean(view && view.status !== "pending" && !streaming);

	const heartOf = (pid: string) => {
		if (!view || streaming) return undefined;
		if (isOwner) {
			const on = view.myPicks.includes(pid);
			return {
				on,
				count: view.hearts[pid],
				onClick: () => {
					const myPicks = on ? view.myPicks.filter((p) => p !== pid) : [...view.myPicks, pid];
					setView({ ...view, myPicks });
					void sendJson("PATCH", `/api/consultations/${id}`, { myPicks }).catch(() => setView(view));
				},
			};
		}
		const key = `${id}:${pid}`;
		const on = hearted.has(key);
		return {
			on,
			count: view.hearts[pid],
			disabled: on,
			onClick: () => {
				rememberHeart(key);
				setHearted(heartedSet());
				void sendJson<{ count: number }>("POST", `/api/consultations/${id}/hearts`, { philosopherId: pid }).then((r) =>
					setView((v) => (v ? { ...v, hearts: { ...v.hearts, [pid]: r.count } } : v)),
				);
			},
		};
	};

	const askMore = async () => {
		setMore((m) => ({ ...m, busy: true, error: null }));
		try {
			for await (const ev of streamEvents(`/api/consultations/${id}/more`)) {
				if (ev.type === "answer") setMore((m) => ({ ...m, answers: [...m.answers, ev] }));
				if (ev.type === "error") setMore((m) => ({ ...m, error: errorText(ev.code) }));
			}
			const loaded = await load();
			// 読み直せたら、届いた分は保存された中身に入っている。読み直せなかったら、届いた分をそのまま見せ続ける
			setMore((m) => ({ ...m, answers: loaded ? [] : m.answers, busy: false }));
		} catch (err) {
			setMore((m) => ({ ...m, busy: false, error: errorText(err) }));
		}
	};

	return (
		<div className="space-y-8">
			<section aria-labelledby="body-title" className="space-y-3">
				<div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
					<span id="body-title" className="font-bold text-ink">
						相談
					</span>
					{view && <span>{dateText(view.createdAt)}</span>}
					{view && isOwner && (
						<span className={`rounded-full px-2.5 py-0.5 font-bold ${view.sharedAt ? "bg-ink text-white" : "bg-mist"}`}>{view.sharedAt ? "共有中" : "あなただけが見られます"}</span>
					)}
					{view && !isOwner && <span>{view.displayName ?? "匿名"}さんの相談</span>}
				</div>
				<p className="rounded-3xl border border-line bg-white p-5 text-lg leading-relaxed whitespace-pre-wrap">{body}</p>
			</section>

			{crisis && <CrisisBanner />}

			{failed && (
				<div role="alert" className="space-y-3 rounded-3xl border border-amber-200 bg-amber-50 p-5">
					<p className="leading-relaxed text-amber-950">{errorText(here?.error ?? "ai_failed")}</p>
					<p className="text-sm text-amber-900">書いた相談は入力欄に戻しました。</p>
					<button type="button" className={btnSecondary} onClick={() => navigate("/")}>
						入力欄に戻る
					</button>
				</div>
			)}

			{streaming && answers.length === 0 && waiting.length === 0 && (
				<div className="flex flex-col items-center gap-4 py-8" role="status">
					<div className="flex -space-x-3">
						{WAITING_FACES.map((pid, i) => (
							<span key={pid} className="animate-pulse rounded-full ring-4 ring-paper" style={{ animationDelay: `${i * 150}ms` }}>
								<Portrait id={pid} size={48} round />
							</span>
						))}
					</div>
					<p className="text-ink-soft">哲学者たちが相談を読んでいます…</p>
				</div>
			)}

			{waitingSaved && (
				<p role="status" className="animate-pulse rounded-3xl bg-mist p-4 text-center text-sm text-ink-soft">
					まだ回答を書いています。書き終わると、ここに出ます。
				</p>
			)}

			{(answers.length > 0 || waiting.length > 0) && <CompareTable answers={answers} waiting={waiting} />}

			{answers.length > 0 && (
				<section aria-label="哲学者たちの回答" className="space-y-5">
					{answers.map((a, i) => {
						const p = philosopherById(a.philosopher);
						return p ? <AnswerCard key={a.philosopher} answer={a} philosopher={p} index={i} heart={heartOf(p.id)} /> : null;
					})}
				</section>
			)}

			{isOwner && view && settled && answers.length > 0 && answers.length < MAX_ANSWERS && (
				<div className="space-y-2">
					<button type="button" className={`${btnSecondary} w-full`} disabled={more.busy} onClick={() => void askMore()}>
						<Icon name="plus" />
						{more.busy ? "ほかの哲学者が考えています…" : `ほかの哲学者にも聞く（${MORE_COUNT}人）`}
					</button>
					{more.error && <p className="text-sm text-red-700">{more.error}</p>}
				</div>
			)}

			{nunu && <NunuSection nunu={nunu} heart={heartOf("nunu")} />}

			{isOwner && view && settled && answers.length > 0 && (
				<>
					<MyAnswer view={view} onSaved={(myAnswer) => setView({ ...view, myAnswer })} />
					<SharePanel view={view} onChange={(patch) => setView({ ...view, ...patch })} />
					<div className="text-right">
						<ConfirmButton
							label="この相談を消す"
							message="この相談と回答を消します。共有していた場合は、みんなの相談からも消えます。元に戻せません。"
							confirmLabel="消す"
							onConfirm={async () => {
								await sendJson("DELETE", `/api/consultations/${id}`);
								navigate("/me");
							}}
						/>
					</div>
				</>
			)}

			{!isOwner && view && (
				<>
					{(view.myPicks.length > 0 || view.myAnswer) && (
						<section aria-labelledby="their-title" className="space-y-3 rounded-3xl border border-line bg-white p-5">
							<h2 id="their-title" className="text-lg font-bold">
								相談した人の答え
							</h2>
							{view.myPicks.length > 0 && <PickFaces picks={view.myPicks} />}
							{view.myAnswer && <p className="leading-relaxed whitespace-pre-wrap">{view.myAnswer}</p>}
						</section>
					)}
					{similar.length > 0 && (
						<section aria-labelledby="similar-title" className="space-y-3">
							<h2 id="similar-title" className="text-lg font-bold">
								似た悩みのみんなの相談
							</h2>
							<SharedList items={similar} />
						</section>
					)}
					<div className="rounded-3xl bg-ink p-6 text-center text-white">
						<p className="font-bold">あなたの悩みも、哲学者たちに聞いてみませんか</p>
						<Link to="/" className={`${btnPrimary} mt-4 bg-white text-ink hover:bg-paper`}>
							自分も相談する
						</Link>
					</div>
					<ReportForm consultationId={id} />
				</>
			)}
		</div>
	);
}
