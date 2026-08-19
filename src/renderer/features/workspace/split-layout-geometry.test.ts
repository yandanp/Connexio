import { expect, it } from "vitest";
import { computePaneBounds, computeResizeHandleBounds } from "./split-layout-geometry";
import type { SplitBranch, SplitLeaf } from "./split-layout";

const leaf = (id: string): SplitLeaf => ({ type: "leaf", id, kind: "terminal", terminalId: null });

it("two-way horizontal split yields left/right halves", () => {
	const b: SplitBranch = {
		type: "branch",
		id: "b",
		direction: "horizontal",
		children: [leaf("l"), leaf("r")],
	};
	const bounds = computePaneBounds(b);
	expect(bounds).toHaveLength(2);
	const byId = Object.fromEntries(bounds.map((p) => [p.paneId, p]));
	expect(byId["l"].left).toBeCloseTo(0);
	expect(byId["l"].width).toBeCloseTo(0.5);
	expect(byId["r"].left).toBeCloseTo(0.5);
	expect(byId["l"].height).toBeCloseTo(1);
});

it("ratios override equal split", () => {
	const b: SplitBranch = {
		type: "branch",
		id: "b",
		direction: "vertical",
		children: [leaf("t"), leaf("d")],
		ratios: [0.25, 0.75],
	};
	const byId = Object.fromEntries(computePaneBounds(b).map((p) => [p.paneId, p]));
	expect(byId["t"].height).toBeCloseTo(0.25);
	expect(byId["d"].top).toBeCloseTo(0.25);
});

it("one resize handle per divider", () => {
	const b: SplitBranch = {
		type: "branch",
		id: "b",
		direction: "horizontal",
		children: [leaf("l"), leaf("m"), leaf("r")],
	};
	const handles = computeResizeHandleBounds(b);
	expect(handles).toHaveLength(2);
	expect(handles[0].branchId).toBe("b");
	// Characterized: dividerIndex is the 1-based child index (divider i sits
	// between children i-1 and i); resizeSplitBranch rejects index <= 0.
	expect(handles.map((h) => h.dividerIndex)).toEqual([1, 2]);
});
