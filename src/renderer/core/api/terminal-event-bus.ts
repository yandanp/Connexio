import { listen } from "@tauri-apps/api/event";

// ─── Terminal ────────────────────────────────────────────────────────────────

// Renderer consumers receive buffered data; observers only receive live events.
type TerminalDataCallback = (id: string, data: string) => void;
type TerminalExitCallback = (id: string) => void;
const terminalDataConsumers = new Map<string, Set<TerminalDataCallback>>();
const terminalDataObservers = new Set<TerminalDataCallback>();
const terminalExitListeners = new Set<TerminalExitCallback>();

// Buffer: stores data per terminal ID until at least one renderer consumer exists
export const terminalDataBuffer = new Map<string, string[]>();
const scheduledBufferFlushes = new Set<string>();

function flushBuffer(terminalId: string) {
	scheduledBufferFlushes.delete(terminalId);
	const chunks = terminalDataBuffer.get(terminalId);
	const consumers = terminalDataConsumers.get(terminalId);
	if (!chunks || !consumers || consumers.size === 0) return;
	for (const data of chunks) {
		for (const callback of consumers) callback(terminalId, data);
	}
	terminalDataBuffer.delete(terminalId);
}

// Start global listener immediately (not lazy)
listen<[string, string]>("terminal:data", (event) => {
	const [id, data] = event.payload;
	for (const callback of terminalDataObservers) callback(id, data);
	const consumers = terminalDataConsumers.get(id);
	if (!consumers || consumers.size === 0) {
		const buffered = terminalDataBuffer.get(id) || [];
		buffered.push(data);
		terminalDataBuffer.set(id, buffered);
		return;
	}
	if (terminalDataBuffer.has(id)) flushBuffer(id);
	for (const callback of consumers) callback(id, data);
});

listen<string>("terminal:exit", (event) => {
	for (const cb of terminalExitListeners) {
		cb(event.payload);
	}
});

export function onTerminalData(terminalId: string, callback: TerminalDataCallback): () => void {
	const consumers = terminalDataConsumers.get(terminalId) || new Set<TerminalDataCallback>();
	consumers.add(callback);
	terminalDataConsumers.set(terminalId, consumers);
	if (terminalDataBuffer.has(terminalId) && !scheduledBufferFlushes.has(terminalId)) {
		scheduledBufferFlushes.add(terminalId);
		setTimeout(() => flushBuffer(terminalId), 500);
	}
	return () => {
		consumers.delete(callback);
		if (consumers.size === 0) terminalDataConsumers.delete(terminalId);
	};
}

/** Observes live terminal output without consuming buffered data. */
export function observeTerminalData(callback: TerminalDataCallback): () => void {
	terminalDataObservers.add(callback);
	return () => terminalDataObservers.delete(callback);
}

export function onTerminalExit(callback: TerminalExitCallback): () => void {
	terminalExitListeners.add(callback);
	return () => {
		terminalExitListeners.delete(callback);
	};
}
