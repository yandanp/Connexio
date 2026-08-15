import { invoke } from "@tauri-apps/api/core";

// ─── File Explorer ───────────────────────────────────────────────────────────
// Wrappers untuk command explorer_* yang saat ini masih dipanggil langsung
// (invoke) oleh file LEGACY; dipakai saat migrasi T6/T12/T13.

export interface FileEntry {
	name: string;
	path: string;
	isDir: boolean;
	isHidden: boolean;
	extension: string | null;
	size: number | null;
	children: FileEntry[] | null;
}

export interface SearchResult {
	filePath: string;
	lineNumber: number;
	lineContent: string;
}

export const explorer = {
	listDir: (dirPath: string): Promise<FileEntry[]> => invoke("explorer_list_dir", { dirPath }),

	readFile: (filePath: string): Promise<string> => invoke("explorer_read_file", { filePath }),

	writeFile: (filePath: string, content: string): Promise<void> =>
		invoke("explorer_write_file", { filePath, content }),

	rename: (oldPath: string, newPath: string): Promise<void> =>
		invoke("explorer_rename", { oldPath, newPath }),

	delete: (targetPath: string): Promise<void> => invoke("explorer_delete", { targetPath }),

	newFile: (filePath: string): Promise<void> => invoke("explorer_new_file", { filePath }),

	newFolder: (dirPath: string): Promise<void> => invoke("explorer_new_folder", { dirPath }),

	openPath: (targetPath: string): Promise<void> => invoke("explorer_open_path", { targetPath }),

	searchInFiles: (
		projectPath: string,
		query: string,
		caseSensitive?: boolean,
		maxResults?: number,
	): Promise<SearchResult[]> =>
		invoke("explorer_search_in_files", {
			projectPath,
			query,
			caseSensitive: caseSensitive ?? null,
			maxResults: maxResults ?? null,
		}),
};
