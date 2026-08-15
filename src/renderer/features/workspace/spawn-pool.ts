/**
 * Bounded spawn pool limiter.
 *
 * Every terminal-spawn path (restore-on-open, new split, new tab) must route
 * through this pool so peak concurrent process creation stays bounded during
 * startup. One module-level FIFO queue is shared by every caller — the
 * concurrency cap is global, not per-call.
 */

export const SPAWN_POOL_LIMIT = 6;

/** A unit of work as stored in the shared queue. */
type PoolJob = () => Promise<void>;

/** Module-level FIFO queue shared by every `runWithSpawnLimit` caller. */
const queue: PoolJob[] = [];
let head = 0;
let active = 0;

/** Start queued jobs while capacity remains; re-invoked whenever a job settles. */
function next(): void {
	while (active < SPAWN_POOL_LIMIT && head < queue.length) {
		const job = queue[head];
		head += 1;
		active += 1;
		job()
			.catch(() => {
				/* jobs never reject by contract; keep the pool alive regardless */
			})
			.finally(() => {
				active -= 1;
				next();
			});
	}
	if (head === queue.length) {
		queue.length = 0;
		head = 0;
	}
}

/**
 * Run `tasks` with global concurrency capped at `SPAWN_POOL_LIMIT`.
 *
 * FIFO; results keep input order. A failed task resolves its slot to
 * `undefined` (the error is swallowed) and never prevents the remaining
 * tasks from settling — callers handle failures per-pane.
 */
export function runWithSpawnLimit<T>(
	tasks: Array<() => Promise<T>>,
): Promise<Array<T | undefined>> {
	const results: Array<T | undefined> = tasks.map(() => undefined);
	let remaining = tasks.length;
	// Executor form (not Promise.withResolvers): the project's TS lib is
	// ES2020 (no withResolvers typing) and the renderer may run in older
	// webviews that lack the API.
	let settle: (value: Array<T | undefined>) => void = () => {};
	const done = new Promise<Array<T | undefined>>((resolve) => {
		settle = resolve;
	});

	if (remaining === 0) {
		settle(results);
		return done;
	}

	for (const [index, task] of tasks.entries()) {
		queue.push(async () => {
			try {
				results[index] = await task();
			} catch {
				// Swallowed: the slot stays `undefined`; sibling tasks keep running.
			}
			remaining -= 1;
			if (remaining === 0) {
				settle(results);
			}
		});
	}

	// Kick with a microtask so callers enqueueing in the same tick queue fairly.
	Promise.resolve().then(next);

	return done;
}
