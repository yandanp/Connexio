import type { AppSettings, ShellInfo } from "@shared/types";
import { waitForState } from "./connection";

// ─── Settings ────────────────────────────────────────────────────────────────

export const settings = {
	get: async (): Promise<AppSettings> => {
		const s = await waitForState();
		return s.settings;
	},

	set: async (_s: AppSettings): Promise<AppSettings> => {
		// Settings changes not supported in remote mode
		const s = await waitForState();
		return s.settings;
	},

	getShells: async (): Promise<ShellInfo[]> => {
		const s = await waitForState();
		return s.shells;
	},

	getDefaultShell: async (): Promise<string> => {
		const s = await waitForState();
		return s.settings.defaultShell || "";
	},
};
