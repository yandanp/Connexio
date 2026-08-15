import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type {
	SSHConnection,
	SSHConnectionTestResult,
	SSHKnownHost,
	SFTPEntry,
} from "@shared/types";

// ─── SSH ─────────────────────────────────────────────────────────────────────

export const ssh = {
	list: (projectId: string): Promise<SSHConnection[]> => invoke("ssh_list", { projectId }),

	save: (projectId: string, connections: SSHConnection[]): Promise<void> =>
		invoke("ssh_save", { projectId, connections }),

	listGlobal: (): Promise<SSHConnection[]> => invoke("ssh_list_global"),

	saveGlobal: (connections: SSHConnection[]): Promise<void> =>
		invoke("ssh_save_global", { connections }),

	buildCommand: (connection: SSHConnection): Promise<string> =>
		invoke("ssh_build_command", { connection }),

	buildCommandArgs: (connection: SSHConnection): Promise<string[]> =>
		invoke("ssh_build_command_args", { connection }),

	testConnection: (
		connection: SSHConnection,
		password?: string,
	): Promise<SSHConnectionTestResult> =>
		invoke("ssh_test_connection", { connection, password: password || null }),

	setSecret: (key: string, value: string): Promise<void> =>
		invoke("ssh_secret_set", { key, value }),

	getSecret: (key: string): Promise<string | null> => invoke("ssh_secret_get", { key }),

	deleteSecret: (key: string): Promise<void> => invoke("ssh_secret_delete", { key }),

	listKnownHosts: (): Promise<SSHKnownHost[]> => invoke("ssh_known_hosts_list"),

	trustHost: (host: string, port: number, fingerprintSha256: string): Promise<void> =>
		invoke("ssh_trust_host", { host, port, fingerprintSha256 }),

	forgetHost: (host: string, port: number): Promise<void> =>
		invoke("ssh_forget_host", { host, port }),

	sftpList: (connection: SSHConnection, path: string, password?: string): Promise<SFTPEntry[]> =>
		invoke("ssh_sftp_list", { connection, path, password: password || null }),

	sftpDownload: (
		connection: SSHConnection,
		remotePath: string,
		localPath: string,
		password?: string,
	): Promise<void> =>
		invoke("ssh_sftp_download", { connection, remotePath, localPath, password: password || null }),

	sftpUpload: (
		connection: SSHConnection,
		localPath: string,
		remotePath: string,
		password?: string,
	): Promise<void> =>
		invoke("ssh_sftp_upload", { connection, localPath, remotePath, password: password || null }),

	sftpRead: (connection: SSHConnection, path: string, password?: string): Promise<string> =>
		invoke("ssh_sftp_read", { connection, path, password: password || null }),

	sftpWrite: (
		connection: SSHConnection,
		path: string,
		content: string,
		password?: string,
	): Promise<void> =>
		invoke("ssh_sftp_write", { connection, path, content, password: password || null }),

	sftpMkdir: (connection: SSHConnection, path: string, password?: string): Promise<void> =>
		invoke("ssh_sftp_mkdir", { connection, path, password: password || null }),

	sftpDelete: (
		connection: SSHConnection,
		path: string,
		isDir: boolean,
		password?: string,
	): Promise<void> =>
		invoke("ssh_sftp_delete", { connection, path, isDir, password: password || null }),

	sftpRename: (
		connection: SSHConnection,
		oldPath: string,
		newPath: string,
		password?: string,
	): Promise<void> =>
		invoke("ssh_sftp_rename", { connection, oldPath, newPath, password: password || null }),

	forgetOpenSSHHost: (host: string, port: number): Promise<string> =>
		invoke("ssh_forget_openssh_host", { host, port }),

	selectKey: async (): Promise<string | null> => {
		const selected = await open({
			multiple: false,
			filters: [{ name: "SSH Keys", extensions: ["pem", "key", "pub", ""] }],
		});
		return selected as string | null;
	},

	keyExists: (keyPath: string): Promise<boolean> => invoke("ssh_key_exists", { keyPath }),
};
