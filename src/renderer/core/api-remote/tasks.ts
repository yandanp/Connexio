import type { TaskScript } from "@shared/types";
import { sendCommand } from "./connection";

// ─── Tasks ───────────────────────────────────────────────────────────────────

export const tasks = {
	detect: (projectPath: string): Promise<TaskScript[]> =>
		sendCommand<TaskScript[]>({ ch: "cmd_detect_tasks", project_path: projectPath }),
};
