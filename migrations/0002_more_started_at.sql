-- 「ほかの哲学者にも聞く」を書いている途中の印（始めた時刻）。同時に2回押されても1回だけ通すため、条件付きの UPDATE で取る
-- （worker/db/consultations.ts の takeMore）。終われば外す。途中で落ちても、一定時間たてば取り直せる
ALTER TABLE consultations ADD COLUMN more_started_at INTEGER;
