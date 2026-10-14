import { philosopherById } from "../../shared/philosophers";

/** 哲学者の絵（public/portraits/<id>.svg）。round なら丸く切り抜く（比べ表・一覧の小さな絵） */
export function Portrait({ id, size, round = false, className = "" }: { id: string; size: number; round?: boolean; className?: string }) {
	const name = philosopherById(id)?.name ?? "";
	return (
		<img
			src={`/portraits/${id}.svg`}
			alt={name}
			width={size}
			height={Math.round((size * 220) / 200)}
			loading="lazy"
			className={`${round ? "aspect-square rounded-full object-cover object-top" : "rounded-2xl"} shrink-0 ${className}`}
			style={round ? { width: size, height: size } : undefined}
		/>
	);
}
