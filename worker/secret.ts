async function sha256(text: string): Promise<Uint8Array> {
	return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

/**
 * 合言葉の比較。`===` は食い違った最初の文字で止まるので、時間のかかり方から合言葉を探られうる。
 * 両方を SHA-256 にして同じ長さにしてから、全部のバイトを見て比べる（途中で止めない）
 */
export async function sameSecret(given: string, expected: string): Promise<boolean> {
	const [a, b] = await Promise.all([sha256(given), sha256(expected)]);
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
	return diff === 0;
}
