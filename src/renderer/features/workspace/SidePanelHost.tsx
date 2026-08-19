import { Bot, FolderTree, GitBranch, ListTodo, PanelRightClose, Server } from "lucide-react";
import type { MouseEvent as ReactMouseEvent, RefObject } from "react";
import type { Project, SSHConnection } from "../../../shared/types";
import SidePanelHeader from "../../core/ui/SidePanelHeader";
import SidePanelRail from "../../core/ui/SidePanelRail";
import { AIChatPanel } from "../ai";
import { FileExplorer } from "../explorer";
import { SourcePanel } from "../git";
import { SSHPanel } from "../ssh";
import { TaskPanel } from "../tasks";

export type SidePanelTab = "ai" | "explorer" | "tasks" | "ssh" | "source";

interface Props {
	activePanel: SidePanelTab;
	project: Project;
	projectId: string;
	activeFilePath?: string | null;
	// Resize chrome is owned by Workspace so the width survives close/reopen
	// (this component unmounts when the panel closes).
	panelWidth: number;
	isPanelResizing: boolean;
	panelRef: RefObject<HTMLDivElement>;
	onResizeStart: (e: ReactMouseEvent) => void;
	onSelectPanel: (tab: SidePanelTab) => void;
	onClose: () => void;
	onOpenInTerminal: (path: string) => void;
	panelDockMode: boolean;
	onOpenFile: (filePath: string, lineNumber?: number) => void;
	onOpenFileInSplit: (filePath: string, direction: "horizontal" | "vertical") => void;
	onRunCommand: (command: string) => void;
	onSSHConnect: (connection: SSHConnection, label: string, password?: string) => Promise<void>;
	onOpenSSHManager: () => void;
	onOpenSftp: (connection: SSHConnection) => void;
}

export default function SidePanelHost({
	activePanel,
	project,
	projectId,
	activeFilePath,
	panelWidth,
	isPanelResizing,
	panelRef,
	onResizeStart,
	onSelectPanel,
	onClose,
	onOpenInTerminal,
	onOpenFile,
	onOpenFileInSplit,
	onRunCommand,
	onSSHConnect,
	onOpenSSHManager,
	onOpenSftp,
	panelDockMode,
}: Props) {
	const sidePanelItems = [
		{ id: "ai" as const, label: "AI", icon: Bot },
		{ id: "explorer" as const, label: "Files", icon: FolderTree, badge: !!activeFilePath },
		{ id: "source" as const, label: "Source", icon: GitBranch },
		{ id: "tasks" as const, label: "Tasks", icon: ListTodo },
		{ id: "ssh" as const, label: "SSH", icon: Server },
	];

	return (
		<div
			ref={panelRef}
			className={panelDockMode ? "glass-panel relative flex flex-shrink-0 flex-col overflow-hidden border-l border-connexio-border/45 shadow-[-8px_0_22px_rgba(0,0,0,0.10),inset_1px_0_0_rgba(255,255,255,0.03)]" : "glass-panel animate-panel-in absolute bottom-0 right-0 top-0 z-50 flex flex-col overflow-hidden border-l border-connexio-border/45 shadow-[-18px_0_34px_rgba(0,0,0,0.22),inset_1px_0_0_rgba(255,255,255,0.03)]"}
			style={{ width: panelWidth }}
		>
			{/* Resize handle */}
			<div
				className={`absolute bottom-0 left-0 top-0 z-10 w-1 cursor-col-resize transition-colors hover:bg-connexio-accent/30 active:bg-connexio-accent/50 ${isPanelResizing ? "resize-rail-active" : ""}`}
				onMouseDown={onResizeStart}
			/>
			<div className="flex min-h-0 flex-1 overflow-hidden">
				{/* Panel content */}
				<div className="flex min-w-0 flex-1 flex-col overflow-hidden">
					{activePanel === "ai" && (
						<>
							<SidePanelHeader icon={Bot} title="AI Assistant" subtitle={project.name} />
							<div className="min-h-0 flex-1 overflow-hidden">
								<AIChatPanel />
							</div>
						</>
					)}
					{activePanel === "explorer" && (
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
									onOpenInTerminal={onOpenInTerminal}
									onOpenFile={onOpenFile}
									onOpenFileInSplit={onOpenFileInSplit}
								/>
							</div>
						</>
					)}
					{activePanel === "source" && (
						<>
							<SidePanelHeader icon={GitBranch} title="Source Control" subtitle={project.name} />
							<div className="min-h-0 flex-1 overflow-hidden">
								<SourcePanel projectPath={project.path} />
							</div>
						</>
					)}
					{activePanel === "tasks" && (
						<>
							<SidePanelHeader icon={ListTodo} title="Tasks" subtitle={project.name} />
							<div className="min-h-0 flex-1 overflow-hidden">
								<TaskPanel
									projectId={projectId}
									projectPath={project.path}
									onRunCommand={onRunCommand}
								/>
							</div>
						</>
					)}
					{activePanel === "ssh" && (
						<>
							<SidePanelHeader icon={Server} title="SSH" subtitle={project.name} />
							<div className="min-h-0 flex-1 overflow-hidden">
								<SSHPanel
									projectId={projectId}
									onConnect={onSSHConnect}
									onOpenManager={onOpenSSHManager}
									onOpenSftp={onOpenSftp}
								/>
							</div>
						</>
					)}
				</div>
				<SidePanelRail
					items={sidePanelItems}
					activeId={activePanel}
					onSelect={onSelectPanel}
					onClose={onClose}
					closeIcon={PanelRightClose}
				/>
			</div>
		</div>
	);
}
