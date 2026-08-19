import { v4 as uuid } from "uuid";
import { create } from "zustand";

import type { Project } from "@shared/types";
import { collectTerminalIds, useWorkspaceStore } from "../workspace";

export interface ProjectsStore {
	projects: Project[];
	activeProjectId: string | null;
	searchQuery: string;
	sidebarCollapsed: boolean;

	// Actions
	loadProjects: () => Promise<void>;
	addProject: (name: string, path: string, group: string) => Promise<string>;
	deleteProject: (id: string) => Promise<void>;
	renameProject: (id: string, name: string) => Promise<void>;
	setActiveProject: (id: string) => void;
	setSearchQuery: (query: string) => void;
	toggleSidebar: () => void;
	updateProjectLastOpened: (id: string) => Promise<void>;

	reorderProjects: (fromId: string, toId: string) => Promise<void>;
	moveProjectToGroup: (projectId: string, newGroup: string) => Promise<void>;
	renameProjectGroup: (oldGroup: string, newGroup: string) => Promise<void>;
}

export const useProjectsStore = create<ProjectsStore>((set, get) => ({
	projects: [],
	activeProjectId: null,
	searchQuery: "",
	sidebarCollapsed: false,

	loadProjects: async () => {
		const projects = await window.connexio.project.list();
		set({ projects });
	},

	addProject: async (name: string, projectPath: string, group: string) => {
		const project: Project = {
			id: uuid(),
			name,
			path: projectPath,
			group,
			tabs: [{ id: uuid(), label: "Terminal 1" }],
			createdAt: Date.now(),
			lastOpenedAt: Date.now(),
		};
		await window.connexio.project.add(project);
		const projects = await window.connexio.project.list();
		set({ projects });
		get().setActiveProject(project.id);
		return project.id;
	},

	deleteProject: async (id: string) => {
		const { projects, activeProjectId } = get();
		const { workspaceTabs, activeTabIds } = useWorkspaceStore.getState();
		const tabs = workspaceTabs[id] || [];

		const { [id]: _removedTabs, ...restTabs } = workspaceTabs;
		const { [id]: _removedActive, ...restActiveIds } = activeTabIds;

		let newActiveId: string | null = activeProjectId;
		if (activeProjectId === id) {
			const remaining = projects.filter((p) => p.id !== id);
			newActiveId = remaining.length > 0 ? remaining[0].id : null;
		}

		set({ activeProjectId: newActiveId });
		useWorkspaceStore.setState({ workspaceTabs: restTabs, activeTabIds: restActiveIds });

		for (const tab of tabs) {
			if (tab.splitLayout) {
				for (const tid of collectTerminalIds(tab.splitLayout.root)) {
					await window.connexio.terminal.close(tid);
				}
			} else if (tab.terminalId) {
				await window.connexio.terminal.close(tab.terminalId);
			}
		}

		await window.connexio.project.delete(id);
		set({ projects: await window.connexio.project.list() });
		useWorkspaceStore.getState().persistWorkspace();
	},

	renameProject: async (id: string, name: string) => {
		const trimmed = name.trim();
		if (!trimmed) return;
		const { projects } = get();
		const project = projects.find((p) => p.id === id);
		if (!project || project.name === trimmed) return;
		const updated = { ...project, name: trimmed };
		await window.connexio.project.update(updated);
		set({ projects: projects.map((p) => (p.id === id ? updated : p)) });
	},

	setActiveProject: (id: string) => {
		const { activeProjectId, projects } = get();
		const { isRestoring } = useWorkspaceStore.getState();
		if (activeProjectId === id) return;
		const project = projects.find((p) => p.id === id);
		if (!project) return;
		set({ activeProjectId: id });
		if (!isRestoring) {
			const tabs = useWorkspaceStore.getState().workspaceTabs[id];
			if (!tabs || tabs.length === 0)
				useWorkspaceStore.getState().openTerminalTab(id, "Terminal 1");
		}
		get().updateProjectLastOpened(id);
		useWorkspaceStore.getState().persistWorkspace();
	},

	setSearchQuery: (query: string) => set({ searchQuery: query }),
	toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

	updateProjectLastOpened: async (id: string) => {
		const { projects } = get();
		const project = projects.find((p) => p.id === id);
		if (project) {
			const updated = { ...project, lastOpenedAt: Date.now() };
			await window.connexio.project.update(updated);
		}
	},

	reorderProjects: async (fromId: string, toId: string) => {
		const { projects } = get();
		const fromIndex = projects.findIndex((p) => p.id === fromId);
		const toIndex = projects.findIndex((p) => p.id === toId);
		if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;
		const reordered = [...projects];
		const [moved] = reordered.splice(fromIndex, 1);
		reordered.splice(toIndex, 0, moved);
		set({ projects: reordered });
		await window.connexio.project.reorder(reordered.map((p) => p.id));
	},

	moveProjectToGroup: async (projectId: string, newGroup: string) => {
		const { projects } = get();
		const project = projects.find((p) => p.id === projectId);
		const group = newGroup.trim() || "default";
		if (!project || project.group === group) return;
		const updated = { ...project, group };
		await window.connexio.project.update(updated);
		set({ projects: projects.map((p) => (p.id === projectId ? updated : p)) });
	},

	renameProjectGroup: async (oldGroup: string, newGroup: string) => {
		const group = newGroup.trim() || "default";
		if (oldGroup === group) return;
		const { projects } = get();
		const affected = projects.filter((p) => (p.group || "default") === oldGroup);
		if (affected.length === 0) return;
		const updatedProjects = projects.map((project) =>
			(project.group || "default") === oldGroup ? { ...project, group } : project,
		);
		await Promise.all(
			affected.map((project) => window.connexio.project.update({ ...project, group })),
		);
		set({ projects: updatedProjects });
	},
}));
