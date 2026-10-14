import { chip, chipOn } from "../buttons";

/**
 * 絞り込みの丸いボタンの並び（テーマ・小分類）。先頭の「すべて」は絞り込まない状態。
 * 選んでいるものをもう一度押すと外れる。スマホで押しやすいように、高さは 44px にそろえる（chip の既定は 36px）
 */
export function FilterChips({
	label,
	options,
	value,
	onChange,
}: {
	label: string;
	options: readonly { id: string; name: string }[];
	value: string | null;
	onChange: (id: string | null) => void;
}) {
	const item = (id: string | null, name: string) => {
		const on = value === id;
		return (
			<button key={id ?? "all"} type="button" aria-pressed={on} className={on ? chipOn : chip} onClick={() => onChange(on ? null : id)}>
				{name}
			</button>
		);
	};
	return (
		<div role="group" aria-label={label} className="flex flex-wrap gap-2">
			{item(null, "すべて")}
			{options.map((o) => item(o.id, o.name))}
		</div>
	);
}
