import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

// ─── App Window ──────────────────────────────────────────────────────────────

export const app = {
	minimize: () => getCurrentWindow().minimize(),
	maximize: async () => {
		const win = getCurrentWindow();
		if (await win.isMaximized()) {
			await win.unmaximize();
		} else {
			await win.maximize();
		}
	},
	close: () => getCurrentWindow().close(),
	isMaximized: () => getCurrentWindow().isMaximized(),
	getVersion: (): Promise<string> => invoke("app_get_version"),
};
