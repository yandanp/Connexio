/**
 * Worktree detection helpers for the git panel.
 *
 * A worktree project lives under `<repo>/.worktrees/<slug>` on disk. The git
 * panel uses this to badge the branch chip and show the owning repo name.
 */

/** Normalize separators so detection works on Windows and Unix paths. */
function normalize(path: string): string {
	return path.replace(/\\/g, "/");
}

export interface WorktreeContext {
	/** True when the project path is inside a `.worktrees` directory. */
	isWorktree: boolean;
	/** The worktree's own directory name (last path segment), if a worktree. */
	name: string | null;
}

/** Detect whether a project path points inside a git worktree checkout. */
export function detectWorktree(projectPath: string): WorktreeContext {
	const parts = normalize(projectPath).split("/");
	const idx = parts.lastIndexOf(".worktrees");
	if (idx === -1 || idx === parts.length - 1) {
		return { isWorktree: false, name: null };
	}
	return { isWorktree: true, name: parts[idx + 1] || null };
}
