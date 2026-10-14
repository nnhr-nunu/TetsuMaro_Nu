import { Link } from "react-router";
import { DOC_LINK, DocSection } from "../components/Doc";
import { useTitle } from "../useTitle";

export function TermsPage() {
	useTitle("利用規約");
	return (
		<div className="space-y-6">
			<h1 className="text-2xl font-bold">利用規約</h1>
			<p className="text-sm leading-relaxed">この規約は、哲マロ(ぬ)（以下「本サービス」）を使うときの約束ごとです。本サービスを使う方は、この規約に同意したものとします。</p>

			<DocSection title="1. 利用できる人">
				<p>18歳以上の方が利用できます（回答を作る AI の提供元の決まりによります）。</p>
			</DocSection>

			<DocSection title="2. 回答について">
				<ul className="list-disc space-y-1 pl-5">
					<li>哲学者たちの回答は、それぞれの思想をもとに AI が書いたものです。哲学者本人の言葉ではありません。名言として出すのは、出典の分かる言葉だけです</li>
					<li>「AIぬぬはら」の回答も AI が書いたもので、ぬぬはら本人の発言ではありません</li>
					<li>回答は考えるための材料の一つです。病気・法律・お金などの判断の代わりにはなりません。つらい気持ちが続くときは、相談窓口や専門家に相談してください</li>
					<li>死や苦しみを扱う思想の紹介は、その考え方を伝えるもので、死を勧めるものではありません</li>
					<li>AI は間違えることがあります。回答の正しさ・役に立つかは保証しません</li>
				</ul>
			</DocSection>

			<DocSection title="3. 相談に書かないでほしいこと">
				<p>
					名前・住所・学校や会社の名前・連絡先など、あなたや他の人が分かることは書かないでください。相談文は回答を作るために Google の Gemini API に送られます（
					<Link to="/privacy" className={DOC_LINK}>
						プライバシーポリシー
					</Link>
					）。
				</p>
			</DocSection>

			<DocSection title="4. 禁止事項">
				<ul className="list-disc space-y-1 pl-5">
					<li>他の人の個人情報を書くこと、誹謗中傷、なりすまし</li>
					<li>法令や公序良俗に反すること</li>
					<li>自動化した手段で大量に送るなど、本サービスの運営を妨げること</li>
					<li>本サービスのしくみに不正にアクセスすること</li>
				</ul>
			</DocSection>

			<DocSection title="5. 共有">
				<ul className="list-disc space-y-1 pl-5">
					<li>相談は、共有するまであなただけが見られます</li>
					<li>共有した相談と回答・自分の答え・公開名は、誰でも見られ、検索エンジンにも出ることがあります</li>
					<li>共有をやめる（非公開に戻す）ことも、消すこともできます。ただし、X などに貼られた分や、他の人が保存した分までは消せません</li>
				</ul>
			</DocSection>

			<DocSection title="6. 運営による非表示・削除">
				<p>この規約に反するもの、通報が多いものは、運営の判断で見えなくしたり消したりすることがあります。</p>
			</DocSection>

			<DocSection title="7. サービスの変更・停止">
				<p>本サービスは無料で運営しています。内容を予告なく変えたり、止めたりすることがあります。1日に答えられる相談の数には限りがあります。</p>
			</DocSection>

			<DocSection title="8. 規約の変更とお問い合わせ">
				<p>
					規約を変えるときは、このページでお知らせします。お問い合わせは、開発者の X（
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
