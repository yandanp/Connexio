// Mock event bus to avoid @tauri-apps listen() crashes when running tests in Node.
vi.mock("../../core/api/terminal-event-bus", () => ({
	onTerminalData: vi.fn(() => () => {}),
	observeTerminalData: vi.fn(() => () => {}),
	onTerminalExit: vi.fn(() => {}),
}));

// settingsStore (imported transitively via workspace store) reads localStorage at
// module scope — stub it for the node test env, hoisted above static imports.
vi.hoisted(() => {
	if (!globalThis.localStorage) Reflect.set(globalThis, "localStorage", { getItem: () => null });
});

import { describe, expect, it, vi } from "vitest";
import { shouldTriggerSpawn } from "./activation-trigger";
import type { SplitNode, TerminalTab } from "../workspace";

/**
 * State shape mirrors the real workspace/projects store slices (subset consumed
 * by the trigger): workspaceTabs (TerminalTab[]), activeTabIds, spawningTabs,
 * paneErrors, activeProjectId.
 */
type MakeStateOpts = {
	visibleTabWithNullLeaf?: boolean;
	hiddenTabWithNullLeaf?: boolean;
	inFlight?: boolean;
	visibleTabAllLeavesError?: boolean;
	visibleTabAllReady?: boolean;
};

/** Build a real SplitLeaf node. */
function leaf(id: string, terminalId: string | null): SplitNode {
	return { type: "leaf", id, kind: "terminal", terminalId };
}

function makeTab(
	id: string,
	opts: { root?: SplitNode; terminalId?: string | null } = {},
): TerminalTab {
	const tab: TerminalTab = {
		id,
		label: id,
		terminalId: opts.terminalId ?? null,
		type: "terminal",
	};
	if (opts.root) tab.splitLayout = { root: opts.root, activePaneId: id };
	return tab;
}

function makeState(opts: MakeStateOpts = {}) {
	const state = {
		spawningTabs: {} as Record<string, true>,
		paneErrors: {} as Record<string, string>,
		workspaceTabs: {
			p1: [] as TerminalTab[],
		},
		activeProjectId: "p1",
		activeTabIds: { p1: "t1" } as Record<string, string>,
	};

	if (opts.visibleTabWithNullLeaf) {
		state.workspaceTabs.p1.push(
			makeTab("t1", {
				root: { type: "branch", id: "b1", direction: "horizontal", children: [leaf("l1", null)] },
			}),
		);
	}

	if (opts.hiddenTabWithNullLeaf) {
		// t2 has a null leaf but is NOT the active tab
		state.activeTabIds.p1 = "t-other";
		state.workspaceTabs.p1.push(
			makeTab("t2", {
				root: { type: "branch", id: "b2", direction: "horizontal", children: [leaf("l2", null)] },
			}),
		);
	}

	if (opts.inFlight) {
		state.spawningTabs["p1:t1"] = true;
	}

	if (opts.visibleTabAllLeavesError) {
		state.workspaceTabs.p1.push(
			makeTab("t1", {
				root: { type: "branch", id: "b1", direction: "horizontal", children: [leaf("l1", null)] },
			}),
		);
		state.paneErrors["l1"] = "spawn failed";
	}

	if (opts.visibleTabAllReady) {
		state.workspaceTabs.p1.push(
			makeTab("t1", {
				root: {
					type: "branch",
					id: "b1",
					direction: "horizontal",
					children: [leaf("l1", "term-ready")],
				},
			}),
		);
	}

	return state;
}

describe("shouldTriggerSpawn", () => {
	it("triggers for visible tab with null leaves", () => {
		expect(shouldTriggerSpawn(makeState({ visibleTabWithNullLeaf: true }), "p1", "t1")).toBe(true);
	});

	it("does not trigger when tab in-flight", () => {
		expect(
			shouldTriggerSpawn(makeState({ visibleTabWithNullLeaf: true, inFlight: true }), "p1", "t1"),
		).toBe(false);
	});

	it("does not trigger for hidden tabs", () => {
		expect(shouldTriggerSpawn(makeState({ hiddenTabWithNullLeaf: true }), "p1", "t1")).toBe(false);
	});

	it("does not trigger when only error panes remain (retry is explicit)", () => {
		expect(shouldTriggerSpawn(makeState({ visibleTabAllLeavesError: true }), "p1", "t1")).toBe(
			false,
		);
	});

	it("does not trigger when all leaves ready", () => {
		expect(shouldTriggerSpawn(makeState({ visibleTabAllReady: true }), "p1", "t1")).toBe(false);
	});
});
