import type { ReactNode } from "react";

/** 規約・プライバシーの節 */
export function DocSection({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="space-y-2 text-sm leading-relaxed">
			<h2 className="text-base font-bold">{title}</h2>
			{children}
		</section>
	);
}

export const DOC_LINK = "text-brand-link underline underline-offset-4";
