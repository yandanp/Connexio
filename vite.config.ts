import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

// https://tauri.app/start/frontend/vite/
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
	plugins: [react()],
	root: "src/renderer",
	base: "./",
	build: {
		outDir: "../../dist/renderer",
		emptyOutDir: true,
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "src/renderer"),
			"@shared": path.resolve(__dirname, "src/shared"),
		},
	},
	// Vite options tailored for Tauri development
	clearScreen: false,
	server: {
		port: 5188,
		strictPort: true,
		host: host || false,
		hmr: host
			? {
					protocol: "ws",
					host,
					port: 5189,
				}
			: undefined,
	},
});
