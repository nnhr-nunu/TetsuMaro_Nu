import { type D1Migration, applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { CURATED_OWNER } from "../shared/site";

const migrations = (env as unknown as { TEST_MIGRATIONS: D1Migration[] }).TEST_MIGRATIONS;
await applyD1Migrations(env.DB, migrations);

// 見本の相談（migrations の *_curated.sql）は、テストの一覧・検索の結果に混ざらないよう消しておく（見本の扱いは curated.test.ts）
await env.DB.batch([
	env.DB.prepare("DELETE FROM shared_fts WHERE consultation_id IN (SELECT id FROM consultations WHERE owner_id = ?)").bind(CURATED_OWNER),
	env.DB.prepare("DELETE FROM answers WHERE consultation_id IN (SELECT id FROM consultations WHERE owner_id = ?)").bind(CURATED_OWNER),
	env.DB.prepare("DELETE FROM nunu_answers WHERE consultation_id IN (SELECT id FROM consultations WHERE owner_id = ?)").bind(CURATED_OWNER),
	env.DB.prepare("DELETE FROM consultations WHERE owner_id = ?").bind(CURATED_OWNER),
]);
