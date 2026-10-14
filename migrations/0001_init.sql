-- 端末の持ち主（ログインの代わり）。Cookie の owner に入れた鍵の SHA-256 だけを残す（worker/owner.ts）
CREATE TABLE owners (
	id TEXT PRIMARY KEY,
	key_hash TEXT NOT NULL UNIQUE,
	created_at INTEGER NOT NULL
);

-- 相談。shared_at が入っていて hidden_at が空のものだけが、みんなの相談に出る
CREATE TABLE consultations (
	id TEXT PRIMARY KEY,
	owner_id TEXT NOT NULL,
	-- general（一般向け）/ adult（大人向け。後で開く）
	mode TEXT NOT NULL DEFAULT 'general',
	body TEXT NOT NULL,
	-- 大分類と小分類（shared/themes.ts の id。tags は JSON の配列）
	category TEXT NOT NULL DEFAULT 'other',
	tags TEXT NOT NULL DEFAULT '[]',
	-- 重い相談（AI の印か、shared/crisis.ts の言葉）
	crisis INTEGER NOT NULL DEFAULT 0,
	-- 任意の年代・性別（集計にだけ使う。ほかの人には見せない）
	age_band TEXT,
	gender TEXT,
	created_at INTEGER NOT NULL,
	shared_at INTEGER,
	display_name TEXT,
	my_answer TEXT,
	-- 相談者が刺さった人（JSON の配列。哲学者の id か "nunu"）
	my_picks TEXT NOT NULL DEFAULT '[]',
	-- 管理画面か通報で隠した時刻
	hidden_at INTEGER,
	-- 書いたモデル（fake は偽の AI）
	model TEXT,
	-- pending（書いている途中）/ done（7人そろった）/ partial（途中で切れた）
	status TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX consultations_owner ON consultations (owner_id, created_at);
CREATE INDEX consultations_shared ON consultations (shared_at) WHERE shared_at IS NOT NULL AND hidden_at IS NULL;
CREATE INDEX consultations_category ON consultations (category, shared_at);

-- 哲学者ごとの回答。slot は画面に出す順
CREATE TABLE answers (
	consultation_id TEXT NOT NULL,
	philosopher_id TEXT NOT NULL,
	slot INTEGER NOT NULL,
	conclusion TEXT NOT NULL,
	body TEXT NOT NULL,
	concepts TEXT NOT NULL DEFAULT '[]',
	quote_id TEXT,
	PRIMARY KEY (consultation_id, philosopher_id)
);

-- AIぬぬはらの回答と、関連したマシュマロ回答の id（JSON の配列）
CREATE TABLE nunu_answers (
	consultation_id TEXT PRIMARY KEY,
	body TEXT NOT NULL,
	related TEXT NOT NULL DEFAULT '[]'
);

-- 見た人の「刺さった」。押した人は回線と相談の id から作った HMAC（worker/ipHash.ts）。同じ人・同じ哲学者は1回
CREATE TABLE hearts (
	consultation_id TEXT NOT NULL,
	philosopher_id TEXT NOT NULL,
	voter_hash TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	PRIMARY KEY (consultation_id, philosopher_id, voter_hash)
);

-- 通報。同じ人は1つの相談に1回
CREATE TABLE reports (
	id TEXT PRIMARY KEY,
	consultation_id TEXT NOT NULL,
	reason TEXT NOT NULL,
	reporter_hash TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	UNIQUE (consultation_id, reporter_hash)
);

-- 共有された相談の全文検索（3文字以上の言葉。2文字以下は LIKE で探す。worker/db/shared.ts）
CREATE VIRTUAL TABLE shared_fts USING fts5 (consultation_id UNINDEXED, body, my_answer, tokenize = 'trigram');

-- Gemini を呼んだ回数と失敗の数（日本時間の日ごと）。無料枠に近いかを見る
CREATE TABLE ai_usage (
	day TEXT PRIMARY KEY,
	calls INTEGER NOT NULL DEFAULT 0,
	failures INTEGER NOT NULL DEFAULT 0
);
