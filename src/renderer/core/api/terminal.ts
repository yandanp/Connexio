import { invoke } from "@tauri-apps/api/core";
import type { SSHConnection } from "@shared/types";
import { onTerminalData, onTerminalExit } from "./terminal-event-bus";

interface TerminalContext {
	projectId: string;
	projectName: string;
	tabId: string;
	tabLabel: string;
}

export const terminal = {
	create: async (
		projectPath: string,
		shell?: string,
		context?: TerminalContext,
	): Promise<string> => {
		try {
			return await invoke("terminal_create", {
				projectPath,
				shell: shell || null,
				context: context || null,
			});
		} catch (e) {
			console.error("[Tauri] terminal_create failed:", e);
			throw e;
		}
	},

	createCommand: async (
		projectPath: string,
		command: string[],
		context?: TerminalContext,
	): Promise<string> =>
		invoke("terminal_create_command", { projectPath, command, context: context || null }),

	createSsh: async (
		connection: SSHConnection,
		password?: string,
		cols?: number,
		rows?: number,
	): Promise<string> =>
		invoke("terminal_create_ssh", {
			connection,
			password: password || null,
			cols: cols || null,
			rows: rows || null,
		}),

	write: (id: string, data: string): Promise<void> => invoke("terminal_write", { id, data }),

	resize: (id: string, cols: number, rows: number): Promise<void> =>
		invoke("terminal_resize", { id, cols: Math.round(cols), rows: Math.round(rows) }),

	close: (id: string): Promise<void> => invoke("terminal_close", { id }),

	onData: (callback: (id: string, data: string) => void): (() => void) => onTerminalData(callback),

	onExit: (callback: (id: string) => void): (() => void) => onTerminalExit(callback),
};
