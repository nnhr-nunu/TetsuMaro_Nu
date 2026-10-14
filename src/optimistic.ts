/**
 * 先に画面へ反映してから送る。送れなかったら revert で押す前に戻して、失敗を返す（成功したら送った結果を返す）。
 * 戻した後の知らせ方は呼び出し側が決める
 */
export async function sendOptimistic<T>(apply: () => void, revert: () => void, send: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: unknown }> {
	apply();
	try {
		return { ok: true, value: await send() };
	} catch (error) {
		revert();
		return { ok: false, error };
	}
}
