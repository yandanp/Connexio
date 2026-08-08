import {
	Bot,
	Columns2,
	FolderTree,
	GitBranch,
	Globe,
	ListTodo,
	PanelRightClose,
	Rows2,
	Server,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useProjectsStore } from "../features/projects";
import { useWorkspaceStore, type TerminalTab } from "../features/workspace";
import { SSHManagerPanel, SSHPanel, SFTPBrowser } from "../features/ssh";
import { SourcePanel } from "../features/git";
import { AIChatPanel } from "./ai";
import ConfirmDialog from "../core/ui/ConfirmDialog";
import { CodeEditor } from "./editor";
import { FileExplorer } from "./explorer";
import ShellPicker from "./ShellPicker";
import SidePanelHeader from "../core/ui/SidePanelHeader";
import SidePanelRail from "../core/ui/SidePanelRail";
import TaskPanel from "./TaskPanel";
import type { SSHConnection } from "../../shared/types";
import TerminalLayer from "./TerminalLayer";
import WebPreview from "./WebPreview";
import WorkspaceTab from "./WorkspaceTab";

type SidePanelTab = "ai" | "explorer" | "tasks" | "ssh" | "source";

export default function Workspace() {
	const { projects, activeProjectId } = useProjectsStore();
	const {
		workspaceTabs,
		activeTabIds,
		openTerminalTab,
		openCommandTerminalTab,
		openSshTerminalTab,
		openEditorTab,
		openRemoteEditorTab,
		openSSHManagerTab,
		openSftpTab,
		closeTerminalTab,
		setActiveTerminalTab,
		renameTerminalTab,
		updatePreviewTabUrl,
		reorderTabs,
		splitTerminal,
	} = useWorkspaceStore();

	// Drag state
	const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
	const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
	const [dragSide, setDragSide] = useState<"left" | "right" | null>(null);
	const [showSidePanel, setShowSidePanel] = useState(false);
	const [sidePanelTab, setSidePanelTab] = useState<SidePanelTab>("tasks");
	const [closeConfirmTabId, setCloseConfirmTabId] = useState<string | null>(null);
	const [dirtyTabs, setDirtyTabs] = useState<Set<string>>(new Set());
	const tabBarRef = useRef<HTMLDivElement>(null);

	const closeTabs = useCallback(
		(tabIds: string[]) => {
			if (!activeProjectId) return;
			for (const tabId of tabIds) {
				closeTerminalTab(activeProjectId, tabId);
			}
		},
		[activeProjectId, closeTerminalTab],
	);

	// Resizable side panel
	const [panelWidth, setPanelWidth] = useState(340);
	const [isPanelResizing, setIsPanelResizing] = useState(false);
	const isResizing = useRef(false);
	const panelRef = useRef<HTMLDivElement>(null);

	const handleResizeStart = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		isResizing.current = true;
		setIsPanelResizing(true);
		document.body.style.cursor = "col-resize";
		document.body.style.userSelect = "none";
	}, []);

	useEffect(() => {
		const handleResizeMove = (e: MouseEvent) => {
			if (!isResizing.current || !panelRef.current) return;
			const containerRect = panelRef.current.parentElement?.getBoundingClientRect();
			if (!containerRect) return;
			const newWidth = containerRect.right - e.clientX;
			setPanelWidth(Math.max(300, Math.min(600, newWidth)));
		};

		const handleResizeEnd = () => {
			if (isResizing.current) {
				isResizing.current = false;
				setIsPanelResizing(false);
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
			} else if (
				detail === "ai" ||
				detail === "explorer" ||
				detail === "source" ||
				detail === "tasks" ||
				detail === "ssh"
			) {
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
			const projId = useProjectsStore.getState().activeProjectId;
			if (!projId) return;
			const state = useWorkspaceStore.getState();
			const currentTabs = state.workspaceTabs[projId] || [];
			const currentActiveTabId = state.activeTabIds[projId];
			if (!currentActiveTabId) return;
			const currentTab = currentTabs.find((t) => t.id === currentActiveTabId);

			if (currentTab?.type === "remoteEditor") {
				return;
			}

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
	const activeFilePath = activeTab?.type === "editor" ? activeTab.filePath : null;
	const sidePanelItems = [
		{ id: "ai" as const, label: "AI", icon: Bot },
		{ id: "explorer" as const, label: "Files", icon: FolderTree, badge: !!activeFilePath },
		{ id: "source" as const, label: "Source", icon: GitBranch },
		{ id: "tasks" as const, label: "Tasks", icon: ListTodo },
		{ id: "ssh" as const, label: "SSH", icon: Server },
	];

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

	const getTabDetail = (tab: TerminalTab) => {
		if (tab.type === "editor" || tab.type === "remoteEditor" || tab.type === "preview")
			return tab.filePath;
		if (tab.type === "sftp") return tab.sftpConnection?.host;
		if (tab.type === "sshManager") return "SSH connections";
		return tab.status ? `${tab.shell || "terminal"} · ${tab.status}` : tab.shell || "terminal";
	};

	const getSplitCount = (tab: TerminalTab) => {
		if (!tab.splitLayout) return 1;
		const countLeaves = (node: any): number =>
			node.type === "leaf"
				? 1
				: node.children.reduce((sum: number, child: any) => sum + countLeaves(child), 0);
		return countLeaves(tab.splitLayout.root);
	};

	// Run command in active terminal
	const handleRunCommand = (command: string) => {
		if (activeTab?.terminalId) {
			window.connexio.terminal.write(activeTab.terminalId, `${command}\r`);
		}
	};

	// SSH connect — use the integrated SSH backend so saved credentials work.
	const handleSSHConnect = async (connection: SSHConnection, label: string, password?: string) => {
		await openSshTerminalTab(activeProjectId, label, connection, password);
	};

	// Close tab with confirmation
	// Editor/remoteEditor tabs: if dirty, show unsaved-changes dialog; otherwise close directly.
	// Terminal tabs: always confirm (running processes).
	// Other types (sshManager, sftp, preview): close directly.
	const handleCloseTab = (tabId: string) => {
		const tab = tabs.find((t) => t.id === tabId);
		if (!tab) return;
		if (tab.type === "sshManager" || tab.type === "sftp" || tab.type === "preview") {
			closeTerminalTab(activeProjectId, tabId);
			return;
		}
		if (tab.type === "editor" || tab.type === "remoteEditor") {
			if (dirtyTabs.has(tabId)) {
				// Let the editor's internal unsaved-changes dialog handle it
				window.dispatchEvent(
					new CustomEvent("connexio:editor-request-close", { detail: { filePath: tab.filePath } }),
				);
			} else {
				closeTerminalTab(activeProjectId, tabId);
			}
			return;
		}
		// Terminal tabs — confirm running processes
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
			<div className="flex h-10 items-center gap-2 bg-connexio-bg-secondary/70 px-3 backdrop-blur">
				<span className="truncate rounded-full border border-connexio-border-subtle bg-connexio-bg-tertiary/70 px-2 py-1 text-[11px] font-semibold text-connexio-text flex-shrink-0">
					{project.name}
				</span>
				<span className="min-w-0 flex-shrink truncate text-[10px] text-connexio-text-muted opacity-70">
					{project.path}
				</span>

				{/* Web Preview — open as tab */}
				<button
					onClick={() => useWorkspaceStore.getState().openPreviewTab(activeProjectId)}
					className="dock-button p-1.5"
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
									useWorkspaceStore
										.getState()
										.splitTerminalFromEditor(activeProjectId, activeTab.id, "horizontal");
								} else {
									splitTerminal(activeProjectId, activeTab.id, activeTab.id, "horizontal");
								}
							}}
							className="dock-button p-1.5"
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
									useWorkspaceStore
										.getState()
										.splitTerminalFromEditor(activeProjectId, activeTab.id, "vertical");
								} else {
									splitTerminal(activeProjectId, activeTab.id, activeTab.id, "vertical");
								}
							}}
							className="dock-button p-1.5"
							title="Split Down (Ctrl+Shift+E)"
							type="button"
						>
							<Rows2 size={12} />
						</button>
					</>
				)}

				{/* Side panel toggles */}
				<div className="ml-auto flex flex-shrink-0 items-center gap-1">
					<button
						onClick={() => toggleSidePanel("ai")}
						className={`p-1 dock-button ${
							showSidePanel && sidePanelTab === "ai" ? "dock-button-active" : ""
						}`}
						title="AI Chat"
						type="button"
					>
						<Bot size={12} />
					</button>
					<button
						onClick={() => toggleSidePanel("explorer")}
						className={`p-1 dock-button ${
							showSidePanel && sidePanelTab === "explorer" ? "dock-button-active" : ""
						}`}
						title="File Explorer"
						type="button"
					>
						<FolderTree size={12} />
					</button>
					<button
						onClick={() => toggleSidePanel("source")}
						className={`p-1 dock-button ${
							showSidePanel && sidePanelTab === "source" ? "dock-button-active" : ""
						}`}
						title="Source Control"
						type="button"
					>
						<GitBranch size={12} />
					</button>
					<button
						onClick={() => toggleSidePanel("tasks")}
						className={`p-1 dock-button ${
							showSidePanel && sidePanelTab === "tasks" ? "dock-button-active" : ""
						}`}
						title="Tasks & Pinned Commands"
						type="button"
					>
						<ListTodo size={12} />
					</button>
					<button
						onClick={() => toggleSidePanel("ssh")}
						className={`p-1 dock-button ${
							showSidePanel && sidePanelTab === "ssh" ? "dock-button-active" : ""
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
							onSelect={() => setActiveTerminalTab(activeProjectId, tab.id)}
							onClose={() => handleCloseTab(tab.id)}
							onCloseOthers={
								tabs.length > 1
									? () =>
											closeTabs(tabs.filter((item) => item.id !== tab.id).map((item) => item.id))
									: undefined
							}
							onCloseTabsToRight={
								index < tabs.length - 1
									? () => closeTabs(tabs.slice(index + 1).map((item) => item.id))
									: undefined
							}
							onRevealInExplorer={
								tab.filePath
									? () => {
											setShowSidePanel(true);
											setSidePanelTab("explorer");
										}
									: undefined
							}
							onRename={(newLabel) => renameTerminalTab(activeProjectId, tab.id, newLabel)}
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
						<ShellPicker onSelect={(shell) => openTerminalTab(activeProjectId, undefined, shell)} />
					</div>
				</div>
			</div>

			{/* Main content area */}
			<div className="flex flex-1 overflow-hidden">
				{/* Terminal / Editor / Preview Area */}
				<div
					className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-connexio-bg"
					data-file-drop-zone=""
					onDragOver={(e) => {
						if (
							e.dataTransfer.types.includes("application/connexio-file") ||
							e.dataTransfer.types.includes("Files")
						) {
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
					{tabs
						.filter((t) => t.type === "editor" && t.filePath && !t.splitLayout)
						.map((tab) => (
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

					{/* Remote editor tab */}
					{activeTab?.type === "remoteEditor" &&
						activeTab.filePath &&
						activeTab.remoteConnection &&
						activeTab.remotePath && (
							<div className="flex-1 min-h-0">
								<RemoteEditorWrapper
									key={activeTab.id}
									tab={activeTab}
									onClose={() => closeTerminalTab(activeProjectId, activeTab.id)}
									onDirtyChange={(dirty) => {
										setDirtyTabs((prev) => {
											const next = new Set(prev);
											if (dirty) next.add(activeTab.id);
											else next.delete(activeTab.id);
											return next;
										});
									}}
								/>
							</div>
						)}

					{/* SSH manager tab */}
					{activeTab?.type === "sshManager" && (
						<div className="flex-1 min-h-0 bg-connexio-bg text-connexio-text">
							<SSHManagerPanel
								projectId={activeProjectId}
								onConnect={handleSSHConnect}
								onOpenSftp={(connection) => openSftpTab(activeProjectId, connection)}
							/>
						</div>
					)}

					{/* SFTP tabs — persist all, hide inactive to preserve state */}
					{tabs
						.filter((t) => t.type === "sftp" && t.sftpConnection)
						.map((tab) => (
							<div
								key={`sftp-${tab.id}`}
								className={
									activeTabId === tab.id
										? "flex-1 min-h-0 bg-connexio-bg text-connexio-text"
										: "hidden"
								}
							>
								<SFTPBrowser connection={tab.sftpConnection!} />
							</div>
						))}

					{/* Preview tab (shown when active tab is preview type) */}
					{activeTab?.type === "preview" && (
						<div className="flex-1 min-h-0">
							<WebPreview
								onClose={() => closeTerminalTab(activeProjectId, activeTab.id)}
								initialUrl={activeTab.filePath}
								projectPath={project.path}
								onUrlChange={(url) => updatePreviewTabUrl(activeProjectId, activeTab.id, url)}
							/>
						</div>
					)}

					{/* Terminal/Split area (hidden only when pure editor or preview is active) */}
					<div
						className={
							((activeTab?.type === "editor" ||
								activeTab?.type === "remoteEditor" ||
								activeTab?.type === "sshManager" ||
								activeTab?.type === "sftp") &&
								!activeTab?.splitLayout) ||
							activeTab?.type === "preview"
								? "hidden"
								: "flex-1 min-h-0 relative"
						}
						data-terminal-layer-container=""
					>
						<TerminalLayer />
					</div>
				</div>

				{/* Right Side Panel */}
				{showSidePanel && (
					<div
						ref={panelRef}
						className="glass-panel animate-panel-in relative flex flex-shrink-0 flex-col overflow-hidden border-l border-connexio-border/45 shadow-[-8px_0_22px_rgba(0,0,0,0.10),inset_1px_0_0_rgba(255,255,255,0.03)]"
						style={{ width: panelWidth }}
					>
						{/* Resize handle */}
						<div
							className={`absolute bottom-0 left-0 top-0 z-10 w-1 cursor-col-resize transition-colors hover:bg-connexio-accent/30 active:bg-connexio-accent/50 ${isPanelResizing ? "resize-rail-active" : ""}`}
							onMouseDown={handleResizeStart}
						/>
						<div className="flex min-h-0 flex-1 overflow-hidden">
							{/* Panel content */}
							<div className="flex min-w-0 flex-1 flex-col overflow-hidden">
								{sidePanelTab === "ai" && (
									<>
										<SidePanelHeader icon={Bot} title="AI Assistant" subtitle={project.name} />
										<div className="min-h-0 flex-1 overflow-hidden">
											<AIChatPanel />
										</div>
									</>
								)}
								{sidePanelTab === "explorer" && (
									<>
										<SidePanelHeader
											icon={FolderTree}
											title="Explorer"
											subtitle={activeFilePath ? activeFilePath.split(/[\\/]/).pop() : project.name}
										/>
										<div className="min-h-0 flex-1 overflow-hidden">
											<FileExplorer
												projectPath={project.path}
												activeFilePath={activeFilePath}
												onOpenInTerminal={(path) => {
													openTerminalTab(
														activeProjectId,
														`Terminal (${path.split(/[\\/]/).pop()})`,
													);
												}}
												onOpenFile={(filePath, lineNumber) =>
													openEditorTab(activeProjectId, filePath, lineNumber)
												}
												onOpenFileInSplit={(filePath, direction) => {
													if (!activeTab) return;
													const paneId = activeTab.splitLayout
														? activeTab.splitLayout.activePaneId
														: activeTab.id;
													useWorkspaceStore
														.getState()
														.openEditorInSplit(
															activeProjectId,
															activeTab.id,
															paneId,
															direction,
															filePath,
														);
												}}
											/>
										</div>
									</>
								)}
								{sidePanelTab === "source" && (
									<>
										<SidePanelHeader
											icon={GitBranch}
											title="Source Control"
											subtitle={project.name}
										/>
										<div className="min-h-0 flex-1 overflow-hidden">
											<SourcePanel projectPath={project.path} />
										</div>
									</>
								)}
								{sidePanelTab === "tasks" && (
									<>
										<SidePanelHeader icon={ListTodo} title="Tasks" subtitle={project.name} />
										<div className="min-h-0 flex-1 overflow-hidden">
											<TaskPanel
												projectId={activeProjectId}
												projectPath={project.path}
												onRunCommand={handleRunCommand}
											/>
										</div>
									</>
								)}
								{sidePanelTab === "ssh" && (
									<>
										<SidePanelHeader icon={Server} title="SSH" subtitle={project.name} />
										<div className="min-h-0 flex-1 overflow-hidden">
											<SSHPanel
												projectId={activeProjectId}
												onConnect={handleSSHConnect}
												onOpenManager={() => openSSHManagerTab(activeProjectId)}
												onOpenSftp={(connection) => openSftpTab(activeProjectId, connection)}
											/>
										</div>
									</>
								)}
							</div>
							<SidePanelRail
								items={sidePanelItems}
								activeId={sidePanelTab}
								onSelect={setSidePanelTab}
								onClose={() => setShowSidePanel(false)}
								closeIcon={PanelRightClose}
							/>
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

// === Remote Editor Wrapper ===
// Stabilizes loadContent/saveContent references to prevent CodeEditor re-mount loops
function RemoteEditorWrapper({
	tab,
	onClose,
	onDirtyChange,
}: {
	tab: TerminalTab;
	onClose: () => void;
	onDirtyChange: (dirty: boolean) => void;
}) {
	const { workspaceTabs } = useWorkspaceStore();
	const { activeProjectId } = useProjectsStore();

	// Stable loadContent — only recreated when tab.id changes
	const loadContent = useCallback(async () => {
		return tab.remoteContent || "";
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [tab.id]);

	// Stable saveContent — uses refs internally
	const tabRef = useRef(tab);
	tabRef.current = tab;

	const saveContent = useCallback(
		async (content: string) => {
			const currentTab = tabRef.current;
			const conn = currentTab.remoteConnection!;
			const ref = conn.authMethod === "key" ? conn.passphraseSecretRef : conn.passwordSecretRef;
			const password = ref?.key ? await window.connexio.ssh.getSecret(ref.key) : null;
			if (conn.authMethod !== "agent" && !password) {
				throw new Error(
					"Saved SSH secret is required to save this remote file. Reopen SFTP and save the password/passphrase first.",
				);
			}
			await window.connexio.ssh.sftpWrite(
				conn,
				currentTab.remotePath!,
				content,
				password || undefined,
			);
			// Update store immutably
			const projId = useProjectsStore.getState().activeProjectId;
			if (projId) {
				const store = useWorkspaceStore.getState();
				const tabs = store.workspaceTabs[projId] || [];
				const updated = tabs.map((t) =>
					t.id === currentTab.id ? { ...t, remoteContent: content } : t,
				);
				useWorkspaceStore.setState({
					workspaceTabs: { ...store.workspaceTabs, [projId]: updated },
				});
			}
			// eslint-disable-next-line react-hooks/exhaustive-deps
		},
		[tab.id],
	);

	return (
		<CodeEditor
			filePath={tab.filePath!}
			loadContent={loadContent}
			saveContent={saveContent}
			onClose={onClose}
			onDirtyChange={onDirtyChange}
		/>
	);
}
