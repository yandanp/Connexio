/**
 * Lazy-spawn actions for the workspace store (Task 4).
 *
 * Extracted from workspace-store.ts to respect the max-lines ratchet: the
 * store delegates here via `createSpawnActions(set, get)`.
 *
 * Contract (consumed by Task 6 UI):
 * - `ensureTerminalSpawned(projectId, tabId)` — spawn every lazy terminal leaf
 *   (`kind !== "editor"`, `terminalId == null`, no pane error) of one tab.
 *   Idempotent: concurrent calls share one in-flight promise per
 *   `${projectId}:${tabId}` key (StrictMode double-mount safe).
 * - `retryPaneSpawn(projectId, tabId, paneId)` — clear the pane error and
 *   respawn only that pane through the same pool + disposal path.
 * - PTY disposal: after each `terminal.create` resolves, verify the leaf still
 *   exists in the live tree; if the tab/pane/project vanished mid-spawn the
 *   freshly created PTY is closed instead of being written to state — no
 *   orphaned shells (covers closeTab / closeSplitPane / deleteProject paths).
 * - Non-atomic per pane: successes commit their terminalId, failures land in
 *   `paneErrors[paneId]`, siblings keep running.
 */

import type { StoreApi } from "zustand";
import type { WorkspaceStore } from "./workspace-store";
import { useProjectsStore } from "../projects";
import { useSettingsStore } from "../../core/stores/settingsStore";
import { registerSpawnComplete, setSpawnStart } from "../../core/instrumentation/startup-metrics";
import { collectLeaves, findNode } from "./split-layout";
import type { SplitLeaf, SplitNode } from "./split-layout";
import { runWithSpawnLimit } from "./spawn-pool";

/** Store slices this module consumes/produces. */
type Get = () => WorkspaceStore;
type Set = StoreApi<WorkspaceStore>["setState"];

/** The public action surface added to WorkspaceStore. */
export interface SpawnActions {
	ensureTerminalSpawned: (projectId: string, tabId: string) => Promise<void>;
	retryPaneSpawn: (projectId: string, tabId: string, paneId: string) => Promise<void>;
}

/** A leaf awaiting a PTY, plus how to commit the new terminalId on success. */
interface SpawnTarget {
	paneId: string;
	/** Single-pane tabs write `tab.terminalId`; split tabs rewrite their leaf. */
	split: boolean;
}

/** Module-level in-flight map — key `${projectId}:${tabId}` → shared promise. */
const inFlight = new Map<string, Promise<void>>();

/** Await a tab's in-flight spawn, if any (used by splitTerminal's guard). */
export async function waitForSpawn(projectId: string, tabId: string): Promise<void> {
	await inFlight.get(`${projectId}:${tabId}`);
}

/**
 * Panes that survived a split collapse while their spawn was still in-flight:
 * key `${projectId}:${tabId}` → surviving paneId. closeSplitPane records the
 * survivor when it collapses a split whose surviving leaf is still lazy, so
 * the pane's late create is ADOPTED as the tab terminal instead of disposed.
 */
const collapsedSurvivors = new Map<string, string>();

/**
 * Record a split collapse whose surviving root is STILL LAZY (no terminal
 * yet): its in-flight create, if any, must later adopt the tab instead of
 * being disposed. No-op for editor survivors and non-leaf roots.
 */
export function noteLazyCollapse(
	projectId: string,
	tabId: string,
	node: SplitNode | null,
): void {
	if (node?.type !== "leaf" || node.kind === "editor" || node.terminalId != null) return;
	collapsedSurvivors.set(`${projectId}:${tabId}`, node.id);
}

/** Does the pane still exist in the CURRENT tree? Walks live store state. */
export function leafExists(get: Get, projectId: string, tabId: string, paneId: string): boolean {
	const tab = get().workspaceTabs[projectId]?.find((t) => t.id === tabId);
	if (!tab) return false;
	// A single-pane tab IS its own leaf — its paneId is the tabId. A pane id
	// from a since-collapsed split never matches, so late creates dispose.
	if (!tab.splitLayout) return paneId === tab.id;
	return findNode(tab.splitLayout.root, paneId) !== null;
}

/**
 * Collect the leaves of a tab that still need a shell. `onlyPaneId` restricts
 * the result to one pane (retry path). Returns [] when there is nothing to do.
 */
function collectSpawnTargets(
	state: WorkspaceStore,
	projectId: string,
	tabId: string,
	onlyPaneId?: string,
): SpawnTarget[] {
	const tab = state.workspaceTabs[projectId]?.find((t) => t.id === tabId);
	if (!tab) return [];
	const targets: SpawnTarget[] = [];
	if (tab.splitLayout) {
		for (const leaf of collectLeaves(tab.splitLayout.root)) {
			if (leaf.kind === "editor") continue;
			if (leaf.terminalId != null) continue;
			if (state.paneErrors[leaf.id]) continue;
			if (onlyPaneId && leaf.id !== onlyPaneId) continue;
			targets.push({ paneId: leaf.id, split: true });
		}
		return targets;
	}
	// Single-pane terminal tab (editor/preview/ssh/sftp tabs never spawn here).
	const spawnable = !tab.type || tab.type === "terminal";
	if (
		spawnable &&
		tab.terminalId == null &&
		!state.paneErrors[tabId] &&
		(!onlyPaneId || onlyPaneId === tabId)
	) {
		targets.push({ paneId: tabId, split: false });
	}
	return targets;
}

/** Immutably write a successful terminalId into the live tree. */
function commitTerminalId(
	set: Set,
	projectId: string,
	tabId: string,
	paneId: string,
	terminalId: string,
	split: boolean,
): void {
	set((state) => ({
		workspaceTabs: {
			...state.workspaceTabs,
			[projectId]: (state.workspaceTabs[projectId] ?? []).map((tab) => {
				if (tab.id !== tabId) return tab;
				if (!split || !tab.splitLayout) return { ...tab, terminalId };
				return {
					...tab,
					splitLayout: {
						...tab.splitLayout,
						root: mapLeafTerminal(tab.splitLayout.root, paneId, terminalId),
					},
				};
			}),
		},
	}));
}

/** Deep-clone a split tree with one leaf's terminalId replaced. */
function mapLeafTerminal(node: SplitNode, paneId: string, terminalId: string): SplitNode {
	if (node.type === "leaf") return node.id === paneId ? { ...node, terminalId } : node;
	return { ...node, children: node.children.map((c) => mapLeafTerminal(c, paneId, terminalId)) };
}

/** Record a per-pane spawn failure (partial failure: siblings unaffected). */
function setPaneError(set: Set, paneId: string, err: unknown): void {
	const message = err instanceof Error ? err.message : String(err);
	set((state) => ({ paneErrors: { ...state.paneErrors, [paneId]: message } }));
}

/** Remove a pane error (retry path) — no-op when the pane has none. */
function clearPaneError(set: Set, paneId: string): void {
	set((state) => {
		if (!(paneId in state.paneErrors)) return {};
		const next = { ...state.paneErrors };
		delete next[paneId];
		return { paneErrors: next };
	});
}

/**
 * Spawn `targets` through the bounded pool. Non-atomic per pane: each task
 * registers its spawn metric, creates the PTY, performs the late-close
 * disposal check, then commits the terminalId or records the pane error.
 */
async function spawnTargets(
	get: Get,
	set: Set,
	projectId: string,
	tabId: string,
	key: string, // `${projectId}:${tabId}` for adoption registry
	targets: SpawnTarget[],
): Promise<void> {
	const tab = get().workspaceTabs[projectId]?.find((t) => t.id === tabId);
	const project = useProjectsStore.getState().projects.find((p) => p.id === projectId);
	if (!tab || !project) return;

	// Snapshot spawn params once, up front.
	const shell = tab.shell ?? useSettingsStore.getState().settings?.defaultShell;
	const context = {
		projectId,
		projectName: project.name,
		tabId,
		tabLabel: tab.label,
	};

	await runWithSpawnLimit(
		targets.map(({ paneId, split }) => async (): Promise<void> => {
			const startedAt = performance.now();
			let terminalId: string;
			try {
				terminalId = await window.connexio.terminal.create(project.path, shell, {
					...context,
					paneId,
				});
			} catch (err) {
				setPaneError(set, paneId, err);
				return;
			}
			// Anchor spawn metrics under the REAL terminal id (knowable only now)
			// with the pre-captured start: duration stays accurate and Task 1's
			// first-output correlation (keyed by the bus-emitted id) works.
			setSpawnStart(terminalId, startedAt);
			registerSpawnComplete(terminalId);
			// Disposal: leaf removed mid-spawn (closeTab / closeSplitPane /
			// deleteProject) → close the fresh PTY, never touch state.
			if (!leafExists(get, projectId, tabId, paneId)) {
				// Exception: this pane SURVIVED a split collapse to single-pane and
				// the tab still has no terminal → adopt as the tab's terminal.
				const collapsed = get().workspaceTabs[projectId]?.find(
					(t) => t.id === tabId && !t.splitLayout && t.terminalId == null,
				);
				if (collapsed && collapsedSurvivors.get(key) === paneId) {
					collapsedSurvivors.delete(key);
					commitTerminalId(set, projectId, tabId, tabId, terminalId, false);
					return;
				}
				await window.connexio.terminal.close(terminalId).catch(() => {});
				return;
			}
			commitTerminalId(set, projectId, tabId, paneId, terminalId, split);
		}),
	);
}

/** ensureTerminalSpawned body — guarded by the in-flight map for idempotency. */
async function runTabSpawn(get: Get, set: Set, projectId: string, tabId: string): Promise<void> {
	const key = `${projectId}:${tabId}`;
	// No pending leaves (or project gone) → resolve immediately, no state churn.
	if (collectSpawnTargets(get(), projectId, tabId).length === 0) return;
	set((state) => ({ spawningTabs: { ...state.spawningTabs, [key]: true } }));
	try {
		const targets = collectSpawnTargets(get(), projectId, tabId);
		if (targets.length > 0) await spawnTargets(get, set, projectId, tabId, key, targets);
	} finally {
		collapsedSurvivors.delete(key); // stale survivor markers after batch settles
		set((state) => {
			if (!(key in state.spawningTabs)) return {};
			const next = { ...state.spawningTabs };
			delete next[key];
			return { spawningTabs: next };
		});
	}
}

/** Build the spawn action slice for the store (called once in `create`). */
export function createSpawnActions(set: Set, get: Get): SpawnActions {
	return {
		ensureTerminalSpawned: (projectId: string, tabId: string): Promise<void> => {
			const key = `${projectId}:${tabId}`;
			const pending = inFlight.get(key);
			if (pending) return pending; // idempotent: share the same promise
			const promise = runTabSpawn(get, set, projectId, tabId).finally(() => {
				inFlight.delete(key);
			});
			inFlight.set(key, promise);
			return promise;
		},
		retryPaneSpawn: async (projectId: string, tabId: string, paneId: string): Promise<void> => {
			const key = `${projectId}:${tabId}`;
			clearPaneError(set, paneId);
			const targets = collectSpawnTargets(get(), projectId, tabId, paneId);
			if (targets.length === 0) return;
			try {
				await spawnTargets(get, set, projectId, tabId, key, targets);
			} finally {
				collapsedSurvivors.delete(key);
				set((state) => {
					if (!(key in state.spawningTabs)) return {};
					const next = { ...state.spawningTabs };
					delete next[key];
					return { spawningTabs: next };
				});
			}
		},
	};
}
/** Re-exported for tests: leaves of a tree (kind !== "editor"). */
export function terminalLeavesOf(node: SplitNode): SplitLeaf[] {
	return collectLeaves(node).filter((leaf) => leaf.kind !== "editor");
}
