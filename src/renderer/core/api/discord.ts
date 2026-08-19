import { invoke } from "@tauri-apps/api/core";

// ─── Discord Presence ────────────────────────────────────────────────────────

export const discord = {
	connect: (): Promise<boolean> => invoke("discord_presence_connect"),
	disconnect: (): Promise<boolean> => invoke("discord_presence_disconnect"),
	update: (details: string, status?: string): Promise<boolean> =>
		invoke("discord_presence_update", { details, status: status || null }),
	isConnected: (): Promise<boolean> => invoke("discord_presence_is_connected"),
};
