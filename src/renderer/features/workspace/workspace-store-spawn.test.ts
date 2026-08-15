import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Project } from "@shared/types";

// ─── Test-local spies (cross-task contract pattern from the task brief) ────────

const terminalCreate = vi.fn(
	async (_path: string, _shell?: string, ctx?: Record<string, unknown>) =>
		`term-${String(ctx?.paneId ?? Math.random())}`,
);
const terminalClose = vi.fn(async () => {});

// The store reads the runtime global `window.connexio.*`; mocking the barrel
// keeps the module graph free of @tauri-apps imports in the node test env.
vi.mock("../../core/api", () => ({
	terminal: { create: terminalCreate, close: terminalClose },
}));

// startup-metrics transitively imports @tauri-apps — mock it and spy on the
// spawn metric registration this task must emit.
const registerPhaseComplete = vi.fn();
const registerSpawnStart = vi.fn();
const registerSpawnComplete = vi.fn();
const setSpawnStart = vi.fn();
vi.mock("../../core/instrumentation/startup-metrics", () => ({
	registerPhaseComplete,
	registerSpawnStart,
	registerSpawnComplete,
	setSpawnStart,
}));

// ─── Fixtures ──────────────────────────────────────────────────────────────────

function makeProject(id: string): Project {
	return {
		id,
		name: `Project ${id}`,
		path: `/repo/${id}`,
		group: "",
		tabs: [],
		createdAt: 1,
		lastOpenedAt: 1,
	};
}

interface SavedTab {
	id: string;
	label: string;
	shell?: string;
	splitTree?: object;
}
interface SavedState {
	activeProjectId: string;
	activeTabIds: Record<string, string>;
	projectTabs: Record<string, SavedTab[]>;
}

function makeSavedState(): SavedState {
	const splitTree = {
		type: "branch",
		id: "root-branch",
		direction: "horizontal",
		ratios: [0.25, 0.75],
		children: [
			{ type: "leaf", id: "pane-1", kind: "terminal" },
			{ type: "leaf", id: "pane-2", kind: "terminal" },
			{ type: "leaf", id: "pane-3", kind: "terminal" },
		],
	} satisfies object;
	return {
		activeProjectId: "proj-1",
		activeTabIds: { "proj-1": "tab-split" },
		projectTabs: {
			"proj-1": [
				{ id: "tab-single", label: "Shell", shell: "bash" },
				{ id: "tab-split", label: "Split", shell: "bash", splitTree },
				{ id: "tab-hidden", label: "Hidden", shell: "zsh" },
			],
		},
	};
}

/** Fixture for the collapse-mid-spawn test: a 2-pane split. */
function makeSavedStateForCollapse(): SavedState {
	const splitTree = {
		type: "branch",
		id: "root-branch",
		direction: "horizontal",
		ratios: [0.5, 0.5],
		children: [
			{ type: "leaf", id: "pane-a", kind: "terminal" },
			{ type: "leaf", id: "pane-b", kind: "terminal" },
		],
	} satisfies object;
	return {
		activeProjectId: "proj-1",
		activeTabIds: { "proj-1": "tab-split" },
		projectTabs: {
			"proj-1": [
				{ id: "tab-single", label: "Shell", shell: "bash" },
				{ id: "tab-split", label: "Split", shell: "bash", splitTree },
			],
		},
	};
}

function makeSinglePaneState(): SavedState {
	return {
		activeProjectId: "proj-1",
		activeTabIds: { "proj-1": "tab-late" },
		projectTabs: {
			"proj-1": [
				{ id: "tab-single", label: "Shell", shell: "bash" },
				{ id: "tab-late", label: "Late", shell: "bash" },
				{ id: "tab-hidden", label: "Hidden", shell: "zsh" },
			],
		},
	};
}

let savedState: SavedState | null = null;

// ─── Suite ─────────────────────────────────────────────────────────────────────

describe("ensureTerminalSpawned / retryPaneSpawn", () => {
	beforeEach(() => {
		terminalCreate.mockClear();
		terminalClose.mockClear();
		registerPhaseComplete.mockClear();
		registerSpawnStart.mockClear();
		registerSpawnComplete.mockClear();
		setSpawnStart.mockClear();
		terminalCreate.mockImplementation(
			async (_path: string, _shell?: string, ctx?: Record<string, unknown>) =>
				`term-${String(ctx?.paneId ?? Math.random())}`,
		);
		vi.resetModules();
		savedState = makeSavedState();

		// Node env has no real `window`; the store reads `window.connexio.*`.
		const connexio = {
			terminal: { create: terminalCreate, close: terminalClose },
			workspace: { getState: async () => savedState, saveState: async () => {} },
		};
		Reflect.set(globalThis, "window", { connexio });
		// settingsStore reads localStorage at module scope — stub it for node env.
		Reflect.set(globalThis, "localStorage", { getItem: () => null });
	});

	// Dynamic imports (not static): must resolve AFTER vi.resetModules() so the
	// fresh module registry + mocked globals are in place before store init.
	async function importStores() {
		const { useProjectsStore } = await import("../projects");
		const { useWorkspaceStore } = await import("./workspace-store");
		return { useProjectsStore, useWorkspaceStore };
	}

	it("spawns all lazy leaves of a tab on ensureTerminalSpawned", async () => {
		const { useProjectsStore, useWorkspaceStore } = await importStores();
		useProjectsStore.setState({ projects: [makeProject("proj-1")] });
		await useWorkspaceStore.getState().restoreWorkspace();

		const pid = "proj-1";
		const tid = "tab-split";
		await useWorkspaceStore.getState().ensureTerminalSpawned(pid, tid);
		expect(terminalCreate).toHaveBeenCalledTimes(3);
		// semua leaf kini punya terminalId
		const tab = useWorkspaceStore.getState().workspaceTabs[pid]?.find((t) => t.id === tid);
		if (!tab?.splitLayout || tab.splitLayout.root.type !== "branch") {
			throw new Error("expected split tab with branch root");
		}
		for (const child of tab.splitLayout.root.children) {
			if (child.type === "leaf") expect(child.terminalId).not.toBeNull();
		}
		// Metrics anchored under the REAL terminal ids (first-output correlation):
		expect(setSpawnStart).toHaveBeenCalledWith("term-pane-1", expect.any(Number));
		expect(registerSpawnComplete).toHaveBeenCalledWith("term-pane-1");
		expect(registerSpawnStart).not.toHaveBeenCalled(); // no paneId pre-anchor
	});

	it("is idempotent under concurrent calls (StrictMode-safe)", async () => {
		const { useProjectsStore, useWorkspaceStore } = await importStores();
		useProjectsStore.setState({ projects: [makeProject("proj-1")] });
		await useWorkspaceStore.getState().restoreWorkspace();

		const pid = "proj-1";
		const tid = "tab-split";
		await Promise.all([
			useWorkspaceStore.getState().ensureTerminalSpawned(pid, tid),
			useWorkspaceStore.getState().ensureTerminalSpawned(pid, tid),
		]);
		expect(terminalCreate).toHaveBeenCalledTimes(3); // bukan 6
	});

	it("does not spawn hidden tabs (only called for visible)", async () => {
		const { useProjectsStore, useWorkspaceStore } = await importStores();
		useProjectsStore.setState({ projects: [makeProject("proj-1")] });
		await useWorkspaceStore.getState().restoreWorkspace();

		const pid = "proj-1";
		await useWorkspaceStore.getState().ensureTerminalSpawned(pid, "tab-single");
		expect(terminalCreate).toHaveBeenCalledTimes(1);

		// ensureTerminalSpawned TIDAK dipanggil untuk tab lain — verifikasi via state:
		// tab kedua tetap terminalId null setelah spawn tab pertama
		const hidden = useWorkspaceStore
			.getState()
			.workspaceTabs[pid]?.find((t) => t.id === "tab-hidden");
		if (!hidden) throw new Error("hidden tab missing");
		expect(hidden.terminalId).toBeNull();
	});

	it("disposes late-created PTY when pane closed mid-spawn", async () => {
		savedState = makeSinglePaneState();
		const { useProjectsStore, useWorkspaceStore } = await importStores();
		useProjectsStore.setState({ projects: [makeProject("proj-1")] });
		await useWorkspaceStore.getState().restoreWorkspace();

		let resolveCreate: ((id: string) => void) | undefined;
		terminalCreate.mockImplementation(
			() =>
				new Promise<string>((res) => {
					resolveCreate = () => res("late-id");
				}),
		);

		const pid = "proj-1";
		const tid = "tab-late";
		const p = useWorkspaceStore.getState().ensureTerminalSpawned(pid, tid);
		// Let the pool kick so terminal.create is actually invoked (in-flight).
		await Promise.resolve();
		expect(resolveCreate).toBeDefined();
		// tutup tab saat masih in-flight
		useWorkspaceStore.getState().closeTerminalTab(pid, tid);
		resolveCreate!("late-id");
		await p;
		expect(terminalClose).toHaveBeenCalledWith("late-id");
	});

	it("partial failure: failed panes get error, successful panes stay ready", async () => {
		terminalCreate.mockImplementation(
			async (_path: string, _shell?: string, ctx?: Record<string, unknown>) => {
				const paneId = ctx?.paneId;
				if (paneId === "pane-2") throw new Error("spawn failed");
				return `ok-${String(paneId)}`;
			},
		);
		const { useProjectsStore, useWorkspaceStore } = await importStores();
		useProjectsStore.setState({ projects: [makeProject("proj-1")] });
		await useWorkspaceStore.getState().restoreWorkspace();

		const pid = "proj-1";
		const tid = "tab-split";
		await useWorkspaceStore.getState().ensureTerminalSpawned(pid, tid);
		const errors = useWorkspaceStore.getState().paneErrors;
		expect(errors["pane-2"]).toContain("spawn failed");
		expect(Object.keys(errors)).toHaveLength(1);

		// successful panes stay ready: pane-1 and pane-3 hold their terminalId
		const tab = useWorkspaceStore.getState().workspaceTabs[pid]?.find((t) => t.id === tid);
		if (!tab?.splitLayout || tab.splitLayout.root.type !== "branch") {
			throw new Error("expected split tab with branch root");
		}
		const leaves = tab.splitLayout.root.children;
		const pane1 = leaves.find((c) => c.type === "leaf" && c.id === "pane-1");
		const pane3 = leaves.find((c) => c.type === "leaf" && c.id === "pane-3");
		if (pane1?.type === "leaf") expect(pane1.terminalId).toBe("ok-pane-1");
		if (pane3?.type === "leaf") expect(pane3.terminalId).toBe("ok-pane-3");
	});

	it("retryPaneSpawn respawns only the failed pane", async () => {
		// seed paneErrors['pane-2'] dengan spawn pertama yang gagal untuk pane itu
		terminalCreate.mockImplementation(
			async (_path: string, _shell?: string, ctx?: Record<string, unknown>) => {
				const paneId = ctx?.paneId;
				if (paneId === "pane-2") throw new Error("spawn failed");
				return `ok-${String(paneId)}`;
			},
		);
		const { useProjectsStore, useWorkspaceStore } = await importStores();
		useProjectsStore.setState({ projects: [makeProject("proj-1")] });
		await useWorkspaceStore.getState().restoreWorkspace();
		await useWorkspaceStore.getState().ensureTerminalSpawned("proj-1", "tab-split");
		expect(useWorkspaceStore.getState().paneErrors["pane-2"]).toContain("spawn failed");

		terminalCreate.mockClear();
		terminalCreate.mockResolvedValue("respawn-ok");
		await useWorkspaceStore.getState().retryPaneSpawn("proj-1", "tab-split", "pane-2");
		expect(terminalCreate).toHaveBeenCalledTimes(1);
		expect(useWorkspaceStore.getState().paneErrors["pane-2"]).toBeUndefined();

		const tab = useWorkspaceStore
			.getState()
			.workspaceTabs["proj-1"]?.find((t) => t.id === "tab-split");
		if (!tab?.splitLayout || tab.splitLayout.root.type !== "branch") {
			throw new Error("expected split tab with branch root");
		}
		const pane2 = tab.splitLayout.root.children.find((c) => c.type === "leaf" && c.id === "pane-2");
		if (pane2?.type !== "leaf") throw new Error("pane-2 leaf missing");
		expect(pane2.terminalId).toBe("respawn-ok");
	});

	it("split collapse mid-spawn adopts the survivor and disposes the removed pane", async () => {
		savedState = makeSavedStateForCollapse();
		const { useProjectsStore, useWorkspaceStore } = await importStores();
		useProjectsStore.setState({ projects: [makeProject("proj-1")] });
		await useWorkspaceStore.getState().restoreWorkspace();

		const pid = "proj-1";
		const tid = "tab-split";
		const resolvers: Array<(id: string) => void> = [];
		terminalCreate.mockImplementation(
			() =>
				new Promise<string>((res) => {
					resolvers.push((id: string) => res(id));
				}),
		);

		const p = useWorkspaceStore.getState().ensureTerminalSpawned(pid, tid);
		// Pool kick → both creates in flight (order = tree order: pane-a, pane-b).
		await Promise.resolve();
		expect(resolvers).toHaveLength(2);

		// Remove pane-b → the split collapses to a single-pane tab whose
		// terminalId is still null (pane-a's create is pending).
		useWorkspaceStore.getState().closeSplitPane(pid, tid, "pane-b");
		const midTab = useWorkspaceStore.getState().workspaceTabs[pid]?.find((t) => t.id === tid);
		if (!midTab) throw new Error("tab missing after collapse");
		expect(midTab.splitLayout).toBeUndefined();
		expect(midTab.terminalId).toBeNull();

		resolvers[0]("term-a"); // survivor pane-a
		resolvers[1]("term-b"); // removed pane-b
		await p;

		// Removed pane's late PTY is disposed; survivor's is adopted by the tab.
		expect(terminalClose).toHaveBeenCalledTimes(1);
		expect(terminalClose).toHaveBeenCalledWith("term-b");
		const tab = useWorkspaceStore.getState().workspaceTabs[pid]?.find((t) => t.id === tid);
		if (!tab) throw new Error("tab missing");
		expect(tab.splitLayout).toBeUndefined();
		expect(tab.terminalId).toBe("term-a");
	});
});
