import { invoke } from "@tauri-apps/api/core";
import type { GitStatus } from "@shared/types";

// ─── Git ─────────────────────────────────────────────────────────────────────

export const git = {
	status: (projectPath: string): Promise<GitStatus> => invoke("git_status", { projectPath }),

	changedFiles: (projectPath: string): Promise<any[]> =>
		invoke("git_changed_files", { projectPath }),

	diff: (projectPath: string, filePath: string, staged: boolean): Promise<any> =>
		invoke("git_diff", { projectPath, filePath, staged }),

	diffUntracked: (projectPath: string, filePath: string): Promise<any> =>
		invoke("git_diff_untracked", { projectPath, filePath }),

	stage: (projectPath: string, filePath: string): Promise<void> =>
		invoke("git_stage", { projectPath, filePath }),

	stageAll: (projectPath: string): Promise<void> => invoke("git_stage_all", { projectPath }),

	unstage: (projectPath: string, filePath: string): Promise<void> =>
		invoke("git_unstage", { projectPath, filePath }),

	unstageAll: (projectPath: string): Promise<void> => invoke("git_unstage_all", { projectPath }),

	discard: (projectPath: string, filePath: string): Promise<void> =>
		invoke("git_discard", { projectPath, filePath }),

	openFile: (projectPath: string, filePath: string): Promise<void> =>
		invoke("git_open_file", { projectPath, filePath }),

	commit: (projectPath: string, message: string): Promise<any> =>
		invoke("git_commit", { projectPath, message }),

	push: (projectPath: string): Promise<any> => invoke("git_push", { projectPath }),

	pull: (projectPath: string): Promise<any> => invoke("git_pull", { projectPath }),

	fetch: (projectPath: string): Promise<any> => invoke("git_fetch", { projectPath }),

	history: (projectPath: string, limit?: number): Promise<any[]> =>
		invoke("git_history", { projectPath, limit: limit || null }),

	branches: (projectPath: string): Promise<any[]> => invoke("git_branches", { projectPath }),

	checkout: (projectPath: string, branch: string): Promise<any> =>
		invoke("git_checkout", { projectPath, branch }),

	createBranch: (projectPath: string, branchName: string): Promise<any> =>
		invoke("git_create_branch", { projectPath, branchName }),

	publishBranch: (projectPath: string): Promise<any> =>
		invoke("git_publish_branch", { projectPath }),

	stashList: (projectPath: string): Promise<any[]> => invoke("git_stash_list", { projectPath }),

	stashSave: (projectPath: string, message?: string): Promise<any> =>
		invoke("git_stash_save", { projectPath, message: message || null }),

	stashPop: (projectPath: string, index?: number): Promise<any> =>
		invoke("git_stash_pop", { projectPath, index: index ?? null }),

	stashApply: (projectPath: string, index?: number): Promise<any> =>
		invoke("git_stash_apply", { projectPath, index: index ?? null }),

	stashDrop: (projectPath: string, index?: number): Promise<any> =>
		invoke("git_stash_drop", { projectPath, index: index ?? null }),
};
