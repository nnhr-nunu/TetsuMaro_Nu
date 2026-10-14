/** サイトの名前。画面の題名の「〇〇｜哲マロ(ぬ)」に使う */
export const SITE_NAME = "哲マロ(ぬ)";

/** トップの題名（index.html の <title> と同じ）。ほかの画面から戻ったときもこれにする */
export const TOP_TITLE = "哲マロ(ぬ)｜悩みを哲学者たちに相談できる";

/** サイトの説明（index.html の description と同じ） */
export const SITE_DESCRIPTION =
	"悩みを送ると、ソクラテスやニーチェ、ブッダ、孔子など、考え方の違う哲学者たちが答えてくれます。見比べて、自分に合う答えを見つけましょう。";

/** サイトの URL。リンクカードの画像など、絶対 URL が要るところで使う */
export const SITE_URL = "https://tetsumaro.oshilog.life";

/**
 * Turnstile のサイトキー（公開してよい値）。本物のウィジェットを作るまでは、Cloudflare のテスト用（いつも通る）の値。
 * 対になるシークレットは Worker のシークレット TURNSTILE_SECRET_KEY に入れる（入っていなければ確かめない）
 */
export const TURNSTILE_SITE_KEY = "1x00000000000000000000AA";
