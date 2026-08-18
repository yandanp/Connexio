import { collectLeaves } from "./split-layout";
import type { SplitDirection, SplitNode } from "./split-layout";
import { runWithSpawnLimit } from "./spawn-pool";
import { createTerminalWithTiming } from "./terminal-spawn";

// === Persistence helpers ===

export interface PersistedNode {
	type: "leaf" | "branch";
	id: string;
	kind?: "terminal" | "editor";
	direction?: SplitDirection;
	children?: PersistedNode[];
	ratios?: number[];
	shell?: string;
	filePath?: string;
}

export function serializeNode(node: SplitNode, tabShell?: string): PersistedNode {
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

export function deserializeNode(persisted: PersistedNode): SplitNode {
	if (persisted.type === "leaf") {
		return {
			type: "leaf",
			id: persisted.id,
			kind: persisted.kind || "terminal",
			terminalId: null,
			filePath: persisted.filePath,
		};
	}
	return {
		type: "branch",
		id: persisted.id,
		direction: persisted.direction || "horizontal",
		ratios: persisted.ratios,
		children: (persisted.children || []).map(deserializeNode),
	};
}

/**
 * Spawn terminals for all terminal leaves in a tree via bounded spawn pool.
 *
 * Editor leaves are skipped; terminal leaves spawn through `runWithSpawnLimit`
 * so peak concurrent spawns stay bounded. Each leaf's spawn context includes
 * `paneId` so Task 4 can attribute partial failures per-pane. Failed creates
 * resolve to undefined → that leaf keeps terminalId null and never blocks siblings
 * (settled-all behavior). Signature unchanged; return tree with assigned ids.
 */
export async function createTerminalsForTree(
	node: SplitNode,
	projectPath: string,
	projectId: string,
	projectName: string,
	tabLabel: string,
	shell?: string,
): Promise<SplitNode> {
	// Editor leaves never spawn; nothing to do when no terminal leaves remain.
	const leaves = collectLeaves(node).filter((leaf) => leaf.kind !== "editor");
	if (leaves.length === 0) return node;

	// Spawn every terminal leaf through the shared bounded pool. `paneId`
	// lets Task 4's error mapping attribute partial failures to the pane.
	// A failed create resolves to undefined — the leaf keeps terminalId null
	// and never blocks its siblings (settled-all behavior).
	const results = await runWithSpawnLimit(
		leaves.map(
			(leaf) => () =>
				createTerminalWithTiming(() =>
					window.connexio.terminal.create(projectPath, shell, {
						projectId,
						projectName,
						tabId: leaf.id,
						paneId: leaf.id,
						tabLabel: `${tabLabel} (split)`,
					}),
				),
		),
	);

	// Pool results keep input order; map them back onto the tree by leaf id.
	const spawned = new Map<string, string>();
	for (const [index, leaf] of leaves.entries()) {
		const terminalId = results[index];
		if (terminalId !== undefined) spawned.set(leaf.id, terminalId);
	}
	return withTerminalIds(node, spawned);
}

/** Immutably copy `node`, writing successfully-spawned terminalIds into matching leaves. */
function withTerminalIds(node: SplitNode, ids: Map<string, string>): SplitNode {
	if (node.type === "leaf") {
		const terminalId = ids.get(node.id);
		return terminalId === undefined ? node : { ...node, terminalId };
	}
	return { ...node, children: node.children.map((child) => withTerminalIds(child, ids)) };
}
