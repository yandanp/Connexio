import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { Project } from "@shared/types";

// ─── Projects ────────────────────────────────────────────────────────────────

export const project = {
	list: (): Promise<Project[]> => invoke("projects_list"),

	add: (proj: Project): Promise<Project[]> => invoke("projects_add", { project: proj }),

	update: (proj: Project): Promise<Project[]> => invoke("projects_update", { project: proj }),

	reorder: (ids: string[]): Promise<Project[]> => invoke("projects_reorder", { ids }),

	delete: (id: string): Promise<Project[]> => invoke("projects_delete", { id }),

	selectDir: async (): Promise<string | null> => {
		const selected = await open({ directory: true, multiple: false });
		if (!selected) return null;
		if (Array.isArray(selected)) return selected[0] || null;
		return selected;
	},
};
