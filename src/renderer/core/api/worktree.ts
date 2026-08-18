import { invoke } from "@tauri-apps/api/core";
import type { WorktreeEntry } from "@shared/types";

/** Public worktree API adapter */
export const worktree = {
	/** Create a new worktree under `<projectPath>/.worktrees/<slug>` */
	create: async (
		projectPath: string,
		name: string,
		options?: {
			fromRef?: string;
			branchOverride?: string;
			linkedIssueUrl?: string;
		},
	): Promise<WorktreeEntry> => {
		return invoke("worktree_create", {
			projectPath,
			name,
			fromRef: options?.fromRef || null,
			branchOverride: options?.branchOverride || null,
			linkedIssueUrl: options?.linkedIssueUrl || null,
		});
	},

	/** List all worktrees for a given project */
	list: async (projectPath: string): Promise<WorktreeEntry[]> => {
		return invoke("worktree_list", { projectPath });
	},

	/**
	 * Preview how a worktree's branch diverges from a base ref:
	 * changed file count plus ahead/behind commit counts.
	 */
	previewDiff: async (
		projectPath: string,
		worktreePath: string,
		baseRef: string,
	): Promise<{ changedFiles: number; ahead: number; behind: number }> => {
		return invoke("worktree_preview_diff", { projectPath, worktreePath, baseRef });
	},

	/**
	 * Delete a worktree's directory and its branch (Orca-style: the branch is
	 * preserved when it holds unmerged commits — check preservedBranch).
	 */
	delete: async (
		projectPath: string,
		worktreePath: string,
		confirmBranch: string,
	): Promise<{ preservedBranch: string | null }> => {
		return invoke("worktree_delete", { projectPath, worktreePath, confirmBranch });
	},
};
