import { expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(), listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/plugin-updater", () => ({ check: vi.fn() }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: vi.fn() }));

it("connexioApi exposes exactly the 16 public domains", async () => {
	const { connexioApi } = await import("./index");
	expect(Object.keys(connexioApi)).toEqual([
		"terminal",
		"project",
		"session",
		"settings",
		"workspace",
		"tasks",
		"pinned",
		"ssh",
		"git",
		"worktree",
		"theme",
		"app",
		"updater",
		"notification",
		"discord",
		"remote",
	]);
});
