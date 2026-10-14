import type { ReactNode } from "react";
import { Link, NavLink } from "react-router";

/** サイトの印（マシュマロの形）。favicon と同じ形 */
export function Logo({ className = "h-8 w-8" }: { className?: string }) {
	return (
		<svg viewBox="0 0 64 64" className={className} aria-hidden="true">
			<rect width="64" height="64" rx="18" fill="#3b4fe0" />
			<ellipse cx="32" cy="22" rx="17" ry="8" fill="#ffffff" />
			<rect x="15" y="22" width="34" height="22" fill="#eef0fd" />
			<ellipse cx="32" cy="44" rx="17" ry="8" fill="#eef0fd" />
			<circle cx="26" cy="33" r="2.4" fill="#1e1b3a" />
			<circle cx="38" cy="33" r="2.4" fill="#1e1b3a" />
		</svg>
	);
}

const nav = ({ isActive }: { isActive: boolean }) =>
	`whitespace-nowrap rounded-full px-3 py-1.5 ${isActive ? "bg-ink text-white" : "text-ink-soft hover:bg-mist"}`;

export function Layout({ children }: { children: ReactNode }) {
	return (
		<div className="flex min-h-dvh flex-col">
			<header className="sticky top-0 z-30 border-b border-line/70 bg-paper/90 backdrop-blur">
				<div className="mx-auto flex max-w-3xl flex-col gap-1 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
					<Link to="/" className="flex items-center gap-2 font-bold whitespace-nowrap">
						<Logo />
						<span className="text-lg tracking-wide">哲マロ(ぬ)</span>
					</Link>
					<nav className="-mx-1 flex items-center gap-0.5 text-sm" aria-label="サイト内">
						<NavLink to="/search" className={nav}>
							みんなの相談
						</NavLink>
						<NavLink to="/philosophers" className={nav}>
							哲学者
						</NavLink>
						<NavLink to="/me" className={nav}>
							自分の相談
						</NavLink>
					</nav>
				</div>
			</header>
			<main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-16">{children}</main>
			<footer className="border-t border-line/70 py-6 text-center text-xs text-ink-soft">
				<nav className="flex justify-center gap-4" aria-label="サイトの決まり">
					<Link to="/terms" className="underline-offset-4 hover:underline">
						利用規約
					</Link>
					<Link to="/privacy" className="underline-offset-4 hover:underline">
						プライバシーポリシー
					</Link>
				</nav>
				<p className="mt-2">© ぬぬはら</p>
			</footer>
		</div>
	);
}
