// 哲学者の絵を一覧にして、1枚の画像（test-results/portraits.png）に書き出す。タッチがそろっているかを目で確かめる用
// 使い方: node scripts/portrait-sheet.mjs [id ...]（省くと全員）。SHEET=名前 で書き出すファイル名を変えられる。端末の Chrome を使う（CHROME で場所を変えられる）
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..");
const dir = path.join(root, "public", "portraits");
const ids = process.argv.length > 2 ? process.argv.slice(2) : fs.readdirSync(dir).filter((f) => f.endsWith(".svg")).map((f) => f.slice(0, -4));
const cols = Math.min(6, ids.length);
const rows = Math.ceil(ids.length / cols);

const cells = ids
	.map((id) => `<figure><img src="${pathToFileURL(path.join(dir, `${id}.svg`)).href}" width="200" height="220"><figcaption>${id}</figcaption></figure>`)
	.join("");
const html = `<!doctype html><meta charset="utf-8"><style>body{margin:10px;background:#fbf8f3;font:12px sans-serif;display:grid;grid-template-columns:repeat(${cols},200px);gap:10px}figure{margin:0}img{display:block;border-radius:16px}figcaption{text-align:center;padding:2px}</style>${cells}`;

const out = path.join(root, "test-results");
fs.mkdirSync(out, { recursive: true });
const name = process.env.SHEET || "portraits";
const htmlPath = path.join(out, `${name}.html`);
fs.writeFileSync(htmlPath, html);
const png = path.join(out, `${name}.png`);
const chrome = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
execFileSync(
	chrome,
	["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1", `--window-size=${cols * 210 + 20},${rows * 250 + 20}`, `--screenshot=${png}`, pathToFileURL(htmlPath).href],
	{ stdio: "ignore" },
);
console.log(png);
