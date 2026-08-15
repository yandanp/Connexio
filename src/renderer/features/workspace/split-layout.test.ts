import { describe, expect, it } from "vitest";
import {
	collectLeaves,
	collectTerminalIds,
	findNode,
	removeNode,
	replaceNode,
} from "./split-layout";
import type { SplitBranch, SplitLeaf, SplitNode } from "./split-layout";

const leaf = (id: string, terminalId: string | null = null): SplitLeaf => ({
	type: "leaf",
	id,
	kind: "terminal",
	terminalId,
});
const branch = (id: string, children: SplitNode[], ratios?: number[]): SplitBranch => ({
	type: "branch",
	id,
	direction: "horizontal",
	children,
	ratios,
});

const tree = branch("b1", [leaf("l1", "t1"), branch("b2", [leaf("l2", "t2"), leaf("l3", "t3")])]);

describe("split-layout tree ops", () => {
	it("findNode locates by id, null when absent", () => {
		expect(findNode(tree, "l3")?.id).toBe("l3");
		expect(findNode(tree, "b2")?.type).toBe("branch");
		expect(findNode(tree, "nope")).toBeNull();
	});

	it("collectLeaves preserves order", () => {
		expect(collectLeaves(tree).map((l) => l.id)).toEqual(["l1", "l2", "l3"]);
	});

	it("collectTerminalIds skips null terminals", () => {
		expect(collectTerminalIds(branch("b", [leaf("a", "t1"), leaf("b")]))).toEqual(["t1"]);
	});

	it("replaceNode swaps target without mutating original", () => {
		const next = replaceNode(tree, "l2", leaf("l9", "t9"));
		expect((findNode(next, "l9") as SplitLeaf)?.terminalId).toBe("t9");
		expect(findNode(tree, "l2")?.id).toBe("l2");
	});

	it("removeNode drops target; null when tree empties", () => {
		const two = branch("b", [leaf("a"), leaf("c")]);
		const after = removeNode(two, "a");
		expect(after && collectLeaves(after).map((l) => l.id)).toEqual(["c"]);
		expect(removeNode(leaf("solo"), "solo")).toBeNull();
	});
});
