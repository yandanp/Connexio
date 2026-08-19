import type { GitChangedFile } from "@shared/types";

export type FileGroup = "staged" | "modified" | "untracked" | "conflicted";

export interface GroupedFiles {
	staged: GitChangedFile[];
	modified: GitChangedFile[];
	untracked: GitChangedFile[];
	conflicted: GitChangedFile[];
}

export function groupFiles(files: GitChangedFile[]): GroupedFiles {
	const grouped: GroupedFiles = { staged: [], modified: [], untracked: [], conflicted: [] };

	for (const file of files) {
		const x = file.indexStatus as string;
		const y = file.workTreeStatus as string;

		// Conflict detection
		if (x === "U" || y === "U" || (x === "A" && y === "A") || (x === "D" && y === "D")) {
			grouped.conflicted.push(file);
			continue;
		}

		if (file.indexStatus === "?" && file.workTreeStatus === "?") {
			grouped.untracked.push(file);
		} else {
			if (file.indexStatus !== " " && file.indexStatus !== "?") {
				grouped.staged.push(file);
			}
			if (file.workTreeStatus !== " " && file.workTreeStatus !== "?") {
				grouped.modified.push(file);
			}
		}
	}

	return grouped;
}

export function getStatusLabel(status: string): string {
	switch (status) {
		case "M":
			return "Modified";
		case "A":
			return "Added";
		case "D":
			return "Deleted";
		case "R":
			return "Renamed";
		case "C":
			return "Copied";
		case "U":
			return "Conflict";
		case "?":
			return "Untracked";
		default:
			return "";
	}
}

export function getFileName(filePath: string): string {
	return filePath.split("/").pop() || filePath;
}

export function getFileDir(filePath: string): string {
	const parts = filePath.split("/");
	if (parts.length <= 1) return "";
	return `${parts.slice(0, -1).join("/")}/`;
}

export function filterFiles(
	files: GitChangedFile[],
	query: string,
	group: FileGroup,
): GitChangedFile[] {
	const q = query.trim().toLowerCase();
	if (!q) return files;

	return files.filter((file) => {
		const filePath = file.path.toLowerCase();
		const fileName = getFileName(file.path).toLowerCase();
		const status = group === "staged" ? file.indexStatus : file.workTreeStatus;

		// Match status shorthand: "M", "A", "D", "?"
		if (q.length === 1 && status.toLowerCase() === q) return true;

		// Match group prefix: "staged", "modified", "untracked"
		if (q.startsWith("group:")) {
			return group === q.slice(6);
		}

		// Match status prefix: "status:M"
		if (q.startsWith("status:")) {
			return status.toLowerCase() === q.slice(7);
		}

		// Default: match file path or name
		return filePath.includes(q) || fileName.includes(q);
	});
}
