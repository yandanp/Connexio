import { invoke } from "@tauri-apps/api/core";

// ─── Remote Access ───────────────────────────────────────────────────────────

export interface RemoteClientInfo {
	id: string;
	userAgent: string;
	connectedAt: number;
}

export interface RemoteStatus {
	isRunning: boolean;
	port: number;
	pin: string;
	localIp: string | null;
	connectedClients: number;
	clients: RemoteClientInfo[];
	loginUrl: string | null;
	tailscaleIp: string | null;
	tailscaleLoginUrl: string | null;
}

export const remote = {
	start: (port?: number): Promise<RemoteStatus> => invoke("remote_start", { port: port || null }),
	stop: (): Promise<void> => invoke("remote_stop"),
	status: (): Promise<RemoteStatus> => invoke("remote_status"),
	regeneratePin: (): Promise<string> => invoke("remote_regenerate_pin"),
	sendWol: (mac: string, broadcastIp?: string, port?: number): Promise<void> =>
		invoke("remote_wol_send", { mac, broadcastIp: broadcastIp || null, port: port || null }),
};
