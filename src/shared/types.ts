// ============================================
// Connexio — Shared Types
// ============================================

export interface Project {
	id: string;
	name: string;
	path: string;
	group: string;
	icon?: string;
	color?: string;
	tabs: TabConfig[];
	createdAt: number;
	lastOpenedAt: number;
}

// ─── Worktree ───────────────────────────────────────────────────────────────

/// A git worktree managed under a project's `.worktrees/` directory.
export interface WorktreeEntry {
	id: string;
	name: string;
	branch: string;
	baseRef: string;
	path: string;
	createdAt: number;
	isDirty: boolean;
	/** Optional tracker URL (GitHub PR/issue) set at creation time. */
	linkedIssueUrl?: string;
}

export interface TabConfig {
	id: string;
	label: string;
	shell?: string;
	command?: string;
}

export interface Session {
	id: string;
	projectId: string;
	tabs: SessionTab[];
	savedAt: number;
}

export interface SessionTab {
	id: string;
	tabConfigId: string;
	scrollback?: string;
	cwd: string;
}

export interface AppTheme {
	id: string;
	name: string;
	type: "dark" | "light";
	colors: ThemeColors;
	terminal: TerminalThemeColors;
}

export interface ThemeColors {
	bgPrimary: string;
	bgSecondary: string;
	bgTertiary: string;
	borderColor: string;
	accentColor: string;
	accentHover: string;
	textPrimary: string;
	textSecondary: string;
	textMuted: string;
}

export interface TerminalThemeColors {
	background: string;
	foreground: string;
	cursor: string;
	cursorAccent: string;
	selectionBackground: string;
	black: string;
	red: string;
	green: string;
	yellow: string;
	blue: string;
	magenta: string;
	cyan: string;
	white: string;
	brightBlack: string;
	brightRed: string;
	brightGreen: string;
	brightYellow: string;
	brightBlue: string;
	brightMagenta: string;
	brightCyan: string;
	brightWhite: string;
}

export interface AppSettings {
	defaultShell: string;
	fontSize: number;
	fontFamily: string;
	cursorStyle: "bar" | "block" | "underline";
	cursorBlink: boolean;
	scrollback: number;
	copyOnSelect: boolean;
	webglRenderer: boolean;
	uiFontSize: "small" | "default" | "large";
}

export interface ShellInfo {
	id: string;
	name: string;
	path: string;
}

// Persisted workspace tab (without live terminalId)
export interface WorkspaceTabState {
	id: string;
	label: string;
	shell?: string;
	type?: "terminal" | "editor" | "preview" | "remoteEditor" | "sshManager" | "sftp";
	filePath?: string;
	// Split persistence (recursive tree)
	splitTree?: {
		type: "leaf" | "branch";
		id: string;
		direction?: "horizontal" | "vertical";
		children?: WorkspaceTabState["splitTree"][];
		shell?: string;
	};
}

// Full workspace state to persist
export interface WorkspaceState {
	activeProjectId: string | null;
	projectTabs: Record<string, WorkspaceTabState[]>;
	activeTabIds: Record<string, string>;
}

// Task Runner
export interface TaskScript {
	name: string;
	command: string;
	source: "package.json" | "Makefile" | "Cargo.toml" | "pyproject.toml";
}

// Pinned Commands
export interface PinnedCommand {
	id: string;
	label: string;
	command: string;
	color?: string;
}

// SSH Connection
export type SSHAuthMethod = "password" | "key" | "agent";
export type SSHSecretProvider = "keychain" | "vault";
export type SSHTunnelType = "local" | "remote" | "dynamic";

export interface SSHSecretRef {
	provider: SSHSecretProvider;
	key: string;
}

export interface SSHIdentity {
	id: string;
	name: string;
	username?: string;
	privateKeyPath?: string;
	privateKeySecretRef?: SSHSecretRef;
	passphraseSecretRef?: SSHSecretRef;
}

export interface SSHTunnelConfig {
	id: string;
	tunnelType: SSHTunnelType;
	name?: string;
	localHost?: string;
	localPort?: number;
	remoteHost?: string;
	remotePort?: number;
	autoStart?: boolean;
}

export type SSHHostTrustStatus = "unknown" | "trusted" | "changed";

export interface SSHKnownHost {
	host: string;
	port: number;
	fingerprintSha256: string;
	trustedAt: string;
}

export interface SSHConnectionTestResult {
	success: boolean;
	message: string;
	fingerprintSha256?: string;
	authenticated: boolean;
	hostTrust: SSHHostTrustStatus;
}

export interface SFTPEntry {
	name: string;
	path: string;
	isDir: boolean;
	size?: number;
	modifiedTime?: number;
}

export interface SSHConnection {
	id: string;
	name: string;
	host: string;
	port: number;
	username: string;
	authMethod: SSHAuthMethod;
	privateKeyPath?: string;
	color?: string;
	folder?: string;
	tags?: string[];
	notes?: string;
	identityId?: string;
	passwordSecretRef?: SSHSecretRef;
	passphraseSecretRef?: SSHSecretRef;
	startupCommands?: string[];
	keepAliveSecs?: number;
	tunnels?: SSHTunnelConfig[];
}

export interface GitStatus {
	isRepo: boolean;
	branch: string;
	ahead: number;
	behind: number;
	modified: number;
	staged: number;
	untracked: number;
	conflicted: number;
	stashes: number;
	lastCommit: string;
	lastCommitTime: string;
	remoteUrl: string;
}

// Source Control
export type GitFileStatus = "M" | "A" | "D" | "R" | "C" | "U" | "?";

export interface GitChangedFile {
	path: string;
	oldPath?: string; // for renames
	indexStatus: GitFileStatus | " ";
	workTreeStatus: GitFileStatus | " ";
}

export interface GitDiffResult {
	file: string;
	hunks: GitDiffHunk[];
	isBinary?: boolean;
	isTooLarge?: boolean;
	fileSize?: number;
	truncated?: boolean;
	language?: string; // for syntax highlighting hint
}

export interface GitDiffHunk {
	header: string;
	lines: GitDiffLine[];
}

export interface GitDiffLine {
	type: "add" | "remove" | "context";
	content: string;
	oldLineNo?: number;
	newLineNo?: number;
}

// Git action result (commit, push, etc.)
export interface GitActionResult {
	success: boolean;
	message: string;
	output?: string;
}

// Git commit history entry
export interface GitCommitEntry {
	shortHash: string;
	hash: string;
	author: string;
	relativeTime: string;
	subject: string;
}

// Git branch entry
export interface GitBranchEntry {
	name: string;
	current: boolean;
	remote: boolean;
}

// Git stash entry
export interface GitStashEntry {
	index: number;
	message: string;
}

// Notifications
export type NotificationSource = "agent" | "command" | "system";

export interface ConnexioNotification {
	id: string;
	source: NotificationSource;
	provider?: string; // "claude" | "opencode" | "codex" | "pi" etc.
	title: string;
	body: string;
	tabId?: string;
	projectId?: string;
	terminalId?: string;
	projectName?: string;
	tabLabel?: string;
	timestamp: number;
	isRead: boolean;
}

export interface NotificationSettings {
	enabled: boolean;
	sound: boolean;
	soundVolume: number; // 0.0 - 1.0
	customSoundPath: string | null; // user-uploaded sound file path
	showWhenFocused: boolean;
	idleNotify: boolean; // notify when terminal goes idle
	idleThreshold: number; // seconds, for generic idle detection
}

export interface AIProvider {
	id: string;
	name: string;
	isInstalled: boolean;
	isHookInstalled: boolean;
}

// IPC Channel names
export const IPC = {
	TERMINAL_CREATE: "terminal:create",
	TERMINAL_DATA: "terminal:data",
	TERMINAL_WRITE: "terminal:write",
	TERMINAL_RESIZE: "terminal:resize",
	TERMINAL_CLOSE: "terminal:close",
	PROJECT_LIST: "project:list",
	PROJECT_ADD: "project:add",
	PROJECT_UPDATE: "project:update",
	PROJECT_DELETE: "project:delete",
	PROJECT_SELECT_DIR: "project:select-dir",
	SESSION_SAVE: "session:save",
	SESSION_LOAD: "session:load",
	SESSION_LIST: "session:list",
	SESSION_DELETE: "session:delete",
	THEME_GET: "theme:get",
	THEME_SET: "theme:set",
	THEME_LIST: "theme:list",
	APP_MINIMIZE: "app:minimize",
	APP_MAXIMIZE: "app:maximize",
	APP_CLOSE: "app:close",
	APP_IS_MAXIMIZED: "app:is-maximized",
} as const;
