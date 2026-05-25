import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { GitChangedFile } from "@shared/types";

export type GitFileIndicator = "M" | "A" | "D" | "R" | "U" | "?" | "C";

export interface GitFileStatusMap {
	/** Get the display status for a file path (relative to project root) */
	get(relativePath: string): GitFileIndicator | undefined;
	/** Check if a directory contains any changed files */
	hasChangesInDir(relativePath: string): boolean;
	/** Get the "worst" status in a directory for coloring the folder */
	getDirStatus(relativePath: string): GitFileIndicator | undefined;
}

const STATUS_PRIORITY: Record<GitFileIndicator, number> = {
	C: 6, // conflict — highest
	U: 5,
	D: 4,
	A: 3,
	M: 2,
	R: 1,
	"?": 0,
};

function buildStatusMap(
	files: GitChangedFile[],
	projectPath: string,
): GitFileStatusMap {
	const fileMap = new Map<string, GitFileIndicator>();
	const dirSet = new Map<string, GitFileIndicator>();

	const normalize = (p: string) => p.replace(/\\/g, "/");
	const normalizedProject = normalize(projectPath).replace(/\/$/, "");

	for (const f of files) {
		const relPath = normalize(f.path);

		// Determine the effective status to display
		let status: GitFileIndicator;
		const x = f.indexStatus;
		const y = f.workTreeStatus;

		if (x === "U" || y === "U" || (x === "A" && y === "A") || (x === "D" && y === "D")) {
			status = "C"; // conflict
		} else if (x === "?" && y === "?") {
			status = "?";
		} else if (y === "D") {
			status = "D";
		} else if (x === "D" && y === " ") {
			status = "D";
		} else if (x === "A" && y === " ") {
			status = "A";
		} else if (x === "R" || y === "R") {
			status = "R";
		} else if (y === "M" || x === "M") {
			status = "M";
		} else if (x === "A") {
			status = "A";
		} else {
			status = "M";
		}

		fileMap.set(relPath, status);

		// Propagate to parent directories
		const parts = relPath.split("/");
		for (let i = 1; i < parts.length; i++) {
			const dirPath = parts.slice(0, i).join("/");
			const existing = dirSet.get(dirPath);
			if (!existing || STATUS_PRIORITY[status] > STATUS_PRIORITY[existing]) {
				dirSet.set(dirPath, status);
			}
		}
	}

	return {
		get(relativePath: string) {
			return fileMap.get(normalize(relativePath));
		},
		hasChangesInDir(relativePath: string) {
			return dirSet.has(normalize(relativePath));
		},
		getDirStatus(relativePath: string) {
			return dirSet.get(normalize(relativePath));
		},
	};
}

const EMPTY_MAP: GitFileStatusMap = {
	get: () => undefined,
	hasChangesInDir: () => false,
	getDirStatus: () => undefined,
};

export function useGitFileStatus(projectPath: string): GitFileStatusMap {
	const [statusMap, setStatusMap] = useState<GitFileStatusMap>(EMPTY_MAP);
	const mountedRef = useRef(true);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const fetchStatus = useCallback(async () => {
		if (!projectPath) return;
		try {
			const files = await invoke<GitChangedFile[]>("git_changed_files", { projectPath });
			if (mountedRef.current) {
				setStatusMap(buildStatusMap(files, projectPath));
			}
		} catch {
			if (mountedRef.current) {
				setStatusMap(EMPTY_MAP);
			}
		}
	}, [projectPath]);

	useEffect(() => {
		mountedRef.current = true;
		setStatusMap(EMPTY_MAP);
		fetchStatus();

		// Poll every 5 seconds for changes
		intervalRef.current = setInterval(fetchStatus, 5000);

		return () => {
			mountedRef.current = false;
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		};
	}, [fetchStatus]);

	return statusMap;
}
