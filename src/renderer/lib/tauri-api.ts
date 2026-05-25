/**
 * Connexio Tauri API Adapter
 *
 * This module provides the same interface as the old Electron preload bridge
 * (`window.connexio`) but routes calls through Tauri's `invoke` and `listen`.
 *
 * Components can import from here instead of relying on `window.connexio`.
 */

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type {
	AppSettings,
	PinnedCommand,
	Project,
	Session,
	SSHConnection,
	WorkspaceState,
	GitStatus,
	TaskScript,
	ShellInfo,
	AppTheme,
} from "@shared/types";

// ─── Terminal ────────────────────────────────────────────────────────────────

interface TerminalContext {
	projectId: string;
	projectName: string;
	tabId: string;
	tabLabel: string;
}

// Global terminal data listeners — registered immediately on import
type TerminalDataCallback = (id: string, data: string) => void;
const terminalDataListeners = new Set<TerminalDataCallback>();

// Buffer: stores data per terminal ID until at least one listener exists
const terminalDataBuffer = new Map<string, string[]>();
let bufferFlushScheduled = false;

function flushBuffer() {
	if (terminalDataBuffer.size === 0 || terminalDataListeners.size === 0) return;
	for (const [id, chunks] of terminalDataBuffer.entries()) {
		for (const data of chunks) {
			for (const cb of terminalDataListeners) {
				cb(id, data);
			}
		}
	}
	terminalDataBuffer.clear();
	bufferFlushScheduled = false;
}

// Start global listener immediately (not lazy)
listen<[string, string]>("terminal:data", (event) => {
	const [id, data] = event.payload;
	if (terminalDataListeners.size === 0) {
		// No listeners yet, buffer
		const buf = terminalDataBuffer.get(id) || [];
		buf.push(data);
		terminalDataBuffer.set(id, buf);
		return;
	}
	// If there's still buffered data, flush it first
	if (terminalDataBuffer.size > 0) {
		flushBuffer();
	}
	for (const cb of terminalDataListeners) {
		cb(id, data);
	}
});

export const terminal = {
	create: async (projectPath: string, shell?: string, context?: TerminalContext): Promise<string> => {
		try {
			return await invoke("terminal_create", { projectPath, shell: shell || null, context: context || null });
		} catch (e) {
			console.error("[Tauri] terminal_create failed:", e);
			throw e;
		}
	},

	write: (id: string, data: string): Promise<void> =>
		invoke("terminal_write", { id, data }),

	resize: (id: string, cols: number, rows: number): Promise<void> =>
		invoke("terminal_resize", { id, cols: Math.round(cols), rows: Math.round(rows) }),

	close: (id: string): Promise<void> =>
		invoke("terminal_close", { id }),

	onData: (callback: (id: string, data: string) => void): (() => void) => {
		terminalDataListeners.add(callback);
		// Schedule buffer flush after short delay to let all terminals register
		if (terminalDataBuffer.size > 0 && !bufferFlushScheduled) {
			bufferFlushScheduled = true;
			setTimeout(flushBuffer, 500);
		}
		return () => {
			terminalDataListeners.delete(callback);
		};
	},
};

// ─── Projects ────────────────────────────────────────────────────────────────

export const project = {
	list: (): Promise<Project[]> => invoke("projects_list"),

	add: (proj: Project): Promise<Project[]> =>
		invoke("projects_add", { project: proj }),

	update: (proj: Project): Promise<Project[]> =>
		invoke("projects_update", { project: proj }),

	reorder: (ids: string[]): Promise<Project[]> =>
		invoke("projects_reorder", { ids }),

	delete: (id: string): Promise<Project[]> =>
		invoke("projects_delete", { id }),

	selectDir: async (): Promise<string | null> => {
		const selected = await open({ directory: true, multiple: false });
		if (!selected) return null;
		if (Array.isArray(selected)) return selected[0] || null;
		return selected;
	},
};

// ─── Session ─────────────────────────────────────────────────────────────────

export const session = {
	save: (sess: Session): Promise<void> =>
		invoke("session_save", { session: sess }),

	load: (id: string): Promise<Session | null> =>
		invoke("session_load", { id }),

	list: (): Promise<Session[]> => invoke("session_list"),

	delete: (id: string): Promise<void> => invoke("session_delete", { id }),
};

// ─── Settings ────────────────────────────────────────────────────────────────

export const settings = {
	get: (): Promise<AppSettings> => invoke("settings_get"),

	set: (s: AppSettings): Promise<AppSettings> =>
		invoke("settings_set", { settings: s }),

	getShells: (): Promise<ShellInfo[]> => invoke("settings_get_shells"),

	getDefaultShell: (): Promise<string> => invoke("settings_get_default_shell"),
};

// ─── Workspace ───────────────────────────────────────────────────────────────

export const workspace = {
	getState: (): Promise<WorkspaceState> => invoke("workspace_get_state"),

	saveState: (state: WorkspaceState): Promise<void> =>
		invoke("workspace_save_state", { state }),
};

// ─── Tasks ───────────────────────────────────────────────────────────────────

export const tasks = {
	detect: (projectPath: string): Promise<TaskScript[]> =>
		invoke("tasks_detect", { projectPath }),
};

// ─── Pinned Commands ─────────────────────────────────────────────────────────

export const pinned = {
	list: (projectId: string): Promise<PinnedCommand[]> =>
		invoke("pinned_list", { projectId }),

	save: (projectId: string, commands: PinnedCommand[]): Promise<void> =>
		invoke("pinned_save", { projectId, commands }),
};

// ─── SSH ─────────────────────────────────────────────────────────────────────

export const ssh = {
	list: (projectId: string): Promise<SSHConnection[]> =>
		invoke("ssh_list", { projectId }),

	save: (projectId: string, connections: SSHConnection[]): Promise<void> =>
		invoke("ssh_save", { projectId, connections }),

	listGlobal: (): Promise<SSHConnection[]> => invoke("ssh_list_global"),

	saveGlobal: (connections: SSHConnection[]): Promise<void> =>
		invoke("ssh_save_global", { connections }),

	buildCommand: (connection: SSHConnection): Promise<string> =>
		invoke("ssh_build_command", { connection }),

	selectKey: async (): Promise<string | null> => {
		const selected = await open({
			multiple: false,
			filters: [{ name: "SSH Keys", extensions: ["pem", "key", "pub", ""] }],
		});
		return selected as string | null;
	},

	keyExists: (keyPath: string): Promise<boolean> =>
		invoke("ssh_key_exists", { keyPath }),
};

// ─── Git ─────────────────────────────────────────────────────────────────────

export const git = {
	status: (projectPath: string): Promise<GitStatus> =>
		invoke("git_status", { projectPath }),

	changedFiles: (projectPath: string): Promise<any[]> =>
		invoke("git_changed_files", { projectPath }),

	diff: (projectPath: string, filePath: string, staged: boolean): Promise<any> =>
		invoke("git_diff", { projectPath, filePath, staged }),

	diffUntracked: (projectPath: string, filePath: string): Promise<any> =>
		invoke("git_diff_untracked", { projectPath, filePath }),

	stage: (projectPath: string, filePath: string): Promise<void> =>
		invoke("git_stage", { projectPath, filePath }),

	stageAll: (projectPath: string): Promise<void> =>
		invoke("git_stage_all", { projectPath }),

	unstage: (projectPath: string, filePath: string): Promise<void> =>
		invoke("git_unstage", { projectPath, filePath }),

	unstageAll: (projectPath: string): Promise<void> =>
		invoke("git_unstage_all", { projectPath }),

	discard: (projectPath: string, filePath: string): Promise<void> =>
		invoke("git_discard", { projectPath, filePath }),

	openFile: (projectPath: string, filePath: string): Promise<void> =>
		invoke("git_open_file", { projectPath, filePath }),

	commit: (projectPath: string, message: string): Promise<any> =>
		invoke("git_commit", { projectPath, message }),

	push: (projectPath: string): Promise<any> =>
		invoke("git_push", { projectPath }),

	pull: (projectPath: string): Promise<any> =>
		invoke("git_pull", { projectPath }),

	fetch: (projectPath: string): Promise<any> =>
		invoke("git_fetch", { projectPath }),

	history: (projectPath: string, limit?: number): Promise<any[]> =>
		invoke("git_history", { projectPath, limit: limit || null }),

	branches: (projectPath: string): Promise<any[]> =>
		invoke("git_branches", { projectPath }),

	checkout: (projectPath: string, branch: string): Promise<any> =>
		invoke("git_checkout", { projectPath, branch }),

	createBranch: (projectPath: string, branchName: string): Promise<any> =>
		invoke("git_create_branch", { projectPath, branchName }),

	publishBranch: (projectPath: string): Promise<any> =>
		invoke("git_publish_branch", { projectPath }),

	stashList: (projectPath: string): Promise<any[]> =>
		invoke("git_stash_list", { projectPath }),

	stashSave: (projectPath: string, message?: string): Promise<any> =>
		invoke("git_stash_save", { projectPath, message: message || null }),

	stashPop: (projectPath: string, index?: number): Promise<any> =>
		invoke("git_stash_pop", { projectPath, index: index ?? null }),

	stashApply: (projectPath: string, index?: number): Promise<any> =>
		invoke("git_stash_apply", { projectPath, index: index ?? null }),

	stashDrop: (projectPath: string, index?: number): Promise<any> =>
		invoke("git_stash_drop", { projectPath, index: index ?? null }),
};

// ─── Theme ───────────────────────────────────────────────────────────────────

export const theme = {
	get: (): Promise<AppTheme> => invoke("theme_get"),
	set: async (themeId: string): Promise<AppTheme> => {
		await invoke("theme_set", { themeId });
		// Return the theme after setting it
		return invoke("theme_get");
	},
	list: (): Promise<AppTheme[]> => invoke("theme_list"),
};

// ─── App Window ──────────────────────────────────────────────────────────────

export const app = {
	minimize: () => getCurrentWindow().minimize(),
	maximize: async () => {
		const win = getCurrentWindow();
		if (await win.isMaximized()) {
			await win.unmaximize();
		} else {
			await win.maximize();
		}
	},
	close: () => getCurrentWindow().close(),
	isMaximized: () => getCurrentWindow().isMaximized(),
	getVersion: (): Promise<string> => invoke("app_get_version"),
};

// ─── Updater ─────────────────────────────────────────────────────────────────

import { check as checkUpdate } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

type UpdaterCallbacks = {
	onChecking: Set<() => void>;
	onAvailable: Set<(info: any) => void>;
	onNotAvailable: Set<() => void>;
	onProgress: Set<(progress: any) => void>;
	onDownloaded: Set<(info: any) => void>;
	onError: Set<(error: string) => void>;
};

const updaterCallbacks: UpdaterCallbacks = {
	onChecking: new Set(),
	onAvailable: new Set(),
	onNotAvailable: new Set(),
	onProgress: new Set(),
	onDownloaded: new Set(),
	onError: new Set(),
};

export const updater = {
	check: async (): Promise<any> => {
		for (const cb of updaterCallbacks.onChecking) cb();
		try {
			const update = await checkUpdate();
			if (update) {
				for (const cb of updaterCallbacks.onAvailable) cb({ version: update.version, body: update.body });
				return { available: true, version: update.version };
			} else {
				for (const cb of updaterCallbacks.onNotAvailable) cb();
				return { available: false, version: "" };
			}
		} catch (e: any) {
			for (const cb of updaterCallbacks.onError) cb(e?.message || String(e));
			return { available: false, version: "" };
		}
	},
	download: async (): Promise<void> => {
		try {
			const update = await checkUpdate();
			if (update) {
				let downloaded = 0;
				await update.downloadAndInstall((event) => {
					if (event.event === "Started") {
						for (const cb of updaterCallbacks.onProgress) cb({ percent: 0, total: event.data.contentLength });
					} else if (event.event === "Progress") {
						downloaded += event.data.chunkLength;
						for (const cb of updaterCallbacks.onProgress) cb({ percent: downloaded, transferred: downloaded });
					} else if (event.event === "Finished") {
						for (const cb of updaterCallbacks.onDownloaded) cb({ version: update.version });
					}
				});
			}
		} catch (e: any) {
			for (const cb of updaterCallbacks.onError) cb(e?.message || String(e));
		}
	},
	install: async (): Promise<void> => {
		await relaunch();
	},
	onChecking: (cb: () => void) => { updaterCallbacks.onChecking.add(cb); return () => { updaterCallbacks.onChecking.delete(cb); }; },
	onAvailable: (cb: (info: any) => void) => { updaterCallbacks.onAvailable.add(cb); return () => { updaterCallbacks.onAvailable.delete(cb); }; },
	onNotAvailable: (cb: () => void) => { updaterCallbacks.onNotAvailable.add(cb); return () => { updaterCallbacks.onNotAvailable.delete(cb); }; },
	onProgress: (cb: (progress: any) => void) => { updaterCallbacks.onProgress.add(cb); return () => { updaterCallbacks.onProgress.delete(cb); }; },
	onDownloaded: (cb: (info: any) => void) => { updaterCallbacks.onDownloaded.add(cb); return () => { updaterCallbacks.onDownloaded.delete(cb); }; },
	onError: (cb: (error: string) => void) => { updaterCallbacks.onError.add(cb); return () => { updaterCallbacks.onError.delete(cb); }; },
};

// ─── Notification ────────────────────────────────────────────────────────────

// Global notification listener
type NotificationCallback = (notification: any) => void;
const notificationReceivedListeners = new Set<NotificationCallback>();
const notificationNavigateListeners = new Set<NotificationCallback>();

listen<any>("notification:received", (event) => {
	for (const cb of notificationReceivedListeners) {
		cb(event.payload);
	}
});

listen<any>("notification:navigate", (event) => {
	for (const cb of notificationNavigateListeners) {
		cb(event.payload);
	}
});

export const notification = {
	list: (): Promise<any[]> => invoke("notification_list"),
	unreadCount: (): Promise<number> => invoke("notification_unread_count"),
	markRead: (id: string): Promise<void> => invoke("notification_mark_read", { id }),
	markAllRead: (): Promise<void> => invoke("notification_mark_all_read"),
	remove: (id: string): Promise<void> => invoke("notification_remove", { id }),
	clear: (): Promise<void> => invoke("notification_clear"),
	getSettings: (): Promise<any> => invoke("notification_get_settings"),
	updateSettings: (settings: any): Promise<any> => invoke("notification_update_settings", { settings }),
	getPort: (): Promise<number | null> => invoke("notification_get_port"),
	onReceived: (cb: (n: any) => void) => {
		notificationReceivedListeners.add(cb);
		return () => { notificationReceivedListeners.delete(cb); };
	},
	onNavigate: (cb: (n: any) => void) => {
		notificationNavigateListeners.add(cb);
		return () => { notificationNavigateListeners.delete(cb); };
	},
	getProviders: (): Promise<any[]> => invoke("notification_get_providers"),
	installHook: (providerId: string): Promise<void> => invoke("notification_install_hook", { providerId }),
	uninstallHook: (providerId: string): Promise<void> => invoke("notification_uninstall_hook", { providerId }),
	uploadSound: async (): Promise<any> => {
		const selected = await open({
			multiple: false,
			filters: [{ name: "Audio", extensions: ["wav", "mp3", "ogg"] }],
		});
		if (!selected) return { success: false };
		// Copy file to app data and update settings
		return invoke("notification_upload_sound", { path: selected });
	},
	removeCustomSound: (): Promise<void> => invoke("notification_remove_custom_sound"),
	getSoundPath: (): Promise<string | null> => invoke("notification_get_sound_path"),
};

// ─── Discord Presence ────────────────────────────────────────────────────────

export const discord = {
	connect: (): Promise<boolean> => invoke("discord_presence_connect"),
	disconnect: (): Promise<boolean> => invoke("discord_presence_disconnect"),
	update: (details: string, status?: string): Promise<boolean> =>
		invoke("discord_presence_update", { details, status: status || null }),
	isConnected: (): Promise<boolean> => invoke("discord_presence_is_connected"),
};

// ─── Combined API (drop-in replacement for window.connexio) ──────────────────

export const connexioApi = {
	terminal,
	project,
	session,
	settings,
	workspace,
	tasks,
	pinned,
	ssh,
	git,
	theme,
	app,
	updater,
	notification,
	discord,
};

export default connexioApi;
