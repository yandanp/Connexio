import { invoke } from "@tauri-apps/api/core";
import type { AppTheme } from "@shared/types";

// ─── Theme ───────────────────────────────────────────────────────────────────

export const theme = {
	get: (): Promise<AppTheme> => invoke("theme_get"),
	set: async (themeId: string): Promise<AppTheme> => {
		await invoke("theme_set", { themeId });
		// Return the theme after setting it
		return invoke("theme_get");
	},
	list: (): Promise<AppTheme[]> => invoke("theme_list"),
};
