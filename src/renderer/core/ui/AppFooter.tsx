import {
	AlertCircle,
	ArrowDown,
	ArrowUp,
	Bell,
	Code2,
	FileCode,
	GitBranch,
	Globe,
	HardDrive,
	Server,
	Terminal,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GitStatus } from "../../../shared/types";
import { useNotificationStore } from "../stores/notificationStore";
import { useProjectsStore } from "../../features/projects";
import { useWorkspaceStore } from "../../features/workspace";
import { useSettingsStore } from "../stores/settingsStore";
import RemoteConnectionBadge from "../../components/RemoteConnectionBadge";
import RemotePowerControls from "../../components/RemotePowerControls";

export default function AppFooter() {
	const { projects, activeProjectId, sidebarCollapsed } = useProjectsStore();
	const { workspaceTabs, activeTabIds } = useWorkspaceStore();
	const { notifications } = useNotificationStore();
	const { isSettingsOpen } = useSettingsStore();
	const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
	const [appVersion, setAppVersion] = useState("");
	const [pathCopied, setPathCopied] = useState(false);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const mountedRef = useRef(true);

	const project = projects.find((p) => p.id === activeProjectId);

	// Notification count for active project only
	const projectUnreadCount = notifications.filter(
		(n) => !n.isRead && n.projectId === activeProjectId,
	).length;

	// Fetch git status for active project
	const fetchGitStatus = useCallback(async () => {
		if (!project) {
			setGitStatus(null);
			return;
		}
		try {
			const result = await window.connexio.git.status(project.path);
			if (mountedRef.current) setGitStatus(result);
		} catch {
			if (mountedRef.current) setGitStatus(null);
		}
	}, [project]);

	useEffect(() => {
		mountedRef.current = true;
		fetchGitStatus();

		if (intervalRef.current) clearInterval(intervalRef.current);
		intervalRef.current = setInterval(fetchGitStatus, 30000);

		return () => {
			mountedRef.current = false;
			if (intervalRef.current) clearInterval(intervalRef.current);
		};
	}, [fetchGitStatus]);

	useEffect(() => {
		window.connexio.app.getVersion().then((v: string) => setAppVersion(v));
	}, []);

	const handleCopyPath = useCallback(() => {
		if (!project) return;
		navigator.clipboard.writeText(project.path);
		setPathCopied(true);
		setTimeout(() => setPathCopied(false), 2000);
	}, [project]);

	const handleGitClick = useCallback(() => {
		window.dispatchEvent(new CustomEvent("connexio:open-panel", { detail: "source" }));
	}, []);

	const handleTerminalClick = useCallback(() => {
		// Close side panel to focus terminal
		window.dispatchEvent(new CustomEvent("connexio:open-panel", { detail: "close" }));
	}, []);

	const handleOpenSettings = useCallback(() => {
		if (!isSettingsOpen) {
			useSettingsStore.getState().openSettings();
		}
	}, [isSettingsOpen]);

	// Terminal info
	const tabs = activeProjectId ? workspaceTabs[activeProjectId] || [] : [];
	const activeTabId = activeProjectId ? activeTabIds[activeProjectId] || null : null;
	const activeTab = tabs.find((t) => t.id === activeTabId);

	// Git summary
	const changesCount = gitStatus ? gitStatus.modified + gitStatus.staged + gitStatus.untracked : 0;

	const activeTabType = activeTab?.type || "terminal";
	const activeStatusLabel =
		activeTab?.status === "running" ? "Running" : activeTab?.status === "exited" ? "Done" : "Ready";
	const ActiveTabIcon =
		activeTabType === "editor" || activeTabType === "remoteEditor"
			? FileCode
			: activeTabType === "preview"
				? Globe
				: activeTabType === "sshManager"
					? Server
					: activeTabType === "sftp"
						? HardDrive
						: activeTabType === "terminal"
							? Terminal
							: Code2;

	// Sidebar width to match
	const sidebarWidth = sidebarCollapsed ? "w-12" : "w-64";

	return (
		<div className="relative z-10 flex h-[34px] select-none items-stretch bg-connexio-bg-secondary/90 text-[12px] soft-separator-top backdrop-blur-xl">
			{/* Left section — matches sidebar width */}
			<div className={`${sidebarWidth} flex-shrink-0 flex items-center px-3 soft-separator-right`}>
				{project && (
					<button
						onClick={handleCopyPath}
						className="flex w-full items-center gap-2 truncate rounded-lg px-1 py-1 transition-colors hover:bg-connexio-bg-tertiary/70 hover:text-connexio-accent"
						title={pathCopied ? "Path copied!" : `Click to copy: ${project.path}`}
						type="button"
					>
						<span className="h-2 w-2 flex-shrink-0 rounded-full bg-[var(--success-color)] shadow-[0_0_12px_rgba(52,211,153,0.5)]" />
						<span className="truncate font-medium text-connexio-text-secondary">
							{pathCopied ? "Copied!" : project.name}
						</span>
					</button>
				)}
			</div>

			{/* Right section — matches workspace area */}
			<div className="flex flex-1 items-center gap-2.5 px-3">
				{/* Git segment — click to open source panel */}
				{gitStatus?.isRepo && (
					<button
						onClick={handleGitClick}
						className="connexio-pill flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 transition-colors hover:bg-connexio-accent/10"
						title="Open Source Control"
						type="button"
					>
						<GitBranch size={12} className="text-connexio-accent flex-shrink-0" />
						<span className="font-medium text-connexio-text-secondary">{gitStatus.branch}</span>
						{(gitStatus.ahead > 0 || gitStatus.behind > 0) && (
							<span className="flex items-center gap-1">
								{gitStatus.ahead > 0 && (
									<span className="flex items-center gap-0 text-green-400 font-medium">
										<ArrowUp size={10} />
										{gitStatus.ahead}
									</span>
								)}
								{gitStatus.behind > 0 && (
									<span className="flex items-center gap-0 text-yellow-400 font-medium">
										<ArrowDown size={10} />
										{gitStatus.behind}
									</span>
								)}
							</span>
						)}
						{changesCount > 0 && (
							<span className="text-connexio-text-muted">
								· {changesCount} change{changesCount !== 1 ? "s" : ""}
							</span>
						)}
						{gitStatus.conflicted > 0 && (
							<span className="flex items-center gap-0.5 text-red-400 font-medium">
								<AlertCircle size={10} />
								{gitStatus.conflicted}
							</span>
						)}
					</button>
				)}

				{/* Terminal segment — click to focus terminal */}
				{activeTab && (
					<button
						onClick={handleTerminalClick}
						className="connexio-pill flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-connexio-text-muted transition-colors hover:bg-connexio-accent/10"
						title="Focus terminal"
						type="button"
					>
						<ActiveTabIcon size={12} className="flex-shrink-0" />
						<span className="truncate max-w-[140px]">{activeTab.label}</span>
						<span className="rounded bg-white/[0.04] px-1 text-[9px] uppercase text-connexio-text-muted">
							{activeTabType}
						</span>
						{activeTab.status && (
							<span
								className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${activeTab.status === "running" ? "bg-[var(--success-color)]/10 text-[var(--success-color)]" : activeTab.status === "exited" ? "bg-white/[0.035] text-connexio-text-muted" : "bg-connexio-accent/10 text-connexio-accent"}`}
							>
								<span
									className={`h-1.5 w-1.5 rounded-full ${activeTab.status === "running" ? "animate-pulse bg-[var(--success-color)]" : activeTab.status === "exited" ? "bg-connexio-text-muted/45" : "bg-connexio-accent"}`}
								/>
								{activeStatusLabel}
							</span>
						)}
						{tabs.length > 1 && (
							<span className="text-connexio-text-muted/60">· {tabs.length} tabs</span>
						)}
					</button>
				)}

				{/* Spacer */}
				<div className="flex-1" />

				<RemoteConnectionBadge />
				<RemotePowerControls />

				{/* Notifications for this project */}
				{projectUnreadCount > 0 && (
					<div className="flex items-center gap-1.5 rounded-lg border border-connexio-accent/20 bg-connexio-accent/10 px-2 py-1 font-medium text-connexio-accent">
						<Bell size={12} />
						<span>{projectUnreadCount} new</span>
					</div>
				)}

				{/* Version */}
				{appVersion && (
					<button
						onClick={handleOpenSettings}
						className="connexio-pill rounded-lg px-2 py-1 text-connexio-text-muted transition-colors hover:text-connexio-text-secondary"
						title="Open settings"
						type="button"
					>
						v{appVersion}
					</button>
				)}
			</div>
		</div>
	);
}
