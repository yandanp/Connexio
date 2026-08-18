import type { SSHConnection } from "@shared/types";
import { send, sendCommand, terminalDataListeners } from "./connection";

// ─── Terminal API ────────────────────────────────────────────────────────────

interface TerminalContext {
	projectId: string;
	projectName: string;
	tabId: string;
	tabLabel: string;
	paneId?: string;
}

export const terminal = {
	create: async (
		projectPath: string,
		shell?: string,
		context?: TerminalContext,
	): Promise<string> => {
		return sendCommand({
			ch: "cmd_create_terminal",
			project_path: projectPath,
			shell: shell || null,
			context: context || null,
		});
	},

	createCommand: async (
		projectPath: string,
		command: string[],
		context?: TerminalContext,
	): Promise<string> => {
		return sendCommand({
			ch: "cmd_create_command",
			project_path: projectPath,
			command,
			context: context || null,
		});
	},

	createSsh: async (
		_connection: SSHConnection,
		_password?: string,
		_cols?: number,
		_rows?: number,
	): Promise<string> => {
		// SSH terminal creation via remote not yet supported
		throw new Error("SSH terminals not supported in remote mode");
	},

	write: (id: string, data: string): Promise<void> => {
		send({ ch: "term_input", id, data });
		return Promise.resolve();
	},

	resize: (id: string, cols: number, rows: number): Promise<void> => {
		send({ ch: "term_resize", id, cols: Math.round(cols), rows: Math.round(rows) });
		return Promise.resolve();
	},

	close: (id: string): Promise<void> => {
		send({ ch: "cmd_close_terminal", id });
		return Promise.resolve();
	},

	onData: (terminalId: string, callback: (id: string, data: string) => void): (() => void) => {
		const listener = (id: string, data: string) => {
			if (id === terminalId) callback(id, data);
		};
		terminalDataListeners.add(listener);
		return () => terminalDataListeners.delete(listener);
	},
};
