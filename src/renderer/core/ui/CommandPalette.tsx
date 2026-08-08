import {
	Bot,
	Bookmark,
	FileSearch,
	FolderOpen,
	Globe,
	Home,
	Keyboard,
	ListTodo,
	MonitorCog,
	Plus,
	Search,
	Server,
	Settings,
	Terminal,
	Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useProjectsStore } from "../../features/projects";
import { useWorkspaceStore } from "../../features/workspace";
import { useSettingsStore } from "../stores/settingsStore";
import type { PinnedCommand, TaskScript } from "../../../shared/types";

type PaletteAction = {
	id: string;
	label: string;
	detail?: string;
	group: "Projects" | "Tabs" | "Tasks" | "Pinned" | "Workspace" | "Panels" | "App";
	icon: React.ReactNode;
	run: () => void | Promise<void>;
};

function shellCommand(command: string): string[] {
	const isWindows = navigator.platform.toLowerCase().includes("win");
	if (isWindows) return ["cmd.exe", "/K", command];
	const shell = "/bin/sh";
	return [shell, "-lc", `${command}; exec ${shell}`];
}

interface Props {
	open: boolean;
	onClose: () => void;
}

export default function CommandPalette({ open, onClose }: Props) {
	const [query, setQuery] = useState("");
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [tasks, setTasks] = useState<TaskScript[]>([]);
	const [pinnedCommands, setPinnedCommands] = useState<PinnedCommand[]>([]);
	const inputRef = useRef<HTMLInputElement>(null);
	const { projects, activeProjectId, setActiveProject } = useProjectsStore();
	const {
		workspaceTabs,
		activeTabIds,
		setActiveTerminalTab,
		openTerminalTab,
		openCommandTerminalTab,
		openPreviewTab,
		openSSHManagerTab,
	} = useWorkspaceStore();
	const { openSettings } = useSettingsStore();

	const activeProject = projects.find((project) => project.id === activeProjectId);
	const tabs = activeProjectId ? workspaceTabs[activeProjectId] || [] : [];

	useEffect(() => {
		if (!open) return;
		setQuery("");
		setSelectedIndex(0);
		const timer = window.setTimeout(() => inputRef.current?.focus(), 20);
		return () => window.clearTimeout(timer);
	}, [open]);

	useEffect(() => {
		if (!open || !activeProjectId || !activeProject) {
			setTasks([]);
			setPinnedCommands([]);
			return;
		}
		let cancelled = false;
		window.connexio.tasks
			.detect(activeProject.path)
			.then((items) => {
				if (!cancelled) setTasks(items);
			})
			.catch(() => {
				if (!cancelled) setTasks([]);
			});
		window.connexio.pinned
			.list(activeProjectId)
			.then((items) => {
				if (!cancelled) setPinnedCommands(items);
			})
			.catch(() => {
				if (!cancelled) setPinnedCommands([]);
			});
		return () => {
			cancelled = true;
		};
	}, [activeProject, activeProjectId, open]);

	const actions = useMemo<PaletteAction[]>(() => {
		const openPanel = (panel: "ai" | "explorer" | "source" | "tasks" | "ssh") => {
			window.dispatchEvent(new CustomEvent("connexio:open-panel", { detail: panel }));
		};

		const base: PaletteAction[] = projects.map((project) => ({
			id: `project-${project.id}`,
			label: `Open ${project.name}`,
			detail: project.path,
			group: "Projects",
			icon: <FolderOpen size={15} />,
			run: () => setActiveProject(project.id),
		}));

		for (const tab of tabs) {
			base.push({
				id: `tab-${tab.id}`,
				label: `Switch to ${tab.label}`,
				detail: tab.type || "terminal",
				group: "Tabs",
				icon: <Terminal size={15} />,
				run: () => {
					if (activeProjectId) setActiveTerminalTab(activeProjectId, tab.id);
				},
			});
		}

		if (activeProjectId) {
			for (const task of tasks) {
				base.push({
					id: `task-${task.source}-${task.name}`,
					label: `Run ${task.name}`,
					detail: `${task.command} · ${task.source}`,
					group: "Tasks",
					icon: <Zap size={15} />,
					run: () => openCommandTerminalTab(activeProjectId, task.name, shellCommand(task.command)),
				});
			}

			for (const command of pinnedCommands) {
				base.push({
					id: `pinned-${command.id}`,
					label: `Run ${command.label}`,
					detail: command.command,
					group: "Pinned",
					icon: <Bookmark size={15} />,
					run: () =>
						openCommandTerminalTab(activeProjectId, command.label, shellCommand(command.command)),
				});
			}
			base.push(
				{
					id: "new-terminal",
					label: "New Terminal",
					detail: activeProject?.name,
					group: "Workspace",
					icon: <Plus size={15} />,
					run: () => openTerminalTab(activeProjectId),
				},
				{
					id: "open-preview",
					label: "Open Web Preview",
					detail: activeProject?.name,
					group: "Workspace",
					icon: <Globe size={15} />,
					run: () => openPreviewTab(activeProjectId),
				},
				{
					id: "open-ssh-manager",
					label: "Open SSH Manager",
					detail: activeProject?.name,
					group: "Workspace",
					icon: <Server size={15} />,
					run: () => openSSHManagerTab(activeProjectId),
				},
				{
					id: "panel-ai",
					label: "Open AI Assistant",
					group: "Panels",
					icon: <Bot size={15} />,
					run: () => openPanel("ai"),
				},
				{
					id: "panel-files",
					label: "Open File Explorer",
					group: "Panels",
					icon: <FileSearch size={15} />,
					run: () => openPanel("explorer"),
				},
				{
					id: "panel-source",
					label: "Open Source Control",
					group: "Panels",
					icon: <FolderOpen size={15} />,
					run: () => openPanel("source"),
				},
				{
					id: "panel-tasks",
					label: "Open Tasks",
					group: "Panels",
					icon: <ListTodo size={15} />,
					run: () => openPanel("tasks"),
				},
				{
					id: "panel-ssh",
					label: "Open SSH Connections",
					group: "Panels",
					icon: <Server size={15} />,
					run: () => openPanel("ssh"),
				},
			);
		}

		base.push(
			{
				id: "start-page",
				label: "Open Start Page",
				detail: "Recent projects and quick actions",
				group: "App",
				icon: <Home size={15} />,
				run: () => {
					window.dispatchEvent(new CustomEvent("connexio:open-start-page"));
				},
			},
			{
				id: "settings",
				label: "Open Settings",
				group: "App",
				icon: <Settings size={15} />,
				run: openSettings,
			},
			{
				id: "shortcuts",
				label: "Open Keyboard Shortcuts",
				detail: "Ctrl/Cmd /",
				group: "App",
				icon: <Keyboard size={15} />,
				run: () => {
					window.dispatchEvent(new CustomEvent("connexio:open-shortcuts"));
				},
			},
		);

		return base;
	}, [
		activeProject?.name,
		activeProjectId,
		openCommandTerminalTab,
		openPreviewTab,
		openSSHManagerTab,
		openSettings,
		openTerminalTab,
		pinnedCommands,
		projects,
		setActiveProject,
		setActiveTerminalTab,
		tabs,
		tasks,
	]);

	const filtered = useMemo(() => {
		const raw = query.trim();
		let groupFilter: PaletteAction["group"] | null = null;
		let normalized = raw.toLowerCase();
		if (raw.startsWith("$")) {
			groupFilter = "Tasks";
			normalized = raw.slice(1).trim().toLowerCase();
		}
		if (raw.startsWith("@")) {
			groupFilter = "Projects";
			normalized = raw.slice(1).trim().toLowerCase();
		}
		if (raw.startsWith(">")) {
			groupFilter = "App";
			normalized = raw.slice(1).trim().toLowerCase();
		}
		const pool = groupFilter
			? actions.filter(
					(action) =>
						action.group === groupFilter || (groupFilter === "Tasks" && action.group === "Pinned"),
				)
			: actions;
		if (!normalized) return pool.slice(0, 30);
		return pool
			.map((action) => {
				const haystack = `${action.label} ${action.detail || ""} ${action.group}`.toLowerCase();
				const label = action.label.toLowerCase();
				let score = 0;
				if (label.startsWith(normalized)) score += 30;
				if (label.includes(normalized)) score += 15;
				if ((action.detail || "").toLowerCase().includes(normalized)) score += 8;
				if (action.group.toLowerCase().includes(normalized)) score += 4;
				return { action, score, matched: haystack.includes(normalized) };
			})
			.filter((item) => item.matched)
			.sort((a, b) => b.score - a.score)
			.map((item) => item.action)
			.slice(0, 30);
	}, [actions, query]);

	useEffect(() => {
		setSelectedIndex(0);
	}, [query]);

	const runAction = async (action: PaletteAction) => {
		await action.run();
		onClose();
	};

	if (!open) return null;

	return (
		<div
			className="fixed inset-0 z-[400] flex items-start justify-center bg-black/45 pt-[12vh] backdrop-blur-sm"
			onMouseDown={onClose}
		>
			<div
				className="glass-panel animate-fade-scale w-[min(720px,calc(100vw-2rem))] overflow-hidden rounded-2xl shadow-[0_28px_90px_rgba(0,0,0,0.46)]"
				onMouseDown={(event) => event.stopPropagation()}
			>
				<div className="flex items-center gap-3 px-4 py-3 soft-separator-bottom">
					<Search size={16} className="text-connexio-accent" />
					<input
						ref={inputRef}
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === "Escape") onClose();
							if (event.key === "ArrowDown") {
								event.preventDefault();
								setSelectedIndex((index) => Math.min(index + 1, filtered.length - 1));
							}
							if (event.key === "ArrowUp") {
								event.preventDefault();
								setSelectedIndex((index) => Math.max(index - 1, 0));
							}
							if (event.key === "Enter" && filtered[selectedIndex]) {
								event.preventDefault();
								runAction(filtered[selectedIndex]);
							}
						}}
						placeholder="Search projects, tabs, panels, and actions..."
						className="flex-1 bg-transparent text-[14px] text-connexio-text outline-none placeholder:text-connexio-text-muted"
					/>
					<div className="rounded-md bg-white/[0.04] px-2 py-1 text-[10px] font-medium text-connexio-text-muted">
						Esc
					</div>
				</div>

				<div className="max-h-[420px] overflow-y-auto p-2">
					{filtered.length === 0 ? (
						<div className="flex flex-col items-center justify-center px-6 py-12 text-center">
							<MonitorCog size={24} className="mb-2 text-connexio-text-muted" />
							<p className="text-sm font-medium text-connexio-text">No command found</p>
							<p className="text-xs text-connexio-text-muted">
								Try searching for a project, tab, panel, or setting.
							</p>
						</div>
					) : (
						filtered.map((action, index) => (
							<button
								key={action.id}
								onClick={() => runAction(action)}
								className={`interaction-lift flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${index === selectedIndex ? "bg-connexio-accent/10 text-connexio-text shadow-[inset_2px_0_0_var(--accent-color)]" : "text-connexio-text-secondary hover:bg-white/[0.04]"}`}
								type="button"
							>
								<span
									className={
										index === selectedIndex ? "text-connexio-accent" : "text-connexio-text-muted"
									}
								>
									{action.icon}
								</span>
								<span className="min-w-0 flex-1">
									<span className="block truncate text-[13px] font-medium">{action.label}</span>
									{action.detail && (
										<span className="block truncate text-[10px] text-connexio-text-muted">
											{action.detail}
										</span>
									)}
								</span>
								<span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] text-connexio-text-muted">
									{action.group}
								</span>
							</button>
						))
					)}
				</div>
			</div>
		</div>
	);
}
