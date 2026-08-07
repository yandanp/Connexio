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

import type { AppSettings, AppTheme, Project, ShellInfo, WorkspaceState } from "@shared/types";

// ─── Connection State ────────────────────────────────────────────────────────

let _pin: string | null = sessionStorage.getItem("connexio_remote_pin");
let _trustedToken: string | null = localStorage.getItem("connexio_remote_token");
let _ws: WebSocket | null = null;
let _authenticated = false;
let _connected = false;
let _latencyMs: number | null = null;
let _lastPingAt = 0;
let _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let _lastConnectUsedToken = false;

export type RemoteConnectionStatus = "connected" | "connecting" | "reconnecting" | "disconnected";
export type StatusListener = (status: {
	status: RemoteConnectionStatus;
	latencyMs: number | null;
}) => void;
export const statusListeners = new Set<StatusListener>();
let _connectionStatus: RemoteConnectionStatus = "disconnected";

function setConnectionStatus(status: RemoteConnectionStatus) {
	_connectionStatus = status;
	for (const cb of statusListeners) cb({ status, latencyMs: _latencyMs });
}

function notifyLatency() {
	for (const cb of statusListeners) cb({ status: _connectionStatus, latencyMs: _latencyMs });
}

export function getConnectionStatus(): RemoteConnectionStatus {
	return _connectionStatus;
}

export function getLatencyMs(): number | null {
	return _latencyMs;
}

// State cache (pushed from server)
let _state: InitState | null = null;
let _stateResolvers: Array<(s: InitState) => void> = [];

export interface InitState {
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
export const terminalDataListeners = new Set<TerminalDataCallback>();
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

	const data = await res.json().catch(() => ({}));
	_pin = pin;
	_trustedToken = data.token || null;
	_authenticated = true;
	sessionStorage.setItem("connexio_remote_pin", pin);
	if (_trustedToken) localStorage.setItem("connexio_remote_token", _trustedToken);

	// Connect WebSocket
	await connectWs();
	return true;
}

export function logout() {
	_pin = null;
	_trustedToken = null;
	_authenticated = false;
	_connected = false;
	_state = null;
	sessionStorage.removeItem("connexio_remote_pin");
	localStorage.removeItem("connexio_remote_token");
	stopHeartbeat();
	setConnectionStatus("disconnected");
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
		const params = new URLSearchParams();
		_lastConnectUsedToken = !!_trustedToken;
		if (_trustedToken) params.set("token", _trustedToken);
		else if (_pin) params.set("pin", _pin);
		_ws = new WebSocket(`${proto}//${window.location.host}/ws?${params.toString()}`);

		setConnectionStatus(_authenticated ? "reconnecting" : "connecting");

		_ws.onopen = () => {
			_connected = true;
			setConnectionStatus("connected");
			startHeartbeat();
			resolve();
		};

		_ws.onmessage = (event) => {
			handleServerMessage(event.data);
		};

		_ws.onclose = () => {
			_connected = false;
			stopHeartbeat();
			setConnectionStatus(_authenticated ? "reconnecting" : "disconnected");

			// If a trusted token was rejected after server restart/PIN rotation,
			// fall back to the remembered PIN and request a fresh token.
			if (_lastConnectUsedToken && _pin) {
				_trustedToken = null;
				localStorage.removeItem("connexio_remote_token");
				setTimeout(() => {
					authenticate(_pin!).catch(() => logout());
				}, 300);
				return;
			}

			// Auto-reconnect
			setTimeout(() => {
				if (_authenticated && (_trustedToken || _pin)) {
					connectWs().catch(() => {});
				}
			}, 1200);
		};

		_ws.onerror = () => {
			_connected = false;
			stopHeartbeat();
			setConnectionStatus(_authenticated ? "reconnecting" : "disconnected");
			reject(new Error("WebSocket connection failed"));
		};
	});
}

function startHeartbeat() {
	stopHeartbeat();
	_heartbeatTimer = setInterval(() => {
		if (!_ws || _ws.readyState !== WebSocket.OPEN) return;
		_lastPingAt = performance.now();
		send({ ch: "ping" });
	}, 5000);
}

function stopHeartbeat() {
	if (_heartbeatTimer) {
		clearInterval(_heartbeatTimer);
		_heartbeatTimer = null;
	}
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
			case "cmd_result": {
				const pending = pendingCommands.get(msg.req_id);
				if (pending) {
					pending.resolve(msg.data);
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
			case "pong": {
				_latencyMs = Math.max(0, Math.round(performance.now() - _lastPingAt));
				notifyLatency();
				break;
			}
		}
	} catch {
		// Ignore non-JSON
	}
}

export function send(msg: object) {
	if (_ws && _ws.readyState === WebSocket.OPEN) {
		_ws.send(JSON.stringify(msg));
	}
}

export function sendCommand<T = string>(msg: object): Promise<T> {
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

export function waitForState(): Promise<InitState> {
	if (_state) return Promise.resolve(_state);
	return new Promise((resolve) => {
		_stateResolvers.push(resolve);
	});
}

// Reconnect automatically with a trusted token or remembered PIN.
// Magic link (?pin=xxxxxx) is handled by RemoteLoginGate so the UI can show progress.
if (_trustedToken || _pin) {
	_authenticated = true;
	connectWs().catch(() => {
		logout();
	});
}
