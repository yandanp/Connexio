import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../../core/instrumentation/startup-metrics", () => ({
	setSpawnStart: vi.fn(),
	registerSpawnComplete: vi.fn(),
}));
import { collectLeaves } from "./split-layout";
import type { SplitBranch, SplitNode } from "./split-layout";
import { SPAWN_POOL_LIMIT } from "./spawn-pool";
import { createTerminalsForTree, deserializeNode, serializeNode } from "./workspace-persistence";

// ─── Test-local spies ─────────────────────────────────────────────────────────
// `createTerminalsForTree` reads the runtime global `window.connexio.*`; node
// env has no window, so each test installs a stub with these spies. The
// persistence module graph is pure TS (no @tauri-apps imports), so no barrel
// mock is needed.

const terminalCreate = vi.fn(
	async (_path: string, _shell?: string, ctx?: Record<string, unknown>) =>
		`term-${String(ctx?.paneId ?? Math.random())}`,
);

/** Branch with `n` lazy terminal leaves (l1..lN, terminalId null). */
function makeTreeWithLeaves(n: number): SplitBranch {
	return {
		type: "branch",
		id: "root",
		direction: "horizontal",
		children: Array.from({ length: n }, (_, i) => ({
			type: "leaf" as const,
			id: `l${i + 1}`,
			kind: "terminal" as const,
			terminalId: null,
		})),
	};
}

it("serialize/deserialize round-trips tree shape", () => {
	const tree: SplitBranch = {
		type: "branch",
		id: "b1",
		direction: "vertical",
		ratios: [0.4, 0.6],
		children: [
			{ type: "leaf", id: "l1", kind: "terminal", terminalId: "t1" },
			{ type: "leaf", id: "l2", kind: "editor", terminalId: null, filePath: "/a/b.ts" },
		],
	};
	const restored = deserializeNode(serializeNode(tree, "pwsh"));
	expect(restored).toMatchObject({
		type: "branch",
		id: "b1",
		direction: "vertical",
		ratios: [0.4, 0.6],
		children: [
			{ type: "leaf", id: "l1", kind: "terminal", terminalId: null },
			{ type: "leaf", id: "l2", kind: "editor", filePath: "/a/b.ts" },
		],
	});
});

describe("createTerminalsForTree", () => {
	beforeEach(() => {
		terminalCreate.mockClear();
		terminalCreate.mockImplementation(
			async (_path: string, _shell?: string, ctx?: Record<string, unknown>) =>
				`term-${String(ctx?.paneId ?? Math.random())}`,
		);
		// Node env has no real `window`; the walker reads `window.connexio.*`.
		Reflect.set(globalThis, "window", {
			connexio: { terminal: { create: terminalCreate } },
		});
	});

	it("spawns leaves in parallel with bounded concurrency", async () => {
		let active = 0;
		let peak = 0;
		terminalCreate.mockImplementation(
			async (_p: string, _s: string | undefined, ctx?: Record<string, unknown>) => {
				active++;
				peak = Math.max(peak, active);
				await new Promise((r) => setTimeout(r, 5));
				active--;
				return `term-${String(ctx?.paneId)}`;
			},
		);
		const tree = makeTreeWithLeaves(8);
		const result = await createTerminalsForTree(tree, "/p", "pid", "pn", "tab-id", "tab");
		expect(peak).toBeGreaterThan(1); // genuinely parallel, not serial
		expect(peak).toBeLessThanOrEqual(SPAWN_POOL_LIMIT);
		expect(terminalCreate).toHaveBeenCalledTimes(8);
		// every leaf got its OWN id back (result order maps to the right leaf)
		for (const leaf of collectLeaves(result)) {
			expect(leaf.terminalId).toBe(`term-${leaf.id}`);
		}
	});

	it("leaves a failed leaf's terminalId null while siblings spawn", async () => {
		terminalCreate.mockImplementation(
			async (_p: string, _s: string | undefined, ctx?: Record<string, unknown>) => {
				if (ctx?.paneId === "l3") throw new Error("spawn boom");
				return `term-${String(ctx?.paneId)}`;
			},
		);
		const tree = makeTreeWithLeaves(5);
		const result = await createTerminalsForTree(tree, "/p", "pid", "pn", "tab-id", "tab");
		expect(terminalCreate).toHaveBeenCalledTimes(5); // failed one still ran
		const leaves = collectLeaves(result);
		expect(leaves.find((l) => l.id === "l3")?.terminalId).toBeNull();
		for (const leaf of leaves.filter((l) => l.id !== "l3")) {
			expect(leaf.terminalId).toBe(`term-${leaf.id}`);
		}
	});

	it("skips editor leaves and passes paneId in the spawn context", async () => {
		const tree: SplitNode = {
			type: "branch",
			id: "root",
			direction: "horizontal",
			children: [
				{ type: "leaf", id: "term-1", kind: "terminal", terminalId: null },
				{ type: "leaf", id: "ed-1", kind: "editor", terminalId: null, filePath: "/a/b.ts" },
			],
		};
		const result = await createTerminalsForTree(tree, "/p", "pid", "pn", "tab-id", "tab");
		expect(terminalCreate).toHaveBeenCalledTimes(1); // editor never spawns
		expect(terminalCreate).toHaveBeenCalledWith("/p", undefined, {
			projectId: "pid",
			projectName: "pn",
			tabId: "tab-id",
			paneId: "term-1",
			tabLabel: "tab (split)",
		});
		const leaves = collectLeaves(result);
		expect(leaves.find((l) => l.id === "term-1")?.terminalId).toBe("term-term-1");
		expect(leaves.find((l) => l.id === "ed-1")?.terminalId).toBeNull();
	});
});
