import { onTerminalData } from "../api/terminal-event-bus";

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
	/** ms dari app-mount, null bila belum ada terminal yang mount */
	firstTerminalReadyAt: number | null;
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
const recordedFirstOutput = new Set<string>();
let firstTerminalReadyAt: number | null = null;
let appMountTimestamp: number | null = null;

function computeStats(durations: number[]): Stats {
	const count = durations.length;
	if (count === 0) return { min: 0, max: 0, median: 0, count: 0 };
	const sorted = [...durations].sort((a, b) => a - b);
	const mid = Math.floor(count / 2);
	const median = count % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
	return { min: sorted[0], max: sorted[count - 1], median, count };
}

function recordFirstOutput(terminalId: string): void {
	if (recordedFirstOutput.has(terminalId)) return;
	recordedFirstOutput.add(terminalId);
	const spawnStart = spawnStarts.get(terminalId);
	if (spawnStart === undefined) return; // no spawn start — no derivable latency
	firstOutputDurations.push(performance.now() - spawnStart);
}

// Global first-output subscription — registered once at module import and kept
// for the module's lifetime; independent of any Terminal component mounting.
onTerminalData((terminalId) => recordFirstOutput(terminalId));

export function resetMetrics(): void {
	phaseStarts.clear();
	phaseMetrics.length = 0;
	spawnStarts.clear();
	spawnCompleted.clear();
	spawnDurations.length = 0;
	firstOutputDurations.length = 0;
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
	spawnStarts.set(terminalId, performance.now());
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
