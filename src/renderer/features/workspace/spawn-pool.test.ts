import { describe, expect, it, vi } from "vitest";
import { SPAWN_POOL_LIMIT, runWithSpawnLimit } from "./spawn-pool";

// NOTE: the first three tests below are verbatim from the task brief. They use
// real `setTimeout` delays (5–30 ms) because the brief's test cases are the
// cross-task contract and must not be modified; all *added* tests below use
// deterministic gates instead of wall-clock timers.

/**
 * Deterministic gate: the awaited promise settles only when `open()` is
 * called — no clock involvement. Executor form because the project's TS lib
 * (ES2020) has no `Promise.withResolvers` typing.
 */
function gate(): { promise: Promise<void>; open: () => void } {
	let open: () => void = () => {};
	const promise = new Promise<void>((resolve) => {
		open = resolve;
	});
	return { promise, open };
}

/** Yield enough microtask ticks for the pool's microtask kick to run. */
async function flushMicrotasks(): Promise<void> {
	for (let i = 0; i < 12; i += 1) {
		await Promise.resolve();
	}
}

describe("runWithSpawnLimit", () => {
	it("never exceeds the concurrency limit", async () => {
		let active = 0;
		let peak = 0;
		const tasks = Array.from({ length: 20 }, (_, i) => async () => {
			active++;
			peak = Math.max(peak, active);
			await new Promise((r) => setTimeout(r, 5));
			active--;
			return i;
		});
		const results = await runWithSpawnLimit(tasks);
		expect(peak).toBeLessThanOrEqual(SPAWN_POOL_LIMIT);
		expect(results).toHaveLength(20);
	});

	it("keeps input order in results", async () => {
		const tasks = Array.from({ length: 10 }, (_, i) => async () => {
			await new Promise((r) => setTimeout(r, (10 - i) * 3));
			return i;
		});
		const results = await runWithSpawnLimit(tasks);
		expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
	});

	it("failed task yields undefined but others complete", async () => {
		const tasks = [
			async () => 1,
			async () => {
				throw new Error("boom");
			},
			async () => 3,
		];
		const results = await runWithSpawnLimit(tasks);
		expect(results[0]).toBe(1);
		expect(results[1]).toBeUndefined();
		expect(results[2]).toBe(3);
	});

	it("shares one global concurrency cap across concurrent callers", async () => {
		let active = 0;
		let peak = 0;
		const openers: Array<() => void> = [];
		const makeTasks = (count: number) =>
			Array.from({ length: count }, () => async () => {
				active++;
				peak = Math.max(peak, active);
				const g = gate();
				openers.push(g.open);
				await g.promise;
				active--;
			});
		// Two callers in flight at once — they must share the same 6 slots.
		const first = runWithSpawnLimit(makeTasks(SPAWN_POOL_LIMIT));
		const second = runWithSpawnLimit(makeTasks(SPAWN_POOL_LIMIT));
		await flushMicrotasks();
		expect(active).toBe(SPAWN_POOL_LIMIT);
		expect(peak).toBe(SPAWN_POOL_LIMIT);
		// Release batch 1; the queued batch 2 claims the freed slots.
		for (const open of openers.splice(0)) open();
		await flushMicrotasks();
		expect(active).toBe(SPAWN_POOL_LIMIT);
		expect(peak).toBe(SPAWN_POOL_LIMIT);
		for (const open of openers.splice(0)) open();
		const [firstResults, secondResults] = await Promise.all([first, second]);
		expect(peak).toBeLessThanOrEqual(SPAWN_POOL_LIMIT);
		expect(firstResults).toHaveLength(SPAWN_POOL_LIMIT);
		expect(secondResults).toHaveLength(SPAWN_POOL_LIMIT);
	});

	it("queues a later batch behind a saturated earlier batch (FIFO across batches)", async () => {
		const started: string[] = [];
		const openers: Array<() => void> = [];
		const gated = (label: string) => async () => {
			started.push(label);
			const g = gate();
			openers.push(g.open);
			await g.promise;
			return label;
		};
		// Batch A saturates every slot; batch B must wait in the shared queue.
		const batchA = runWithSpawnLimit(
			Array.from({ length: SPAWN_POOL_LIMIT }, (_, i) => gated(`A${i}`)),
		);
		const batchB = runWithSpawnLimit([gated("B0")]);
		await flushMicrotasks();
		expect(started).toEqual(["A0", "A1", "A2", "A3", "A4", "A5"]);
		// Free one slot — only then may B0 start.
		openers[0]();
		await flushMicrotasks();
		expect(started).toEqual(["A0", "A1", "A2", "A3", "A4", "A5", "B0"]);
		for (const open of openers.splice(1)) open();
		const [resultsA, resultsB] = await Promise.all([batchA, batchB]);
		expect(resultsA).toEqual(["A0", "A1", "A2", "A3", "A4", "A5"]);
		expect(resultsB).toEqual(["B0"]);
	});

	it("synchronous throw in a task also yields undefined", async () => {
		const tasks = [
			() => {
				throw new Error("sync boom");
			},
			async () => 2,
		];
		const results = await runWithSpawnLimit(tasks);
		expect(results[0]).toBeUndefined();
		expect(results[1]).toBe(2);
	});

	it("resolves immediately for an empty task list", async () => {
		const results = await runWithSpawnLimit<number>([]);
		expect(results).toEqual([]);
	});
});
