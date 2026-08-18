import { describe, expect, it, vi } from "vitest";
import { worktree } from "./worktree";

const invoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
	invoke: (...args: unknown[]) => invoke(...args),
}));

describe("worktree api adapter", () => {
	it("create invokes worktree_create with name and options", async () => {
		invoke.mockResolvedValueOnce({});
		await worktree.create("/repo", "My Feature", { fromRef: "origin/main" });
		expect(invoke).toHaveBeenCalledWith("worktree_create", {
			projectPath: "/repo",
			name: "My Feature",
			fromRef: "origin/main",
			branchOverride: null,
			linkedIssueUrl: null,
		});
	});

	it("list invokes worktree_list", async () => {
		invoke.mockResolvedValueOnce([]);
		await worktree.list("/repo");
		expect(invoke).toHaveBeenCalledWith("worktree_list", { projectPath: "/repo" });
	});

	it("delete invokes worktree_delete with branch confirmation", async () => {
		invoke.mockResolvedValueOnce(undefined);
		await worktree.delete("/repo", "C:\\repo\\.worktrees\\f", "connexio/f");
		expect(invoke).toHaveBeenCalledWith("worktree_delete", {
			projectPath: "/repo",
			worktreePath: "C:\\repo\\.worktrees\\f",
			confirmBranch: "connexio/f",
		});
	});
});
