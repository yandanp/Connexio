import type { AppTheme } from "@shared/types";
import { waitForState } from "./connection";

// ─── Theme ───────────────────────────────────────────────────────────────────

export const theme = {
	get: async (): Promise<AppTheme> => {
		const s = await waitForState();
		return s.theme;
	},
	set: async (_themeId: string): Promise<AppTheme> => {
		const s = await waitForState();
		return s.theme;
	},
	list: async (): Promise<AppTheme[]> => {
		const s = await waitForState();
		return s.themes;
	},
};
