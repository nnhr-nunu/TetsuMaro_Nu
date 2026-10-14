/**
 * ボタンの見た目。色は役割で決める（性癖カルテと同じ決まり。~/.claude/skills/quality-review/design-tips.md の5）
 * - 主（濃い紺の塗り）: 送る・保存・共有するなど、その画面でしてほしいこと
 * - 副（白地に紺の枠）: 別のページを見に行く、もっと聞く
 * - 控えめ（白地に灰色の枠）: やめる・コピー・非公開に戻すなど
 * - X に投稿は黒（XPostLink）。消すなど取り返しのつかない確認は赤（ConfirmButton）
 * 文中の下線のリンクはボタンではないので、これらを使わない。幅や並べ方（w-full・flex-1 など）は使う側で足す
 */
export const btnPrimary =
	"inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-ink px-5 py-2.5 text-center font-bold text-white transition hover:bg-ink-soft disabled:opacity-40";
export const btnSecondary =
	"inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border-2 border-ink bg-white px-5 py-2 text-center font-bold text-ink transition hover:bg-paper disabled:opacity-40";
export const btnQuiet =
	"inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-line bg-white px-4 py-2 text-center text-ink-soft transition hover:bg-paper disabled:opacity-40";
/** 一覧の行や絞り込みに添える小さな丸いボタン（選んでいるときは on を付ける） */
export const chip = "inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full border border-line bg-white px-3 text-sm text-ink-soft transition hover:border-ink";
export const chipOn = "inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full border border-ink bg-ink px-3 text-sm font-bold text-white";
