# 哲マロ(ぬ) 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 相談を送ると、名簿の38人から選ばれた哲学者7人とぬぬはら（関連マシュマロ＋AIぬぬはら）の回答が届き、見比べ・共有・検索できる Web サービスを作る。

**Architecture:** Cloudflare Workers（Hono）が API と画面の配信を受け持ち、D1 に相談・回答を保存する。Gemini は1相談1回だけ呼び、改行区切りの JSON をストリーミングで画面へ流す。名簿・テーマ・指示文・答えの読み取り・近さの計算は `shared/` の純粋な処理にして、画面と Worker で共用する。

**Tech Stack:** TypeScript / Hono / D1 / React 19 / React Router / Tailwind CSS 4 / Vite（@cloudflare/vite-plugin）/ zod / vitest（@cloudflare/vitest-plugin）/ Playwright

**Spec:** `docs/superpowers/specs/2026-10-14-tetsumaro-design.md`

## Global Constraints

- 画面の言葉はすべて日本語。サービス名は「哲マロ(ぬ)」
- 相談 1000字・自分の答え 200字・公開名 20字まで。1端末1日10相談まで。相談の回線ごとの歯止めは1分3回
- 既定の回答者は7人（哲学者5人以上、同じ学派は1人まで）。「ほかの哲学者にも聞く」は2人
- Gemini は1相談1回。キーが無いとき・`AI_FAKE=1` のときは偽の AI
- 名言の本文は名簿から差し込む（AI の出した文を名言として出さない）
- 5人未満の集計は出さない
- `npm run deploy` は実行しない。キー・合言葉はコミットしない（`.dev.vars` は git に入れない）
- ボタンは `src/buttons.ts` の btnPrimary／btnSecondary／btnQuiet（X は黒、消すは赤）。画面の文言は `~/.claude/skills/quality-review/design-tips.md` に沿う
- Rate Limiting の namespace_id は 2001〜2006（性癖カルテの 1001〜1005 と重ねない）
- コミットメッセージは日本語。区切りごとに commit して `git push`

## Review Focus

- AI の答えが途中で切れる・壊れた行が混じる → 届いた分だけ見せて保存し（状態「途中」）、500 にしない。「ほかの哲学者にも聞く」で足せる（Task 5・7 にテスト）
- 相談を送った直後にタブを閉じる → サーバーは最後まで受け取って保存し、開き直すと回答が並ぶ（Task 7 にテスト）
- 空白だけ・1000字超え・HTML を含む相談 → 前の2つは 400、HTML は文字のまま表示され、OGP でもエスケープされる（Task 7・11 にテスト）
- 共有した相談を持ち主が消す・非公開に戻す → 検索・似た悩み・sitemap から消え、共有ページは 404（Task 8・9 にテスト）
- 同じ人が「刺さった」を何度も押す → 哲学者ごとに1回だけ数える（Task 8 にテスト）。2文字の言葉（「恋愛」）でも検索できる（Task 9 にテスト）

---

## ファイルの地図

```
shared/   site.ts（定数）  themes.ts  schools.ts  crisis.ts  api.ts（API の型）
          philosophers/{types.ts, index.ts, data/<id>.ts ×38}
          similarity.ts  nunu/{answers.json, index.ts}
          prompt.ts  answerStream.ts
worker/   index.ts  env.ts  http.ts  ids.ts  owner.ts  limits.ts  turnstile.ts  pages.ts  crawl.ts
          gemini/{models.ts, client.ts, generate.ts}  fakeAi.ts  ai.ts
          db/{consultations.ts, hearts.ts, shared.ts, reports.ts, usage.ts}
          routes/{consult.ts, consultations.ts, me.ts, shared.ts, reports.ts, admin.ts}
src/      main.tsx  App.tsx  api.ts  buttons.ts  index.css  draft.ts  useConsultStream.ts
          components/{Layout, DeveloperFooter, Portrait, ConsultForm, CompareTable, AnswerCard, InfoSheet,
                      NunuSection, MyAnswer, SharePanel, HeartButton, CrisisBanner, SharedList, XPostLink, ConfirmButton}.tsx
          pages/{Home, Consultation, Search, Theme, Philosophers, Philosopher, Me, Terms, Privacy, Admin, NotFound}.tsx
public/   portraits/<id>.svg ×38  favicon.svg  og.png
migrations/0001_init.sql
scripts/  nunu-fetch.mjs  eval.mjs  eval/cases.json
test/     *.test.ts（shared と worker）   e2e/*.spec.ts
docs/     portrait-style.md  nunu-review.md
```

---

### Task 1: 土台（ビルド・テスト・ルールの文書）

**Files:**
- Create: `package.json`, `vite.config.ts`, `vitest.config.ts`, `tsconfig*.json`（4つ。性癖カルテと同じ分け方）, `playwright.config.ts`, `wrangler.jsonc`, `index.html`, `.gitignore`, `.dev.vars.example`, `.claude/launch.json`, `worker/index.ts`, `worker/env.ts`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `shared/site.ts`, `test/apply-migrations.ts`, `migrations/0001_init.sql`（空の表1つでよい。Task 7 で中身）, `CLAUDE.md`, `task.md`
- Test: `test/health.test.ts`

**Interfaces:**
- Produces: `AppEnv`（`worker/env.ts`。`Env & Secrets`。Secrets は `GEMINI_API_KEY? ADMIN_TOKEN? TURNSTILE_SECRET_KEY? TURNSTILE_SITE_KEY? TURNSTILE_HOSTNAMES? AI_FAKE? REPORTER_KEY?`）、`SITE_NAME = "哲マロ(ぬ)"`, `SITE_URL = "https://tetsumaro.oshilog.life"`, `TOP_TITLE = "哲マロ(ぬ)｜悩みを哲学者たちに相談できる"`, `TURNSTILE_SITE_KEY`（本物ができるまで Cloudflare のテスト用 `1x00000000000000000000AA`）

- [ ] **Step 1:** 性癖カルテ（`D:\Dev\性癖カルテ`）の同名ファイルを写し、名前を `tetsumaro` にする。wrangler.jsonc: `name: "tetsumaro"`, `main: ./worker/index.ts`, `assets.not_found_handling: "none"`, `run_worker_first: ["/", "/api/*", "/c/*", "/philosophers/*", "/theme/*", "/robots.txt", "/sitemap.xml"]`, d1 `binding: DB, database_name: tetsumaro, database_id: 00000000-0000-0000-0000-000000000000`（作ったら差し替え）, ratelimits `CONSULT_LIMIT(2001, 3/60)`, `WRITE_LIMIT(2002, 60/60)`, `READ_LIMIT(2003, 300/60)`, `REPORT_LIMIT(2004, 5/60)`, `SEARCH_LIMIT(2005, 20/60)`, observability on。依存: hono, react, react-dom, react-router, zod ＋ 性癖カルテと同じ devDependencies
- [ ] **Step 2:** テスト `GET /api/health` が `{ ok: true }` を返す
- [ ] **Step 3:** `npm install` → `npm run cf-typegen` → `npm test` が通る、`npm run build` が通る
- [ ] **Step 4:** CLAUDE.md（入口の表・決まり・コマンド）と task.md（状態・決定事項・ぬぬはらの操作が要るもの＝設計書 12章）を書く
- [ ] **Step 5:** commit「土台を作る」→ `git push -u origin main`

### Task 2: 定数・テーマ・学派・重い相談

**Files:** Create `shared/site.ts`（追記）, `shared/themes.ts`, `shared/schools.ts`, `shared/crisis.ts` / Test `test/themes.test.ts`, `test/crisis.test.ts`

**Interfaces:**
- Produces:
  - `shared/site.ts`: `BODY_MAX=1000, MY_ANSWER_MAX=200, NAME_MAX=20, DAILY_PER_OWNER=10, ANSWER_COUNT=7, MORE_COUNT=2, MIN_PHILOSOPHY=5`, `type Mode = "general" | "adult"`, `AGE_BANDS: readonly {id:"10s"|"20s"|"30s"|"40s"|"50s"|"60s", label}[]`, `GENDERS: readonly {id:"female"|"male"|"other", label}[]`
  - `shared/themes.ts`: `CATEGORIES: readonly {id: CategoryId; name: string}[]`（設計書 6章の10＋`other`）, `TAGS: readonly {id: string; name: string; category: CategoryId}[]`（50前後）, `isCategory(v: unknown): v is CategoryId`, `normalizeTags(v: unknown): string[]`（知っている id だけ・重複なし・3つまで）, `categoryName(id)`, `tagName(id)`
  - `shared/schools.ts`: `type School = {id: string; name: string; desc: string}`, `SCHOOLS: Record<string, School>`, `schoolById(id)`
  - `shared/crisis.ts`: `looksCrisis(text: string): boolean`, `HOTLINES: readonly {name: string; tel?: string; hours: string; url: string}[]`（いのちの電話・よりそいホットライン・24時間子供SOSダイヤル・厚労省「まもろうよ こころ」。番号は厚労省のページで確かめてから書く）
  - `shared/personalInfo.ts`: `findPersonalInfo(text: string): ("tel" | "email" | "url")[]`（共有の前に知らせる）

- [ ] **Step 1:** テスト: `normalizeTags(["x", tag0, tag0, tag1, tag2, tag3])` → `[tag0, tag1, tag2]`；`normalizeTags("a")` → `[]`；全タグの category が CATEGORIES にある；`looksCrisis("もう死にたい")`・`looksCrisis("消えたい")`・`looksCrisis("リスカしてしまう")` が true、`looksCrisis("死生観について知りたい")` が false；`findPersonalInfo("090-1234-5678 に連絡")` → `["tel"]`、`findPersonalInfo("a@b.jp")` → `["email"]`、`findPersonalInfo("2024年の春")` → `[]`
- [ ] **Step 2:** 失敗を確かめる → 実装 → 通す
- [ ] **Step 3:** commit「テーマ・学派・重い相談の言葉」

### Task 3: 哲学者の名簿の型と見本2人

**Files:** Create `shared/philosophers/types.ts`, `shared/philosophers/index.ts`, `shared/philosophers/data/socrates.ts`, `.../nietzsche.ts` / Test `test/philosophers.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type Field = "philosophy" | "psychology" | "practical";
  type Group = "ancient" | "eastern" | "modern" | "contemporary" | "japan" | "psychology" | "practical";
  type Concept = { id: string; name: string; desc: string };   // id は "<人の id>.<英小文字>"
  type Quote = { id: string; text: string; source: string };    // id は "<人の id>.q<番号>"
  type Philosopher = {
    id: string; name: string; kana: string; years: string; region: string;
    field: Field; group: Group; school: string | null;   // SCHOOLS の id
    color: string;                                        // "#RRGGBB"。絵の背景と画面の色
    oneLine: string;                                      // この人の考え方（40字以内）
    core: string; works: string[]; concepts: Concept[]; quotes: Quote[];
    avoid: string[]; voice: string;
    heavyTheme?: boolean;        // 死や苦しみを扱う思想。カードに注意書きを付ける
    generalNote?: string;        // 一般向けのときだけ指示文に足す（フロイトなど）
  };
  ```
  `PHILOSOPHERS: readonly Philosopher[]`（グループ順）, `philosopherById(id): Philosopher | undefined`, `conceptById(id): Concept | undefined`, `quoteById(id): Quote | undefined`, `ROSTER_IDS: readonly string[]`（38人の id。並び＝設計書 3章の表）

- [ ] **Step 1:** テスト（名簿全体に対して回す）: id が `ROSTER_IDS` と同じ集合（Task 3b までは「入っている人について」だけ確かめ、`ROSTER_IDS` の長さ 38 を確かめる）／概念・名言の id が人の id で始まり重複しない／概念 2〜6個・名言 0〜4個／school が null か SCHOOLS にある／color が `#RRGGBB`／oneLine 40字以内
- [ ] **Step 2:** 実装し、ソクラテスとニーチェを手で書く（設計書 3章の項目すべて）→ 通す
- [ ] **Step 3:** commit「哲学者の名簿の型とソクラテス・ニーチェ」

### Task 3b: 名簿の残り36人

**Files:** Create `shared/philosophers/data/<id>.ts` ×36, Modify `shared/philosophers/index.ts`, `shared/schools.ts`

- [ ] **Step 1:** 6人ずつに分けて書く（並列可）。名言は**出典（作品名と巻・章が分かればそれも）を確かに言えるものだけ**。迷うものは載せない。言わせないことに、よくある誤解を必ず1つ以上
- [ ] **Step 2:** Task 3 のテストを「38人全員がいる」に強めて通す
- [ ] **Step 3:** commit「名簿の残り36人」

### Task 4: 近さの計算とぬぬはらのデータの入口

**Files:** Create `shared/similarity.ts`, `shared/nunu/index.ts`, `shared/nunu/answers.json`（Task 16 までは見本3件） / Test `test/similarity.test.ts`, `test/nunu.test.ts`

**Interfaces:**
- Produces: `buildIndex(docs: {id: string; text: string}[]): TextIndex`, `rank(index: TextIndex, query: string, k: number): {id: string; score: number}[]`（文字2-gram の TF-IDF とコサイン。空白・記号は捨てる。score 0 は返さない）；`type NunuAnswer = {id: string; url: string; date: string; question: string; answer: string; audience: "general" | "adult"; category: CategoryId}`, `NUNU_ANSWERS: readonly NunuAnswer[]`, `relatedNunu(query: string, mode: Mode, k = 3): NunuAnswer[]`, `nunuById(id)`
- [ ] **Step 1:** テスト: 「彼氏と別れた」は恋愛の文書を、「上司が怖い」は仕事の文書を一番上に返す／関係ない文には何も返さない／`relatedNunu(q, "general")` は audience が adult のものを返さない
- [ ] **Step 2:** 実装 → 通す → commit「近さの計算とぬぬはらの関連回答」

### Task 5: 指示文と答えの読み取り

**Files:** Create `shared/prompt.ts`, `shared/answerStream.ts`, `shared/api.ts` / Test `test/prompt.test.ts`, `test/answerStream.test.ts`

**Interfaces:**
- Produces:
  - `shared/api.ts`:
    ```ts
    type MetaEvent = { type: "meta"; category: CategoryId; tags: string[]; crisis: boolean; picks: string[] };
    type AnswerEvent = { type: "answer"; philosopher: string; conclusion: string; body: string; concepts: string[]; quote: string | null };
    type NunuEvent = { type: "nunu"; body: string; related: string[] };   // related は NunuAnswer の id（サーバーが付ける）
    type StreamEvent = { type: "start"; id: string } | MetaEvent | AnswerEvent | NunuEvent | { type: "done"; status: "done" | "partial" } | { type: "error"; code: ErrorCode };
    type ErrorCode = "too_long" | "empty" | "rate_limited" | "daily_owner_limit" | "turnstile" | "ai_daily_limit" | "ai_unavailable" | "ai_failed" | "not_found";
    type ConsultationView = { id; mode; body; category; tags; crisis; createdAt; sharedAt: number | null; displayName: string | null; myAnswer: string | null; myPicks: string[]; answers: AnswerEvent[]; nunu: NunuEvent | null; hearts: Record<string, number>; isOwner: boolean; status: "pending" | "done" | "partial" };
    type SharedItem = { id; excerpt: string; category; tags: string[]; sharedAt: number; displayName: string | null; topPhilosopher: string | null; heartTotal: number };
    ```
  - `shared/prompt.ts`: `buildConsultPrompt(input: { body: string; mode: Mode; nunuExamples: NunuAnswer[]; count: number; exclude: string[] }): { system: string; user: string }`。system は名簿全員（oneLine・core・concepts の id と名前・quotes の id と本文・avoid・voice・school）と出力の決まり（設計書 4章の3種の行、7人の選び方、結論30字以内、本文250〜400字、heavyTheme の人も思想をゆがめない、病気・法律の判断はしない）。user は相談文と手本と count・exclude
  - `shared/answerStream.ts`: `class LineSplitter { push(chunk: string): string[]; flush(): string[] }`, `parseEvent(line: string): MetaEvent | AnswerEvent | Omit<NunuEvent, "related"> | null`（zod。``` で囲まれた行や前置きは null。concepts・quote は名簿にない id を捨て、quote は本人のものだけ。conclusion は30字、body は600字で切る）, `type PickState = { answered: string[]; count: number; exclude: string[] }`, `acceptAnswer(state: PickState, a: AnswerEvent): boolean`（名簿にいる・exclude と answered にいない・同じ学派がまだいない・count 未満・count が7のときは哲学者以外が2人まで）
- [ ] **Step 1:** テスト: 3つに割れて届いた行を LineSplitter がつなぐ／`parseEvent` が壊れた JSON・未知の type を null にする／名簿にない概念を捨てる／他人の名言の id を null にする／`acceptAnswer` がセネカの後のエピクテトス（同じストア派）を断る・8人目を断る・心理学3人目を断る／system に38人全員の id が入る／exclude の人が user に「答えない人」として入る
- [ ] **Step 2:** 実装 → 通す → commit「指示文と答えの読み取り」

### Task 6: Gemini の呼び出しと偽の AI

**Files:** Create `worker/gemini/models.ts`, `worker/gemini/client.ts`, `worker/gemini/generate.ts`, `worker/fakeAi.ts`, `worker/ai.ts` / Test `test/gemini.test.ts`, `test/fakeAi.test.ts`

**Interfaces:**
- Produces:
  - `GEMINI_MODELS: readonly string[]`（品質の高い順。実装時に models API で無料枠のモデルを確かめて決める。TopicStream の `src/lib/constants.ts` の一覧が出発点）, `thinkingConfigFor(model)`
  - `class GeminiError extends Error { kind: "busy" | "daily_limit" | "auth" | "bad_request" | "network" }`
  - `streamGemini(opts: { apiKey: string; model: string; system: string; user: string; signal?: AbortSignal }): AsyncGenerator<string>`（`:streamGenerateContent?alt=sse`、`x-goog-api-key`、text/plain の出力。SSE の各 data から text を取り出して yield）
  - `generateText(opts: { apiKey; system; user; signal? }): AsyncGenerator<string>`（モデルを順に試す。最初の文字が来る前の busy・network は次のモデルへ。混んだモデルは2分後回し。daily_limit は全部のモデルで出たら投げる）, `lastModel(): string`
  - `fakeAiStream(opts: { count: number; exclude: string[]; mode: Mode }): AsyncGenerator<string>`（名簿の先頭から acceptAnswer を満たす人を選び、meta・answer・nunu の行を少しずつ yield）
  - `aiStream(env: AppEnv["Bindings"], prompt: {system; user}, opts: {count; exclude; mode}): AsyncGenerator<string>`（キーが無い・`AI_FAKE === "1"` なら偽）
- [ ] **Step 1:** テスト（fetch を差し替える）: 1つ目のモデルが 503 なら2つ目の答えを返す／429 の日の枠切れが全モデルで出たら `GeminiError("daily_limit")`／SSE の data を text に戻す／偽の AI の出力を LineSplitter と parseEvent に通すと meta 1・answer count・nunu 1 になる
- [ ] **Step 2:** 実装 → 通す → commit「Gemini の呼び出しと偽の AI」

### Task 7: 相談を送る（D1・持ち主・流す）

**Files:** Modify `migrations/0001_init.sql`, Create `worker/ids.ts`, `worker/http.ts`, `worker/owner.ts`, `worker/db/consultations.ts`, `worker/db/usage.ts`, `worker/routes/consult.ts`, Modify `worker/index.ts` / Test `test/consult.test.ts`

**Interfaces:**
- Produces:
  - 表（設計書 6章）: `owners(id, key_hash UNIQUE, created_at)`, `consultations(id PK, owner_id, mode, body, category, tags JSON, crisis INT, age_band, gender, created_at, shared_at, display_name, my_answer, my_picks JSON, hidden_at, model, status)`, `answers(consultation_id, philosopher_id, slot, conclusion, body, concepts JSON, quote_id, PK(consultation_id, philosopher_id))`, `nunu_answers(consultation_id PK, body, related JSON)`, `hearts(consultation_id, philosopher_id, voter_hash, created_at, PK(三つ))`, `reports(id, consultation_id, reason, reporter_hash, created_at)`, `shared_fts`（FTS5 trigram、content は consultation_id・body・my_answer）, `ai_usage(day PK, calls, failures)`。index: `consultations(owner_id, created_at)`, `consultations(shared_at) WHERE shared_at IS NOT NULL AND hidden_at IS NULL`, `consultations(category, shared_at)`
  - `newId(): string`（URL に使える16文字）, `readBody(c, schema)`（性癖カルテと同じ）
  - `ownerOf(c): Promise<{id: string} | null>`, `ensureOwner(c): Promise<{id: string}>`（Cookie `owner`、httpOnly・Secure・Lax・400日、鍵は SHA-256 で保存）
  - `insertConsultation(db, row)`, `saveResult(db, id, {meta, answers, nunu, model, status})`, `loadConsultation(db, id): Promise<ConsultationView-の元 | null>`, `countToday(db, ownerId, now): Promise<number>`
  - `POST /api/consult` 本文 `{ body: string; ageBand?: AgeBandId; gender?: GenderId; turnstile?: string }` → `application/x-ndjson`。前置きの検証で弾くものは JSON の 400/403/429（`{error: ErrorCode}`）、AI の失敗は流れの中の `{type:"error"}`。流れは `ctx.waitUntil` で最後まで読み、届いた答えを保存する（7人そろえば done、1人以上なら partial、0人なら行を消して error）。`relatedNunu` の id を nunu 行の related に入れる。重い相談は AI の印か `looksCrisis` のどちらか
- [ ] **Step 1:** テスト（偽の AI）: 送ると start・meta・answer×7・nunu・done が順に来て、`loadConsultation` で7人が読める／空白だけ → 400 `empty`、1001字 → 400 `too_long`／同じ端末の11回目 → 429 `daily_owner_limit`／偽の AI を途中で止めた（3人で終わる）→ done の status が partial で3人保存／流れを途中で読み捨てても保存される／「死にたい」を含む相談は crisis が true
- [ ] **Step 2:** 実装 → 通す → commit「相談を送って回答を流す」

### Task 8: 相談のページの API（読む・直す・共有・消す・刺さった）

**Files:** Create `worker/routes/consultations.ts`, `worker/routes/me.ts`, `worker/db/hearts.ts` / Test `test/consultations.test.ts`

**Interfaces:**
- Consumes: Task 7 の表と `ownerOf`
- Produces: `GET /api/consultations/:id` → `ConsultationView`（持ち主か、共有中で隠されていない。ほかは 404）、`PATCH`（持ち主。`{myAnswer?, myPicks?, displayName?, body?}`。body は共有前だけ）、`PUT/DELETE /api/consultations/:id/share`、`DELETE /api/consultations/:id`（answers・nunu・hearts・reports・shared_fts ごと）、`POST /api/consultations/:id/hearts {philosopherId}`（共有中のものだけ。押した人は回線と相談 id の HMAC。同じ人・同じ哲学者は1回。返り値は新しい数）、`POST /api/consultations/:id/more`（持ち主。MORE_COUNT 人を流す。exclude は既にいる人）、`GET /api/me/consultations` → `{id, excerpt, createdAt, sharedAt}[]`
- [ ] **Step 1:** テスト: 持ち主でない人は非公開の相談を読めない（404）・共有後は読める・非公開に戻すとまた 404／消すと読めず、hearts も残らない／同じ人が同じ哲学者を2回押しても 1／共有後は body を直せない（400）／more で2人増え、前の7人と重ならない
- [ ] **Step 2:** 実装 → 通す → commit「相談の読み書き・共有・刺さった」

### Task 9: みんなの相談（一覧・検索・似た悩み）

**Files:** Create `worker/db/shared.ts`, `worker/routes/shared.ts` / Test `test/shared.test.ts`

**Interfaces:**
- Produces: `GET /api/shared?q&category&tag&philosopher&sort=new|hearts&cursor` → `{items: SharedItem[]; next: string | null}`（20件ずつ。q は3文字以上 FTS5、2文字以下 LIKE。philosopher は「相談者が刺さった人か、見た人の刺さったが一番多い人」）、`GET /api/shared/:id/similar` → `SharedItem[]`（同じ大分類で小分類が多く重なる順→新しい順、6件、自分は除く）。共有・非公開・消す・隠すで `shared_fts` を出し入れする関数 `indexShared(db, id)`, `unindexShared(db, id)`
- [ ] **Step 1:** テスト: 「恋愛」（2文字）でも「上司が怖い」（5文字）でも見つかる／非公開に戻したもの・隠したもの・消したものは出ない／category で絞れる／similar が自分を含まない
- [ ] **Step 2:** 実装 → 通す → commit「みんなの相談の一覧と検索」

### Task 10: 通報・管理・連投対策・Turnstile

**Files:** Create `worker/limits.ts`, `worker/turnstile.ts`, `worker/db/reports.ts`, `worker/routes/reports.ts`, `worker/routes/admin.ts` / Test `test/reports.test.ts`, `test/limits.test.ts`

**Interfaces:**
- Produces: `rateLimit` middleware（GET→READ、`POST /api/consult` と `/more`→CONSULT、通報→REPORT、`/api/shared?q`→SEARCH、ほか→WRITE。手元の IP は数えない）、`requireTurnstile(c, token, "consult" | "report")`（性癖カルテと同じ。シークレットが無ければ通す）、`POST /api/reports {consultationId, reason}`（同じ人は1回。3人で自動で hidden_at を入れる）、`/api/admin/*`（`Authorization: Bearer <ADMIN_TOKEN>`。無ければ 404）: `GET reports`, `POST consultations/:id/hide`, `POST consultations/:id/unhide`, `PATCH consultations/:id/theme {category, tags}`
- [ ] **Step 1:** テスト: 3人の通報で共有一覧から消える／ADMIN_TOKEN が無いと admin は 404、違う合言葉は 401／偽の RateLimit が false を返すと 429
- [ ] **Step 2:** 実装 → 通す → commit「通報・管理・連投の歯止め」

### Task 11: 画面の配信・OGP・robots・sitemap

**Files:** Create `worker/pages.ts`, `worker/crawl.ts`, Modify `worker/index.ts` / Test `test/pages.test.ts`

**Interfaces:**
- Produces: 画面のパス（`/`, `/c/:id`, `/search`, `/theme/:category`, `/philosophers`, `/philosophers/:id`, `/me`, `/terms`, `/privacy`, `/admin`）は index.html を返す。`/c/:id` は共有中なら title「<相談の先頭40字>…｜哲マロ(ぬ)」と og:description（結論の一言を3つ）、そうでなければ `noindex` と一般の題名。`/philosophers/:id`・`/theme/:category` は名前入りの題名、知らない id は 404 の画面。`/me`・`/admin` は noindex。`robots.txt`（`/api/` `/me` `/admin` を Disallow、sitemap の場所）、`sitemap.xml`（トップ・名簿・38人・テーマ・共有中の相談 新しい順 1000件）
- [ ] **Step 1:** テスト: 相談に `<script>` を書いて共有 → `/c/:id` の HTML の title にエスケープされて入る／非公開の `/c/:id` は noindex で相談文が HTML に出ない／知らない `/philosophers/xxx` は 404／sitemap に非公開の相談が出ない
- [ ] **Step 2:** 実装 → 通す → commit「画面の配信と OGP」

### Task 12: 画面の骨組み（見た目の決まり・共通部品・規約）

**Files:** Create `src/buttons.ts`（性癖カルテから写す）, `src/components/{Layout, DeveloperFooter, XPostLink, ConfirmButton, Portrait}.tsx`, `src/pages/{Terms, Privacy, NotFound}.tsx`, `src/api.ts`, Modify `src/App.tsx`, `src/index.css`, `index.html`

**Interfaces:**
- Produces: Tailwind のテーマ（`--color-ink #1E1B3A` 文字、`--color-paper #FBF8F3` 背景、`--color-brand #3B4FE0` 主ボタン、`--color-brand-link`）、フォント Zen Kaku Gothic New、`Portrait({id, size})`（`/portraits/<id>.svg`、alt は名前）、`api.get<T>(path)`, `api.send<T>(method, path, body)`（エラーは `ApiError{status, code}`）、DeveloperFooter（性癖カルテと同じ内容。関連サービスは エゴサ支援ツール `D:\Dev\TwitterEgoSearch_Nu\src\components\developer-info.tsx` と同じ並びで、性癖カルテ(ぬ)も入れる）
- [ ] **Step 1:** 規約とプライバシーは性癖カルテの `src/pages/TermsPage.tsx`・`PrivacyPage.tsx` の型を写し、設計書 9章の内容（Gemini の無料枠・個人情報・集計・消し方・AIぬぬはら・思想の紹介）に書き直す
- [ ] **Step 2:** `npm run build` と `npm run typecheck` が通る。画面を開いてスクリーンショットで崩れがないか見る
- [ ] **Step 3:** commit「画面の骨組みと規約」

### Task 13: 相談して回答を見る画面

**Files:** Create `src/draft.ts`, `src/useConsultStream.ts`, `src/components/{ConsultForm, CompareTable, AnswerCard, InfoSheet, NunuSection, MyAnswer, SharePanel, HeartButton, CrisisBanner}.tsx`, `src/pages/{Home, Consultation}.tsx`

**Interfaces:**
- Consumes: Task 5 の型、Task 7・8 の API
- Produces: `useConsultStream()` → `{ state: {id: string | null; meta: MetaEvent | null; answers: AnswerEvent[]; nunu: NunuEvent | null; status: "idle" | "streaming" | "done" | "partial" | "error"; error: ErrorCode | null}; start(input); more(id) }`（fetch の body を読み、LineSplitter で行に分ける。start 行で `/c/:id` へ URL を置き換える）、`draft.ts`: `loadDraft()`, `saveDraft(text)`, `clearDraft()`（送れたら消す）
- [ ] **Step 1:** 設計書 2章の通りに並べる。ConsultForm に任意の年代・性別。SharePanel は `findPersonalInfo` で見つかったら公開の前に知らせる。InfoSheet は概念・学派を押すと下から出る（Esc と外側で閉じる、フォーカスを中へ）。heavyTheme の人のカードに注意書き。CrisisBanner は crisis のとき回答の上
- [ ] **Step 2:** 手元で偽の AI を使って一通り動かし、スマホ幅（375px）と PC 幅のスクリーンショットで確かめる
- [ ] **Step 3:** commit「相談して回答を見る画面」

### Task 14: みんなの相談・名簿・自分の相談・管理の画面

**Files:** Create `src/components/SharedList.tsx`, `src/pages/{Search, Theme, Philosophers, Philosopher, Me, Admin}.tsx`

- [ ] **Step 1:** Search は言葉・大分類・小分類・哲学者・並びで絞り、URL の query に持つ（戻ったら同じ絞り込み）。Philosopher は名簿の全項目とその人が刺さった相談。Admin は合言葉を入れて通報の一覧・隠す・戻す・分類を直す
- [ ] **Step 2:** スクリーンショットで確かめる → commit「みんなの相談・名簿・管理の画面」

### Task 15: 38人の絵

**Files:** Create `docs/portrait-style.md`, `public/portraits/<id>.svg` ×38

- [ ] **Step 1:** 決まりを書く: viewBox `0 0 200 220`、背景は角丸なしの四角に淡い色（人の color を薄めたもの）と大きな円、上半身を面で塗り分けたポリゴン（光の当たる面と影の面の2〜3段）、線は使わない、肌は3色の中から、顔は目・眉・鼻の面だけ、その人らしいしぐさか小物を1つ（人ごとの一覧を表で）、文字を入れない
- [ ] **Step 2:** ソクラテスとニーチェを描いて決まりを固める（会話で見せた見本が出発点）→ 残りを6人ずつ描く（並列可）
- [ ] **Step 3:** 名簿ページのスクリーンショットで全員を並べて、タッチがそろっているか見る → commit「38人の絵」

### Task 16: ぬぬはらのデータ

**Files:** Create `scripts/nunu-fetch.mjs`, Modify `shared/nunu/answers.json`, Create `docs/nunu-review.md`

- [ ] **Step 1:** `npm run nunu:fetch`: 一覧 `https://marshmallow-qa.com/users/3745329/answers`（`Accept: application/json`、続きは `?before=<最後の updated_at>`、404 で終わり）→ 1件ずつ `https://marshmallow-qa.com/messages/<uuid>` の HTML から質問と回答を取る（入れ子の div があるので HTML を正しく読む）。すでにある id の audience と category は上書きしない
- [ ] **Step 2:** 新しい件に audience と category を付ける（読んで判断。性的な内容・自傷の具体的な方法は adult）→ `docs/nunu-review.md` に「id・質問の先頭・付けた印」の表を書き出す
- [ ] **Step 3:** Task 4 のテストが通る → commit「ぬぬはらのマシュマロ回答を取り込む」

### Task 17: E2E

**Files:** Create `e2e/helpers.ts`, `e2e/consult.spec.ts`, `e2e/share.spec.ts`, `e2e/browse.spec.ts`

- [ ] **Step 1:** consult: 相談を書いて送る → 7枚のカードと比べ表 → 概念を押すと補足が出て Esc で閉じる → 刺さった → 自分の答えを保存 → 再読み込みしても残る。share: 共有 → 別の端末（新しい context）で `/c/:id` が見え、刺さったを押せる → みんなの相談の検索で出る → 持ち主が非公開に戻すと別の端末で 404。browse: 名簿 → 一人のページ → 学派の補足
- [ ] **Step 2:** `npm run e2e` が通る → commit「E2E」

### Task 18: 回答の質を確かめるスクリプト

**Files:** Create `scripts/eval.mjs`, `scripts/eval/cases.json`

- [ ] **Step 1:** cases.json に試験用の相談20件（大分類を一通り、重い相談を2件、短すぎる相談を1件）。eval.mjs は手元の開発サーバー（`http://localhost:5173`）に1件ずつ送り、`docs/eval/<日付>.md` に相談ごとの7人の結論・本文・概念・名言を書き出す（Cookie を付けないので端末の上限にかからない）
- [ ] **Step 2:** 偽の AI で一度動かして形を確かめる（本物のキーで回すのはキーができてから）→ commit「回答の質を確かめるスクリプト」

### Task 19: レビュー方針と引き継ぎ

**Files:** Create `~/.claude/skills/quality-review/projects/哲マロ.md`（リポジトリの外）, Modify `task.md`, `CLAUDE.md`

- [ ] **Step 1:** projects ファイル: 性癖カルテの形で、前提・一番大事な体験・変えたくない所・重点（設計書 11章の順）・SEO（出す: トップ・名簿・テーマ・共有中の相談／出さない: 非公開の相談・/me・/admin・API）・範囲の呼び名・コマンド・既知の残課題
- [ ] **Step 2:** task.md にぬぬはらの操作が要るもの（設計書 12章）を手順つきで、残課題とあわせて書く
- [ ] **Step 3:** `npm test`・`npm run typecheck`・`npm run build`・`npm run e2e` を全部通す → commit「レビュー方針と引き継ぎ」→ push
