import { useState } from "react";

/**
 * Sidebar project drag-reorder state machine.
 * Extracted from Sidebar.tsx to respect the max-lines ratchet.
 */
export function useProjectDrag() {
	const [dragProjectId, setDragProjectId] = useState<string | null>(null);
	const [dragOverId, setDragOverId] = useState<string | null>(null);
	const [dragOverGroup, setDragOverGroup] = useState<string | null>(null);

	const handleDragStart = (projectId: string) => {
		setDragProjectId(projectId);
	};

	const handleDragOverProject = (e: React.DragEvent, targetId: string) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
		if (dragProjectId && dragProjectId !== targetId) {
			setDragOverId(targetId);
			setDragOverGroup(null);
		}
	};

	const handleDragOverGroup = (e: React.DragEvent, group: string) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
		if (dragProjectId) {
			setDragOverGroup(group);
			setDragOverId(null);
		}
	};

	/** Clear the group highlight when the drag leaves the group header. */
	const clearDragOverGroup = () => {
		setDragOverGroup(null);
	};

	const resetDrag = () => {
		setDragProjectId(null);
		setDragOverId(null);
		setDragOverGroup(null);
	};

	return {
		dragProjectId,
		dragOverId,
		dragOverGroup,
		handleDragStart,
		handleDragOverProject,
		handleDragOverGroup,
		clearDragOverGroup,
		resetDrag,
	};
}
