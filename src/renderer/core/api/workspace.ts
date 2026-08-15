import { invoke } from "@tauri-apps/api/core";
import type { WorkspaceState } from "@shared/types";

// ─── Workspace ───────────────────────────────────────────────────────────────

export const workspace = {
	getState: (): Promise<WorkspaceState> => invoke("workspace_get_state"),

	saveState: (state: WorkspaceState): Promise<void> => invoke("workspace_save_state", { state }),
};
