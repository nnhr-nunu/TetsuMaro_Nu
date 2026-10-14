/** URL に使える文字の乱数（12バイト → 16文字）。相談の id など */
export function newId(): string {
	return base64url(crypto.getRandomValues(new Uint8Array(12)));
}

/** 持ち主の鍵（32バイト → 43文字） */
export function newKey(): string {
	return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

function base64url(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes))
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replaceAll("=", "");
}
