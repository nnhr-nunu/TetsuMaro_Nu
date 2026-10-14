# 哲マロ(ぬ)

相談を送ると、名簿の38人から選ばれた哲学者7人と、開発者ぬぬはら（関連マシュマロ回答＋AIぬぬはら）が答える Web サービス。
一番大事な体験は「いろんな哲学者の考え方と意見が、分かりやすく得られること」。

- 作業を始める前に [task.md](task.md) を読む（今の状態、決定事項、未決事項、調べた事実）
- 設計の正本は [docs/superpowers/specs/2026-10-14-tetsumaro-design.md](docs/superpowers/specs/2026-10-14-tetsumaro-design.md)。実装計画は [docs/superpowers/plans/2026-10-14-tetsumaro.md](docs/superpowers/plans/2026-10-14-tetsumaro.md)
- 区切りごとに task.md を更新してコミットし、`git push` する（コミットメッセージは日本語）

## 最初に読む（やること別）

| やること | 入口 |
| --- | --- |
| 哲学者の名簿（考え方・概念・名言・語り口） | `shared/philosophers/data/<id>.ts`（型は `types.ts`、一覧は `index.ts`）。学派の説明は `shared/schools.ts` |
| AI への指示文・答えの読み取り | `shared/prompt.ts` → `shared/answerStream.ts`（7人の選び方は `acceptAnswer`） |
| Gemini の呼び出し・モデルの切り替え | `worker/gemini/`（モデルの一覧は `models.ts`）。キーが無いときの偽物は `worker/fakeAi.ts` |
| 相談を送る・回答を流す | `worker/routes/consult.ts` → `worker/db/consultations.ts` |
| 相談の読み書き・共有・刺さった | `worker/routes/consultations.ts` |
| みんなの相談・検索・似た悩み | `worker/routes/shared.ts` → `worker/db/shared.ts` |
| テーマ（大分類・小分類） | `shared/themes.ts` |
| ぬぬはらのマシュマロ回答 | `shared/nunu/answers.json`（取り込みは `npm run nunu:fetch`）・関連の探し方は `shared/nunu/index.ts` |
| 重い相談の窓口・個人情報の注意 | `shared/crisis.ts`・`shared/personalInfo.ts` |
| 画面 | `src/pages/` と `src/components/`。ボタンの見た目は `src/buttons.ts` |
| 哲学者の絵 | `public/portraits/<id>.svg`（描き方の決まりは `docs/portrait-style.md`） |
| OGP・robots・sitemap | `worker/pages.ts`・`worker/crawl.ts` |

## 決まり

- **`npm run deploy` は実行しない**（本番のマイグレーションとデプロイが走る）。本番は GitHub に push すると Cloudflare の Workers Builds が出す
- キー・合言葉はコミットしない。手元の値は `.dev.vars`（`.dev.vars.example` を写す）
- AI は Gemini だけ。1相談で呼ぶのは1回。キーが無くても偽の AI で動くこと（新機能もこれを保つ）
- 対象は18歳以上（Gemini API の規約）。無料枠では相談文が Google に読まれうるので、規約・入力欄の注意書きを消さない
- 名言の本文は名簿から差し込む。AI が書いた文を名言として出さない
- 哲学者の思想はゆがめずに書く。死や苦しみを扱う思想には「思想の紹介で、死を勧めるものではありません」と添える
- 5人未満の集計は出さない
- ボタンは `src/buttons.ts` の btnPrimary（その画面でしてほしいこと）／btnSecondary（見に行く）／btnQuiet（やめる・コピー）。X は黒、消すは赤
- 画面の文言は `~/.claude/skills/quality-review/design-tips.md` に沿う

## コマンド

| 用途 | コマンド |
| --- | --- |
| 開発サーバー | `npm run dev`（http://localhost:5183） |
| テスト / 型 / ビルド | `npm test` / `npm run typecheck` / `npm run build` |
| E2E（偽の AI。端末の Chrome を使う。開発サーバーを止めてから） | `npm run e2e` |
| 手元の DB を作る | `npm run db:local` |
| マシュマロ回答の取り込み | `npm run nunu:fetch` |
| 回答の質を確かめる（開発サーバーに本物のキーを入れて） | `npm run eval` |
| 絵を一覧の画像にする | `node scripts/portrait-sheet.mjs [id ...]`（test-results/portraits.png） |

Windows の既定ターミナルは PowerShell。bash の heredoc は Bash ツールでだけ使う。
