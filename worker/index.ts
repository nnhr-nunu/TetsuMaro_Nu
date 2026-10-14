import { Hono } from "hono";
import type { AppEnv } from "./env";
import { consult } from "./routes/consult";
import { consultations } from "./routes/consultations";
import { me } from "./routes/me";
import { shared } from "./routes/shared";

// strict: false で、末尾に / が付いた URL（外から貼られたリンク）も同じページにする
const app = new Hono<AppEnv>({ strict: false });

// 相談や持ち主ごとの中身を返すので、途中の経路にも端末にもキャッシュさせない。検索エンジンにも載せない
app.use("/api/*", async (c, next) => {
	await next();
	if (!c.res.headers.has("Cache-Control")) c.header("Cache-Control", "no-store");
	c.header("X-Robots-Tag", "noindex");
});

app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/api/consult", consult);
app.route("/api/consultations", consultations);
app.route("/api/me", me);
app.route("/api/shared", shared);
app.all("/api/*", (c) => c.json({ error: "not_found" }, 404));

// 画面のパスは静的アセット（index.html）に任せる。OGP の書き換えと 404 は worker/pages.ts（Task 11）
app.get("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
