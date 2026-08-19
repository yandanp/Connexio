import { describe, expect, it } from "vitest";
import { detectWorktree } from "./worktree-context";

describe("detectWorktree", () => {
	it("detects a worktree path with unix separators", () => {
		expect(detectWorktree("/repo/.worktrees/my-feature")).toEqual({
			isWorktree: true,
			name: "my-feature",
		});
	});

	it("detects a worktree path with windows separators", () => {
		expect(detectWorktree("C:\\repo\\.worktrees\\bugfix")).toEqual({
			isWorktree: true,
			name: "bugfix",
		});
	});

	it("rejects the .worktrees root itself", () => {
		expect(detectWorktree("/repo/.worktrees").isWorktree).toBe(false);
	});

	it("rejects regular project paths", () => {
		expect(detectWorktree("/repo/src").isWorktree).toBe(false);
	});
});
