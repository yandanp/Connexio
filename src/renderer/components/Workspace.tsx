import { Bot, Columns2, FolderTree, GitBranch, Globe, ListTodo, PanelRightClose, Rows2, Server } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useProjectStore } from "../stores/projectStore";
import { AIChatPanel } from "./ai";
import ConfirmDialog from "./ConfirmDialog";
import { CodeEditor } from "./editor";
import { FileExplorer } from "./explorer";
import ShellPicker from "./ShellPicker";
import SourcePanel from "./SourcePanel";
import SSHPanel from "./SSHPanel";
import TaskPanel from "./TaskPanel";
import TerminalLayer from "./TerminalLayer";
import WebPreview from "./WebPreview";
import WorkspaceTab from "./WorkspaceTab";

type SidePanelTab = "ai" | "explorer" | "tasks" | "ssh" | "source";

export default function Workspace() {
	const {
		projects,
		activeProjectId,
		workspaceTabs,
		activeTabIds,
		openTerminalTab,
		openEditorTab,
		closeTerminalTab,
		setActiveTerminalTab,
		renameTerminalTab,
		reorderTabs,
		splitTerminal,
	} = useProjectStore();

	// Drag state
	const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
	const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
	const [dragSide, setDragSide] = useState<"left" | "right" | null>(null);
	const [showSidePanel, setShowSidePanel] = useState(false);
	const [sidePanelTab, setSidePanelTab] = useState<SidePanelTab>("tasks");
	const [closeConfirmTabId, setCloseConfirmTabId] = useState<string | null>(
		null,
	);
	const [dirtyTabs, setDirtyTabs] = useState<Set<string>>(new Set());
	const tabBarRef = useRef<HTMLDivElement>(null);

	// Resizable side panel
	const [panelWidth, setPanelWidth] = useState(360);
	const isResizing = useRef(false);
	const panelRef = useRef<HTMLDivElement>(null);

	const handleResizeStart = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		isResizing.current = true;
		document.body.style.cursor = "col-resize";
		document.body.style.userSelect = "none";
	}, []);

	useEffect(() => {
		const handleResizeMove = (e: MouseEvent) => {
			if (!isResizing.current || !panelRef.current) return;
			const containerRect = panelRef.current.parentElement?.getBoundingClientRect();
			if (!containerRect) return;
			const newWidth = containerRect.right - e.clientX;
			setPanelWidth(Math.max(280, Math.min(600, newWidth)));
		};

		const handleResizeEnd = () => {
			if (isResizing.current) {
				isResizing.current = false;
				document.body.style.cursor = "";
				document.body.style.userSelect = "";
			}
		};

		document.addEventListener("mousemove", handleResizeMove);
		document.addEventListener("mouseup", handleResizeEnd);
		return () => {
			document.removeEventListener("mousemove", handleResizeMove);
			document.removeEventListener("mouseup", handleResizeEnd);
		};
	}, []);

	// Listen for footer panel open/close events
	useEffect(() => {
		const handlePanelEvent = (e: Event) => {
			const detail = (e as CustomEvent).detail;
			if (detail === "close") {
				setShowSidePanel(false);
			} else if (detail === "ai" || detail === "explorer" || detail === "source" || detail === "tasks" || detail === "ssh") {
				setSidePanelTab(detail as SidePanelTab);
				setShowSidePanel(true);
			}
		};
		window.addEventListener("connexio:open-panel", handlePanelEvent);
		return () => window.removeEventListener("connexio:open-panel", handlePanelEvent);
	}, []);

	// Keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const state = useProjectStore.getState();
			const projId = state.activeProjectId;
			if (!projId) return;
			const currentTabs = state.workspaceTabs[projId] || [];
			const currentActiveTabId = state.activeTabIds[projId];
			if (!currentActiveTabId) return;
			const currentTab = currentTabs.find((t) => t.id === currentActiveTabId);

			// Ctrl+Shift+D = Split Right (new terminal pane)
			if (e.ctrlKey && e.shiftKey && e.key === "D") {
				e.preventDefault();
				const activePaneId = currentTab?.splitLayout
					? currentTab.splitLayout.activePaneId
					: currentActiveTabId;
				state.splitTerminal(projId, currentActiveTabId, activePaneId, "horizontal");
			}
			// Ctrl+Shift+E = Split Down
			if (e.ctrlKey && e.shiftKey && e.key === "E") {
				e.preventDefault();
				const activePaneId = currentTab?.splitLayout
					? currentTab.splitLayout.activePaneId
					: currentActiveTabId;
				state.splitTerminal(projId, currentActiveTabId, activePaneId, "vertical");
			}
			// Ctrl+T = New terminal tab
			if (e.ctrlKey && !e.shiftKey && e.key === "t") {
				e.preventDefault();
				state.openTerminalTab(projId);
			}
			// Ctrl+W = Close current tab
			if (e.ctrlKey && !e.shiftKey && e.key === "w") {
				e.preventDefault();
				if (currentTabs.length > 1) {
					state.closeTerminalTab(projId, currentActiveTabId);
				}
			}
			// Ctrl+` = Toggle side panel
			if (e.ctrlKey && e.key === "`") {
				e.preventDefault();
				setShowSidePanel((prev) => !prev);
			}
			// Ctrl+Shift+F = Search in files (opens explorer with search)
			if (e.ctrlKey && e.shiftKey && e.key === "F") {
				e.preventDefault();
				setSidePanelTab("explorer");
				setShowSidePanel(true);
			}
			// Ctrl+Tab = Next tab
			if (e.ctrlKey && e.key === "Tab" && !e.shiftKey) {
				e.preventDefault();
				const idx = currentTabs.findIndex((t) => t.id === currentActiveTabId);
				const nextIdx = (idx + 1) % currentTabs.length;
				state.setActiveTerminalTab(projId, currentTabs[nextIdx].id);
			}
			// Ctrl+Shift+Tab = Previous tab
			if (e.ctrlKey && e.key === "Tab" && e.shiftKey) {
				e.preventDefault();
				const idx = currentTabs.findIndex((t) => t.id === currentActiveTabId);
				const prevIdx = (idx - 1 + currentTabs.length) % currentTabs.length;
				state.setActiveTerminalTab(projId, currentTabs[prevIdx].id);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);

	if (!activeProjectId) return null;

	const project = projects.find((p) => p.id === activeProjectId);
	if (!project) return null;

	const tabs = workspaceTabs[activeProjectId] || [];
	const activeTabId = activeTabIds[activeProjectId] || null;
	const activeTab = tabs.find((t) => t.id === activeTabId);

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
		if (
			dragFromIndex !== null &&
			dragOverIndex !== null &&
			dragFromIndex !== dragOverIndex
		) {
			reorderTabs(activeProjectId, dragFromIndex, dragOverIndex);
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

	// Run command in active terminal
	const handleRunCommand = (command: string) => {
		if (activeTab?.terminalId) {
			window.connexio.terminal.write(activeTab.terminalId, `${command}\r`);
		}
	};

	// SSH connect — open new tab with SSH command
	const handleSSHConnect = async (command: string, label: string) => {
		await openTerminalTab(activeProjectId, label);
		// Wait a tick for the new tab to be created, then write the SSH command
		setTimeout(() => {
			const updatedTabs =
				useProjectStore.getState().workspaceTabs[activeProjectId] || [];
			const newTab = updatedTabs[updatedTabs.length - 1];
			if (newTab?.terminalId) {
				window.connexio.terminal.write(newTab.terminalId, `${command}\r`);
			}
		}, 500);
	};

	// Close tab with confirmation
	const handleCloseTab = (tabId: string) => {
		setCloseConfirmTabId(tabId);
	};

	const confirmCloseTab = () => {
		if (closeConfirmTabId) {
			closeTerminalTab(activeProjectId, closeConfirmTabId);
			setCloseConfirmTabId(null);
		}
	};

	const cancelCloseTab = () => {
		setCloseConfirmTabId(null);
	};

	const toggleSidePanel = (tab: SidePanelTab) => {
		if (showSidePanel && sidePanelTab === tab) {
			setShowSidePanel(false);
		} else {
			setSidePanelTab(tab);
			setShowSidePanel(true);
		}
	};

	return (
		<div className="flex flex-col flex-1 overflow-hidden">
			{/* Workspace Header */}
			<div className="flex items-center h-8 px-3 bg-connexio-bg-secondary border-b border-connexio-border gap-2">
				<span className="text-[11px] font-medium text-connexio-text-muted truncate flex-shrink-0">
					{project.name}
				</span>
				<span className="text-[10px] text-connexio-text-muted truncate opacity-60 flex-shrink min-w-0">
					{project.path}
				</span>

				{/* Web Preview — open as tab */}
				<button
					onClick={() => useProjectStore.getState().openPreviewTab(activeProjectId)}
					className="p-1 rounded transition-colors hover:bg-connexio-bg-tertiary text-connexio-text-muted"
					title="Web Preview"
					type="button"
				>
					<Globe size={12} />
				</button>

				{/* Split buttons */}
				{activeTab && (
					<>
						<button
							onClick={() => {
								if (activeTab.splitLayout) {
									const paneId = activeTab.splitLayout.activePaneId;
									splitTerminal(activeProjectId, activeTab.id, paneId, "horizontal");
								} else if (activeTab.type === "editor") {
									useProjectStore.getState().splitTerminalFromEditor(activeProjectId, activeTab.id, "horizontal");
								} else {
									splitTerminal(activeProjectId, activeTab.id, activeTab.id, "horizontal");
								}
							}}
							className="p-1 rounded transition-colors hover:bg-connexio-bg-tertiary text-connexio-text-muted hover:text-connexio-text-secondary"
							title="Split Right (Ctrl+Shift+D)"
							type="button"
						>
							<Columns2 size={12} />
						</button>
						<button
							onClick={() => {
								if (activeTab.splitLayout) {
									const paneId = activeTab.splitLayout.activePaneId;
									splitTerminal(activeProjectId, activeTab.id, paneId, "vertical");
								} else if (activeTab.type === "editor") {
									useProjectStore.getState().splitTerminalFromEditor(activeProjectId, activeTab.id, "vertical");
								} else {
									splitTerminal(activeProjectId, activeTab.id, activeTab.id, "vertical");
								}
							}}
							className="p-1 rounded transition-colors hover:bg-connexio-bg-tertiary text-connexio-text-muted hover:text-connexio-text-secondary"
							title="Split Down (Ctrl+Shift+E)"
							type="button"
						>
							<Rows2 size={12} />
						</button>
					</>
				)}

				{/* Side panel toggles */}
				<div className="ml-auto flex items-center gap-0.5 flex-shrink-0">
					<button
						onClick={() => toggleSidePanel("ai")}
						className={`p-1 rounded transition-colors ${
							showSidePanel && sidePanelTab === "ai"
								? "bg-connexio-accent/10 text-connexio-accent"
								: "hover:bg-connexio-bg-tertiary text-connexio-text-muted"
						}`}
						title="AI Chat"
						type="button"
					>
						<Bot size={12} />
					</button>
					<button
						onClick={() => toggleSidePanel("explorer")}
						className={`p-1 rounded transition-colors ${
							showSidePanel && sidePanelTab === "explorer"
								? "bg-connexio-accent/10 text-connexio-accent"
								: "hover:bg-connexio-bg-tertiary text-connexio-text-muted"
						}`}
						title="File Explorer"
						type="button"
					>
						<FolderTree size={12} />
					</button>
					<button
						onClick={() => toggleSidePanel("source")}
						className={`p-1 rounded transition-colors ${
							showSidePanel && sidePanelTab === "source"
								? "bg-connexio-accent/10 text-connexio-accent"
								: "hover:bg-connexio-bg-tertiary text-connexio-text-muted"
						}`}
						title="Source Control"
						type="button"
					>
						<GitBranch size={12} />
					</button>
					<button
						onClick={() => toggleSidePanel("tasks")}
						className={`p-1 rounded transition-colors ${
							showSidePanel && sidePanelTab === "tasks"
								? "bg-connexio-accent/10 text-connexio-accent"
								: "hover:bg-connexio-bg-tertiary text-connexio-text-muted"
						}`}
						title="Tasks & Pinned Commands"
						type="button"
					>
						<ListTodo size={12} />
					</button>
					<button
						onClick={() => toggleSidePanel("ssh")}
						className={`p-1 rounded transition-colors ${
							showSidePanel && sidePanelTab === "ssh"
								? "bg-connexio-accent/10 text-connexio-accent"
								: "hover:bg-connexio-bg-tertiary text-connexio-text-muted"
						}`}
						title="SSH Connections"
						type="button"
					>
						<Server size={12} />
					</button>
				</div>
			</div>

			{/* Terminal TabBar */}
			<div
				ref={tabBarRef}
				className="flex items-center h-9 bg-connexio-bg-secondary border-b border-connexio-border"
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
				<div className="flex items-center flex-1 overflow-x-auto">
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
							onSelect={() => setActiveTerminalTab(activeProjectId, tab.id)}
							onClose={() => handleCloseTab(tab.id)}
							onRename={(newLabel) =>
								renameTerminalTab(activeProjectId, tab.id, newLabel)
							}
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
						<ShellPicker
							onSelect={(shell) =>
								openTerminalTab(activeProjectId, undefined, shell)
							}
						/>
					</div>
				</div>
			</div>

			{/* Main content area */}
			<div className="flex flex-1 overflow-hidden">
				{/* Terminal / Editor / Preview Area */}
				<div
					className="flex-1 relative overflow-hidden flex flex-col"
					data-file-drop-zone=""
					onDragOver={(e) => {
						if (e.dataTransfer.types.includes("application/connexio-file") || e.dataTransfer.types.includes("Files")) {
							e.preventDefault();
							e.dataTransfer.dropEffect = "copy";
						}
					}}
					onDrop={(e) => {
						e.preventDefault();
						if (!activeProjectId) return;
						// File from sidebar explorer
						const connexioFile = e.dataTransfer.getData("application/connexio-file");
						if (connexioFile) {
							openEditorTab(activeProjectId, connexioFile);
							return;
						}
						// File from OS
						const files = e.dataTransfer.files;
						if (files.length > 0) {
							for (let i = 0; i < files.length; i++) {
								const filePath = (files[i] as any).path;
								if (filePath) {
									openEditorTab(activeProjectId, filePath);
								}
							}
						}
					}}
				>
					{/* Editor tabs — only render those WITHOUT splitLayout (split ones go to TerminalLayer) */}
					{tabs.filter((t) => t.type === "editor" && t.filePath && !t.splitLayout).map((tab) => (
						<div
							key={`editor-${tab.id}`}
							className={activeTabId === tab.id ? "flex-1 min-h-0" : "hidden"}
						>
							<CodeEditor
								filePath={tab.filePath!}
								onClose={() => closeTerminalTab(activeProjectId, tab.id)}
								onDirtyChange={(dirty) => {
									setDirtyTabs((prev) => {
										const next = new Set(prev);
										if (dirty) next.add(tab.id);
										else next.delete(tab.id);
										return next;
									});
								}}
							/>
						</div>
					))}

					{/* Preview tab (shown when active tab is preview type) */}
					{activeTab?.type === "preview" && (
						<div className="flex-1 min-h-0">
							<WebPreview onClose={() => closeTerminalTab(activeProjectId, activeTab.id)} />
						</div>
					)}

					{/* Terminal/Split area (hidden only when pure editor or preview is active) */}
					<div className={(activeTab?.type === "editor" && !activeTab?.splitLayout) || activeTab?.type === "preview" ? "hidden" : "flex-1 min-h-0 relative"} data-terminal-layer-container="">
						<TerminalLayer />
					</div>
				</div>

				{/* Right Side Panel */}
				{showSidePanel && (
					<div
						ref={panelRef}
						className="bg-connexio-bg-secondary border-l border-connexio-border flex flex-col relative overflow-hidden"
						style={{ width: panelWidth }}
					>
						{/* Resize handle */}
						<div
							className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-connexio-accent/30 active:bg-connexio-accent/50 transition-colors z-10"
							onMouseDown={handleResizeStart}
						/>
						{/* Panel header with tabs */}
						<div className="flex items-center border-b border-connexio-border flex-shrink-0 overflow-x-auto">
							<button
								onClick={() => setSidePanelTab("ai")}
								className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
									sidePanelTab === "ai"
										? "text-connexio-accent border-b-2 border-connexio-accent"
										: "text-connexio-text-muted hover:text-connexio-text-secondary"
								}`}
								type="button"
							>
								<Bot size={10} />
								AI
							</button>
							<button
								onClick={() => setSidePanelTab("explorer")}
								className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
									sidePanelTab === "explorer"
										? "text-connexio-accent border-b-2 border-connexio-accent"
										: "text-connexio-text-muted hover:text-connexio-text-secondary"
								}`}
								type="button"
							>
								<FolderTree size={10} />
								Files
							</button>
							<button
								onClick={() => setSidePanelTab("source")}
								className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
									sidePanelTab === "source"
										? "text-connexio-accent border-b-2 border-connexio-accent"
										: "text-connexio-text-muted hover:text-connexio-text-secondary"
								}`}
								type="button"
							>
								<GitBranch size={10} />
								Source
							</button>
							<button
								onClick={() => setSidePanelTab("tasks")}
								className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
									sidePanelTab === "tasks"
										? "text-connexio-accent border-b-2 border-connexio-accent"
										: "text-connexio-text-muted hover:text-connexio-text-secondary"
								}`}
								type="button"
							>
								<ListTodo size={10} />
								Tasks
							</button>
							<button
								onClick={() => setSidePanelTab("ssh")}
								className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
									sidePanelTab === "ssh"
										? "text-connexio-accent border-b-2 border-connexio-accent"
										: "text-connexio-text-muted hover:text-connexio-text-secondary"
								}`}
								type="button"
							>
								<Server size={10} />
								SSH
							</button>
							<button
								onClick={() => setShowSidePanel(false)}
								className="ml-auto p-1 mr-1 rounded hover:bg-connexio-bg-tertiary transition-colors"
								type="button"
							>
								<PanelRightClose
									size={11}
									className="text-connexio-text-muted"
								/>
							</button>
						</div>

						{/* Panel content */}
						<div className="flex-1 min-h-0 overflow-hidden">
							{sidePanelTab === "ai" && <AIChatPanel />}
						{sidePanelTab === "explorer" && (
							<FileExplorer
								projectPath={project.path}
								onOpenInTerminal={(path) => {
									openTerminalTab(activeProjectId, `Terminal (${path.split(/[\\/]/).pop()})`);
								}}
								onOpenFile={(filePath, lineNumber) => openEditorTab(activeProjectId, filePath, lineNumber)}
								onOpenFileInSplit={(filePath, direction) => {
									if (!activeTab) return;
									const paneId = activeTab.splitLayout
										? activeTab.splitLayout.activePaneId
										: activeTab.id;
									useProjectStore.getState().openEditorInSplit(activeProjectId, activeTab.id, paneId, direction, filePath);
								}}
							/>
						)}
						{sidePanelTab === "source" && (
							<SourcePanel projectPath={project.path} />
						)}
						{sidePanelTab === "tasks" && (
							<TaskPanel
								projectId={activeProjectId}
								projectPath={project.path}
								onRunCommand={handleRunCommand}
							/>
						)}
							{sidePanelTab === "ssh" && (
								<SSHPanel
									projectId={activeProjectId}
									onConnect={handleSSHConnect}
								/>
							)}
						</div>
					</div>
				)}
			</div>

			{/* Close tab confirmation */}
			{closeConfirmTabId && (
				<ConfirmDialog
					title="Close Tab"
					message="Close this terminal tab? Any running processes will be terminated."
					onConfirm={confirmCloseTab}
					onCancel={cancelCloseTab}
				/>
			)}
		</div>
	);
}
