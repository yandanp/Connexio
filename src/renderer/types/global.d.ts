// Type declarations for the Connexio preload API
interface ConnexioAPI {
	terminal: {
		create: (
			projectPath: string,
			shell?: string,
			context?: {
				projectId: string;
				projectName: string;
				tabId: string;
				tabLabel: string;
			},
		) => Promise<string>;
		write: (id: string, data: string) => Promise<void>;
		resize: (id: string, cols: number, rows: number) => Promise<void>;
		close: (id: string) => Promise<void>;
		onData: (callback: (id: string, data: string) => void) => () => void;
	};
	project: {
		list: () => Promise<import("../../shared/types").Project[]>;
		add: (
			project: import("../../shared/types").Project,
		) => Promise<import("../../shared/types").Project>;
		update: (
			project: import("../../shared/types").Project,
		) => Promise<import("../../shared/types").Project>;
		reorder: (ids: string[]) => Promise<import("../../shared/types").Project[]>;
		delete: (id: string) => Promise<boolean>;
		selectDir: () => Promise<string | null>;
	};
	session: {
		save: (
			session: import("../../shared/types").Session,
		) => Promise<import("../../shared/types").Session>;
		load: (id: string) => Promise<import("../../shared/types").Session | null>;
		list: () => Promise<import("../../shared/types").Session[]>;
		delete: (id: string) => Promise<boolean>;
	};
	theme: {
		get: () => Promise<import("../../shared/types").AppTheme>;
		set: (themeId: string) => Promise<import("../../shared/types").AppTheme>;
		list: () => Promise<import("../../shared/types").AppTheme[]>;
	};
	settings: {
		get: () => Promise<import("../../shared/types").AppSettings>;
		set: (
			settings: import("../../shared/types").AppSettings,
		) => Promise<import("../../shared/types").AppSettings>;
		getShells: () => Promise<import("../../shared/types").ShellInfo[]>;
		getDefaultShell: () => Promise<string>;
	};
	workspace: {
		getState: () => Promise<import("../../shared/types").WorkspaceState>;
		saveState: (
			state: import("../../shared/types").WorkspaceState,
		) => Promise<boolean>;
	};
	tasks: {
		detect: (
			projectPath: string,
		) => Promise<import("../../shared/types").TaskScript[]>;
	};
	pinned: {
		list: (
			projectId: string,
		) => Promise<import("../../shared/types").PinnedCommand[]>;
		save: (
			projectId: string,
			commands: import("../../shared/types").PinnedCommand[],
		) => Promise<import("../../shared/types").PinnedCommand[]>;
	};
	ssh: {
		list: (
			projectId: string,
		) => Promise<import("../../shared/types").SSHConnection[]>;
		save: (
			projectId: string,
			connections: import("../../shared/types").SSHConnection[],
		) => Promise<import("../../shared/types").SSHConnection[]>;
		listGlobal: () => Promise<import("../../shared/types").SSHConnection[]>;
		saveGlobal: (
			connections: import("../../shared/types").SSHConnection[],
		) => Promise<import("../../shared/types").SSHConnection[]>;
		buildCommand: (
			connection: import("../../shared/types").SSHConnection,
		) => Promise<string>;
		selectKey: () => Promise<string | null>;
		keyExists: (keyPath: string) => Promise<boolean>;
	};
	git: {
		status: (
			projectPath: string,
		) => Promise<import("../../shared/types").GitStatus>;
		changedFiles: (
			projectPath: string,
		) => Promise<import("../../shared/types").GitChangedFile[]>;
		diff: (
			projectPath: string,
			filePath: string,
			staged: boolean,
		) => Promise<import("../../shared/types").GitDiffResult>;
		diffUntracked: (
			projectPath: string,
			filePath: string,
		) => Promise<import("../../shared/types").GitDiffResult>;
		stage: (projectPath: string, filePath: string) => Promise<boolean>;
		stageAll: (projectPath: string) => Promise<boolean>;
		unstage: (projectPath: string, filePath: string) => Promise<boolean>;
		unstageAll: (projectPath: string) => Promise<boolean>;
		discard: (projectPath: string, filePath: string) => Promise<boolean>;
		openFile: (projectPath: string, filePath: string) => Promise<boolean>;
		commit: (
			projectPath: string,
			message: string,
		) => Promise<import("../../shared/types").GitActionResult>;
		push: (
			projectPath: string,
		) => Promise<import("../../shared/types").GitActionResult>;
		fetch: (
			projectPath: string,
		) => Promise<import("../../shared/types").GitActionResult>;
		pull: (
			projectPath: string,
		) => Promise<import("../../shared/types").GitActionResult>;
		history: (
			projectPath: string,
			limit?: number,
		) => Promise<import("../../shared/types").GitCommitEntry[]>;
		branches: (
			projectPath: string,
		) => Promise<import("../../shared/types").GitBranchEntry[]>;
		checkout: (
			projectPath: string,
			branch: string,
		) => Promise<import("../../shared/types").GitActionResult>;
		createBranch: (
			projectPath: string,
			branchName: string,
		) => Promise<import("../../shared/types").GitActionResult>;
		publishBranch: (
			projectPath: string,
		) => Promise<import("../../shared/types").GitActionResult>;
		stashList: (
			projectPath: string,
		) => Promise<import("../../shared/types").GitStashEntry[]>;
		stashSave: (
			projectPath: string,
			message?: string,
		) => Promise<import("../../shared/types").GitActionResult>;
		stashPop: (
			projectPath: string,
			index?: number,
		) => Promise<import("../../shared/types").GitActionResult>;
		stashApply: (
			projectPath: string,
			index?: number,
		) => Promise<import("../../shared/types").GitActionResult>;
		stashDrop: (
			projectPath: string,
			index?: number,
		) => Promise<import("../../shared/types").GitActionResult>;
	};
	updater: {
		check: () => Promise<string | null>;
		download: () => Promise<boolean>;
		install: () => Promise<void>;
		onChecking: (cb: () => void) => () => void;
		onAvailable: (
			cb: (info: {
				version: string;
				releaseNotes: string;
				releaseName: string;
			}) => void,
		) => () => void;
		onNotAvailable: (cb: () => void) => () => void;
		onProgress: (
			cb: (progress: {
				percent: number;
				bytesPerSecond: number;
				transferred: number;
				total: number;
			}) => void,
		) => () => void;
		onDownloaded: (
			cb: (info: { version: string; releaseName: string }) => void,
		) => () => void;
		onError: (cb: (error: string) => void) => () => void;
	};
	discord: {
		connect: () => Promise<boolean>;
		disconnect: () => Promise<boolean>;
		update: (details: string, status?: string) => Promise<boolean>;
		isConnected: () => Promise<boolean>;
	};
	app: {
		minimize: () => Promise<void>;
		maximize: () => Promise<void>;
		close: () => Promise<void>;
		isMaximized: () => Promise<boolean>;
		getVersion: () => Promise<string>;
	};
	notification: {
		list: () => Promise<import("../../shared/types").ConnexioNotification[]>;
		unreadCount: () => Promise<number>;
		markRead: (id: string) => Promise<void>;
		markAllRead: () => Promise<void>;
		remove: (id: string) => Promise<void>;
		clear: () => Promise<void>;
		getSettings: () => Promise<
			import("../../shared/types").NotificationSettings
		>;
		updateSettings: (
			settings: import("../../shared/types").NotificationSettings,
		) => Promise<import("../../shared/types").NotificationSettings>;
		getPort: () => Promise<number | null>;
		onReceived: (
			cb: (
				notification: import("../../shared/types").ConnexioNotification,
			) => void,
		) => () => void;
		onNavigate: (
			cb: (
				notification: import("../../shared/types").ConnexioNotification,
			) => void,
		) => () => void;
		getProviders: () => Promise<import("../../shared/types").AIProvider[]>;
		installHook: (
			providerId: string,
		) => Promise<{ success: boolean; error?: string }>;
		uninstallHook: (
			providerId: string,
		) => Promise<{ success: boolean; error?: string }>;
		uploadSound: () => Promise<{
			success: boolean;
			path?: string;
			error?: string;
		}>;
		removeCustomSound: () => Promise<{ success: boolean }>;
		getSoundPath: () => Promise<string | null>;
	};
}

declare global {
	interface Window {
		connexio: ConnexioAPI;
	}
}

export {};
