import { getConnectionStatus, getLatencyMs, sendCommand, statusListeners } from "./connection";
import type { StatusListener } from "./connection";

// ─── Remote ─────────────────────────────────────────────────────────────────

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
	onStatus: (cb: StatusListener) => {
		statusListeners.add(cb);
		cb({ status: getConnectionStatus(), latencyMs: getLatencyMs() });
		return () => {
			statusListeners.delete(cb);
		};
	},
	start: (): Promise<RemoteStatus> =>
		Promise.resolve({
			isRunning: true,
			port: parseInt(window.location.port) || 9876,
			pin: "------",
			localIp: window.location.hostname,
			connectedClients: 1,
			clients: [],
			loginUrl: null,
			tailscaleIp: null,
			tailscaleLoginUrl: null,
		}),
	stop: () => Promise.resolve(),
	status: (): Promise<RemoteStatus> =>
		Promise.resolve({
			isRunning: true,
			port: parseInt(window.location.port) || 9876,
			pin: "------",
			localIp: window.location.hostname,
			connectedClients: 1,
			clients: [],
			loginUrl: null,
			tailscaleIp: null,
			tailscaleLoginUrl: null,
		}),
	regeneratePin: () => Promise.resolve("------"),
	lockHost: (): Promise<void> => sendCommand<void>({ ch: "cmd_power", action: "lock" }),
	sleepHost: (): Promise<void> => sendCommand<void>({ ch: "cmd_power", action: "sleep" }),
};
