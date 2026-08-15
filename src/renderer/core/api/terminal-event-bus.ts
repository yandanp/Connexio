import { listen } from "@tauri-apps/api/event";

// ─── Terminal ────────────────────────────────────────────────────────────────

// Global terminal data listeners — registered immediately on import
type TerminalDataCallback = (id: string, data: string) => void;
type TerminalExitCallback = (id: string) => void;
const terminalDataListeners = new Set<TerminalDataCallback>();
const terminalExitListeners = new Set<TerminalExitCallback>();

// Buffer: stores data per terminal ID until at least one listener exists
export const terminalDataBuffer = new Map<string, string[]>();
let bufferFlushScheduled = false;

function flushBuffer() {
	if (terminalDataBuffer.size === 0 || terminalDataListeners.size === 0) return;
	for (const [id, chunks] of terminalDataBuffer.entries()) {
		for (const data of chunks) {
			for (const cb of terminalDataListeners) {
				cb(id, data);
			}
		}
	}
	terminalDataBuffer.clear();
	bufferFlushScheduled = false;
}

// Start global listener immediately (not lazy)
listen<[string, string]>("terminal:data", (event) => {
	const [id, data] = event.payload;
	if (terminalDataListeners.size === 0) {
		// No listeners yet, buffer
		const buf = terminalDataBuffer.get(id) || [];
		buf.push(data);
		terminalDataBuffer.set(id, buf);
		return;
	}
	// If there's still buffered data, flush it first
	if (terminalDataBuffer.size > 0) {
		flushBuffer();
	}
	for (const cb of terminalDataListeners) {
		cb(id, data);
	}
});

listen<string>("terminal:exit", (event) => {
	for (const cb of terminalExitListeners) {
		cb(event.payload);
	}
});

export function onTerminalData(callback: TerminalDataCallback): () => void {
	terminalDataListeners.add(callback);
	// Schedule buffer flush after short delay to let all terminals register
	if (terminalDataBuffer.size > 0 && !bufferFlushScheduled) {
		bufferFlushScheduled = true;
		setTimeout(flushBuffer, 500);
	}
	return () => {
		terminalDataListeners.delete(callback);
	};
}

export function onTerminalExit(callback: TerminalExitCallback): () => void {
	terminalExitListeners.add(callback);
	return () => {
		terminalExitListeners.delete(callback);
	};
}
