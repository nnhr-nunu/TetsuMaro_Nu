/** 小さなアイコン（線の SVG）。色は文字の色（currentColor）に合わせる */
const PATHS = {
	heart: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z",
	search: "M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Zm5-2 4 4",
	arrow: "M5 12h14m-5-5 5 5-5 5",
	close: "M6 6l12 12M18 6 6 18",
	plus: "M12 5v14M5 12h14",
	share: "M12 3v12m0-12 4 4m-4-4-4 4M5 13v6h14v-6",
	trash: "M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13",
	info: "M12 11v6m0-9.5v.5M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Z",
	quote: "M7 7h4v4c0 3-2 5-4 6M15 7h4v4c0 3-2 5-4 6",
	copy: "M9 9h10v10H9zM5 15V5h10",
	external: "M14 4h6v6m0-6-9 9M18 14v6H4V6h6",
	phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z",
} as const;

export type IconName = keyof typeof PATHS | "x" | "heartFilled";

export function Icon({ name, className = "h-4 w-4" }: { name: IconName; className?: string }) {
	if (name === "x")
		return (
			<svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
				<path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z" />
			</svg>
		);
	if (name === "heartFilled")
		return (
			<svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
				<path d={PATHS.heart} />
			</svg>
		);
	return (
		<svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<path d={PATHS[name]} />
		</svg>
	);
}
