import { invoke } from "@tauri-apps/api/core";

/** Public agents API adapter */
export const agents = {
	/** Detect which agent binaries are installed on this machine. */
	detectAll: async (commands: string[]): Promise<{ command: string; installed: boolean }[]> => {
		return invoke("agent_detect_all", { commands });
	},
};
