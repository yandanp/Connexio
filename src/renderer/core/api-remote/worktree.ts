import type { WorktreeEntry } from "@shared/types";

/**
 * Worktree API — remote adapter.
 *
 * Worktree operations are desktop-only for now: the remote protocol has no
 * worktree commands yet. Mutating calls reject with a clear message instead
 * of silently no-oping; reads return empty results so callers degrade
 * gracefully.
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

	previewDiff: async (
		_projectPath: string,
		_worktreePath: string,
		_baseRef: string,
	): Promise<{ changedFiles: number; ahead: number; behind: number }> => {
		return { changedFiles: 0, ahead: 0, behind: 0 };
	},

	delete: async (
		_projectPath: string,
		_worktreePath: string,
		_confirmBranch: string,
	): Promise<{ preservedBranch: string | null; leftoverDir?: string | null }> => {
		throw new Error("Worktree management is not available in remote mode");
	},
};
