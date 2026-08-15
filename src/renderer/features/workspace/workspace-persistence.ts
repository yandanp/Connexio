import type { SplitDirection, SplitNode } from "./split-layout";

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

export async function createTerminalsForTree(
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
			const terminalId = await window.connexio.terminal.create(projectPath, shell, {
				projectId,
				projectName,
				tabId: node.id,
				tabLabel: `${tabLabel} (split)`,
			});
			return { ...node, terminalId };
		} catch {
			return node;
		}
	}
	const children: SplitNode[] = [];
	for (const child of node.children) {
		children.push(
			await createTerminalsForTree(child, projectPath, projectId, projectName, tabLabel, shell),
		);
	}
	return { ...node, children };
}
