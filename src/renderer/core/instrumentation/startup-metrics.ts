import { observeTerminalData } from "../api/terminal-event-bus";

// ─── Instrumentation ─────────────────────────────────────────────────────────

export interface Stats {
	min: number;
	max: number;
	median: number;
	count: number;
}

export interface PhaseMetric {
	name: string;
	duration: number;
}

export interface StartupMetrics {
	phases: PhaseMetric[];
	spawnStats: Stats;
	outputStats: Stats;
	firstTerminalReadyAt: number | null; // ms dari app-mount, null bila belum
}

const APP_MOUNT_PHASE = "app-mount";

const phaseStarts = new Map<string, number>();
const phaseMetrics: PhaseMetric[] = [];
// Spawn start timestamps are kept after completion: first output can arrive
// before or after registerSpawnComplete, and both orders must be measurable.
const spawnStarts = new Map<string, number>();
const spawnCompleted = new Set<string>();
const spawnDurations: number[] = [];
const firstOutputDurations: number[] = [];
// First outputs that arrive BEFORE their spawn-start is anchored (the Rust
// reader thread can emit before create resolves) are buffered here and
// reconciled when setSpawnStart/registerSpawnStart supplies the anchor.
// Bounded: only the lazy-spawn path anchors, so unknown ids from the global
// subscriber (openTerminalTab, SSH, restored terminals) must not accumulate.
const MAX_PREMATURE_OUTPUTS = 128;
const prematureOutputs = new Map<string, number>(); // terminalId → FIRST output timestamp
const recordedFirstOutput = new Set<string>();
let firstTerminalReadyAt: number | null = null;
let appMountTimestamp: number | null = null;

function computeStats(durations: number[]): Stats {
	const count = durations.length;
	if (count === 0) return { min: 0, max: 0, median: 0, count: 0 };
	const sorted = [...durations].sort((a, b) => a - b);
	const median =
		count % 2 === 0 ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2 : sorted[(count - 1) / 2];
	return { min: sorted[0], max: sorted[count - 1], median, count };
}

function recordFirstOutput(terminalId: string): void {
	if (recordedFirstOutput.has(terminalId)) return;
	const spawnStart = spawnStarts.get(terminalId);
	if (spawnStart === undefined) {
		// Output arrived before the spawn-start anchor — buffer the FIRST chunk
		// only (later chunks must not overwrite the timestamp); the anchor
		// (setSpawnStart) reconciles the latency when it arrives.
		if (prematureOutputs.has(terminalId)) return;
		if (prematureOutputs.size >= MAX_PREMATURE_OUTPUTS) {
			// FIFO eviction: Map iterates in insertion order — drop the oldest.
			const oldest = prematureOutputs.keys().next().value;
			if (oldest !== undefined) prematureOutputs.delete(oldest);
		}
		prematureOutputs.set(terminalId, performance.now());
		return;
	}
	recordedFirstOutput.add(terminalId);
	firstOutputDurations.push(performance.now() - spawnStart);
}

/** If this id has a buffered premature output, compute its latency now. */
function processPrematureOutput(terminalId: string, startedAtMs: number): void {
	const outputAt = prematureOutputs.get(terminalId);
	if (outputAt === undefined) return;
	prematureOutputs.delete(terminalId);
	if (recordedFirstOutput.has(terminalId)) return;
	recordedFirstOutput.add(terminalId);
	firstOutputDurations.push(outputAt - startedAtMs);
}

// Global first-output observer — registered once at module import without
// consuming buffered terminal output before its renderer mounts.
observeTerminalData((terminalId) => recordFirstOutput(terminalId));

export function resetMetrics(): void {
	phaseStarts.clear();
	phaseMetrics.length = 0;
	spawnStarts.clear();
	spawnCompleted.clear();
	spawnDurations.length = 0;
	firstOutputDurations.length = 0;
	prematureOutputs.clear();
	recordedFirstOutput.clear();
	firstTerminalReadyAt = null;
	appMountTimestamp = null;
}

export function registerPhaseStart(name: string): void {
	const now = performance.now();
	if (name === APP_MOUNT_PHASE) appMountTimestamp = now;
	phaseStarts.set(name, now);
}

export function registerPhaseComplete(name: string): number {
	const start = phaseStarts.get(name);
	if (start === undefined) return 0; // complete tanpa start — tidak tercatat
	const duration = performance.now() - start;
	phaseMetrics.push({ name, duration });
	return duration;
}

export function registerSpawnStart(terminalId: string): void {
	const startedAt = performance.now();
	spawnStarts.set(terminalId, startedAt);
	processPrematureOutput(terminalId, startedAt);
}

/**
 * Anchor a spawn start under an id that is only knowable AFTER the create
 * call resolves (the real terminalId). `startedAtMs` must be captured just
 * before invoking create so the measured duration stays accurate. The
 * timestamp persists past completion, letting first-output latency correlate
 * against the id the terminal data bus actually emits. A first output that
 * arrived BEFORE this anchor is buffered and reconciled here.
 */
export function setSpawnStart(terminalId: string, startedAtMs: number): void {
	spawnStarts.set(terminalId, startedAtMs);
	processPrematureOutput(terminalId, startedAtMs);
}

export function registerSpawnComplete(terminalId: string): number {
	const start = spawnStarts.get(terminalId);
	if (start === undefined || spawnCompleted.has(terminalId)) return 0;
	spawnCompleted.add(terminalId);
	const duration = performance.now() - start;
	spawnDurations.push(duration);
	return duration;
}

export function notifyTerminalMounted(terminalId: string): void {
	if (firstTerminalReadyAt !== null) return; // hanya terminal pertama
	void terminalId;
	const now = performance.now();
	firstTerminalReadyAt = appMountTimestamp !== null ? now - appMountTimestamp : 0;
}

export function getStartupMetrics(): StartupMetrics {
	return {
		phases: [...phaseMetrics],
		spawnStats: computeStats(spawnDurations),
		outputStats: computeStats(firstOutputDurations),
		firstTerminalReadyAt,
	};
}
