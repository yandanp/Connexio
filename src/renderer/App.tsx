import { useEffect, useState } from "react";
import AppFooter from "./components/AppFooter";
import CommandPalette from "./components/CommandPalette";
import KeyboardShortcutsModal from "./components/KeyboardShortcutsModal";
import NotificationToast from "./components/NotificationToast";
import RemoteLoginGate from "./components/RemoteLoginGate";
import RemoteMobileShell from "./components/RemoteMobileShell";
import SettingsModal from "./components/SettingsModal";
import Sidebar from "./components/Sidebar";
import TitleBar from "./components/TitleBar";
import UpdateNotification from "./components/UpdateNotification";
import WelcomeScreen from "./components/WelcomeScreen";
import Workspace from "./components/Workspace";

import { useDiscordPresence } from "./hooks/useDiscordPresence";
import { isRemoteMode } from "./lib/tauri-shim";
import { useNotificationStore } from "./stores/notificationStore";
import { useProjectStore } from "./stores/projectStore";
import { useSettingsStore } from "./stores/settingsStore";
import { useThemeStore } from "./stores/themeStore";

const UI_FONT_SIZE_MAP = {
	small: "11px",
	default: "13px",
	large: "15px",
} as const;

function useIsRemoteMobile() {
	return isRemoteMode() && window.matchMedia("(max-width: 768px)").matches;
}

export default function App() {
	const { loadProjects, activeProjectId, restoreWorkspace } = useProjectStore();
	const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
	const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
	const [showStartPage, setShowStartPage] = useState(false);
	const { loadTheme, loadThemes } = useThemeStore();
	const { isSettingsOpen, settings, loadSettings, loadShells, discordPresence } = useSettingsStore();
	const {
		loadNotifications,
		loadSettings: loadNotifSettings,
		handleIncoming,
		navigateToNotification,
	} = useNotificationStore();

	// Discord Rich Presence
	useDiscordPresence(discordPresence);

	// Apply UI font size CSS variable
	useEffect(() => {
		const size = settings?.uiFontSize || "default";
		document.documentElement.style.setProperty("--ui-font-size", UI_FONT_SIZE_MAP[size]);
		document.documentElement.setAttribute("data-ui-size", size);
	}, [settings?.uiFontSize]);

	useEffect(() => {
		let mounted = true;
		const init = async () => {
			if (!mounted) return;
			await loadProjects();
			if (!mounted) return;
			await restoreWorkspace();
			loadTheme();
			loadThemes();
			loadSettings();
			loadShells();
			loadNotifications();
			loadNotifSettings();
		};
		init();
		return () => { mounted = false; };
	}, []);

	// Prevent default browser behavior for file drops (navigating away).
	// With Tauri's dragDropEnabled: false, HTML5 DnD works but we still
	// need to prevent the browser from navigating when files are dropped
	// outside designated drop zones.
	useEffect(() => {
		const preventDefaultDrop = (e: DragEvent) => {
			// Allow drops on designated file drop zones
			const target = e.target as HTMLElement;
			if (target.closest("[data-file-drop-zone]")) return;
			// Prevent browser from navigating to dropped file
			e.preventDefault();
		};
		document.addEventListener("dragover", preventDefaultDrop);
		document.addEventListener("drop", preventDefaultDrop);
		return () => {
			document.removeEventListener("dragover", preventDefaultDrop);
			document.removeEventListener("drop", preventDefaultDrop);
		};
	}, []);

	// Disable default context menu globally (Tauri/WebView2 "Inspect Element" etc.)
	// Custom context menus are handled by individual components.
	useEffect(() => {
		const handleContextMenu = (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			// Allow default context menu on input/textarea for copy/paste
			if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
			// Allow if a component already handles it (terminal, etc.)
			if (target.closest("[data-custom-context-menu]")) return;
			e.preventDefault();
		};
		document.addEventListener("contextmenu", handleContextMenu);
		return () => document.removeEventListener("contextmenu", handleContextMenu);
	}, []);

	useEffect(() => {
		if (activeProjectId) setShowStartPage(false);
	}, [activeProjectId]);

	useEffect(() => {
		const unsubscribe = window.connexio.terminal.onExit((terminalId) => {
			useProjectStore.getState().markTerminalExited(terminalId);
		});
		return unsubscribe;
	}, []);

	useEffect(() => {
		const handleOpenShortcuts = () => setIsShortcutsOpen(true);
		const handleOpenStartPage = () => setShowStartPage(true);
		window.addEventListener("connexio:open-shortcuts", handleOpenShortcuts);
		window.addEventListener("connexio:open-start-page", handleOpenStartPage);
		return () => {
			window.removeEventListener("connexio:open-shortcuts", handleOpenShortcuts);
			window.removeEventListener("connexio:open-start-page", handleOpenStartPage);
		};
	}, []);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement;
			const isEditable = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
			const isTerminalTarget = Boolean(target.closest(".xterm, .terminal-container"));
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
				if (isTerminalTarget) return;
				e.preventDefault();
				setIsCommandPaletteOpen((open) => !open);
				return;
			}
			if ((e.ctrlKey || e.metaKey) && e.key === "/") {
				e.preventDefault();
				setIsShortcutsOpen((open) => !open);
				return;
			}
			if (e.key === "Escape" && !isEditable) {
				setIsCommandPaletteOpen(false);
				setIsShortcutsOpen(false);
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);

	// Listen for real-time notifications from main process
	useEffect(() => {
		const unsubscribe = window.connexio.notification.onReceived(handleIncoming);
		return unsubscribe;
	}, [handleIncoming]);

	// Navigate when native OS notification is clicked
	useEffect(() => {
		const unsubscribe = window.connexio.notification.onNavigate(
			navigateToNotification,
		);
		return unsubscribe;
	}, [navigateToNotification]);

	// Flush workspace state on app close so position is always saved
	useEffect(() => {
		const handleBeforeUnload = () => {
			useProjectStore.getState().flushPersistWorkspace();
		};
		const handleVisibilityChange = () => {
			if (document.visibilityState === "hidden") {
				useProjectStore.getState().flushPersistWorkspace();
			}
		};
		window.addEventListener("beforeunload", handleBeforeUnload);
		document.addEventListener("visibilitychange", handleVisibilityChange);
		return () => {
			window.removeEventListener("beforeunload", handleBeforeUnload);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, []);

	const remoteMobile = useIsRemoteMobile();
	const mainContent = activeProjectId && !showStartPage
		? <Workspace />
		: (
			<WelcomeScreen
				canClose={Boolean(activeProjectId && showStartPage)}
				onClose={() => setShowStartPage(false)}
				onProjectSelected={() => setShowStartPage(false)}
			/>
		);

	return (
		<RemoteLoginGate>
			{remoteMobile ? (
				<RemoteMobileShell>
					{mainContent}
					{isSettingsOpen && <SettingsModal />}
					<NotificationToast />
				</RemoteMobileShell>
			) : (
				<div className="flex flex-col h-screen w-screen bg-connexio-bg text-connexio-text">
					<div className="pointer-events-none fixed inset-0 opacity-70 [background:radial-gradient(circle_at_12%_0%,rgba(56,189,248,0.08),transparent_28%),radial-gradient(circle_at_88%_12%,rgba(139,92,246,0.07),transparent_26%)]" />
					{!isRemoteMode() && <TitleBar />}
					<div className="relative flex flex-1 overflow-hidden">
						<Sidebar />
						<div className="flex flex-col flex-1 overflow-hidden">
							{mainContent}
						</div>
					</div>
					<AppFooter />

					<CommandPalette
						open={isCommandPaletteOpen}
						onClose={() => setIsCommandPaletteOpen(false)}
					/>
					<KeyboardShortcutsModal
						open={isShortcutsOpen}
						onClose={() => setIsShortcutsOpen(false)}
					/>

					{/* Settings Modal */}
					{isSettingsOpen && <SettingsModal />}

					{/* Auto-update notification (desktop only) */}
					{!isRemoteMode() && <UpdateNotification />}

					{/* Notification toast */}
					<NotificationToast />
				</div>
			)}
		</RemoteLoginGate>
	);
}
