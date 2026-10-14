import { Hono } from "hono";
import { crawl } from "./crawl";
import type { AppEnv } from "./env";
import { rateLimit } from "./limits";
import { pages } from "./pages";
import { admin } from "./routes/admin";
import { consult } from "./routes/consult";
import { consultations } from "./routes/consultations";
import { me } from "./routes/me";
import { reports } from "./routes/reports";
import { shared } from "./routes/shared";

// strict: false で、末尾に / が付いた URL（外から貼られたリンク）も同じページにする
const app = new Hono<AppEnv>({ strict: false });

// 相談や持ち主ごとの中身を返すので、途中の経路にも端末にもキャッシュさせない。検索エンジンにも載せない
app.use("/api/*", async (c, next) => {
	await next();
	if (!c.res.headers.has("Cache-Control")) c.header("Cache-Control", "no-store");
	c.header("X-Robots-Tag", "noindex");
});
app.use("/api/*", rateLimit);

app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/api/consult", consult);
app.route("/api/consultations", consultations);
app.route("/api/me", me);
app.route("/api/shared", shared);
app.route("/api/reports", reports);
app.route("/api/admin", admin);
app.all("/api/*", (c) => c.json({ error: "not_found" }, 404));

app.route("/", crawl);
// 画面のパスは index.html の題名・リンクカードを書き換えて返す。どれでもなければ 404（worker/pages.ts）
app.route("/", pages);

export default app;
