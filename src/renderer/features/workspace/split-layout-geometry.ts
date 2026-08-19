import type { SplitDirection, SplitNode } from "./split-layout";

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

export function computePaneBounds(
	node: SplitNode,
	bounds = { top: 0, left: 0, width: 1, height: 1 },
): PaneBounds[] {
	if (node.type === "leaf") {
		return [
			{
				paneId: node.id,
				kind: node.kind,
				terminalId: node.terminalId,
				filePath: node.filePath,
				top: bounds.top,
				left: bounds.left,
				width: bounds.width,
				height: bounds.height,
			},
		];
	}

	const results: PaneBounds[] = [];
	const count = node.children.length;
	const isHorizontal = node.direction === "horizontal";
	const ratios =
		node.ratios && node.ratios.length === count ? node.ratios : node.children.map(() => 1 / count);

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
	const ratios =
		node.ratios && node.ratios.length === count ? node.ratios : node.children.map(() => 1 / count);

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
