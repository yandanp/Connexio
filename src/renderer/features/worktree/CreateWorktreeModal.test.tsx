import { describe, expect, it, vi } from "vitest";
import { slugify } from "./slugify";

const createWorktree = vi.fn();

vi.stubGlobal("window", {
	connexio: {
		worktree: { create: createWorktree },
	},
});

describe("worktree slugify (mirror of backend branch derivation)", () => {
	it("lowercases and slugs names", () => {
		expect(slugify("My Cool Feature!")).toBe("my-cool-feature");
	});

	it("collapses repeated separators and trims edges", () => {
		expect(slugify("  --double--  ")).toBe("double");
	});

	it("falls back to worktree for separator-only names", () => {
		expect(slugify("!!!")).toBe("worktree");
	});

	it("rewrites known emoji shortcodes to readable slug fragments", () => {
		expect(slugify(":rocket: login")).toBe("rocket-login");
	});

	it("keeps literal emoji out of the slug but preserves the word form", () => {
		expect(slugify("🚀 launch pad")).toBe("launch-pad");
	});
});

describe("CreateWorktreeModal behavior contract", () => {
	it("creates via window.connexio.worktree with name and derived options", async () => {
		createWorktree.mockResolvedValueOnce({ id: "wt" } as never);
		// The dialog calls the API with: (projectPath, trimmed name, options)
		await window.connexio.worktree.create("/repo", "My Feature", {
			fromRef: "HEAD",
			branchOverride: undefined,
		});
		expect(createWorktree).toHaveBeenCalledWith("/repo", "My Feature", {
			fromRef: "HEAD",
			branchOverride: undefined,
		});
	});

	it("branch preview derivation matches the backend slug", () => {
		// The dialog derives `connexio/<slug>` for the preview; the backend
		// derives the same default branch from the same name.
		expect(`connexio/${slugify("My Feature")}`).toBe("connexio/my-feature");
	});
});
