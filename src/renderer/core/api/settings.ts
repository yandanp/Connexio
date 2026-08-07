import { invoke } from "@tauri-apps/api/core";
import type { AppSettings, ShellInfo } from "@shared/types";

// ─── Settings ────────────────────────────────────────────────────────────────

export const settings = {
	get: (): Promise<AppSettings> => invoke("settings_get"),

	set: (s: AppSettings): Promise<AppSettings> => invoke("settings_set", { settings: s }),

	getShells: (): Promise<ShellInfo[]> => invoke("settings_get_shells"),

	getDefaultShell: (): Promise<string> => invoke("settings_get_default_shell"),
};
