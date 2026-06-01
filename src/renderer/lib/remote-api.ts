/**
 * Remote API Adapter
 *
 * Provides the same interface as tauri-api.ts but routes calls through
 * HTTP REST + WebSocket to the Connexio remote server.
 * Used when the app is accessed from a browser (remote mode).
 */

import type {
	AppSettings,
	PinnedCommand,
	Project,
	Session,
	SSHConnection,
	SSHConnectionTestResult,
	SSHKnownHost,
	SFTPEntry,
	WorkspaceState,
	GitStatus,
	TaskScript,
	ShellInfo,
	AppTheme,
} from "@shared/types";

// ─── Connection State ────────────────────────────────────────────────────────

let _token: string | null = sessionStorage.getItem("connexio_remote_token");
let _baseUrl = window.location.origin;
let _ws: WebSocket | null = null;
let _authenticated = false;

// Terminal data listeners (same pattern as tauri-api)
type TerminalDataCallback = (id: string, data: string) => void;
const terminalDataListeners = new Set<TerminalDataCallback>();
const terminalExitListeners = new Set<(id: string) => void>();

// State sync listeners
type StateSyncCallback = (event: string, payload: any) => void;
const stateSyncListeners = new Set<StateSyncCallback>();

// ─── Auth ────────────────────────────────────────────────────────────────────

export function isRemoteMode(): boolean {
	return !(window as any).__TAURI_INTERNALS__;
}

export function isAuthenticated(): boolean {
	return _authenticated && !!_token;
}

export async function authenticate(pin: string): Promise<boolean> {
	const res = await fetch(`${_baseUrl}/api/auth`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ pin }),
	});

	if (!res.ok) {
		const data = await res.json();
		throw new Error(data.error || "Authentication failed");
	}

	const data = await res.json();
	_token = data.token;
	_authenticated = true;
	sessionStorage.setItem("connexio_remote_token", _token!);
	connectWebSocket();
	return true;
}

export function logout() {
	_token = null;
	_authenticated = false;
	sessionStorage.removeItem("connexio_remote_token");
	if (_ws) {
		_ws.close();
		_ws = null;
	}
}

// ─── HTTP Helper ─────────────────────────────────────────────────────────────

async function apiCall<T>(path: string, options?: RequestInit): Promise<T> {
	const res = await fetch(`${_baseUrl}${path}`, {
		...options,
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${_token}`,
			...(options?.headers || {}),
		},
	});

	if (res.status === 401) {
		_authenticated = false;
		throw new Error("Session expired");
	}

	if (!res.ok) {
		const data = await res.json().catch(() => ({ error: "Request failed" }));
		throw new Error(data.error || `HTTP ${res.status}`);
	}

	return res.json();
}

// ─── WebSocket ───────────────────────────────────────────────────────────────

function connectWebSocket() {
	if (_ws) _ws.close();

	const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
	_ws = new WebSocket(
		`${wsProtocol}//${window.location.host}/ws/sync?token=${encodeURIComponent(_token!)}`,
	);

	_ws.onmessage = (event) => {
		try {
			const msg = JSON.parse(event.data);
			switch (msg.type) {
				case "terminal:data": {
					const { id, data } = msg;
					for (const cb of terminalDataListeners) {
						cb(id, data);
					}
					break;
				}
				case "terminal:exit": {
					const { id } = msg;
					for (const cb of terminalExitListeners) {
						cb(id);
					}
					break;
				}
				case "state:sync": {
					for (const cb of stateSyncListeners) {
						cb(msg.event, msg.payload);
					}
					break;
				}
			}
		} catch {
			// Non-JSON message, ignore
		}
	};

	_ws.onclose = () => {
		// Reconnect after 3s
		setTimeout(() => {
			if (_authenticated && _token) {
				connectWebSocket();
			}
		}, 3000);
	};
}

// Reconnect on load if token exists
if (_token) {
	// Verify token is still valid
	fetch(`${_baseUrl}/api/terminals`, {
		headers: { Authorization: `Bearer ${_token}` },
	}).then((res) => {
		if (res.ok) {
			_authenticated = true;
			connectWebSocket();
		} else {
			logout();
		}
	}).catch(() => {
		// Server not reachable
	});
}

// ─── Terminal API ────────────────────────────────────────────────────────────

interface TerminalContext {
	projectId: string;
	projectName: string;
	tabId: string;
	tabLabel: string;
}

// Per-terminal WebSocket connections for I/O
const terminalSockets = new Map<string, WebSocket>();
const terminalWriteQueues = new Map<string, string[]>();

function getOrCreateTerminalWs(termId: string): WebSocket | null {
	if (!_token) return null;

	const existing = terminalSockets.get(termId);
	if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
		return existing;
	}

	// Close stale socket
	if (existing) {
		existing.close();
		terminalSockets.delete(termId);
	}

	const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
	const ws = new WebSocket(
		`${wsProtocol}//${window.location.host}/ws/terminal/${termId}?token=${encodeURIComponent(_token!)}`,
	);

	ws.onopen = () => {
		// Flush queued writes
		const queue = terminalWriteQueues.get(termId);
		if (queue) {
			for (const msg of queue) {
				ws.send(msg);
			}
			terminalWriteQueues.delete(termId);
		}
	};

	ws.onmessage = (event) => {
		// Terminal output comes as plain text from the relay
		const data = event.data;
		for (const cb of terminalDataListeners) {
			cb(termId, data);
		}
	};

	ws.onclose = () => {
		terminalSockets.delete(termId);
		terminalWriteQueues.delete(termId);
		for (const cb of terminalExitListeners) {
			cb(termId);
		}
	};

	ws.onerror = () => {
		terminalSockets.delete(termId);
		terminalWriteQueues.delete(termId);
	};

	terminalSockets.set(termId, ws);
	return ws;
}

function sendToTerminalWs(termId: string, message: string) {
	const ws = getOrCreateTerminalWs(termId);
	if (!ws) return;

	if (ws.readyState === WebSocket.OPEN) {
		ws.send(message);
	} else {
		// Queue until open
		const queue = terminalWriteQueues.get(termId) || [];
		queue.push(message);
		terminalWriteQueues.set(termId, queue);
	}
}

function closeTerminalWs(termId: string) {
	const ws = terminalSockets.get(termId);
	if (ws) {
		ws.close();
		terminalSockets.delete(termId);
	}
}

export const terminal = {
	create: async (
		projectPath: string,
		shell?: string,
		context?: TerminalContext,
	): Promise<string> => {
		const id: string = await apiCall("/api/terminal/create", {
			method: "POST",
			body: JSON.stringify({ projectPath, shell, context }),
		});
		// Connect WebSocket for this terminal immediately
		getOrCreateTerminalWs(id);
		return id;
	},

	createCommand: async (
		projectPath: string,
		command: string[],
		context?: TerminalContext,
	): Promise<string> => {
		const id: string = await apiCall("/api/terminal/create-command", {
			method: "POST",
			body: JSON.stringify({ projectPath, command, context }),
		});
		getOrCreateTerminalWs(id);
		return id;
	},

	createSsh: async (
		connection: SSHConnection,
		password?: string,
		cols?: number,
		rows?: number,
	): Promise<string> => {
		const id: string = await apiCall("/api/terminal/create-ssh", {
			method: "POST",
			body: JSON.stringify({ connection, password, cols, rows }),
		});
		getOrCreateTerminalWs(id);
		return id;
	},

	write: (id: string, data: string): Promise<void> => {
		sendToTerminalWs(id, JSON.stringify({ type: "input", data }));
		return Promise.resolve();
	},

	resize: (id: string, cols: number, rows: number): Promise<void> => {
		sendToTerminalWs(id, JSON.stringify({ type: "resize", cols: Math.round(cols), rows: Math.round(rows) }));
		return Promise.resolve();
	},

	close: async (id: string): Promise<void> => {
		closeTerminalWs(id);
		return apiCall(`/api/terminal/${id}/close`, { method: "POST" });
	},

	onData: (callback: (id: string, data: string) => void): (() => void) => {
		terminalDataListeners.add(callback);
		return () => {
			terminalDataListeners.delete(callback);
		};
	},
};

// ─── Projects ────────────────────────────────────────────────────────────────

export const project = {
	list: (): Promise<Project[]> => apiCall("/api/projects"),

	add: (proj: Project): Promise<Project[]> =>
		apiCall("/api/projects", { method: "POST", body: JSON.stringify(proj) }),

	update: (proj: Project): Promise<Project[]> =>
		apiCall("/api/projects/update", {
			method: "POST",
			body: JSON.stringify(proj),
		}),

	reorder: (ids: string[]): Promise<Project[]> =>
		apiCall("/api/projects/reorder", {
			method: "POST",
			body: JSON.stringify({ ids }),
		}),

	delete: (id: string): Promise<Project[]> =>
		apiCall(`/api/projects/${id}`, { method: "DELETE" }),

	selectDir: async (): Promise<string | null> => {
		// Not available in remote mode — show a prompt instead
		const path = window.prompt("Enter project directory path:");
		return path || null;
	},
};

// ─── Session ─────────────────────────────────────────────────────────────────

export const session = {
	save: (sess: Session): Promise<void> =>
		apiCall("/api/sessions/save", {
			method: "POST",
			body: JSON.stringify(sess),
		}),

	load: (id: string): Promise<Session | null> =>
		apiCall(`/api/sessions/${id}`),

	list: (): Promise<Session[]> => apiCall("/api/sessions"),

	delete: (id: string): Promise<void> =>
		apiCall(`/api/sessions/${id}`, { method: "DELETE" }),
};

// ─── Settings ────────────────────────────────────────────────────────────────

export const settings = {
	get: (): Promise<AppSettings> => apiCall("/api/settings"),

	set: (s: AppSettings): Promise<AppSettings> =>
		apiCall("/api/settings", { method: "POST", body: JSON.stringify(s) }),

	getShells: (): Promise<ShellInfo[]> => apiCall("/api/settings/shells"),

	getDefaultShell: (): Promise<string> =>
		apiCall("/api/settings/default-shell"),
};

// ─── Workspace ───────────────────────────────────────────────────────────────

export const workspace = {
	getState: (): Promise<WorkspaceState> => apiCall("/api/workspace"),

	saveState: (state: WorkspaceState): Promise<void> =>
		apiCall("/api/workspace", { method: "POST", body: JSON.stringify(state) }),
};

// ─── Tasks ───────────────────────────────────────────────────────────────────

export const tasks = {
	detect: (projectPath: string): Promise<TaskScript[]> =>
		apiCall("/api/tasks/detect", {
			method: "POST",
			body: JSON.stringify({ projectPath }),
		}),
};

// ─── Pinned Commands ─────────────────────────────────────────────────────────

export const pinned = {
	list: (projectId: string): Promise<PinnedCommand[]> =>
		apiCall(`/api/pinned/${projectId}`),

	save: (projectId: string, commands: PinnedCommand[]): Promise<void> =>
		apiCall(`/api/pinned/${projectId}`, {
			method: "POST",
			body: JSON.stringify({ commands }),
		}),
};

// ─── SSH (limited in remote mode) ────────────────────────────────────────────

export const ssh = {
	list: (projectId: string): Promise<SSHConnection[]> =>
		apiCall(`/api/ssh/${projectId}`),

	save: (projectId: string, connections: SSHConnection[]): Promise<void> =>
		apiCall(`/api/ssh/${projectId}`, {
			method: "POST",
			body: JSON.stringify({ connections }),
		}),

	listGlobal: (): Promise<SSHConnection[]> => apiCall("/api/ssh/global"),

	saveGlobal: (connections: SSHConnection[]): Promise<void> =>
		apiCall("/api/ssh/global", {
			method: "POST",
			body: JSON.stringify({ connections }),
		}),

	buildCommand: (connection: SSHConnection): Promise<string> =>
		apiCall("/api/ssh/build-command", {
			method: "POST",
			body: JSON.stringify(connection),
		}),

	buildCommandArgs: (connection: SSHConnection): Promise<string[]> =>
		apiCall("/api/ssh/build-command-args", {
			method: "POST",
			body: JSON.stringify(connection),
		}),

	testConnection: (
		connection: SSHConnection,
		password?: string,
	): Promise<SSHConnectionTestResult> =>
		apiCall("/api/ssh/test", {
			method: "POST",
			body: JSON.stringify({ connection, password }),
		}),

	setSecret: (_key: string, _value: string): Promise<void> =>
		Promise.reject(new Error("Not available in remote mode")),

	getSecret: (_key: string): Promise<string | null> =>
		Promise.resolve(null),

	deleteSecret: (_key: string): Promise<void> =>
		Promise.reject(new Error("Not available in remote mode")),

	listKnownHosts: (): Promise<SSHKnownHost[]> =>
		apiCall("/api/ssh/known-hosts"),

	trustHost: (
		host: string,
		port: number,
		fingerprintSha256: string,
	): Promise<void> =>
		apiCall("/api/ssh/trust-host", {
			method: "POST",
			body: JSON.stringify({ host, port, fingerprintSha256 }),
		}),

	forgetHost: (host: string, port: number): Promise<void> =>
		apiCall("/api/ssh/forget-host", {
			method: "POST",
			body: JSON.stringify({ host, port }),
		}),

	sftpList: (
		connection: SSHConnection,
		path: string,
		password?: string,
	): Promise<SFTPEntry[]> =>
		apiCall("/api/ssh/sftp/list", {
			method: "POST",
			body: JSON.stringify({ connection, path, password }),
		}),

	sftpDownload: (
		_connection: SSHConnection,
		_remotePath: string,
		_localPath: string,
		_password?: string,
	): Promise<void> =>
		Promise.reject(new Error("File download not available in remote mode")),

	sftpUpload: (
		_connection: SSHConnection,
		_localPath: string,
		_remotePath: string,
		_password?: string,
	): Promise<void> =>
		Promise.reject(new Error("File upload not available in remote mode")),

	sftpRead: (
		connection: SSHConnection,
		path: string,
		password?: string,
	): Promise<string> =>
		apiCall("/api/ssh/sftp/read", {
			method: "POST",
			body: JSON.stringify({ connection, path, password }),
		}),

	sftpWrite: (
		connection: SSHConnection,
		path: string,
		content: string,
		password?: string,
	): Promise<void> =>
		apiCall("/api/ssh/sftp/write", {
			method: "POST",
			body: JSON.stringify({ connection, path, content, password }),
		}),

	sftpMkdir: (
		connection: SSHConnection,
		path: string,
		password?: string,
	): Promise<void> =>
		apiCall("/api/ssh/sftp/mkdir", {
			method: "POST",
			body: JSON.stringify({ connection, path, password }),
		}),

	sftpDelete: (
		connection: SSHConnection,
		path: string,
		isDir: boolean,
		password?: string,
	): Promise<void> =>
		apiCall("/api/ssh/sftp/delete", {
			method: "POST",
			body: JSON.stringify({ connection, path, isDir, password }),
		}),

	sftpRename: (
		connection: SSHConnection,
		oldPath: string,
		newPath: string,
		password?: string,
	): Promise<void> =>
		apiCall("/api/ssh/sftp/rename", {
			method: "POST",
			body: JSON.stringify({ connection, oldPath, newPath, password }),
		}),

	forgetOpenSSHHost: (host: string, port: number): Promise<string> =>
		apiCall("/api/ssh/forget-openssh-host", {
			method: "POST",
			body: JSON.stringify({ host, port }),
		}),

	selectKey: async (): Promise<string | null> => {
		const path = window.prompt("Enter SSH key path:");
		return path || null;
	},

	keyExists: (keyPath: string): Promise<boolean> =>
		apiCall("/api/ssh/key-exists", {
			method: "POST",
			body: JSON.stringify({ keyPath }),
		}),
};

// ─── Git ─────────────────────────────────────────────────────────────────────

export const git = {
	status: (projectPath: string): Promise<GitStatus> =>
		apiCall("/api/git/status", {
			method: "POST",
			body: JSON.stringify({ projectPath }),
		}),

	changedFiles: (projectPath: string): Promise<any[]> =>
		apiCall("/api/git/changed-files", {
			method: "POST",
			body: JSON.stringify({ projectPath }),
		}),

	diff: (projectPath: string, filePath: string, staged: boolean): Promise<any> =>
		apiCall("/api/git/diff", {
			method: "POST",
			body: JSON.stringify({ projectPath, filePath, staged }),
		}),

	diffUntracked: (projectPath: string, filePath: string): Promise<any> =>
		apiCall("/api/git/diff-untracked", {
			method: "POST",
			body: JSON.stringify({ projectPath, filePath }),
		}),

	stage: (projectPath: string, filePath: string): Promise<void> =>
		apiCall("/api/git/stage", {
			method: "POST",
			body: JSON.stringify({ projectPath, filePath }),
		}),

	stageAll: (projectPath: string): Promise<void> =>
		apiCall("/api/git/stage-all", {
			method: "POST",
			body: JSON.stringify({ projectPath }),
		}),

	unstage: (projectPath: string, filePath: string): Promise<void> =>
		apiCall("/api/git/unstage", {
			method: "POST",
			body: JSON.stringify({ projectPath, filePath }),
		}),

	unstageAll: (projectPath: string): Promise<void> =>
		apiCall("/api/git/unstage-all", {
			method: "POST",
			body: JSON.stringify({ projectPath }),
		}),

	discard: (projectPath: string, filePath: string): Promise<void> =>
		apiCall("/api/git/discard", {
			method: "POST",
			body: JSON.stringify({ projectPath, filePath }),
		}),

	openFile: (projectPath: string, filePath: string): Promise<void> =>
		apiCall("/api/git/open-file", {
			method: "POST",
			body: JSON.stringify({ projectPath, filePath }),
		}),

	commit: (projectPath: string, message: string): Promise<any> =>
		apiCall("/api/git/commit", {
			method: "POST",
			body: JSON.stringify({ projectPath, message }),
		}),

	push: (projectPath: string): Promise<any> =>
		apiCall("/api/git/push", {
			method: "POST",
			body: JSON.stringify({ projectPath }),
		}),

	pull: (projectPath: string): Promise<any> =>
		apiCall("/api/git/pull", {
			method: "POST",
			body: JSON.stringify({ projectPath }),
		}),

	fetch: (projectPath: string): Promise<any> =>
		apiCall("/api/git/fetch", {
			method: "POST",
			body: JSON.stringify({ projectPath }),
		}),

	history: (projectPath: string, limit?: number): Promise<any[]> =>
		apiCall("/api/git/history", {
			method: "POST",
			body: JSON.stringify({ projectPath, limit }),
		}),

	branches: (projectPath: string): Promise<any[]> =>
		apiCall("/api/git/branches", {
			method: "POST",
			body: JSON.stringify({ projectPath }),
		}),

	checkout: (projectPath: string, branch: string): Promise<any> =>
		apiCall("/api/git/checkout", {
			method: "POST",
			body: JSON.stringify({ projectPath, branch }),
		}),

	createBranch: (projectPath: string, branchName: string): Promise<any> =>
		apiCall("/api/git/create-branch", {
			method: "POST",
			body: JSON.stringify({ projectPath, branchName }),
		}),

	publishBranch: (projectPath: string): Promise<any> =>
		apiCall("/api/git/publish-branch", {
			method: "POST",
			body: JSON.stringify({ projectPath }),
		}),

	stashList: (projectPath: string): Promise<any[]> =>
		apiCall("/api/git/stash/list", {
			method: "POST",
			body: JSON.stringify({ projectPath }),
		}),

	stashSave: (projectPath: string, message?: string): Promise<any> =>
		apiCall("/api/git/stash/save", {
			method: "POST",
			body: JSON.stringify({ projectPath, message }),
		}),

	stashPop: (projectPath: string, index?: number): Promise<any> =>
		apiCall("/api/git/stash/pop", {
			method: "POST",
			body: JSON.stringify({ projectPath, index }),
		}),

	stashApply: (projectPath: string, index?: number): Promise<any> =>
		apiCall("/api/git/stash/apply", {
			method: "POST",
			body: JSON.stringify({ projectPath, index }),
		}),

	stashDrop: (projectPath: string, index?: number): Promise<any> =>
		apiCall("/api/git/stash/drop", {
			method: "POST",
			body: JSON.stringify({ projectPath, index }),
		}),
};

// ─── Theme ───────────────────────────────────────────────────────────────────

export const theme = {
	get: (): Promise<AppTheme> => apiCall("/api/theme"),
	set: async (themeId: string): Promise<AppTheme> => {
		await apiCall("/api/theme", {
			method: "POST",
			body: JSON.stringify({ themeId }),
		});
		return apiCall("/api/theme");
	},
	list: (): Promise<AppTheme[]> => apiCall("/api/themes"),
};

// ─── App Window (no-op in remote mode) ──────────────────────────────────────

export const app = {
	minimize: () => Promise.resolve(),
	maximize: () => Promise.resolve(),
	close: () => Promise.resolve(),
	isMaximized: () => Promise.resolve(false),
	getVersion: (): Promise<string> => apiCall("/api/version"),
};

// ─── Updater (disabled in remote mode) ──────────────────────────────────────

export const updater = {
	check: async () => ({ available: false, version: "" }),
	download: async () => {},
	install: async () => {},
	onChecking: () => () => {},
	onAvailable: () => () => {},
	onNotAvailable: () => () => {},
	onProgress: () => () => {},
	onDownloaded: () => () => {},
	onError: () => () => {},
};

// ─── Notification ────────────────────────────────────────────────────────────

export const notification = {
	list: (): Promise<any[]> => apiCall("/api/notifications"),
	unreadCount: (): Promise<number> => apiCall("/api/notifications/unread-count"),
	markRead: (id: string): Promise<void> =>
		apiCall(`/api/notifications/${id}/read`, { method: "POST" }),
	markAllRead: (): Promise<void> =>
		apiCall("/api/notifications/read-all", { method: "POST" }),
	remove: (id: string): Promise<void> =>
		apiCall(`/api/notifications/${id}`, { method: "DELETE" }),
	clear: (): Promise<void> =>
		apiCall("/api/notifications/clear", { method: "POST" }),
	getSettings: (): Promise<any> => apiCall("/api/notifications/settings"),
	updateSettings: (settings: any): Promise<any> =>
		apiCall("/api/notifications/settings", {
			method: "POST",
			body: JSON.stringify(settings),
		}),
	getPort: (): Promise<number | null> => Promise.resolve(null),
	onReceived: (_cb: (n: any) => void) => () => {},
	onNavigate: (_cb: (n: any) => void) => () => {},
	getProviders: (): Promise<any[]> => apiCall("/api/notifications/providers"),
	installHook: (providerId: string): Promise<void> =>
		apiCall("/api/notifications/hooks/install", {
			method: "POST",
			body: JSON.stringify({ providerId }),
		}),
	uninstallHook: (providerId: string): Promise<void> =>
		apiCall("/api/notifications/hooks/uninstall", {
			method: "POST",
			body: JSON.stringify({ providerId }),
		}),
	uploadSound: async () => ({ success: false }),
	removeCustomSound: (): Promise<void> => Promise.resolve(),
	getSoundPath: (): Promise<string | null> => Promise.resolve(null),
};

// ─── Discord (disabled in remote mode) ──────────────────────────────────────

export const discord = {
	connect: () => Promise.resolve(false),
	disconnect: () => Promise.resolve(false),
	update: () => Promise.resolve(false),
	isConnected: () => Promise.resolve(false),
};

// ─── Remote (same as tauri-api) ─────────────────────────────────────────────

export interface RemoteStatus {
	isRunning: boolean;
	port: number;
	pin: string;
	localIp: string | null;
	connectedClients: number;
}

export const remote = {
	start: (): Promise<RemoteStatus> => Promise.resolve({
		isRunning: true,
		port: parseInt(window.location.port) || 9876,
		pin: "------",
		localIp: window.location.hostname,
		connectedClients: 1,
	}),
	stop: () => Promise.resolve(),
	status: (): Promise<RemoteStatus> => Promise.resolve({
		isRunning: true,
		port: parseInt(window.location.port) || 9876,
		pin: "------",
		localIp: window.location.hostname,
		connectedClients: 1,
	}),
	regeneratePin: () => Promise.resolve("------"),
};

// ─── Combined API ────────────────────────────────────────────────────────────

export const connexioRemoteApi = {
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
	remote,
};

export default connexioRemoteApi;
