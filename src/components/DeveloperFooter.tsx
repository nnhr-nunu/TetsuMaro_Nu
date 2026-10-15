import { RELATED_SERVICES } from "./relatedServices";

const LINK = "break-all text-brand-link underline-offset-2 hover:underline";

function External({ href }: { href: string }) {
	return (
		<a href={href} target="_blank" rel="noopener noreferrer" className={LINK}>
			{href}
		</a>
	);
}

/** トップの最下部。開発者情報と関連サービス（関連サービスの一覧は relatedServices.ts。正本から書き写す） */
export function DeveloperFooter() {
	return (
		<section className="rounded-3xl border border-line bg-white p-5 text-sm leading-relaxed">
			<h2 className="text-base font-bold">開発者情報</h2>
			<div className="mt-4 space-y-2">
				<p className="font-medium">開発者：ぬぬはら（催眠音声制作者）</p>
				<p>
					Twitter：<External href="https://x.com/nnhr_nunu" />
				</p>
				<p>
					催眠音声チャンネル：<External href="https://www.youtube.com/@nnhr_nunu" />
				</p>
				<p>
					実写催眠チャンネル：<External href="https://www.youtube.com/channel/UCqYpbbypex0iOikcZRenxGA" />
				</p>
				<p>
					マシュマロ（お悩み相談）：<External href="https://marshmallow-qa.com/nnhr_nunu" />
				</p>
				<p>バグ報告はDMなどで頂けたら幸いです。</p>
			</div>
			<div className="mt-5 border-t border-line pt-5">
				<h3 className="font-medium">【開発した関連サービス】</h3>
				<ul className="mt-3 divide-y divide-line">
					{RELATED_SERVICES.map((item) => (
						<li key={item.href} className="space-y-0.5 py-3 first:pt-0 last:pb-0">
							<p>・{item.label}</p>
							<p>
								<External href={item.href} />
							</p>
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}
