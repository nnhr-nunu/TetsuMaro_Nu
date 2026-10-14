import { type Context, Hono } from "hono";
import { philosopherById } from "../shared/philosophers";
import { SITE_NAME } from "../shared/site";
import { categoryName, isCategory } from "../shared/themes";
import { loadConsultation } from "./db/consultations";
import type { AppEnv } from "./env";

/**
 * 画面の index.html を、ページごとの題名・説明・リンクカード（OGP）・noindex に書き換えて返す。
 * 値は setAttribute と setInnerContent に渡し、HTMLRewriter にエスケープさせる（相談は利用者が書いた文なので、HTML を組み立てない）
 */
type PageMeta = { title?: string; description?: string; noindex?: boolean };

/** 相談の題名に入れる先頭の長さ */
const TITLE_EXCERPT = 30;

export function rewriteMeta(html: Response, meta: PageMeta, pageUrl: string): Response {
	const set = (content: string | undefined) => ({
		element(el: Element) {
			if (content !== undefined) el.setAttribute("content", content);
		},
	});
	return new HTMLRewriter()
		.on("title", {
			element(el) {
				if (meta.title !== undefined) el.setInnerContent(meta.title);
			},
		})
		.on('meta[name="description"]', set(meta.description))
		.on('meta[property="og:title"]', set(meta.title))
		.on('meta[property="og:description"]', set(meta.description))
		.on('meta[property="og:url"]', set(pageUrl))
		.on("head", {
			element(el) {
				if (meta.noindex) el.append('<meta name="robots" content="noindex" />', { html: true });
			},
		})
		.transform(html);
}

async function render(c: Context<AppEnv>, meta: PageMeta, status: 200 | 404 = 200): Promise<Response> {
	const url = new URL(c.req.url);
	const html = await c.env.ASSETS.fetch(new URL("/", url));
	const res = rewriteMeta(html, status === 404 ? { ...meta, noindex: true } : meta, `${url.origin}${url.pathname}`);
	const out = new Response(res.body, { status, headers: res.headers });
	// 中身を書き換えたので、元の index.html の ETag は使わない
	out.headers.delete("etag");
	out.headers.set("Cache-Control", "no-cache");
	return out;
}

const titled = (name: string) => `${name}｜${SITE_NAME}`;
const notFound = (c: Context<AppEnv>) => render(c, { title: titled("ページが見つかりません") }, 404);

export const pages = new Hono<AppEnv>();

pages.get("/", (c) => render(c, {}));
pages.get("/search", (c) => render(c, { title: titled("みんなの相談") }));
pages.get("/philosophers", (c) => render(c, { title: titled("哲学者の名簿") }));
pages.get("/terms", (c) => render(c, { title: titled("利用規約") }));
pages.get("/privacy", (c) => render(c, { title: titled("プライバシーポリシー") }));
pages.get("/me", (c) => render(c, { title: titled("自分の相談"), noindex: true }));
pages.get("/admin", (c) => render(c, { title: titled("管理"), noindex: true }));

pages.get("/philosophers/:id", (c) => {
	const p = philosopherById(c.req.param("id"));
	if (!p) return notFound(c);
	return render(c, { title: titled(`${p.name}の考え方`), description: `${p.oneLine}。${p.core.split("。")[0]}。` });
});

pages.get("/theme/:category", (c) => {
	const category = c.req.param("category");
	if (!isCategory(category)) return notFound(c);
	return render(c, {
		title: titled(`${categoryName(category)}の悩み・みんなの相談`),
		description: `${categoryName(category)}の悩みに、哲学者たちはどう答えたか。みんなの相談と、刺さった答えを読めます。`,
	});
});

/** 共有された相談は、相談の先頭と結論の一言をリンクカードに。非公開の相談は中身を HTML に出さず noindex（持ち主は画面が API で読む） */
pages.get("/c/:id", async (c) => {
	const loaded = await loadConsultation(c.env.DB, c.req.param("id"));
	if (!loaded) return notFound(c);
	const { row, answers } = loaded;
	if (row.shared_at === null || row.hidden_at !== null) return render(c, { noindex: true });
	const head = [...row.body.replace(/\s+/g, " ").trim()];
	const excerpt = head.length > TITLE_EXCERPT ? `${head.slice(0, TITLE_EXCERPT).join("")}…` : head.join("");
	const description = answers
		.slice(0, 3)
		.map((a) => `${philosopherById(a.philosopher)?.name ?? a.philosopher}「${a.conclusion}」`)
		.join("／");
	return render(c, { title: titled(`相談「${excerpt}」`), description: description || undefined });
});

pages.get("*", (c) => notFound(c));
