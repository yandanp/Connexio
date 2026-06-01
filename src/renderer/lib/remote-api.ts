/**
 * Remote API Adapter — v2 (Multiplexed WebSocket)
 *
 * Single WebSocket connection handles everything:
 * - Terminal I/O (input/output/resize)
 * - Commands (create/close terminal)
 * - State sync (pushed from server on connect)
 *
 * No REST calls except /api/auth for PIN verification.
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

let _pin: string | null = sessionStorage.getItem("connexio_remote_pin");
let _ws: WebSocket | null = null;
let _authenticated = false;
let _connected = false;

// State cache (pushed from server)
let _state: InitState | null = null;
let _stateResolvers: Array<(s: InitState) => void> = [];

interface InitState {
	projects: Project[];
	settings: AppSettings;
	workspace: WorkspaceState;
	theme: AppTheme;
	themes: AppTheme[];
	shells: ShellInfo[];
	version: string;
	terminals: string[];
}

// Terminal data listeners
type TerminalDataCallback = (id: string, data: string) => void;
const terminalDataListeners = new Set<TerminalDataCallback>();
const terminalExitListeners = new Set<(id: string) => void>();

// Pending command responses
type PendingResolve = (value: any) => void;
type PendingReject = (reason: any) => void;
const pendingCommands = new Map<string, { resolve: PendingResolve; reject: PendingReject }>();
let _reqCounter = 0;

// ─── Auth ────────────────────────────────────────────────────────────────────

export function isRemoteMode(): boolean {
	return !(window as any).__TAURI_INTERNALS__;
}

export function isAuthenticated(): boolean {
	return _authenticated;
}

export async function authenticate(pin: string): Promise<boolean> {
	const res = await fetch(`${window.location.origin}/api/auth`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ pin }),
	});

	if (!res.ok) {
		const data = await res.json();
		throw new Error(data.error || "Authentication failed");
	}

	_pin = pin;
	_authenticated = true;
	sessionStorage.setItem("connexio_remote_pin", pin);

	// Connect WebSocket
	await connectWs();
	return true;
}

export function logout() {
	_pin = null;
	_authenticated = false;
	_connected = false;
	_state = null;
	sessionStorage.removeItem("connexio_remote_pin");
	if (_ws) {
		_ws.close();
		_ws = null;
	}
}

// ─── WebSocket ───────────────────────────────────────────────────────────────

function connectWs(): Promise<void> {
	return new Promise((resolve, reject) => {
		if (_ws) _ws.close();

		const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
		_ws = new WebSocket(
			`${proto}//${window.location.host}/ws?pin=${encodeURIComponent(_pin!)}`,
		);

		_ws.onopen = () => {
			_connected = true;
			resolve();
		};

		_ws.onmessage = (event) => {
			handleServerMessage(event.data);
		};

		_ws.onclose = () => {
			_connected = false;
			// Auto-reconnect
			setTimeout(() => {
				if (_authenticated && _pin) {
					connectWs().catch(() => {});
				}
			}, 2000);
		};

		_ws.onerror = () => {
			_connected = false;
			reject(new Error("WebSocket connection failed"));
		};
	});
}

function handleServerMessage(raw: string) {
	try {
		const msg = JSON.parse(raw);
		switch (msg.ch) {
			case "term": {
				for (const cb of terminalDataListeners) {
					cb(msg.id, msg.data);
				}
				break;
			}
			case "term_exit": {
				for (const cb of terminalExitListeners) {
					cb(msg.id);
				}
				break;
			}
			case "term_created": {
				const pending = pendingCommands.get(msg.req_id);
				if (pending) {
					pending.resolve(msg.id);
					pendingCommands.delete(msg.req_id);
				}
				break;
			}
			case "error": {
				const pending = pendingCommands.get(msg.req_id);
				if (pending) {
					pending.reject(new Error(msg.error));
					pendingCommands.delete(msg.req_id);
				}
				break;
			}
			case "state": {
				_state = msg.data;
				// Resolve any waiters
				for (const resolve of _stateResolvers) {
					resolve(_state!);
				}
				_stateResolvers = [];
				break;
			}
		}
	} catch {
		// Ignore non-JSON
	}
}

function send(msg: object) {
	if (_ws && _ws.readyState === WebSocket.OPEN) {
		_ws.send(JSON.stringify(msg));
	}
}

function sendCommand(msg: object): Promise<string> {
	const reqId = `req-${++_reqCounter}`;
	return new Promise((resolve, reject) => {
		pendingCommands.set(reqId, { resolve, reject });
		send({ ...msg, req_id: reqId });
		// Timeout after 10s
		setTimeout(() => {
			if (pendingCommands.has(reqId)) {
				pendingCommands.delete(reqId);
				reject(new Error("Command timeout"));
			}
		}, 10000);
	});
}

function waitForState(): Promise<InitState> {
	if (_state) return Promise.resolve(_state);
	return new Promise((resolve) => {
		_stateResolvers.push(resolve);
	});
}

// Auto-reconnect on load if PIN exists
if (_pin) {
	fetch(`${window.location.origin}/api/auth`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ pin: _pin }),
	}).then((res) => {
		if (res.ok) {
			_authenticated = true;
			connectWs().catch(() => {});
		} else {
			logout();
		}
	}).catch(() => {});
}

// ─── Terminal API ────────────────────────────────────────────────────────────

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

	onData: (callback: (id: string, data: string) => void): (() => void) => {
		terminalDataListeners.add(callback);
		return () => { terminalDataListeners.delete(callback); };
	},
};

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

// ─── Session ─────────────────────────────────────────────────────────────────

export const session = {
	save: (_sess: Session): Promise<void> => Promise.resolve(),
	load: (_id: string): Promise<Session | null> => Promise.resolve(null),
	list: (): Promise<Session[]> => Promise.resolve([]),
	delete: (_id: string): Promise<void> => Promise.resolve(),
};

// ─── Settings ────────────────────────────────────────────────────────────────

export const settings = {
	get: async (): Promise<AppSettings> => {
		const s = await waitForState();
		return s.settings;
	},

	set: async (_s: AppSettings): Promise<AppSettings> => {
		// Settings changes not supported in remote mode
		const s = await waitForState();
		return s.settings;
	},

	getShells: async (): Promise<ShellInfo[]> => {
		const s = await waitForState();
		return s.shells;
	},

	getDefaultShell: async (): Promise<string> => {
		const s = await waitForState();
		return s.settings.defaultShell || "";
	},
};

// ─── Workspace ───────────────────────────────────────────────────────────────

export const workspace = {
	getState: async (): Promise<WorkspaceState> => {
		const s = await waitForState();
		return s.workspace;
	},

	saveState: (_state: WorkspaceState): Promise<void> => Promise.resolve(),
};

// ─── Tasks ───────────────────────────────────────────────────────────────────

export const tasks = {
	detect: (_projectPath: string): Promise<TaskScript[]> => Promise.resolve([]),
};

// ─── Pinned Commands ─────────────────────────────────────────────────────────

export const pinned = {
	list: (_projectId: string): Promise<PinnedCommand[]> => Promise.resolve([]),
	save: (_projectId: string, _commands: PinnedCommand[]): Promise<void> => Promise.resolve(),
};

// ─── SSH (limited) ───────────────────────────────────────────────────────────

export const ssh = {
	list: (_projectId: string): Promise<SSHConnection[]> => Promise.resolve([]),
	save: (_projectId: string, _connections: SSHConnection[]): Promise<void> => Promise.resolve(),
	listGlobal: (): Promise<SSHConnection[]> => Promise.resolve([]),
	saveGlobal: (_connections: SSHConnection[]): Promise<void> => Promise.resolve(),
	buildCommand: (_connection: SSHConnection): Promise<string> => Promise.resolve(""),
	buildCommandArgs: (_connection: SSHConnection): Promise<string[]> => Promise.resolve([]),
	testConnection: (_connection: SSHConnection, _password?: string): Promise<SSHConnectionTestResult> =>
		Promise.resolve({ success: false, error: "Not available in remote mode" } as any),
	setSecret: (_key: string, _value: string): Promise<void> => Promise.resolve(),
	getSecret: (_key: string): Promise<string | null> => Promise.resolve(null),
	deleteSecret: (_key: string): Promise<void> => Promise.resolve(),
	listKnownHosts: (): Promise<SSHKnownHost[]> => Promise.resolve([]),
	trustHost: (_host: string, _port: number, _fp: string): Promise<void> => Promise.resolve(),
	forgetHost: (_host: string, _port: number): Promise<void> => Promise.resolve(),
	sftpList: (_c: SSHConnection, _p: string, _pw?: string): Promise<SFTPEntry[]> => Promise.resolve([]),
	sftpDownload: (): Promise<void> => Promise.reject(new Error("Not available")),
	sftpUpload: (): Promise<void> => Promise.reject(new Error("Not available")),
	sftpRead: (_c: SSHConnection, _p: string, _pw?: string): Promise<string> => Promise.resolve(""),
	sftpWrite: (): Promise<void> => Promise.resolve(),
	sftpMkdir: (): Promise<void> => Promise.resolve(),
	sftpDelete: (): Promise<void> => Promise.resolve(),
	sftpRename: (): Promise<void> => Promise.resolve(),
	forgetOpenSSHHost: (_h: string, _p: number): Promise<string> => Promise.resolve(""),
	selectKey: (): Promise<string | null> => Promise.resolve(null),
	keyExists: (_keyPath: string): Promise<boolean> => Promise.resolve(false),
};

// ─── Git ─────────────────────────────────────────────────────────────────────

export const git = {
	status: (_projectPath: string): Promise<GitStatus> =>
		Promise.resolve({ branch: "", ahead: 0, behind: 0, staged: 0, modified: 0, untracked: 0 } as any),
	changedFiles: (_projectPath: string): Promise<any[]> => Promise.resolve([]),
	diff: (): Promise<any> => Promise.resolve(null),
	diffUntracked: (): Promise<any> => Promise.resolve(null),
	stage: (): Promise<void> => Promise.resolve(),
	stageAll: (): Promise<void> => Promise.resolve(),
	unstage: (): Promise<void> => Promise.resolve(),
	unstageAll: (): Promise<void> => Promise.resolve(),
	discard: (): Promise<void> => Promise.resolve(),
	openFile: (): Promise<void> => Promise.resolve(),
	commit: (): Promise<any> => Promise.resolve(null),
	push: (): Promise<any> => Promise.resolve(null),
	pull: (): Promise<any> => Promise.resolve(null),
	fetch: (): Promise<any> => Promise.resolve(null),
	history: (): Promise<any[]> => Promise.resolve([]),
	branches: (): Promise<any[]> => Promise.resolve([]),
	checkout: (): Promise<any> => Promise.resolve(null),
	createBranch: (): Promise<any> => Promise.resolve(null),
	publishBranch: (): Promise<any> => Promise.resolve(null),
	stashList: (): Promise<any[]> => Promise.resolve([]),
	stashSave: (): Promise<any> => Promise.resolve(null),
	stashPop: (): Promise<any> => Promise.resolve(null),
	stashApply: (): Promise<any> => Promise.resolve(null),
	stashDrop: (): Promise<any> => Promise.resolve(null),
};

// ─── Theme ───────────────────────────────────────────────────────────────────

export const theme = {
	get: async (): Promise<AppTheme> => {
		const s = await waitForState();
		return s.theme;
	},
	set: async (_themeId: string): Promise<AppTheme> => {
		const s = await waitForState();
		return s.theme;
	},
	list: async (): Promise<AppTheme[]> => {
		const s = await waitForState();
		return s.themes;
	},
};

// ─── App Window (no-op) ─────────────────────────────────────────────────────

export const app = {
	minimize: () => Promise.resolve(),
	maximize: () => Promise.resolve(),
	close: () => Promise.resolve(),
	isMaximized: () => Promise.resolve(false),
	getVersion: async (): Promise<string> => {
		const s = await waitForState();
		return s.version;
	},
};

// ─── Updater (disabled) ─────────────────────────────────────────────────────

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

// ─── Notification (minimal) ─────────────────────────────────────────────────

export const notification = {
	list: (): Promise<any[]> => Promise.resolve([]),
	unreadCount: (): Promise<number> => Promise.resolve(0),
	markRead: (_id: string): Promise<void> => Promise.resolve(),
	markAllRead: (): Promise<void> => Promise.resolve(),
	remove: (_id: string): Promise<void> => Promise.resolve(),
	clear: (): Promise<void> => Promise.resolve(),
	getSettings: (): Promise<any> => Promise.resolve({ enabled: false }),
	updateSettings: (_s: any): Promise<any> => Promise.resolve({}),
	getPort: (): Promise<number | null> => Promise.resolve(null),
	onReceived: (_cb: (n: any) => void) => () => {},
	onNavigate: (_cb: (n: any) => void) => () => {},
	getProviders: (): Promise<any[]> => Promise.resolve([]),
	installHook: (_id: string): Promise<void> => Promise.resolve(),
	uninstallHook: (_id: string): Promise<void> => Promise.resolve(),
	uploadSound: async () => ({ success: false }),
	removeCustomSound: (): Promise<void> => Promise.resolve(),
	getSoundPath: (): Promise<string | null> => Promise.resolve(null),
};

// ─── Discord (disabled) ─────────────────────────────────────────────────────

export const discord = {
	connect: () => Promise.resolve(false),
	disconnect: () => Promise.resolve(false),
	update: () => Promise.resolve(false),
	isConnected: () => Promise.resolve(false),
};

// ─── Remote ─────────────────────────────────────────────────────────────────

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
