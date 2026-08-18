import { beforeEach, describe, expect, it, vi } from "vitest";

// Stubs installed before the store module loads (dynamic import below).
let createTerminal: ReturnType<typeof vi.fn>;

vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));

function makeProject() {
	return {
		id: "p1",
		name: "Repo",
		path: "/repo",
		group: "default",
		tabs: [],
		createdAt: 0,
		lastOpenedAt: 0,
	};
}

// Node env has no real `window`; the store reads `window.connexio.*`.
function installGlobals() {
	createTerminal = vi.fn();
	const connexio = { terminal: { create: createTerminal } };
	Reflect.set(globalThis, "window", { connexio });
	// settingsStore reads localStorage at module scope — stub it for node env.
	Reflect.set(globalThis, "localStorage", { getItem: () => null });
}

async function importStores() {
	const { useProjectsStore } = await import("../projects");
	const { useWorkspaceStore } = await import("./workspace-store");
	return { useProjectsStore, useWorkspaceStore };
}

async function setupStores() {
	const stores = await importStores();
	stores.useProjectsStore.setState({ projects: [makeProject()] });
	stores.useWorkspaceStore.setState({ workspaceTabs: {}, activeTabIds: {} });
	return stores;
}

describe("openTerminalTab with cwd override", () => {
	beforeEach(() => {
		vi.resetModules();
		installGlobals();
	});

	it("creates the terminal in the project path by default", async () => {
		const { useWorkspaceStore } = await setupStores();
		createTerminal.mockResolvedValueOnce("term-1");

		await useWorkspaceStore.getState().openTerminalTab("p1", "T1");

		expect(createTerminal).toHaveBeenCalledWith(
			"/repo",
			undefined,
			expect.objectContaining({ projectId: "p1" }),
		);
	});

	it("creates the terminal in the worktree path when cwd is passed", async () => {
		const { useWorkspaceStore } = await setupStores();
		createTerminal.mockResolvedValueOnce("term-2");

		await useWorkspaceStore
			.getState()
			.openTerminalTab("p1", "🚀 login", undefined, { cwd: "/repo/.worktrees/login" });

		expect(createTerminal).toHaveBeenCalledWith(
			"/repo/.worktrees/login",
			undefined,
			expect.objectContaining({ projectId: "p1", tabLabel: "🚀 login" }),
		);
	});
});
