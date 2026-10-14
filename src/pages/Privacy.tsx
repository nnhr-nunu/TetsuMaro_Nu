import { DOC_LINK, DocSection } from "../components/Doc";
import { useTitle } from "../useTitle";

export function PrivacyPage() {
	useTitle("プライバシーポリシー");
	return (
		<div className="space-y-6">
			<h1 className="text-2xl font-bold">プライバシーポリシー</h1>

			<DocSection title="1. 預かるもの">
				<ul className="list-disc space-y-1 pl-5">
					<li>相談の本文、回答、自分の答え、刺さった哲学者、公開名（共有するとき）</li>
					<li>答えてもらった場合だけ、年代と性別（集計にだけ使い、ほかの人には見せません）</li>
					<li>この端末を見分けるための Cookie（ログインの代わり。自分の相談を開くのに使います）</li>
					<li>連投や不正を防ぐため、接続元の回線から作った、元に戻せない値</li>
				</ul>
			</DocSection>

			<DocSection title="2. 回答を作るための送り先">
				<p>
					相談文は、回答を作るために Google の Gemini API に送られます。本サービスは Gemini API の無料枠を使っているため、送った内容と回答は、Google
					のサービス改善に使われ、Google の担当者が読むことがあります（
					<a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noopener noreferrer" className={DOC_LINK}>
						Gemini API の利用規約
					</a>
					）。個人が分かることは書かないでください。
				</p>
			</DocSection>

			<DocSection title="3. 使い道">
				<ul className="list-disc space-y-1 pl-5">
					<li>回答を作って見せること、共有した相談をみんなの相談に出すこと</li>
					<li>個人が分からない集計（どんな悩みが多いか、年代ごとにどの哲学者が刺さったか など）。共有していない相談も、数としてだけ集計に入ります。集計は5人未満のものを出しません</li>
					<li>不正の防止と、サービスの改善</li>
				</ul>
			</DocSection>

			<DocSection title="4. 消し方">
				<p>自分の相談は、相談のページの「この相談を消す」から、回答・刺さった・検索の索引ごと消せます。Cookie を消すと、その端末から自分の相談を開けなくなります。</p>
			</DocSection>

			<DocSection title="5. 第三者への提供">
				<p>法令に基づく場合を除き、預かったものを、個人が分かる形で第三者に渡しません（2章の Gemini API への送信を除きます）。</p>
			</DocSection>

			<DocSection title="6. お問い合わせ">
				<p>
					開発者の X（
					<a href="https://x.com/nnhr_nunu" target="_blank" rel="noopener noreferrer" className={DOC_LINK}>
						@nnhr_nunu
					</a>
					）へ。
				</p>
			</DocSection>
			<p className="text-xs text-ink-soft">2026年10月14日 制定</p>
		</div>
	);
}
