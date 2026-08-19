import { invoke } from "@tauri-apps/api/core";
import type { TaskScript } from "@shared/types";

// ─── Tasks ───────────────────────────────────────────────────────────────────

export const tasks = {
	detect: (projectPath: string): Promise<TaskScript[]> => invoke("tasks_detect", { projectPath }),
};
