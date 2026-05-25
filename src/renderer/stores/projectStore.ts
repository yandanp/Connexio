import { v4 as uuid } from "uuid";
import { create } from "zustand";

// Module-level guard to prevent double restore from React StrictMode
let _workspaceRestored = false;

import type {
	Project,
	WorkspaceState,
	WorkspaceTabState,
} from "../../shared/types";

// === Split Layout Types (Recursive Tree) ===

export type SplitDirection = "horizontal" | "vertical";

export interface SplitLeaf {
	type: "leaf";
	id: string;
	kind: "terminal" | "editor";
	terminalId: string | null;
	filePath?: string;
}

export interface SplitBranch {
	type: "branch";
	id: string;
	direction: SplitDirection;
	children: SplitNode[];
	/** Ratio for each child (0-1), must sum to 1. If absent, equal split. */
	ratios?: number[];
}

export type SplitNode = SplitLeaf | SplitBranch;

export interface SplitLayout {
	root: SplitNode;
	activePaneId: string;
}

// === Tree helpers ===

function findNode(node: SplitNode, id: string): SplitNode | null {
	if (node.id === id) return node;
	if (node.type === "branch") {
		for (const child of node.children) {
			const found = findNode(child, id);
			if (found) return found;
		}
	}
	return null;
}

function findParent(root: SplitNode, targetId: string): SplitBranch | null {
	if (root.type === "branch") {
		for (const child of root.children) {
			if (child.id === targetId) return root;
			const found = findParent(child, targetId);
			if (found) return found;
		}
	}
	return null;
}

function replaceNode(root: SplitNode, targetId: string, replacement: SplitNode): SplitNode {
	if (root.id === targetId) return replacement;
	if (root.type === "branch") {
		return { ...root, children: root.children.map((c) => replaceNode(c, targetId, replacement)) };
	}
	return root;
}

function removeNode(root: SplitNode, targetId: string): SplitNode | null {
	if (root.id === targetId) return null;
	if (root.type === "branch") {
		const removedIndices: number[] = [];
		const newChildren = root.children
			.map((c, i) => {
				const result = removeNode(c, targetId);
				if (result === null) removedIndices.push(i);
				return result;
			})
			.filter((c): c is SplitNode => c !== null);
		if (newChildren.length === 0) return null;
		if (newChildren.length === 1) return newChildren[0]; // collapse

		// Recalculate ratios: redistribute removed children's space proportionally
		let newRatios: number[] | undefined;
		if (root.ratios && root.ratios.length === root.children.length) {
			const keptRatios = root.ratios.filter((_, i) => !removedIndices.includes(i));
			const keptTotal = keptRatios.reduce((sum, r) => sum + r, 0);
			if (keptTotal > 0) {
				newRatios = keptRatios.map((r) => r / keptTotal);
			}
		}

		return { ...root, children: newChildren, ratios: newRatios };
	}
	return root;
}

function collectLeaves(node: SplitNode): SplitLeaf[] {
	if (node.type === "leaf") return [node];
	return node.children.flatMap(collectLeaves);
}

function collectTerminalIds(node: SplitNode): string[] {
	if (node.type === "leaf") return (node.kind === "terminal" && node.terminalId) ? [node.terminalId] : [];
	return node.children.flatMap(collectTerminalIds);
}

/** Compute absolute bounds (0-1 range) for each leaf in the tree */
export interface PaneBounds {
	paneId: string;
	kind: "terminal" | "editor";
	terminalId: string | null;
	filePath?: string;
	top: number;
	left: number;
	width: number;
	height: number;
}

export interface ResizeHandleBounds {
	branchId: string;
	dividerIndex: number;
	direction: SplitDirection;
	/** Absolute position of the divider line (0-1) */
	top: number;
	left: number;
	/** Full branch bounds for ratio calculation */
	branchTop: number;
	branchLeft: number;
	branchWidth: number;
	branchHeight: number;
}

export function computePaneBounds(node: SplitNode, bounds = { top: 0, left: 0, width: 1, height: 1 }): PaneBounds[] {
	if (node.type === "leaf") {
		return [{
			paneId: node.id,
			kind: node.kind,
			terminalId: node.terminalId,
			filePath: node.filePath,
			top: bounds.top,
			left: bounds.left,
			width: bounds.width,
			height: bounds.height,
		}];
	}

	const results: PaneBounds[] = [];
	const count = node.children.length;
	const isHorizontal = node.direction === "horizontal";
	const ratios = node.ratios && node.ratios.length === count
		? node.ratios
		: node.children.map(() => 1 / count);

	let offset = 0;
	for (let i = 0; i < count; i++) {
		const ratio = ratios[i];
		const childBounds = isHorizontal
			? {
					top: bounds.top,
					left: bounds.left + bounds.width * offset,
					width: bounds.width * ratio,
					height: bounds.height,
				}
			: {
					top: bounds.top + bounds.height * offset,
					left: bounds.left,
					width: bounds.width,
					height: bounds.height * ratio,
				};
		results.push(...computePaneBounds(node.children[i], childBounds));
		offset += ratio;
	}

	return results;
}

/** Compute branch divider handles. Handles belong to branch dividers, not leaf borders. */
export function computeResizeHandleBounds(
	node: SplitNode,
	bounds = { top: 0, left: 0, width: 1, height: 1 },
): ResizeHandleBounds[] {
	if (node.type === "leaf") return [];

	const handles: ResizeHandleBounds[] = [];
	const count = node.children.length;
	const isHorizontal = node.direction === "horizontal";
	const ratios = node.ratios && node.ratios.length === count
		? node.ratios
		: node.children.map(() => 1 / count);

	let offset = 0;
	for (let i = 0; i < count; i++) {
		const ratio = ratios[i];
		const childBounds = isHorizontal
			? {
					top: bounds.top,
					left: bounds.left + bounds.width * offset,
					width: bounds.width * ratio,
					height: bounds.height,
				}
			: {
					top: bounds.top + bounds.height * offset,
					left: bounds.left,
					width: bounds.width,
					height: bounds.height * ratio,
				};

		if (i > 0) {
			handles.push({
				branchId: node.id,
				dividerIndex: i,
				direction: node.direction,
				// Divider position (absolute 0-1)
				top: isHorizontal ? bounds.top : childBounds.top,
				left: isHorizontal ? childBounds.left : bounds.left,
				// Full branch bounds for ratio calculation
				branchTop: bounds.top,
				branchLeft: bounds.left,
				branchWidth: bounds.width,
				branchHeight: bounds.height,
			});
		}

		handles.push(...computeResizeHandleBounds(node.children[i], childBounds));
		offset += ratio;
	}

	return handles;
}

// === Persistence helpers ===

interface PersistedNode {
	type: "leaf" | "branch";
	id: string;
	kind?: "terminal" | "editor";
	direction?: SplitDirection;
	children?: PersistedNode[];
	ratios?: number[];
	shell?: string;
	filePath?: string;
}

function serializeNode(node: SplitNode, tabShell?: string): PersistedNode {
	if (node.type === "leaf") {
		return { type: "leaf", id: node.id, kind: node.kind, shell: tabShell, filePath: node.filePath };
	}
	return {
		type: "branch",
		id: node.id,
		direction: node.direction,
		ratios: node.ratios,
		children: node.children.map((c) => serializeNode(c, tabShell)),
	};
}

function deserializeNode(persisted: PersistedNode): SplitNode {
	if (persisted.type === "leaf") {
		return { type: "leaf", id: persisted.id, kind: persisted.kind || "terminal", terminalId: null, filePath: persisted.filePath };
	}
	return {
		type: "branch",
		id: persisted.id,
		direction: persisted.direction || "horizontal",
		ratios: persisted.ratios,
		children: (persisted.children || []).map(deserializeNode),
	};
}

async function createTerminalsForTree(
	node: SplitNode,
	projectPath: string,
	projectId: string,
	projectName: string,
	tabLabel: string,
	shell?: string,
): Promise<SplitNode> {
	if (node.type === "leaf") {
		if (node.kind === "editor") return node; // editor leaves don't need terminal
		try {
			const terminalId = await window.connexio.terminal.create(
				projectPath, shell,
				{ projectId, projectName, tabId: node.id, tabLabel: `${tabLabel} (split)` },
			);
			return { ...node, terminalId };
		} catch {
			return node;
		}
	}
	const children: SplitNode[] = [];
	for (const child of node.children) {
		children.push(await createTerminalsForTree(child, projectPath, projectId, projectName, tabLabel, shell));
	}
	return { ...node, children };
}

// === Tab Types ===

export interface TerminalTab {
	id: string;
	label: string;
	shell?: string;
	terminalId: string | null;
	type?: "terminal" | "editor" | "preview";
	filePath?: string;
	splitLayout?: SplitLayout;
}

interface ProjectStore {
	projects: Project[];
	activeProjectId: string | null;
	searchQuery: string;
	sidebarCollapsed: boolean;
	isRestoring: boolean;

	workspaceTabs: Record<string, TerminalTab[]>;
	activeTabIds: Record<string, string>;

	// Actions
	loadProjects: () => Promise<void>;
	addProject: (name: string, path: string, group: string) => Promise<void>;
	deleteProject: (id: string) => Promise<void>;
	setActiveProject: (id: string) => void;
	setSearchQuery: (query: string) => void;
	toggleSidebar: () => void;
	updateProjectLastOpened: (id: string) => Promise<void>;

	reorderProjects: (fromId: string, toId: string) => Promise<void>;
	moveProjectToGroup: (projectId: string, newGroup: string) => Promise<void>;

	openTerminalTab: (projectId: string, label?: string, shell?: string) => Promise<void>;
	openEditorTab: (projectId: string, filePath: string, lineNumber?: number) => void;
	openPreviewTab: (projectId: string, url?: string) => void;
	closeTerminalTab: (projectId: string, tabId: string) => void;
	setActiveTerminalTab: (projectId: string, tabId: string) => void;
	renameTerminalTab: (projectId: string, tabId: string, newLabel: string) => void;
	reorderTabs: (projectId: string, fromIndex: number, toIndex: number) => void;

	// Split actions
	splitTerminal: (projectId: string, tabId: string, paneId: string, direction: SplitDirection) => Promise<void>;
	splitTerminalFromEditor: (projectId: string, tabId: string, direction: SplitDirection) => Promise<void>;
	openEditorInSplit: (projectId: string, tabId: string, paneId: string, direction: SplitDirection, filePath: string) => void;
	closeSplitPane: (projectId: string, tabId: string, paneId: string) => void;
	setActiveSplitPane: (projectId: string, tabId: string, paneId: string) => void;
	resizeSplitPane: (projectId: string, tabId: string, paneId: string, delta: number) => void;
	resizeSplitBranch: (
		projectId: string,
		tabId: string,
		branchId: string,
		dividerIndex: number,
		ratio: number,
		mode?: "absolute" | "delta",
	) => void;

	restoreWorkspace: () => Promise<void>;
	persistWorkspace: () => void;
	/** Immediately persist workspace (no debounce). Call on app close. */
	flushPersistWorkspace: () => void;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function debouncedSave(fn: () => void) {
	if (saveTimer) clearTimeout(saveTimer);
	saveTimer = setTimeout(fn, 500);
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
	projects: [],
	activeProjectId: null,
	searchQuery: "",
	sidebarCollapsed: false,
	isRestoring: false,
	workspaceTabs: {},
	activeTabIds: {},

	loadProjects: async () => {
		const projects = await window.connexio.project.list();
		set({ projects });
	},

	addProject: async (name: string, projectPath: string, group: string) => {
		const project: Project = {
			id: uuid(),
			name,
			path: projectPath,
			group,
			tabs: [{ id: uuid(), label: "Terminal 1" }],
			createdAt: Date.now(),
			lastOpenedAt: Date.now(),
		};
		await window.connexio.project.add(project);
		const projects = await window.connexio.project.list();
		set({ projects });
		get().setActiveProject(project.id);
	},

	deleteProject: async (id: string) => {
		const { workspaceTabs, activeTabIds, activeProjectId, projects } = get();
		const tabs = workspaceTabs[id] || [];

		const { [id]: _removedTabs, ...restTabs } = workspaceTabs;
		const { [id]: _removedActive, ...restActiveIds } = activeTabIds;

		let newActiveId: string | null = activeProjectId;
		if (activeProjectId === id) {
			const remaining = projects.filter((p) => p.id !== id);
			newActiveId = remaining.length > 0 ? remaining[0].id : null;
		}

		set({ workspaceTabs: restTabs, activeTabIds: restActiveIds, activeProjectId: newActiveId });

		for (const tab of tabs) {
			if (tab.splitLayout) {
				for (const tid of collectTerminalIds(tab.splitLayout.root)) {
					await window.connexio.terminal.close(tid);
				}
			} else if (tab.terminalId) {
				await window.connexio.terminal.close(tab.terminalId);
			}
		}

		await window.connexio.project.delete(id);
		set({ projects: await window.connexio.project.list() });
		get().persistWorkspace();
	},

	setActiveProject: (id: string) => {
		const { activeProjectId, projects, isRestoring } = get();
		if (activeProjectId === id) return;
		const project = projects.find((p) => p.id === id);
		if (!project) return;
		set({ activeProjectId: id });
		if (!isRestoring) {
			const tabs = get().workspaceTabs[id];
			if (!tabs || tabs.length === 0) get().openTerminalTab(id, "Terminal 1");
		}
		get().updateProjectLastOpened(id);
		get().persistWorkspace();
	},

	setSearchQuery: (query: string) => set({ searchQuery: query }),
	toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

	updateProjectLastOpened: async (id: string) => {
		const { projects } = get();
		const project = projects.find((p) => p.id === id);
		if (project) {
			const updated = { ...project, lastOpenedAt: Date.now() };
			await window.connexio.project.update(updated);
		}
	},

	reorderProjects: async (fromId: string, toId: string) => {
		const { projects } = get();
		const fromIndex = projects.findIndex((p) => p.id === fromId);
		const toIndex = projects.findIndex((p) => p.id === toId);
		if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;
		const reordered = [...projects];
		const [moved] = reordered.splice(fromIndex, 1);
		reordered.splice(toIndex, 0, moved);
		set({ projects: reordered });
		await window.connexio.project.reorder(reordered.map((p) => p.id));
	},

	moveProjectToGroup: async (projectId: string, newGroup: string) => {
		const { projects } = get();
		const project = projects.find((p) => p.id === projectId);
		if (!project || project.group === newGroup) return;
		const updated = { ...project, group: newGroup };
		await window.connexio.project.update(updated);
		set({ projects: projects.map((p) => (p.id === projectId ? updated : p)) });
	},

	// === Tab Actions ===

	openTerminalTab: async (projectId: string, label?: string, shell?: string) => {
		const { projects, workspaceTabs, activeTabIds } = get();
		const project = projects.find((p) => p.id === projectId);
		if (!project) return;

		const existingTabs = workspaceTabs[projectId] || [];
		const tabLabel = label || `Terminal ${existingTabs.length + 1}`;
		const newTabId = uuid();

		let terminalId: string;
		try {
			terminalId = await window.connexio.terminal.create(project.path, shell, {
				projectId, projectName: project.name, tabId: newTabId, tabLabel,
			});
		} catch (e) {
			console.error("[Connexio] Failed to create terminal:", e);
			return;
		}

		const newTab: TerminalTab = { id: newTabId, label: tabLabel, shell, terminalId };
		set({
			workspaceTabs: { ...workspaceTabs, [projectId]: [...existingTabs, newTab] },
			activeTabIds: { ...activeTabIds, [projectId]: newTab.id },
		});
		get().persistWorkspace();
	},

	openEditorTab: (projectId: string, filePath: string, lineNumber?: number) => {
		const { workspaceTabs, activeTabIds } = get();
		const existingTabs = workspaceTabs[projectId] || [];

		const existing = existingTabs.find((t) => t.filePath === filePath);
		if (existing) {
			set({ activeTabIds: { ...activeTabIds, [projectId]: existing.id } });
			if (lineNumber) {
				setTimeout(() => {
					window.dispatchEvent(new CustomEvent("connexio:editor-goto-line", { detail: { filePath, lineNumber } }));
				}, 50);
			}
			return;
		}

		const fileName = filePath.replace(/\\/g, "/").split("/").pop() || "file";
		const newTab: TerminalTab = { id: uuid(), label: fileName, type: "editor", filePath, terminalId: null };
		set({
			workspaceTabs: { ...workspaceTabs, [projectId]: [...existingTabs, newTab] },
			activeTabIds: { ...activeTabIds, [projectId]: newTab.id },
		});
		if (lineNumber) {
			setTimeout(() => {
				window.dispatchEvent(new CustomEvent("connexio:editor-goto-line", { detail: { filePath, lineNumber } }));
			}, 300);
		}
	},

	openPreviewTab: (projectId: string, url?: string) => {
		const { workspaceTabs, activeTabIds } = get();
		const existingTabs = workspaceTabs[projectId] || [];

		// Reuse existing preview tab if one exists
		const existing = existingTabs.find((t) => t.type === "preview");
		if (existing) {
			set({ activeTabIds: { ...activeTabIds, [projectId]: existing.id } });
			return;
		}

		const newTab: TerminalTab = {
			id: uuid(),
			label: "Preview",
			type: "preview",
			filePath: url || "http://localhost:3000",
			terminalId: null,
		};
		set({
			workspaceTabs: { ...workspaceTabs, [projectId]: [...existingTabs, newTab] },
			activeTabIds: { ...activeTabIds, [projectId]: newTab.id },
		});
	},

	closeTerminalTab: (projectId: string, tabId: string) => {
		const { workspaceTabs, activeTabIds } = get();
		const tabs = workspaceTabs[projectId] || [];
		const tab = tabs.find((t) => t.id === tabId);

		if (tab?.splitLayout) {
			for (const tid of collectTerminalIds(tab.splitLayout.root)) {
				window.connexio.terminal.close(tid);
			}
		} else if (tab?.terminalId) {
			window.connexio.terminal.close(tab.terminalId);
		}

		const newTabs = tabs.filter((t) => t.id !== tabId);
		const newActiveTabIds = { ...activeTabIds };
		if (activeTabIds[projectId] === tabId) {
			newActiveTabIds[projectId] = newTabs[newTabs.length - 1]?.id || "";
		}
		set({ workspaceTabs: { ...workspaceTabs, [projectId]: newTabs }, activeTabIds: newActiveTabIds });
		get().persistWorkspace();
	},

	setActiveTerminalTab: (projectId: string, tabId: string) => {
		set({ activeTabIds: { ...get().activeTabIds, [projectId]: tabId } });
		get().persistWorkspace();
	},

	renameTerminalTab: (projectId: string, tabId: string, newLabel: string) => {
		const { workspaceTabs } = get();
		const tabs = workspaceTabs[projectId] || [];
		set({ workspaceTabs: { ...workspaceTabs, [projectId]: tabs.map((t) => t.id === tabId ? { ...t, label: newLabel } : t) } });
		get().persistWorkspace();
	},

	reorderTabs: (projectId: string, fromIndex: number, toIndex: number) => {
		const { workspaceTabs } = get();
		const tabs = [...(workspaceTabs[projectId] || [])];
		if (fromIndex < 0 || toIndex < 0 || fromIndex >= tabs.length || toIndex >= tabs.length) return;
		const [moved] = tabs.splice(fromIndex, 1);
		tabs.splice(toIndex, 0, moved);
		set({ workspaceTabs: { ...workspaceTabs, [projectId]: tabs } });
		get().persistWorkspace();
	},

	// === Split Actions ===

	/**
	 * Split a specific pane (by paneId) in the given direction.
	 * If no split exists yet, creates the initial split from the tab's single terminal.
	 * Supports nested splits — e.g. split pane 2 vertically inside a horizontal split.
	 */
	splitTerminal: async (projectId: string, tabId: string, paneId: string, direction: SplitDirection) => {
		const { workspaceTabs, projects } = get();
		const tabs = workspaceTabs[projectId] || [];
		const tab = tabs.find((t) => t.id === tabId);
		if (!tab) return;

		const project = projects.find((p) => p.id === projectId);
		if (!project) return;

		// Validate target exists if already split
		if (tab.splitLayout) {
			const target = findNode(tab.splitLayout.root, paneId);
			if (!target) return;
		}

		// Create new terminal
		const newPaneId = uuid();
		let newTerminalId: string;
		try {
			newTerminalId = await window.connexio.terminal.create(project.path, tab.shell, {
				projectId, projectName: project.name, tabId: newPaneId, tabLabel: `${tab.label} (split)`,
			});
		} catch (e) {
			console.error("[Connexio] Failed to create split terminal:", e);
			return;
		}

		const newLeaf: SplitLeaf = { type: "leaf", id: newPaneId, kind: "terminal", terminalId: newTerminalId };
		let updatedLayout: SplitLayout;

		if (tab.splitLayout) {
			// Already split — wrap target pane + new leaf in a branch
			const targetNode = findNode(tab.splitLayout.root, paneId)!;
			const newBranch: SplitBranch = {
				type: "branch",
				id: uuid(),
				direction,
				children: [targetNode, newLeaf],
			};
			const newRoot = replaceNode(tab.splitLayout.root, paneId, newBranch);
			updatedLayout = { root: newRoot, activePaneId: newPaneId };
		} else {
			// First split — wrap existing terminal + new leaf
			const existingLeaf: SplitLeaf = { type: "leaf", id: uuid(), kind: "terminal", terminalId: tab.terminalId };
			const rootBranch: SplitBranch = {
				type: "branch",
				id: uuid(),
				direction,
				children: [existingLeaf, newLeaf],
			};
			updatedLayout = { root: rootBranch, activePaneId: newPaneId };
		}

		const updatedTabs = tabs.map((t) => t.id === tabId ? { ...t, splitLayout: updatedLayout } : t);
		set({ workspaceTabs: { ...workspaceTabs, [projectId]: updatedTabs } });
		get().persistWorkspace();

		// Trigger resize so terminals re-fit to new pane size
		setTimeout(() => {
			window.dispatchEvent(new Event("resize"));
			window.dispatchEvent(new Event("connexio:terminal-fit"));
		}, 50);
	},

	/**
	 * Split a terminal from an editor tab.
	 * Creates a split layout with the editor as one pane and a new terminal as the other.
	 */
	splitTerminalFromEditor: async (projectId: string, tabId: string, direction: SplitDirection) => {
		const { workspaceTabs, projects } = get();
		const tabs = workspaceTabs[projectId] || [];
		const tab = tabs.find((t) => t.id === tabId);
		if (!tab || tab.type !== "editor" || !tab.filePath) return;

		const project = projects.find((p) => p.id === projectId);
		if (!project) return;

		// Create new terminal
		const newPaneId = uuid();
		let newTerminalId: string;
		try {
			newTerminalId = await window.connexio.terminal.create(project.path, undefined, {
				projectId, projectName: project.name, tabId: newPaneId, tabLabel: `${tab.label} (terminal)`,
			});
		} catch (e) {
			console.error("[Connexio] Failed to create terminal from editor split:", e);
			return;
		}

		const editorLeaf: SplitLeaf = { type: "leaf", id: uuid(), kind: "editor", terminalId: null, filePath: tab.filePath };
		const terminalLeaf: SplitLeaf = { type: "leaf", id: newPaneId, kind: "terminal", terminalId: newTerminalId };
		const rootBranch: SplitBranch = {
			type: "branch", id: uuid(), direction,
			children: [editorLeaf, terminalLeaf],
		};
		const updatedLayout: SplitLayout = { root: rootBranch, activePaneId: newPaneId };

		const updatedTabs = tabs.map((t) => t.id === tabId ? { ...t, splitLayout: updatedLayout } : t);
		set({ workspaceTabs: { ...workspaceTabs, [projectId]: updatedTabs } });
		get().persistWorkspace();

		setTimeout(() => {
			window.dispatchEvent(new Event("resize"));
			window.dispatchEvent(new Event("connexio:terminal-fit"));
		}, 50);
	},
	openEditorInSplit: (projectId: string, tabId: string, paneId: string, direction: SplitDirection, filePath: string) => {
		const { workspaceTabs } = get();
		const tabs = workspaceTabs[projectId] || [];
		const tab = tabs.find((t) => t.id === tabId);
		if (!tab) return;

		// Validate target exists if already split
		if (tab.splitLayout) {
			const target = findNode(tab.splitLayout.root, paneId);
			if (!target) return;
		}

		const newPaneId = uuid();
		const newLeaf: SplitLeaf = { type: "leaf", id: newPaneId, kind: "editor", terminalId: null, filePath };

		let updatedLayout: SplitLayout;

		if (tab.splitLayout) {
			const targetNode = findNode(tab.splitLayout.root, paneId)!;
			const newBranch: SplitBranch = {
				type: "branch", id: uuid(), direction,
				children: [targetNode, newLeaf],
			};
			const newRoot = replaceNode(tab.splitLayout.root, paneId, newBranch);
			updatedLayout = { root: newRoot, activePaneId: newPaneId };
		} else {
			// First split — existing terminal + new editor
			const existingLeaf: SplitLeaf = { type: "leaf", id: uuid(), kind: "terminal", terminalId: tab.terminalId };
			const rootBranch: SplitBranch = {
				type: "branch", id: uuid(), direction,
				children: [existingLeaf, newLeaf],
			};
			updatedLayout = { root: rootBranch, activePaneId: newPaneId };
		}

		const updatedTabs = tabs.map((t) => t.id === tabId ? { ...t, splitLayout: updatedLayout } : t);
		set({ workspaceTabs: { ...workspaceTabs, [projectId]: updatedTabs } });
		get().persistWorkspace();

		// Trigger resize so terminals re-fit to new pane size
		setTimeout(() => {
			window.dispatchEvent(new Event("resize"));
			window.dispatchEvent(new Event("connexio:terminal-fit"));
		}, 50);
	},

	closeSplitPane: (projectId: string, tabId: string, paneId: string) => {
		const { workspaceTabs } = get();
		const tabs = workspaceTabs[projectId] || [];
		const tab = tabs.find((t) => t.id === tabId);
		if (!tab?.splitLayout) return;

		const targetNode = findNode(tab.splitLayout.root, paneId);
		if (!targetNode || targetNode.type !== "leaf") return;
		const terminalIdToClose = targetNode.kind === "terminal" ? targetNode.terminalId : null;

		const newRoot = removeNode(tab.splitLayout.root, paneId);

		let updatedTab: TerminalTab;
		if (!newRoot || newRoot.type === "leaf") {
			// Collapsed to single pane
			if (newRoot?.type === "leaf" && newRoot.kind === "editor") {
				// Last remaining pane is editor — convert tab to editor type
				updatedTab = {
					...tab,
					type: "editor",
					filePath: newRoot.filePath,
					terminalId: null,
					splitLayout: undefined,
				};
			} else {
				updatedTab = {
					...tab,
					type: "terminal",
					terminalId: newRoot?.type === "leaf" ? newRoot.terminalId : null,
					splitLayout: undefined,
				};
			}
		} else {
			const leaves = collectLeaves(newRoot);
			const newActive = tab.splitLayout.activePaneId === paneId
				? leaves[0]?.id || ""
				: tab.splitLayout.activePaneId;
			updatedTab = { ...tab, splitLayout: { root: newRoot, activePaneId: newActive } };
		}

		const updatedTabs = tabs.map((t) => t.id === tabId ? updatedTab : t);
		set({ workspaceTabs: { ...workspaceTabs, [projectId]: updatedTabs } });
		get().persistWorkspace();

		// Close PTY after state update
		if (terminalIdToClose) {
			setTimeout(() => {
				window.connexio.terminal.close(terminalIdToClose).catch(() => {});
			}, 0);
		}

		// Trigger window resize so remaining terminal(s) re-fit to new size
		setTimeout(() => {
			window.dispatchEvent(new Event("resize"));
			window.dispatchEvent(new Event("connexio:terminal-fit"));
		}, 50);
	},

	setActiveSplitPane: (projectId: string, tabId: string, paneId: string) => {
		const { workspaceTabs } = get();
		const tabs = workspaceTabs[projectId] || [];
		const tab = tabs.find((t) => t.id === tabId);
		if (!tab?.splitLayout || tab.splitLayout.activePaneId === paneId) return;

		const updatedTabs = tabs.map((t) =>
			t.id === tabId ? { ...t, splitLayout: { ...t.splitLayout!, activePaneId: paneId } } : t,
		);
		set({ workspaceTabs: { ...workspaceTabs, [projectId]: updatedTabs } });
	},

	/**
	 * Resize a pane by adjusting the ratios of its parent branch.
	 * delta is a fraction (-1 to 1) representing how much to shift the divider.
	 * Positive delta = previous pane grows, current pane shrinks.
	 * Kept for compatibility; resizeSplitBranch is preferred for nested layouts.
	 */
	resizeSplitPane: (projectId: string, tabId: string, paneId: string, delta: number) => {
		const { workspaceTabs } = get();
		const tabs = workspaceTabs[projectId] || [];
		const tab = tabs.find((t) => t.id === tabId);
		if (!tab?.splitLayout) return;

		const parent = findParent(tab.splitLayout.root, paneId);
		if (!parent) return;

		const idx = parent.children.findIndex((c) => c.id === paneId);
		if (idx === -1 || idx === 0) return;

		get().resizeSplitBranch(projectId, tabId, parent.id, idx, delta);
	},

	/** Resize a specific branch divider. Works for nested branch-vs-branch dividers. */
	resizeSplitBranch: (
		projectId: string,
		tabId: string,
		branchId: string,
		dividerIndex: number,
		ratioOrDelta: number,
		mode: "absolute" | "delta" = "delta",
	) => {
		const { workspaceTabs } = get();
		const tabs = workspaceTabs[projectId] || [];
		const tab = tabs.find((t) => t.id === tabId);
		if (!tab?.splitLayout) return;

		const resizeBranch = (node: SplitNode): SplitNode => {
			if (node.type === "branch" && node.id === branchId) {
				const count = node.children.length;
				if (dividerIndex <= 0 || dividerIndex >= count) return node;

				const currentRatios = node.ratios && node.ratios.length === count
					? [...node.ratios]
					: node.children.map(() => 1 / count);

				const minRatio = 0.1;
				const prevIndex = dividerIndex - 1;
				const nextIndex = dividerIndex;
				const pairTotal = currentRatios[prevIndex] + currentRatios[nextIndex];
				let prevRatio: number;
				let nextRatio: number;

				if (mode === "absolute") {
					// ratioOrDelta is the total size before this divider within this branch (0..1).
					const beforeDivider = currentRatios
						.slice(0, prevIndex)
						.reduce((sum, value) => sum + value, 0);
					prevRatio = ratioOrDelta - beforeDivider;
					nextRatio = pairTotal - prevRatio;
				} else {
					prevRatio = currentRatios[prevIndex] + ratioOrDelta;
					nextRatio = currentRatios[nextIndex] - ratioOrDelta;
				}

				if (prevRatio < minRatio || nextRatio < minRatio) return node;

				currentRatios[prevIndex] = prevRatio;
				currentRatios[nextIndex] = nextRatio;
				return { ...node, ratios: currentRatios };
			}

			if (node.type === "branch") {
				return {
					...node,
					children: node.children.map(resizeBranch),
					ratios: node.ratios,
				};
			}
			return node;
		};

		const newRoot = resizeBranch(tab.splitLayout.root);
		const updatedTabs = tabs.map((t) =>
			t.id === tabId ? { ...t, splitLayout: { ...t.splitLayout!, root: newRoot } } : t,
		);
		set({ workspaceTabs: { ...workspaceTabs, [projectId]: updatedTabs } });

		window.dispatchEvent(new Event("resize"));
		window.dispatchEvent(new Event("connexio:terminal-fit"));
		get().persistWorkspace();
	},

	// === Persistence ===

	restoreWorkspace: async () => {
		if (get().isRestoring) return;
		if (_workspaceRestored) return;
		_workspaceRestored = true;
		set({ isRestoring: true });

		try {
			const saved = await window.connexio.workspace.getState();
			if (!saved || !saved.projectTabs) { set({ isRestoring: false }); return; }

			const { projects } = get();
			const restoredTabs: Record<string, TerminalTab[]> = {};
			const restoredActiveIds: Record<string, string> = {};

			const projectEntries = Object.entries(saved.projectTabs)
				.map(([projectId, tabStates]) => ({
					projectId, tabStates,
					project: projects.find((p) => p.id === projectId),
				}))
				.filter((e) => e.project && e.tabStates.length > 0);

			await Promise.all(
				projectEntries.map(async ({ projectId, tabStates, project }) => {
					const tabs: TerminalTab[] = [];
					for (const tabState of tabStates) {
						try {
							if (tabState.type === "editor" && tabState.filePath) {
								tabs.push({ id: tabState.id, label: tabState.label, type: "editor", filePath: tabState.filePath, terminalId: null });
							} else if (tabState.splitTree) {
								// Restore split layout
								const deserialized = deserializeNode(tabState.splitTree as unknown as PersistedNode);
								const restored = await createTerminalsForTree(deserialized, project!.path, projectId, project!.name, tabState.label, tabState.shell);
								const leaves = collectLeaves(restored);
								const termIds = collectTerminalIds(restored);
								if (termIds.length > 0) {
									tabs.push({
										id: tabState.id, label: tabState.label, shell: tabState.shell,
										terminalId: null,
										splitLayout: { root: restored, activePaneId: leaves[0]?.id || "" },
									});
								}
							} else {
								const terminalId = await window.connexio.terminal.create(
									project!.path, tabState.shell,
									{ projectId, projectName: project!.name, tabId: tabState.id, tabLabel: tabState.label },
								);
								tabs.push({ id: tabState.id, label: tabState.label, shell: tabState.shell, terminalId });
							}
						} catch { /* skip */ }
					}
					if (tabs.length > 0) {
						restoredTabs[projectId] = tabs;
						const savedActiveId = saved.activeTabIds[projectId];
						restoredActiveIds[projectId] = tabs.find((t) => t.id === savedActiveId) ? savedActiveId : tabs[0].id;
					}
				}),
			);

			const activeProjectId = saved.activeProjectId && projects.find((p) => p.id === saved.activeProjectId)
				? saved.activeProjectId : null;

			set({ workspaceTabs: restoredTabs, activeTabIds: restoredActiveIds, activeProjectId, isRestoring: false });
		} catch (error) {
			console.error("Failed to restore workspace:", error);
			set({ isRestoring: false });
		}
	},

	persistWorkspace: () => {
		if (get().isRestoring) return;
		debouncedSave(() => {
			const { activeProjectId, workspaceTabs, activeTabIds } = get();
			const projectTabs: Record<string, WorkspaceTabState[]> = {};
			for (const [projectId, tabs] of Object.entries(workspaceTabs)) {
				if (tabs.length > 0) {
					projectTabs[projectId] = tabs.map((t) => {
						const state: WorkspaceTabState = { id: t.id, label: t.label, shell: t.shell, type: t.type, filePath: t.filePath };
						if (t.splitLayout) {
							state.splitTree = serializeNode(t.splitLayout.root, t.shell) as any;
						}
						return state;
					});
				}
			}
			const state: WorkspaceState = { activeProjectId, projectTabs, activeTabIds };
			window.connexio.workspace.saveState(state).catch((err: unknown) => {
				console.error("Failed to persist workspace:", err);
			});
		});
	},

	flushPersistWorkspace: () => {
		// Cancel any pending debounced save
		if (saveTimer) {
			clearTimeout(saveTimer);
			saveTimer = null;
		}
		const { activeProjectId, workspaceTabs, activeTabIds, isRestoring } = get();
		if (isRestoring) return;

		const projectTabs: Record<string, WorkspaceTabState[]> = {};
		for (const [projectId, tabs] of Object.entries(workspaceTabs)) {
			if (tabs.length > 0) {
				projectTabs[projectId] = tabs.map((t) => {
					const state: WorkspaceTabState = { id: t.id, label: t.label, shell: t.shell, type: t.type, filePath: t.filePath };
					if (t.splitLayout) {
						state.splitTree = serializeNode(t.splitLayout.root, t.shell) as any;
					}
					return state;
				});
			}
		}
		const state: WorkspaceState = { activeProjectId, projectTabs, activeTabIds };
		// Fire-and-forget — we can't await in beforeunload
		window.connexio.workspace.saveState(state).catch(() => {});
	},
}));
