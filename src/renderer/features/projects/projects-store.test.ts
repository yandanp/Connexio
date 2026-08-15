// Mock event bus to avoid @tauri-apps listen() crashes when running tests in Node.
vi.mock("../../core/api/terminal-event-bus", () => ({
	onTerminalData: vi.fn(() => () => {}),
	onTerminalExit: vi.fn(() => {}),
}));

// settingsStore (imported transitively via workspace-store) reads localStorage at
// module scope — stub it for the node test env, hoisted above the static imports.
vi.hoisted(() => {
	if (!globalThis.localStorage) Reflect.set(globalThis, "localStorage", { getItem: () => null });
});

import { describe, expect, it, vi } from "vitest";
import { useProjectsStore } from ".";
import { useWorkspaceStore } from "../workspace";

// Importing both feature indexes in one module exercises the
// projects <-> workspace circular import at module-init time.
describe("projects/workspace store split", () => {
	it("initializes both stores with the expected state surface", () => {
		const projects = useProjectsStore.getState();
		expect(projects.projects).toEqual([]);
		expect(projects.activeProjectId).toBeNull();
		expect(projects.searchQuery).toBe("");
		expect(projects.sidebarCollapsed).toBe(false);

		const workspace = useWorkspaceStore.getState();
		expect(workspace.workspaceTabs).toEqual({});
		expect(workspace.activeTabIds).toEqual({});
		expect(workspace.isRestoring).toBe(false);
	});

	it("exposes the project/group actions on useProjectsStore", () => {
		const state = useProjectsStore.getState();
		for (const action of [
			"loadProjects",
			"addProject",
			"deleteProject",
			"renameProject",
			"setActiveProject",
			"setSearchQuery",
			"toggleSidebar",
			"updateProjectLastOpened",
			"reorderProjects",
			"moveProjectToGroup",
			"renameProjectGroup",
		]) {
			expect(typeof state[action as keyof typeof state]).toBe("function");
		}
	});

	it("exposes the tab/split/persistence actions on useWorkspaceStore", () => {
		const state = useWorkspaceStore.getState();
		for (const action of [
			"openTerminalTab",
			"openCommandTerminalTab",
			"openSshTerminalTab",
			"openEditorTab",
			"openRemoteEditorTab",
			"openPreviewTab",
			"openSSHManagerTab",
			"openSftpTab",
			"closeTerminalTab",
			"setActiveTerminalTab",
			"markTerminalExited",
			"renameTerminalTab",
			"updatePreviewTabUrl",
			"reorderTabs",
			"splitTerminal",
			"splitTerminalFromEditor",
			"openEditorInSplit",
			"closeSplitPane",
			"setActiveSplitPane",
			"resizeSplitPane",
			"resizeSplitBranch",
			"restoreWorkspace",
			"persistWorkspace",
			"flushPersistWorkspace",
		]) {
			expect(typeof state[action as keyof typeof state]).toBe("function");
		}
	});
});
