import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/terminal-event-bus", () => ({
	onTerminalData: vi.fn(() => () => {}),
}));

import { onTerminalData } from "../api/terminal-event-bus";
import {
	getStartupMetrics,
	notifyTerminalMounted,
	registerPhaseComplete,
	registerPhaseStart,
	registerSpawnComplete,
	registerSpawnStart,
	resetMetrics,
} from "./startup-metrics";

// The module subscribes once at module scope — grab that callback so tests can
// simulate terminal output without importing @tauri-apps.
const emitTerminalData = () => {
	const calls = vi.mocked(onTerminalData).mock.calls;
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

	it("subscribes to onTerminalData exactly once at module scope", () => {
		expect(onTerminalData).toHaveBeenCalledTimes(1);
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
});
