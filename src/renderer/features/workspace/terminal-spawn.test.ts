import { describe, expect, it, vi } from "vitest";

const { setSpawnStart, registerSpawnComplete } = vi.hoisted(() => ({
	setSpawnStart: vi.fn(),
	registerSpawnComplete: vi.fn(),
}));
vi.mock("../../core/instrumentation/startup-metrics", () => ({
	setSpawnStart,
	registerSpawnComplete,
}));

import { createTerminalWithLimit } from "./terminal-spawn";
import { SPAWN_POOL_LIMIT } from "./spawn-pool";

function gate(): { promise: Promise<void>; open: () => void } {
	let open = () => {};
	const promise = new Promise<void>((resolve) => {
		open = resolve;
	});
	return { promise, open };
}

async function flushMicrotasks(): Promise<void> {
	for (let i = 0; i < 12; i += 1) await Promise.resolve();
}

describe("createTerminalWithLimit", () => {
	it("shares the global cap and records each successful spawn under its terminal id", async () => {
		let active = 0;
		let peak = 0;
		const gates = Array.from({ length: SPAWN_POOL_LIMIT + 2 }, gate);
		const starts = gates.map((entry, index) =>
			createTerminalWithLimit(async () => {
				active += 1;
				peak = Math.max(peak, active);
				await entry.promise;
				active -= 1;
				return `terminal-${index}`;
			}),
		);

		await flushMicrotasks();
		expect(peak).toBe(SPAWN_POOL_LIMIT);
		expect(active).toBe(SPAWN_POOL_LIMIT);

		for (const entry of gates) entry.open();
		await expect(Promise.all(starts)).resolves.toEqual(
			gates.map((_, index) => `terminal-${index}`),
		);
		expect(setSpawnStart).toHaveBeenCalledWith("terminal-0", expect.any(Number));
		expect(registerSpawnComplete).toHaveBeenCalledWith("terminal-0");
		expect(registerSpawnComplete).toHaveBeenCalledTimes(gates.length);
	});

	it("rethrows the original create failure after its pool slot settles", async () => {
		const failure = new Error("spawn failed");
		await expect(createTerminalWithLimit(async () => Promise.reject(failure))).rejects.toBe(
			failure,
		);
	});
});
