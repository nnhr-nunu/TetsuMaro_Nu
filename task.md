# task.md（哲マロ(ぬ)）

## 今の状態（2026-10-14）

- 実装計画（docs/superpowers/plans/2026-10-14-tetsumaro.md）の Task 1〜19 まで実装した。手元では偽の AI で一通り動く（相談 → 7人の回答 → 比べ表・補足・刺さった → 自分の答え → 共有 → みんなの相談で検索 → 名簿）
- 名簿38人（`shared/philosophers/data/`）、38人の絵（`public/portraits/`）、ぬぬはらのマシュマロ回答92件（`shared/nunu/answers.json`）がそろった
- まだ本物の Gemini で回答を作っていない（キーが無い）。公開もまだ

## 次にやること

1. ぬぬはらの「決めてほしいこと」と「操作が要るもの」（下）
2. キーができたら `npm run eval` で試験用の相談20件を本物の Gemini にかけ、`docs/eval/<日付>.md` を読んで名簿と指示文（`shared/prompt.ts`）を直す。見るところ: 一般論だけになっていないか・全員同じ調子になっていないか・時代に合わない話・結論の一言が似ていないか・名言の選び方
3. 本物の Gemini で1回の相談のトークン数（入力・出力。開発サーバーのログ・本番の observability に `gemini_usage` で出る）と、書き終わるまでの秒数（`npm run eval` の出力）を測る。指示文は約5.6万字（名簿38人分）。無料枠の1分あたりのトークン上限にすぐ当たるようなら、「先に7人を選ぶ（短い名簿）→ 7人分の名簿で答える」の2回に分けるかを考える（呼ぶ回数は倍になる）
4. `/quality-review` で全体を見る（方針は `~/.claude/skills/quality-review/projects/哲マロ.md`）

## ぬぬはらに決めてほしいこと

- **Gemini の無料枠のままでよいか**（おすすめ: 公開するまでに有料枠にする）
  - Gemini API の規約では、無料枠は送った内容を Google の改善に使い、人が読むこともあり、「機微な情報・個人情報を送らないこと」と求めている。悩み相談とは相性が悪い
  - 今の実装: 入力欄の注意書き（個人が分かることは書かない）と、規約・プライバシーポリシーに明記。コードは有料枠でも同じ（キーの請求先を有料にするだけ）
  - 有料枠の目安（2026-10-14 の料金表から計算した概算。キャッシュで下がる）: gemini-3.1-flash-lite なら1相談およそ2〜3円、3.6-flash ならおよそ6〜8円。月1,000相談で2,000〜8,000円ほど。有料枠は送った内容を改善に使わない
- **対象を18歳以上にした**（Gemini API の規約が18歳未満の使うアプリを禁じているため）。送る前に「18歳以上です」を確かめる。年代の選択肢は「18〜19歳」から

## ぬぬはらの操作が要るもの

1. **Gemini API キー**: https://aistudio.google.com/apikey で、TopicStream とは別のプロジェクトのキーを作る（無料枠を分けるため）
   - 手元: `.dev.vars.example` を `.dev.vars` に写して `GEMINI_API_KEY=` に入れる → `npm run dev` → 別の端末で `npm run eval`
   - 本番: Cloudflare のダッシュボードで Worker の「設定 → 変数とシークレット」に `GEMINI_API_KEY`
   - 使えるモデルを確かめて `worker/gemini/models.ts` の並びを直す（`curl -H "x-goog-api-key: $KEY" https://generativelanguage.googleapis.com/v1beta/models`）
2. **Cloudflare（アカウント nnhr を想定）**
   - D1 を作る: `npx wrangler d1 create tetsumaro` → 出た database_id を `wrangler.jsonc` に入れて push
   - Workers Builds を GitHub の nnhr-nunu/TetsuMaro_Nu につなぐ（ワーカー名 `tetsumaro`、ビルドのコマンド `npm run build`、デプロイのコマンド `npm run deploy`。性癖カルテと同じ）
   - 独自ドメイン: oshilog.life がどのアカウントにあるかを確かめ、同じアカウントなら `wrangler.jsonc` に `"routes": [{ "pattern": "tetsumaro.oshilog.life", "custom_domain": true }]` を足す（違うアカウントなら相談）
   - workers.dev のアドレスが `tetsumaro.nnhr.workers.dev` でなければ、`worker/turnstile.ts` の WORKERS_DEV_HOST を直す
3. **Turnstile**: ダッシュボードでウィジェットを作る（ホスト名: tetsumaro.oshilog.life と workers.dev のアドレス）→ サイトキーを `shared/site.ts` の TURNSTILE_SITE_KEY、シークレットを Worker のシークレット `TURNSTILE_SECRET_KEY`
4. **シークレット**: `ADMIN_TOKEN`（管理画面の合言葉）、`REPORTER_KEY`（刺さった・通報した人を見分ける鍵。長い乱数）
5. **マシュマロ回答の印の確認**: `docs/nunu-review.md` を見て、一般向けに出してよいかを確かめる（直すときは `shared/nunu/answers.json` の audience）。依頼・雑談など相談でないもの（other の約21件）も、関連回答に出ないほうがよければ adult にする
6. 公開したら、トップの OGP 画像（`public/og.png`、1200×630）を用意する（今は無い）

## 決定事項（2026-10-14、ぬぬはらと相談して決めた）

- 一般向けから出す（大人向けは seiheki.net の下に後で。相談に mode を持たせて備えてある）
- 共有は「回答を見てから選んで公開」。名前は匿名が既定、ニックネームも可
- ぬぬはらは「関連マシュマロ回答＋AIぬぬはら」の両方を出す
- AI は Gemini だけ。混んだら次のモデル
- 哲学者は相談に合う人を AI が名簿（38人）から7人選ぶ（哲学者5人以上、同じ学派は1人まで）。ほかの哲学者にも聞くは2人ずつ3回まで
- 構成は性癖カルテと同じ Cloudflare（Workers + D1 + React）。アドレスは tetsumaro.oshilog.life
- 他のプロジェクトは触らない。良い所を写して使う
- 見た目は雑誌のようなフラットデザイン。哲学者は上半身を面で塗り分けたポリゴン風のデフォルメを、コード（SVG）で描く
- 「今日できること」は入れない。哲学者らしさと精確さに力を注ぐ
- 年代・性別は任意で聞き、後で白書にできるよう保存する

## 後回し（設計書 1章）

大人向け / 哲マロ白書 / 端末の引き継ぎ / note・YouTube のデータ / 共有用の画像 / 関連回答を意味の近さ（埋め込み）に替える

## 調べた事実

- マシュマロの公開回答は 92件（2026-10-14）。一覧は `https://marshmallow-qa.com/users/3745329/answers`（JSON。続きは `?before=<最後の updated_at>`、404 で終わり）、1件は `https://marshmallow-qa.com/messages/<uuid>`。取り込みは `npm run nunu:fetch`（印は上書きしない）
- note（21本）と YouTube の再生リスト（27本、1.5〜3.9時間、自動字幕のみ）は、ほぼマシュマロ回答の再編集
- oshilog.life も seiheki.net も DNS は Cloudflare
- workerd は互換日付 2026-10-13 までしか受け付けない（2026-10-14 時点）
- Gemini API の規約（2026-10-14 に確認）: 18歳未満が使う・使いそうなアプリに使えない / 無料枠は送った内容を改善に使い、人が読むことがある / EEA・スイス・英国の利用者には有料枠だけ
- 名言のうち、作業役が「記憶だけで、Web で確かめきれていない」と報告したもの: アリストテレス q2・q4、エピクテトス q3・q4、プラトン q4 の後半、サルトル q3、ボーヴォワール q3、カーネギーの章番号、親鸞 q2〜q4、道元 q1・q4、長明 q3（大福光寺本の字）。ユングの q3 は弱いので外した
