import type { Context } from "hono";
import type { z } from "zod";

/**
 * リクエスト本文を JSON として読み、スキーマで確かめる。読めない・合わないときは null。
 * Content-Type が JSON でないものは読まない。他サイトのフォーム送信（text/plain など）で書き込みが起きないようにするため（性癖カルテと同じ）
 */
export async function readBody<T>(c: Context, schema: z.ZodType<T>): Promise<T | null> {
	if (!/^application\/json\b/i.test(c.req.header("content-type") ?? "")) return null;
	const raw: unknown = await c.req.json().catch(() => null);
	const parsed = schema.safeParse(raw);
	return parsed.success ? parsed.data : null;
}
