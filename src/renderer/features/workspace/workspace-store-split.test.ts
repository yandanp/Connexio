import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Project } from "@shared/types";

const terminalCreate = vi.fn(async () => "terminal-id");
vi.mock("../../core/api", () => ({ terminal: { create: terminalCreate, close: vi.fn() } }));
vi.mock("../../core/instrumentation/startup-metrics", () => ({
	registerPhaseComplete: vi.fn(),
	registerPhaseStart: vi.fn(),
	registerSpawnComplete: vi.fn(),
	setSpawnStart: vi.fn(),
}));

function project(): Project {
	return {
		id: "project-1",
		name: "Project 1",
		path: "/repo/project-1",
		group: "",
		tabs: [],
		createdAt: 1,
		lastOpenedAt: 1,
	};
}

describe("dynamic split terminal identity", () => {
	beforeEach(() => {
		vi.resetModules();
		terminalCreate.mockClear();
		Reflect.set(globalThis, "window", {
			connexio: {
				terminal: { create: terminalCreate, close: vi.fn(async () => {}) },
				workspace: { getState: async () => null, saveState: async () => {} },
			},
		});
		Reflect.set(globalThis, "localStorage", { getItem: () => null });
	});

	it("uses the parent tab and leaf id when adding a split terminal", async () => {
		const { useProjectsStore } = await import("../projects");
		const { useWorkspaceStore } = await import("./workspace-store");
		useProjectsStore.setState({ projects: [project()] });
		useWorkspaceStore.setState({
			workspaceTabs: {
				"project-1": [{ id: "tab-1", label: "Shell", terminalId: "existing-id" }],
			},
		});

		await useWorkspaceStore.getState().splitTerminal("project-1", "tab-1", "tab-1", "horizontal");

		expect(terminalCreate).toHaveBeenCalledWith(
			"/repo/project-1",
			undefined,
			expect.objectContaining({ tabId: "tab-1", paneId: expect.any(String) }),
		);
	});
});
