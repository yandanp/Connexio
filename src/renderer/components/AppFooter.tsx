import {
	AlertCircle,
	ArrowDown,
	ArrowUp,
	Bell,
	GitBranch,
	Terminal,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GitStatus } from "../../shared/types";
import { useNotificationStore } from "../stores/notificationStore";
import { useProjectStore } from "../stores/projectStore";
import { useSettingsStore } from "../stores/settingsStore";

export default function AppFooter() {
	const {
		projects,
		activeProjectId,
		workspaceTabs,
		activeTabIds,
		sidebarCollapsed,
	} = useProjectStore();
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
	const activeTabId = activeProjectId
		? activeTabIds[activeProjectId] || null
		: null;
	const activeTab = tabs.find((t) => t.id === activeTabId);

	// Git summary
	const changesCount = gitStatus
		? gitStatus.modified + gitStatus.staged + gitStatus.untracked
		: 0;

	// Sidebar width to match
	const sidebarWidth = sidebarCollapsed ? "w-12" : "w-64";

	return (
		<div className="flex items-stretch h-[32px] bg-connexio-bg-secondary border-t border-connexio-border text-[12px] select-none">
			{/* Left section — matches sidebar width */}
			<div
				className={`${sidebarWidth} flex-shrink-0 flex items-center px-3 border-r border-connexio-border`}
			>
				{project && (
					<button
						onClick={handleCopyPath}
						className="flex items-center gap-2 hover:text-connexio-accent transition-colors truncate w-full"
						title={pathCopied ? "Path copied!" : `Click to copy: ${project.path}`}
						type="button"
					>
						<span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
						<span className="truncate font-medium text-connexio-text-secondary">
							{pathCopied ? "Copied!" : project.name}
						</span>
					</button>
				)}
			</div>

			{/* Right section — matches workspace area */}
			<div className="flex-1 flex items-center px-3 gap-3">
				{/* Git segment — click to open source panel */}
				{gitStatus?.isRepo && (
					<button
						onClick={handleGitClick}
						className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-connexio-bg-tertiary hover:bg-connexio-accent/10 transition-colors cursor-pointer"
						title="Open Source Control"
						type="button"
					>
						<GitBranch size={12} className="text-connexio-accent flex-shrink-0" />
						<span className="font-medium text-connexio-text-secondary">
							{gitStatus.branch}
						</span>
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
						className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-connexio-bg-tertiary hover:bg-connexio-accent/10 transition-colors cursor-pointer text-connexio-text-muted"
						title="Focus terminal"
						type="button"
					>
						<Terminal size={12} className="flex-shrink-0" />
						<span className="truncate max-w-[140px]">{activeTab.label}</span>
						{tabs.length > 1 && (
							<span className="text-connexio-text-muted/60">
								· {tabs.length} tabs
							</span>
						)}
					</button>
				)}

				{/* Spacer */}
				<div className="flex-1" />

				{/* Notifications for this project */}
				{projectUnreadCount > 0 && (
					<div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-connexio-accent/10 text-connexio-accent font-medium">
						<Bell size={12} />
						<span>{projectUnreadCount} new</span>
					</div>
				)}

				{/* Version */}
				{appVersion && (
					<button
						onClick={handleOpenSettings}
						className="px-2 py-0.5 rounded bg-connexio-bg-tertiary text-connexio-text-muted hover:text-connexio-text-secondary transition-colors"
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
