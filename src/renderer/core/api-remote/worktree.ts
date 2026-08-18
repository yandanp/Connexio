import type { WorktreeEntry } from "@shared/types";

/**
 * Worktree API — remote adapter.
 *
 * Worktree operations are desktop-only for now: the remote protocol has no
 * worktree commands yet. Every call rejects with a clear message instead of
 * silently no-oping, so callers can degrade gracefully.
 */
export const worktree = {
	create: async (
		_projectPath: string,
		_name: string,
		_options?: { fromRef?: string; branchOverride?: string },
	): Promise<WorktreeEntry> => {
		throw new Error("Worktree management is not available in remote mode");
	},

	list: async (_projectPath: string): Promise<WorktreeEntry[]> => {
		return [];
	},

	delete: async (
		_projectPath: string,
		_worktreePath: string,
		_confirmBranch: string,
	): Promise<void> => {
		throw new Error("Worktree management is not available in remote mode");
	},
};
