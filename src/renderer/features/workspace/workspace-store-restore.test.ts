import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Project, WorkspaceState, WorkspaceTabState } from "@shared/types";
import type { PersistedNode } from "./workspace-persistence";
import type { SplitLeaf, SplitNode } from "./split-layout";

// ─── Test-local helpers ─────────────────────────────────────────────────────

/** Recursively collect terminal leaves (kind !== "editor") from a split tree. */
function collectTerminalLeaves(node: SplitNode): SplitLeaf[] {
	if (node.type === "leaf") {
		return node.kind !== "editor" ? [node] : [];
	}
	const leaves: SplitLeaf[] = [];
	for (const child of node.children) {
		leaves.push(...collectTerminalLeaves(child));
	}
	return leaves;
}

/** Recursively collect every leaf (terminal + editor) from a split tree. */
function collectAllLeaves(node: SplitNode): SplitLeaf[] {
	if (node.type === "leaf") return [node];
	const leaves: SplitLeaf[] = [];
	for (const child of node.children) {
		leaves.push(...collectAllLeaves(child));
	}
	return leaves;
}

// ─── Mocks ──────────────────────────────────────────────────────────────────

// Cross-task contract spy from the task brief (pattern verbatim). The factory
// closes over the mock lazily, so hoisting is safe.
const terminalCreate = vi.fn(async (..._args: unknown[]) => `term-${Math.random()}`);

vi.mock("../../core/api", () => ({
	terminal: { create: (...a: unknown[]) => terminalCreate(...(a as never[])), close: vi.fn() },
}));

// startup-metrics transitively imports @tauri-apps (unavailable under the node
// test env) — mock it and spy on the phase registration this task must emit.
const registerPhaseComplete = vi.fn();

vi.mock("../../core/instrumentation/startup-metrics", () => ({ registerPhaseComplete }));

// ─── Fixtures ───────────────────────────────────────────────────────────────

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

function makeSavedState(): WorkspaceState {
	// Persisted split trees carry kind/filePath (PersistedNode shape) which the
	// narrower shared WorkspaceTabState type omits — same mismatch the store
	// itself bridges with a cast when deserializing.
	const splitTree = {
		type: "branch",
		id: "root-branch",
		direction: "horizontal",
		ratios: [0.25, 0.75],
		children: [
			{ type: "leaf", id: "leaf-term-1", kind: "terminal", shell: "bash" },
			{ type: "leaf", id: "leaf-term-2", kind: "terminal", shell: "bash" },
			{ type: "leaf", id: "leaf-editor", kind: "editor", filePath: "/src/main.ts" },
		],
	} satisfies PersistedNode as unknown as WorkspaceTabState["splitTree"];

	return {
		activeProjectId: "proj-1",
		activeTabIds: { "proj-1": "tab-split" },
		projectTabs: {
			"proj-1": [
				{ id: "tab-single", label: "Shell", shell: "pwsh" },
				{ id: "tab-split", label: "Split", shell: "bash", splitTree },
				{ id: "tab-editor", label: "main.ts", type: "editor", filePath: "/src/main.ts" },
			],
			// Project missing from the projects list — must be skipped entirely.
			"proj-gone": [{ id: "tab-orphan", label: "Orphan", shell: "pwsh" }],
		},
	};
}

let savedState: WorkspaceState | null = null;

// ─── Suite ──────────────────────────────────────────────────────────────────

describe("restoreWorkspace (lazy)", () => {
	beforeEach(() => {
		terminalCreate.mockClear();
		registerPhaseComplete.mockClear();
		// Fresh module registry per test: workspace-store keeps a module-level
		// `_workspaceRestored` guard, so each test needs a pristine module.
		vi.resetModules();
		savedState = makeSavedState();

		// Node env has no real `window`; the store reads `window.connexio.*`.
		// Unchecked cast: the full ConnexioAPI surface is Tauri-bound — only
		// terminal/workspace are exercised by the restore path.
		const connexio = {
			terminal: { create: terminalCreate, close: vi.fn(async () => {}) },
			workspace: { getState: async () => savedState, saveState: async () => {} },
		} as unknown as Window["connexio"];
		Reflect.set(globalThis, "window", { connexio } as unknown as Window);
		// workspace-spawn-actions imports settingsStore, which reads localStorage
		// at module scope — stub it for the node env (dynamic imports run later).
		Reflect.set(globalThis, "localStorage", { getItem: () => null });
	});

	// Dynamic imports (not static): must resolve AFTER vi.resetModules() so the
	// fresh module registry + mocked window are in place before store init.
	async function importStores() {
		const { useProjectsStore } = await import("../projects");
		const { useWorkspaceStore } = await import("./workspace-store");
		return { useProjectsStore, useWorkspaceStore };
	}

	it("reconstructs tab structure without any terminal.create call", async () => {
		const { useProjectsStore, useWorkspaceStore } = await importStores();
		useProjectsStore.setState({ projects: [makeProject("proj-1")] });

		await useWorkspaceStore.getState().restoreWorkspace();

		expect(terminalCreate).not.toHaveBeenCalled();

		const state = useWorkspaceStore.getState();
		for (const tabs of Object.values(state.workspaceTabs)) {
			for (const tab of tabs) {
				if (tab.terminalId != null && !tab.splitLayout) {
					throw new Error("single-pane tab masih punya terminalId setelah restore");
				}
				if (tab.splitLayout) {
					const leaves = collectTerminalLeaves(tab.splitLayout.root);
					for (const leaf of leaves) {
						if (leaf.terminalId != null) {
							throw new Error("split leaf masih punya terminalId setelah restore");
						}
					}
				}
			}
		}
	});

	it("restores structure: labels, shells, split ratios, editor filePaths", async () => {
		const { useProjectsStore, useWorkspaceStore } = await importStores();
		useProjectsStore.setState({ projects: [makeProject("proj-1")] });

		await useWorkspaceStore.getState().restoreWorkspace();

		const tabs = useWorkspaceStore.getState().workspaceTabs["proj-1"];
		expect(tabs).toHaveLength(3);

		const single = tabs.find((t) => t.id === "tab-single");
		expect(single?.terminalId).toBeNull();
		expect(single?.label).toBe("Shell");
		expect(single?.shell).toBe("pwsh");

		const split = tabs.find((t) => t.id === "tab-split");
		expect(split?.splitLayout).toBeDefined();
		const root = split?.splitLayout?.root;
		expect(root).toMatchObject({ type: "branch", direction: "horizontal", ratios: [0.25, 0.75] });
		if (root && root.type === "branch") {
			const allLeaves = collectAllLeaves(root);
			expect(allLeaves).toHaveLength(3);
			const editorLeaf = allLeaves.find((l) => l.id === "leaf-editor");
			expect(editorLeaf).toMatchObject({ kind: "editor", filePath: "/src/main.ts" });
		}

		const editor = tabs.find((t) => t.id === "tab-editor");
		expect(editor?.type).toBe("editor");
		expect(editor?.filePath).toBe("/src/main.ts");
		expect(editor?.terminalId).toBeNull();
	});

	it("skips projects missing from the projects list", async () => {
		const { useProjectsStore, useWorkspaceStore } = await importStores();
		useProjectsStore.setState({ projects: [makeProject("proj-1")] });

		await useWorkspaceStore.getState().restoreWorkspace();

		const state = useWorkspaceStore.getState();
		expect(state.workspaceTabs["proj-gone"]).toBeUndefined();
		expect(Object.keys(state.workspaceTabs)).toEqual(["proj-1"]);
	});

	it("registers the workspace-structure-restored phase and clears restoring", async () => {
		const { useProjectsStore, useWorkspaceStore } = await importStores();
		useProjectsStore.setState({ projects: [makeProject("proj-1")] });

		await useWorkspaceStore.getState().restoreWorkspace();

		expect(registerPhaseComplete).toHaveBeenCalledWith("workspace-structure-restored");
		const state = useWorkspaceStore.getState();
		expect(state.isRestoring).toBe(false);
		expect(state.activeTabIds["proj-1"]).toBe("tab-split");
	});

	it("initializes spawningTabs and paneErrors empty, never spawns on re-restore", async () => {
		const { useProjectsStore, useWorkspaceStore } = await importStores();
		useProjectsStore.setState({ projects: [makeProject("proj-1")] });

		await useWorkspaceStore.getState().restoreWorkspace();

		const first = useWorkspaceStore.getState();
		expect(first.spawningTabs).toEqual({});
		expect(first.paneErrors).toEqual({});

		// Second call is a no-op via the module-level guard.
		await useWorkspaceStore.getState().restoreWorkspace();
		expect(terminalCreate).not.toHaveBeenCalled();
		expect(registerPhaseComplete).toHaveBeenCalledTimes(1);
	});
});
