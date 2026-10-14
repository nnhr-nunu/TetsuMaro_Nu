import { type ReactNode, createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { conceptById, philosopherById } from "../../shared/philosophers";
import { schoolById } from "../../shared/schools";
import { Icon } from "../icons";

/**
 * ワンタップの補足（学派・概念の説明）。画面の下からせり上がるシート。Esc・外側・閉じるで閉じ、開いている間はフォーカスを中に置く。
 * どの画面からも InfoChip を押せば開く（シートは InfoSheetProvider に1つだけ）
 */
type Info = { title: string; sub?: string; body: string };

const Ctx = createContext<(info: Info) => void>(() => {});

export function InfoSheetProvider({ children }: { children: ReactNode }) {
	const [info, setInfo] = useState<Info | null>(null);
	const panel = useRef<HTMLDivElement>(null);
	const opener = useRef<HTMLElement | null>(null);
	const open = useCallback((next: Info) => {
		opener.current = document.activeElement as HTMLElement | null;
		setInfo(next);
	}, []);
	const close = useCallback(() => {
		setInfo(null);
		opener.current?.focus();
	}, []);

	useEffect(() => {
		if (!info) return;
		panel.current?.focus();
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") close();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [info, close]);

	return (
		<Ctx.Provider value={open}>
			{children}
			{info && (
				<div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 sm:items-center" onClick={close}>
					<div
						ref={panel}
						role="dialog"
						aria-modal="true"
						aria-labelledby="info-title"
						tabIndex={-1}
						className="max-h-[70vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 shadow-xl outline-none sm:rounded-3xl"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="flex items-start justify-between gap-3">
							<div>
								{info.sub && <p className="text-xs text-ink-soft">{info.sub}</p>}
								<h2 id="info-title" className="text-lg font-bold">
									{info.title}
								</h2>
							</div>
							<button type="button" onClick={close} aria-label="閉じる" className="-m-2 rounded-full p-2 text-ink-soft hover:bg-mist">
								<Icon name="close" className="h-5 w-5" />
							</button>
						</div>
						<p className="mt-3 leading-relaxed">{info.body}</p>
					</div>
				</div>
			)}
		</Ctx.Provider>
	);
}

const chipClass =
	"inline-flex items-center gap-1 rounded-full border border-current/20 bg-white/70 px-2.5 py-0.5 text-sm underline decoration-dotted underline-offset-4 hover:bg-white";

/** 押すと学派の説明が出る名前 */
export function SchoolChip({ id, className = "" }: { id: string | null; className?: string }) {
	const open = useContext(Ctx);
	const school = schoolById(id);
	if (!school) return null;
	return (
		<button type="button" className={`${chipClass} ${className}`} onClick={() => open({ title: school.name, sub: "学派・思想の流れ", body: school.desc })}>
			{school.name}
		</button>
	);
}

/** 押すと概念の説明が出る名前 */
export function ConceptChip({ id, className = "" }: { id: string; className?: string }) {
	const open = useContext(Ctx);
	const concept = conceptById(id);
	if (!concept) return null;
	const owner = philosopherById(id.split(".")[0]);
	return (
		<button type="button" className={`${chipClass} ${className}`} onClick={() => open({ title: concept.name, sub: owner ? `${owner.name}の考え方` : undefined, body: concept.desc })}>
			{concept.name}
		</button>
	);
}
