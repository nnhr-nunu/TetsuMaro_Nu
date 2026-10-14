import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { SITE_URL } from "./shared/site.ts";

export default defineConfig({
	plugins: [
		react(),
		tailwindcss(),
		cloudflare(),
		// index.html の %SITE_URL% を、サイトの URL（shared/site.ts）にする
		{ name: "site-url", transformIndexHtml: (html) => html.replaceAll("%SITE_URL%", SITE_URL) },
	],
	// 性癖カルテ（5173）と同時に動かせるように、別の番号にする。作業用の git worktree（.claude/worktrees）は見張らない
	server: { port: 5183, watch: { ignored: ["**/.claude/**"] } },
});
