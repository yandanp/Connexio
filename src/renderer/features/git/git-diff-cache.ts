import type { GitChangedFile, GitDiffResult } from "@shared/types";
import type { FileGroup } from "./git-file-grouping";

// ============================================
// Module-level caches (survive unmount / tab switch)
// ============================================

/** Cap on number of projects kept in memory */
export const MAX_CACHED_PROJECTS = 3;
/** Cap on number of diff entries in memory */
export const MAX_CACHED_DIFFS = 20;

/** File list per project path — instant render on reopen */
export const filesCache = new Map<string, GitChangedFile[]>();
/** Last fetch timestamp per project — skip redundant fetches */
export const lastFetchTime = new Map<string, number>();
/** Skip re-fetching if last fetch was within this window */
export const FETCH_COOLDOWN_MS = 5000;
/** Rendering thousands of changed files at once can lock the renderer. */
export const INITIAL_VISIBLE_FILES_PER_GROUP = 200;
export const LOAD_MORE_FILES_STEP = 500;
/** Diff cache keyed by `${projectPath}::${group}::${filePath}` */
export const diffCache = new Map<string, GitDiffResult>();
/** Prevent concurrent fetches per project */
export const inflightFetches = new Map<string, Promise<GitChangedFile[]>>();

export function cacheKey(projectPath: string, group: FileGroup, path: string): string {
	return `${projectPath}::${group}::${path}`;
}

export function invalidateDiffCache(projectPath: string) {
	const prefix = `${projectPath}::`;
	for (const key of diffCache.keys()) {
		if (key.startsWith(prefix)) diffCache.delete(key);
	}
}

/** Evict oldest project caches when exceeding cap. Uses Map iteration order (insertion). */
export function evictOldProjectsIfNeeded(currentPath: string) {
	if (filesCache.size <= MAX_CACHED_PROJECTS) return;
	for (const key of filesCache.keys()) {
		if (filesCache.size <= MAX_CACHED_PROJECTS) break;
		if (key === currentPath) continue;
		filesCache.delete(key);
		lastFetchTime.delete(key);
		invalidateDiffCache(key);
	}
}

/** Trim diff cache — keep current project's entries, evict others. */
export function trimDiffCache(currentPath: string) {
	if (diffCache.size <= MAX_CACHED_DIFFS) return;
	const currentPrefix = `${currentPath}::`;
	for (const key of diffCache.keys()) {
		if (diffCache.size <= MAX_CACHED_DIFFS) break;
		if (!key.startsWith(currentPrefix)) {
			diffCache.delete(key);
		}
	}
	// If still over cap, start evicting current project's oldest entries
	if (diffCache.size > MAX_CACHED_DIFFS) {
		for (const key of diffCache.keys()) {
			if (diffCache.size <= MAX_CACHED_DIFFS) break;
			diffCache.delete(key);
		}
	}
}
