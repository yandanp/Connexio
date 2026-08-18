import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/terminal-event-bus", () => ({
	observeTerminalData: vi.fn(() => () => {}),
}));

import { observeTerminalData } from "../api/terminal-event-bus";
import {
	getStartupMetrics,
	notifyTerminalMounted,
	registerPhaseComplete,
	registerPhaseStart,
	registerSpawnComplete,
	registerSpawnStart,
	resetMetrics,
	setSpawnStart,
} from "./startup-metrics";

// The module observes live terminal data once at module scope; retrieve that
// callback so tests can simulate output without importing Tauri APIs.
const emitTerminalData = () => {
	const calls = vi.mocked(observeTerminalData).mock.calls;
	return calls[calls.length - 1][0];
};

describe("startup-metrics", () => {
	beforeEach(() => resetMetrics());

	it("aggregates phase durations", () => {
		registerPhaseStart("app-mount");
		registerPhaseStart("projects-loaded");
		registerPhaseComplete("projects-loaded");
		const m = getStartupMetrics();
		expect(m.phases.map((p) => p.name)).toContain("projects-loaded");
	});

	it("computes min/median/max over spawn durations", () => {
		registerSpawnStart("t1");
		registerSpawnComplete("t1"); // duration ~0
		registerSpawnStart("t2");
		registerSpawnComplete("t2");
		const m = getStartupMetrics();
		expect(m.spawnStats.count).toBe(2);
		expect(m.spawnStats.min).toBeLessThanOrEqual(m.spawnStats.median);
		expect(m.spawnStats.median).toBeLessThanOrEqual(m.spawnStats.max);
	});

	it("records firstTerminalReadyAt once from first mount notification", () => {
		expect(getStartupMetrics().firstTerminalReadyAt).toBeNull();
		notifyTerminalMounted("t1");
		notifyTerminalMounted("t2");
		expect(getStartupMetrics().firstTerminalReadyAt).not.toBeNull();
	});

	it("subscribes to observe terminal data exactly once at module scope", () => {
		expect(observeTerminalData).toHaveBeenCalledTimes(1);
	});

	it("records only the first output per terminal as spawn→output latency", () => {
		let now = 1_000;
		const clock = vi.spyOn(performance, "now").mockImplementation(() => now);

		registerSpawnStart("t1");
		now = 1_200;
		emitTerminalData()("t1", "chunk-1");
		now = 1_300;
		emitTerminalData()("t1", "chunk-2"); // ignored: second output for t1
		emitTerminalData()("t2", "chunk-3"); // ignored: no spawn start for t2

		const m = getStartupMetrics();
		expect(m.outputStats.count).toBe(1);
		expect(m.outputStats.min).toBe(200);
		expect(m.outputStats.median).toBe(200);
		expect(m.outputStats.max).toBe(200);

		clock.mockRestore();
	});

	it("keeps measuring first output even when it arrives after spawn complete", () => {
		let now = 0;
		const clock = vi.spyOn(performance, "now").mockImplementation(() => now);

		now = 100;
		registerSpawnStart("t1");
		now = 150;
		expect(registerSpawnComplete("t1")).toBe(50);
		now = 400;
		emitTerminalData()("t1", "late-first-output");

		const m = getStartupMetrics();
		expect(m.outputStats.count).toBe(1);
		expect(m.outputStats.max).toBe(300);
		// double completion is ignored, not double-counted
		expect(registerSpawnComplete("t1")).toBe(0);
		expect(m.spawnStats.count).toBe(1);

		clock.mockRestore();
	});

	it("computes median as the average of the two middle values for even counts", () => {
		let now = 0;
		const clock = vi.spyOn(performance, "now").mockImplementation(() => now);

		now = 100;
		registerSpawnStart("a");
		now = 150;
		expect(registerSpawnComplete("a")).toBe(50);
		now = 200;
		registerSpawnStart("b");
		now = 350;
		expect(registerSpawnComplete("b")).toBe(150);

		expect(getStartupMetrics().spawnStats).toEqual({
			min: 50,
			max: 150,
			median: 100,
			count: 2,
		});

		clock.mockRestore();
	});

	it("reports firstTerminalReadyAt relative to the app-mount phase start", () => {
		let now = 500;
		const clock = vi.spyOn(performance, "now").mockImplementation(() => now);

		registerPhaseStart("app-mount");
		now = 800;
		notifyTerminalMounted("t1");
		expect(getStartupMetrics().firstTerminalReadyAt).toBe(300);

		clock.mockRestore();
	});

	it("falls back to 0 for firstTerminalReadyAt when app-mount was never registered", () => {
		notifyTerminalMounted("t9");
		expect(getStartupMetrics().firstTerminalReadyAt).toBe(0);
	});

	it("resetMetrics clears phases, spawn stats, output stats and firstTerminalReadyAt", () => {
		registerPhaseStart("app-mount");
		registerPhaseComplete("app-mount");
		registerSpawnStart("t1");
		registerSpawnComplete("t1");
		emitTerminalData()("t1", "boot output");
		notifyTerminalMounted("t1");

		resetMetrics();

		const m = getStartupMetrics();
		expect(m.phases).toEqual([]);
		expect(m.spawnStats).toEqual({ min: 0, max: 0, median: 0, count: 0 });
		expect(m.outputStats).toEqual({ min: 0, max: 0, median: 0, count: 0 });
		expect(m.firstTerminalReadyAt).toBeNull();
	});

	it("returns phase durations in completion order", () => {
		let now = 0;
		const clock = vi.spyOn(performance, "now").mockImplementation(() => now);

		now = 10;
		registerPhaseStart("a");
		now = 30;
		registerPhaseStart("b");
		now = 50;
		expect(registerPhaseComplete("a")).toBe(40);
		now = 60;
		registerPhaseComplete("b");

		expect(getStartupMetrics().phases).toEqual([
			{ name: "a", duration: 40 },
			{ name: "b", duration: 30 },
		]);

		clock.mockRestore();
	});
	it("setSpawnStart anchors a pre-captured timestamp for ids known only after create", () => {
		const startedAt = performance.now();
		setSpawnStart("late-id", startedAt);
		const duration = registerSpawnComplete("late-id");
		expect(duration).toBeGreaterThanOrEqual(0);
		expect(getStartupMetrics().spawnStats.count).toBe(1);

		// First output emitted under the same id correlates against the anchor.
		emitTerminalData()("late-id", "hello");
		expect(getStartupMetrics().outputStats.count).toBe(1);
	});

	it("records first-output latency when output arrives BEFORE the spawn anchor", () => {
		// Rust starts the reader thread before create resolves — fast shells can
		// emit terminal:data first. The sample must be buffered, not dropped.
		const startedAt = performance.now();

		// Output arrives with NO anchor yet → buffered.
		emitTerminalData()("race-id", "early banner");
		expect(getStartupMetrics().outputStats.count).toBe(0);

		// Anchor arrives after create resolves, carrying the pre-create start.
		setSpawnStart("race-id", startedAt);
		registerSpawnComplete("race-id");

		const metrics = getStartupMetrics();
		expect(metrics.outputStats.count).toBe(1); // reconciled, not lost
		expect(metrics.outputStats.min).toBeGreaterThanOrEqual(0);
		expect(metrics.spawnStats.count).toBe(1);

		// Later output for the same id is still ignored (first-only).
		emitTerminalData()("race-id", "more output");
		expect(getStartupMetrics().outputStats.count).toBe(1);
	});

	it("keeps the FIRST chunk timestamp when multiple outputs precede the anchor", () => {
		const emit = emitTerminalData();
		const startedAt = performance.now();
		emit("chatty-id", "chunk-1");
		emit("chatty-id", "chunk-2");
		emit("chatty-id", "chunk-3");
		setSpawnStart("chatty-id", startedAt);
		// Exactly one sample — reconciled from the FIRST buffered chunk, and
		// later chunks never created extra samples.
		const metrics = getStartupMetrics();
		expect(metrics.outputStats.count).toBe(1);
		expect(metrics.outputStats.max).toBe(metrics.outputStats.min);
	});

	it("bounds the premature-output buffer with FIFO eviction", () => {
		const emit = emitTerminalData();
		// 200 unknown ids far exceed the 128-entry bound; oldest are evicted.
		for (let i = 0; i < 200; i++) emit(`unknown-${i}`, "x");
		// Oldest (unknown-0) was evicted → anchoring it records no sample.
		setSpawnStart("unknown-0", performance.now() - 1000);
		expect(getStartupMetrics().outputStats.count).toBe(0);
		// Newest (unknown-199) is still buffered → anchoring reconciles it.
		setSpawnStart("unknown-199", performance.now() - 1000);
		const metrics = getStartupMetrics();
		expect(metrics.outputStats.count).toBe(1);
		expect(metrics.outputStats.min).toBeGreaterThan(0);
	});
});
