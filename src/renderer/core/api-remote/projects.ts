import type { Project } from "@shared/types";
import { send, waitForState } from "./connection";

// ─── Projects ────────────────────────────────────────────────────────────────

export const project = {
	list: async (): Promise<Project[]> => {
		const s = await waitForState();
		return s.projects;
	},

	add: async (_proj: Project): Promise<Project[]> => {
		// Mutating operations: request refresh after
		send({ ch: "cmd_refresh" });
		return waitForState().then((s) => s.projects);
	},

	update: async (_proj: Project): Promise<Project[]> => {
		send({ ch: "cmd_refresh" });
		return waitForState().then((s) => s.projects);
	},

	reorder: async (_ids: string[]): Promise<Project[]> => {
		send({ ch: "cmd_refresh" });
		return waitForState().then((s) => s.projects);
	},

	delete: async (_id: string): Promise<Project[]> => {
		send({ ch: "cmd_refresh" });
		return waitForState().then((s) => s.projects);
	},

	selectDir: async (): Promise<string | null> => {
		return window.prompt("Enter project directory path:") || null;
	},
};
