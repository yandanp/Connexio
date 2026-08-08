import { useRef, useState } from "react";
import type { TerminalTab } from "./workspace-store";
import type { SplitNode } from "./split-layout";
import { ShellPicker } from "../terminal";
import WorkspaceTab from "./WorkspaceTab";

interface Props {
	tabs: TerminalTab[];
	activeTabId: string | null;
	dirtyTabs: Set<string>;
	onSelect: (tabId: string) => void;
	onClose: (tabId: string) => void;
	onCloseMany: (tabIds: string[]) => void;
	onRevealInExplorer: () => void;
	onRename: (tabId: string, newLabel: string) => void;
	onReorder: (fromIndex: number, toIndex: number) => void;
	onAddTerminal: (shell?: string) => void;
}

export default function WorkspaceTabBar({
	tabs,
	activeTabId,
	dirtyTabs,
	onSelect,
	onClose,
	onCloseMany,
	onRevealInExplorer,
	onRename,
	onReorder,
	onAddTerminal,
}: Props) {
	// Drag state
	const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
	const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
	const [dragSide, setDragSide] = useState<"left" | "right" | null>(null);
	const tabBarRef = useRef<HTMLDivElement>(null);

	const handleDragStart = (index: number) => {
		setDragFromIndex(index);
	};

	const handleDragOver = (index: number) => {
		if (dragFromIndex === null || dragFromIndex === index) {
			if (dragOverIndex !== null) {
				setDragOverIndex(null);
				setDragSide(null);
			}
			return;
		}
		const newSide = dragFromIndex < index ? "right" : "left";
		if (dragOverIndex === index && dragSide === newSide) return; // no change
		setDragOverIndex(index);
		setDragSide(newSide);
	};

	const handleDragEnd = () => {
		if (dragFromIndex !== null && dragOverIndex !== null && dragFromIndex !== dragOverIndex) {
			onReorder(dragFromIndex, dragOverIndex);
		}
		setDragFromIndex(null);
		setDragOverIndex(null);
		setDragSide(null);
	};

	const handleTabBarDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
	};

	const handleTabBarDrop = (e: React.DragEvent) => {
		e.preventDefault();
		handleDragEnd();
	};

	const getTabDetail = (tab: TerminalTab) => {
		if (tab.type === "editor" || tab.type === "remoteEditor" || tab.type === "preview")
			return tab.filePath;
		if (tab.type === "sftp") return tab.sftpConnection?.host;
		if (tab.type === "sshManager") return "SSH connections";
		return tab.status ? `${tab.shell || "terminal"} · ${tab.status}` : tab.shell || "terminal";
	};

	const getSplitCount = (tab: TerminalTab) => {
		if (!tab.splitLayout) return 1;
		const countLeaves = (node: SplitNode): number =>
			node.type === "leaf"
				? 1
				: node.children.reduce((sum: number, child: SplitNode) => sum + countLeaves(child), 0);
		return countLeaves(tab.splitLayout.root);
	};

	return (
		<div
			ref={tabBarRef}
			className="flex h-10 items-center bg-connexio-bg-secondary/50 px-2 soft-separator-bottom"
			onContextMenu={(e) => e.preventDefault()}
			onDragOver={handleTabBarDragOver}
			onDrop={handleTabBarDrop}
			onDragLeave={(e) => {
				// Only clear if leaving the tab bar entirely (not entering a child)
				if (!tabBarRef.current?.contains(e.relatedTarget as Node)) {
					setDragOverIndex(null);
					setDragSide(null);
				}
			}}
		>
			<div className="flex flex-1 items-center overflow-x-auto">
				{tabs.map((tab, index) => (
					<WorkspaceTab
						key={tab.id}
						id={tab.id}
						label={tab.label}
						isActive={activeTabId === tab.id}
						index={index}
						canClose={tabs.length > 1}
						isDirty={dirtyTabs.has(tab.id)}
						tabType={tab.type}
						detail={getTabDetail(tab)}
						splitCount={getSplitCount(tab)}
						status={tab.status}
						onSelect={() => onSelect(tab.id)}
						onClose={() => onClose(tab.id)}
						onCloseOthers={
							tabs.length > 1
								? () =>
										onCloseMany(tabs.filter((item) => item.id !== tab.id).map((item) => item.id))
								: undefined
						}
						onCloseTabsToRight={
							index < tabs.length - 1
								? () => onCloseMany(tabs.slice(index + 1).map((item) => item.id))
								: undefined
						}
						onRevealInExplorer={tab.filePath ? () => onRevealInExplorer() : undefined}
						onRename={(newLabel) => onRename(tab.id, newLabel)}
						onDragStart={handleDragStart}
						onDragOver={handleDragOver}
						onDragEnd={handleDragEnd}
						onDrop={handleDragEnd}
						isDragOver={dragOverIndex === index}
						dragSide={dragOverIndex === index ? dragSide : null}
						isDragging={dragFromIndex === index}
					/>
				))}

				{/* Add tab — inline after last tab */}
				<div className="flex-shrink-0 ml-0.5">
					<ShellPicker onSelect={onAddTerminal} />
				</div>
			</div>
		</div>
	);
}
