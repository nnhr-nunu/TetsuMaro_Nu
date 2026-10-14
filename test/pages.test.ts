import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import { ROSTER_IDS } from "../shared/philosophers";
import { indexShared } from "../worker/db/shared";
import app from "../worker/index";

const INDEX = `<!doctype html><html lang="ja"><head>
<meta name="description" content="既定の説明" />
<title>哲マロ(ぬ)｜悩みを哲学者たちに相談できる</title>
<meta property="og:title" content="哲マロ(ぬ)" />
<meta property="og:description" content="既定の説明" />
<meta property="og:url" content="https://example.com/" />
</head><body><div id="root"></div></body></html>`;

/** 画面の index.html を返すだけの ASSETS */
const assets = { fetch: async () => new Response(INDEX, { headers: { "content-type": "text/html" } }) } as unknown as Fetcher;
const page = (path: string) => app.request(`https://tetsumaro.example${path}`, {}, { ...env, ASSETS: assets });

async function addConsultation(id: string, body: string, shared: boolean) {
	await env.DB.prepare("INSERT INTO consultations (id, owner_id, body, created_at, shared_at, status) VALUES (?, 'o', ?, 1, ?, 'done')")
		.bind(id, body, shared ? 1 : null)
		.run();
	await env.DB.prepare("INSERT INTO answers (consultation_id, philosopher_id, slot, conclusion, body) VALUES (?, 'socrates', 0, '問い直してみよう', '本文')").bind(id).run();
	await indexShared(env.DB, id);
}

beforeAll(async () => {
	await addConsultation("pageshared", '<script>alert("x")</script>上司が怖いです', true);
	await addConsultation("pageprivate", "誰にも言えない秘密の相談", false);
});

describe("画面の配信", () => {
	it("共有された相談は、題名に相談の先頭が入り、エスケープされる。説明に結論が入る", async () => {
		const res = await page("/c/pageshared");
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain("&lt;script&gt;");
		expect(html).not.toContain('<script>alert("x")');
		expect(html).toMatch(/<title>相談「[^<]*」｜哲マロ\(ぬ\)<\/title>/);
		expect(html).toContain("ソクラテス「問い直してみよう」");
		expect(html).not.toContain("noindex");
	});

	it("非公開の相談は noindex で、相談文を HTML に出さない", async () => {
		const res = await page("/c/pageprivate");
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain('<meta name="robots" content="noindex"');
		expect(html).not.toContain("秘密の相談");
	});

	it("無い相談・知らない哲学者・知らないテーマ・知らない URL は 404", async () => {
		expect((await page("/c/nothing")).status).toBe(404);
		expect((await page("/philosophers/xxx")).status).toBe(404);
		expect((await page("/theme/xxx")).status).toBe(404);
		expect((await page("/no/such/page")).status).toBe(404);
	});

	it("哲学者のページは名前入りの題名", async () => {
		const html = await (await page("/philosophers/nietzsche")).text();
		expect(html).toContain("<title>ニーチェの考え方｜哲マロ(ぬ)</title>");
	});

	it("自分の相談の一覧と管理画面は noindex", async () => {
		expect(await (await page("/me")).text()).toContain('content="noindex"');
		expect(await (await page("/admin")).text()).toContain('content="noindex"');
	});
});

describe("robots.txt と sitemap.xml", () => {
	it("robots.txt は API・自分の相談・管理画面を載せない", async () => {
		const txt = await (await page("/robots.txt")).text();
		expect(txt).toContain("Disallow: /api/");
		expect(txt).toContain("Disallow: /me");
		expect(txt).toContain("Disallow: /admin");
		expect(txt).toContain("Sitemap: https://tetsumaro.example/sitemap.xml");
	});

	it("sitemap に名簿の全員と共有された相談が出て、非公開の相談は出ない", async () => {
		const xml = await (await page("/sitemap.xml")).text();
		for (const id of ROSTER_IDS) expect(xml).toContain(`/philosophers/${id}</loc>`);
		expect(xml).toContain("/c/pageshared</loc>");
		expect(xml).not.toContain("pageprivate");
	});
});
