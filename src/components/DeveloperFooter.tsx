/** 開発した関連サービス。姉妹サービス（エゴサ支援ツールなど）のフッターと同じ内容・並びに、エゴサ支援ツールを足したもの */
const RELATED = [
	{ label: "推し活支援サービス：推しログ(ぬ)", href: "https://oshilog.life/" },
	{ label: "配信者向け雑談提供Webサービス：TopicStream(ぬ)", href: "https://topic-stream.oshilog.life/" },
	{ label: "Xのエゴサーチ支援Webサービス：エゴサ支援ツール(ぬ)", href: "https://self-search.oshilog.life/" },
	{ label: "性癖を可視化するWebサービス：性癖カルテ(ぬ)", href: "https://seiheki.net/" },
	{ label: "心音配信に合わせて動く心臓ソフトウェア：StreamHeartbeat(ぬ)", href: "https://github.com/nnhr-nunu/StreamHeartbeat_Nu" },
	{ label: "配信者向け写真表示ソフト：StreamMediaViewer(ぬ)", href: "https://x.com/nnhr_nunu/status/2100926390078169405" },
	{ label: "Slay the Spire 2 催眠術師Mod", href: "https://x.com/nnhr_nunu/status/2083033452128207076" },
] as const;

const LINK = "break-all text-brand-link underline-offset-2 hover:underline";

function External({ href }: { href: string }) {
	return (
		<a href={href} target="_blank" rel="noopener noreferrer" className={LINK}>
			{href}
		</a>
	);
}

/** トップの最下部。開発者情報と関連サービス（性癖カルテの DeveloperFooter と同じ内容） */
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
					{RELATED.map((item) => (
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
