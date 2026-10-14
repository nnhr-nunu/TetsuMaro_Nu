import { type ReactNode, useState } from "react";
import { errorText } from "../api";
import { Icon } from "../icons";

/** 消すなど元に戻せない操作のボタン。押すと確認の文を出し、もう一度押すと実行する（性癖カルテと同じ） */
export function ConfirmButton({ label, message, confirmLabel, onConfirm }: { label: string; message: ReactNode; confirmLabel: string; onConfirm: () => Promise<void> }) {
	const [step, setStep] = useState<"idle" | "confirm" | "running">("idle");
	const [error, setError] = useState<string | null>(null);

	const run = async () => {
		setStep("running");
		setError(null);
		try {
			await onConfirm();
		} catch (err) {
			setError(errorText(err));
			setStep("confirm");
		}
	};

	if (step === "idle")
		return (
			<button type="button" className="inline-flex items-center gap-1 text-sm text-red-700 underline underline-offset-4" onClick={() => setStep("confirm")}>
				<Icon name="trash" className="h-3.5 w-3.5" />
				{label}
			</button>
		);
	return (
		<div role="alert" className="space-y-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm">
			<p>{message}</p>
			<div className="flex gap-3">
				<button type="button" disabled={step === "running"} className="rounded-full bg-red-700 px-4 py-2 font-bold text-white disabled:opacity-40" onClick={() => void run()}>
					{confirmLabel}
				</button>
				<button type="button" disabled={step === "running"} className="rounded-full border border-line bg-white px-4 py-2" onClick={() => setStep("idle")}>
					やめる
				</button>
			</div>
			{error && <p className="text-red-700">{error}</p>}
		</div>
	);
}
