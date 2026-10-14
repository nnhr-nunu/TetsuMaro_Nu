import { Icon } from "../icons";

/** 「刺さった」。押した（on）ときは塗りのハート。数は1以上のときだけ出す */
export function HeartButton({ on, count, onClick, disabled }: { on: boolean; count?: number; onClick: () => void; disabled?: boolean }) {
	return (
		<button
			type="button"
			aria-pressed={on}
			disabled={disabled}
			onClick={onClick}
			className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-bold transition disabled:opacity-60 ${
				on ? "border-[#e8467c] bg-[#fdebf1] text-[#c22a5f]" : "border-line bg-white text-ink-soft hover:border-[#e8467c] hover:text-[#c22a5f]"
			}`}
		>
			<Icon name={on ? "heartFilled" : "heart"} className="h-4 w-4" />
			刺さった
			{count !== undefined && count > 0 && <span className="tabular-nums">{count}</span>}
		</button>
	);
}
