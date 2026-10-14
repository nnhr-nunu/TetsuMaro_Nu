/**
 * 接続元の回線を、元に戻せない形（HMAC-SHA256）で見分ける。IP そのものは残さない。
 * scope（相談の id など）ごとに値が変わるので、別の用途の値とは突き合わせられない
 */

/** REPORTER_KEY がないとき（手元やテスト）の署名の鍵。本番では使わない */
const FALLBACK_KEY = "tetsumaro-voter";

/**
 * 見分ける単位。IPv6 は先頭の /64 にまとめる（1つの回線の中でアドレスを変えて、別の人を装えないように）。
 * IPv4 と、IPv6 として読めない形は、そのまま使う
 */
export function networkOf(ip: string): string {
	if (!ip.includes(":") || ip.includes(".")) return ip;
	const [head, tail] = ip.split("::");
	const front = head ? head.split(":") : [];
	const back = tail ? tail.split(":") : [];
	const groups = tail === undefined ? front : [...front, ...Array(Math.max(0, 8 - front.length - back.length)).fill("0"), ...back];
	return `${groups
		.slice(0, 4)
		.map((g) => (Number.parseInt(g, 16) || 0).toString(16))
		.join(":")}::/64`;
}

/** 回線（networkOf）と scope を合わせて署名し、base64url にする */
export async function networkHash(secret: string | undefined, ip: string, scope: string): Promise<string> {
	const enc = new TextEncoder();
	const key = await crypto.subtle.importKey("raw", enc.encode(secret || FALLBACK_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
	const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`${networkOf(ip)}|${scope}`)));
	return btoa(String.fromCharCode(...sig))
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replaceAll("=", "");
}
