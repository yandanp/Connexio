import { expect, it } from "vitest";
import { deserializeNode, serializeNode } from "./workspace-persistence";
import type { SplitBranch } from "./split-layout";

it("serialize/deserialize round-trips tree shape", () => {
	const tree: SplitBranch = {
		type: "branch",
		id: "b1",
		direction: "vertical",
		ratios: [0.4, 0.6],
		children: [
			{ type: "leaf", id: "l1", kind: "terminal", terminalId: "t1" },
			{ type: "leaf", id: "l2", kind: "editor", terminalId: null, filePath: "/a/b.ts" },
		],
	};
	const restored = deserializeNode(serializeNode(tree, "pwsh"));
	expect(restored).toMatchObject({
		type: "branch",
		id: "b1",
		direction: "vertical",
		ratios: [0.4, 0.6],
		children: [
			{ type: "leaf", id: "l1", kind: "terminal", terminalId: null },
			{ type: "leaf", id: "l2", kind: "editor", filePath: "/a/b.ts" },
		],
	});
});
