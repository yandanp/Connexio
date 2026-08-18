import type { Project } from "../../../shared/types";

/**
 * Dialog descriptor shared by the sidebar's context-menu actions.
 * Extracted from Sidebar.tsx to respect the max-lines ratchet.
 */
export interface SidebarInputDialog {
	title: string;
	message: string;
	label: string;
	initialValue: string;
	confirmLabel: string;
	options?: string[];
	onConfirm: (value: string) => void | Promise<void>;
}

/** Build the "Rename Project" dialog descriptor. */
export function renameProjectDialog(
	project: Project,
	renameProject: (id: string, name: string) => void,
): SidebarInputDialog {
	return {
		title: "Rename Project",
		message: "Update the display name shown in the sidebar.",
		label: "Project name",
		initialValue: project.name,
		confirmLabel: "Rename",
		onConfirm: (value) => renameProject(project.id, value),
	};
}

/** Build the "Change Group" dialog descriptor. */
export function moveProjectDialog(
	project: Project,
	groups: string[],
	moveProjectToGroup: (id: string, group: string) => void,
): SidebarInputDialog {
	return {
		title: "Change Group",
		message: `Move "${project.name}" to another sidebar group, or type a new one.`,
		label: "Group name",
		initialValue: project.group || "default",
		confirmLabel: "Move",
		options: groups,
		onConfirm: (value) => moveProjectToGroup(project.id, value),
	};
}

/** Build the "Rename Group" dialog descriptor. */
export function renameGroupDialog(
	group: string,
	renameProjectGroup: (group: string, name: string) => void,
): SidebarInputDialog {
	return {
		title: "Rename Group",
		message: `Rename group "${group}" for all projects inside it.`,
		label: "Group name",
		initialValue: group,
		confirmLabel: "Rename",
		onConfirm: (value) => renameProjectGroup(group, value),
	};
}
