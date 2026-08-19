import type { GitStatus } from "@shared/types";

// ─── Git ─────────────────────────────────────────────────────────────────────

export const git = {
	status: (_projectPath: string): Promise<GitStatus> =>
		Promise.resolve({
			branch: "",
			ahead: 0,
			behind: 0,
			staged: 0,
			modified: 0,
			untracked: 0,
		} as any),
	changedFiles: (_projectPath: string): Promise<any[]> => Promise.resolve([]),
	diff: (): Promise<any> => Promise.resolve(null),
	diffUntracked: (): Promise<any> => Promise.resolve(null),
	stage: (): Promise<void> => Promise.resolve(),
	stageAll: (): Promise<void> => Promise.resolve(),
	unstage: (): Promise<void> => Promise.resolve(),
	unstageAll: (): Promise<void> => Promise.resolve(),
	discard: (): Promise<void> => Promise.resolve(),
	openFile: (): Promise<void> => Promise.resolve(),
	commit: (): Promise<any> => Promise.resolve(null),
	push: (): Promise<any> => Promise.resolve(null),
	pull: (): Promise<any> => Promise.resolve(null),
	fetch: (): Promise<any> => Promise.resolve(null),
	history: (): Promise<any[]> => Promise.resolve([]),
	branches: (): Promise<any[]> => Promise.resolve([]),
	checkout: (): Promise<any> => Promise.resolve(null),
	createBranch: (): Promise<any> => Promise.resolve(null),
	publishBranch: (): Promise<any> => Promise.resolve(null),
	stashList: (): Promise<any[]> => Promise.resolve([]),
	stashSave: (): Promise<any> => Promise.resolve(null),
	stashPop: (): Promise<any> => Promise.resolve(null),
	stashApply: (): Promise<any> => Promise.resolve(null),
	stashDrop: (): Promise<any> => Promise.resolve(null),
};
