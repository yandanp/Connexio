import type { WorkspaceState } from "@shared/types";
import { waitForState } from "./connection";

// ─── Workspace ───────────────────────────────────────────────────────────────

export const workspace = {
	getState: async (): Promise<WorkspaceState> => {
		const s = await waitForState();
		return s.workspace;
	},

	saveState: (_state: WorkspaceState): Promise<void> => Promise.resolve(),
};
