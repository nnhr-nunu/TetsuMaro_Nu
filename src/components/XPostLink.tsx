import { Icon } from "../icons";

/** X の投稿画面を開くリンク（黒。外部サービスの色）。className で並べ方を足す */
export function XPostLink({ text, url, className = "" }: { text: string; url: string; className?: string }) {
	const href = `https://x.com/intent/post?${new URLSearchParams({ text, url }).toString()}`;
	return (
		<a
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-black px-5 py-2.5 font-bold text-white ${className}`}
		>
			<Icon name="x" />
			に投稿
		</a>
	);
}
