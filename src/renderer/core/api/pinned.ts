import { invoke } from "@tauri-apps/api/core";
import type { PinnedCommand } from "@shared/types";

// ─── Pinned Commands ─────────────────────────────────────────────────────────

export const pinned = {
	list: (projectId: string): Promise<PinnedCommand[]> => invoke("pinned_list", { projectId }),

	save: (projectId: string, commands: PinnedCommand[]): Promise<void> =>
		invoke("pinned_save", { projectId, commands }),
};
