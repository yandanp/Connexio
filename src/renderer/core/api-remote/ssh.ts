import type {
	SSHConnection,
	SSHConnectionTestResult,
	SSHKnownHost,
	SFTPEntry,
} from "@shared/types";

// ─── SSH (limited) ───────────────────────────────────────────────────────────

export const ssh = {
	list: (_projectId: string): Promise<SSHConnection[]> => Promise.resolve([]),
	save: (_projectId: string, _connections: SSHConnection[]): Promise<void> => Promise.resolve(),
	listGlobal: (): Promise<SSHConnection[]> => Promise.resolve([]),
	saveGlobal: (_connections: SSHConnection[]): Promise<void> => Promise.resolve(),
	buildCommand: (_connection: SSHConnection): Promise<string> => Promise.resolve(""),
	buildCommandArgs: (_connection: SSHConnection): Promise<string[]> => Promise.resolve([]),
	testConnection: (
		_connection: SSHConnection,
		_password?: string,
	): Promise<SSHConnectionTestResult> =>
		Promise.resolve({ success: false, error: "Not available in remote mode" } as any),
	setSecret: (_key: string, _value: string): Promise<void> => Promise.resolve(),
	getSecret: (_key: string): Promise<string | null> => Promise.resolve(null),
	deleteSecret: (_key: string): Promise<void> => Promise.resolve(),
	listKnownHosts: (): Promise<SSHKnownHost[]> => Promise.resolve([]),
	trustHost: (_host: string, _port: number, _fp: string): Promise<void> => Promise.resolve(),
	forgetHost: (_host: string, _port: number): Promise<void> => Promise.resolve(),
	sftpList: (_c: SSHConnection, _p: string, _pw?: string): Promise<SFTPEntry[]> =>
		Promise.resolve([]),
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
