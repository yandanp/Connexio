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

export function findNode(node: SplitNode, id: string): SplitNode | null {
	if (node.id === id) return node;
	if (node.type === "branch") {
		for (const child of node.children) {
			const found = findNode(child, id);
			if (found) return found;
		}
	}
	return null;
}

export function findParent(root: SplitNode, targetId: string): SplitBranch | null {
	if (root.type === "branch") {
		for (const child of root.children) {
			if (child.id === targetId) return root;
			const found = findParent(child, targetId);
			if (found) return found;
		}
	}
	return null;
}

export function replaceNode(root: SplitNode, targetId: string, replacement: SplitNode): SplitNode {
	if (root.id === targetId) return replacement;
	if (root.type === "branch") {
		return { ...root, children: root.children.map((c) => replaceNode(c, targetId, replacement)) };
	}
	return root;
}

export function removeNode(root: SplitNode, targetId: string): SplitNode | null {
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

export function collectLeaves(node: SplitNode): SplitLeaf[] {
	if (node.type === "leaf") return [node];
	return node.children.flatMap(collectLeaves);
}

export function collectTerminalIds(node: SplitNode): string[] {
	if (node.type === "leaf")
		return node.kind === "terminal" && node.terminalId ? [node.terminalId] : [];
	return node.children.flatMap(collectTerminalIds);
}
