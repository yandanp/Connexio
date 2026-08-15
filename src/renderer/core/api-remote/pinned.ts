import type { PinnedCommand } from "@shared/types";
import { sendCommand } from "./connection";

// ─── Pinned Commands ─────────────────────────────────────────────────────────

export const pinned = {
	list: (projectId: string): Promise<PinnedCommand[]> =>
		sendCommand<PinnedCommand[]>({ ch: "cmd_pinned_list", project_id: projectId }),
	save: (projectId: string, commands: PinnedCommand[]): Promise<void> =>
		sendCommand<void>({ ch: "cmd_pinned_save", project_id: projectId, commands }),
};
