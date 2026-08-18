import { invoke } from "@tauri-apps/api/core";
import type { WorktreeEntry } from "@shared/types";

/** Public worktree API adapter */
export const worktree = {
	/** Create a new worktree under `<projectPath>/.worktrees/<slug>` */
	create: async (
		projectPath: string,
		name: string,
		options?: { fromRef?: string; branchOverride?: string },
	): Promise<WorktreeEntry> => {
		return invoke("worktree_create", {
			projectPath,
			name,
			fromRef: options?.fromRef || null,
			branchOverride: options?.branchOverride || null,
		});
	},

	/** List all worktrees for a given project */
	list: async (projectPath: string): Promise<WorktreeEntry[]> => {
		return invoke("worktree_list", { projectPath });
	},

	/**
	 * Delete a worktree and its branch. Requires explicit confirmation of the
	 * current HEAD branch to prevent accidental deletion.
	 */
	delete: async (
		projectPath: string,
		worktreePath: string,
		confirmBranch: string,
	): Promise<void> => {
		return invoke("worktree_delete", { projectPath, worktreePath, confirmBranch });
	},
};
