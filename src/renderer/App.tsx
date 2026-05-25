import { useEffect } from "react";
import AppFooter from "./components/AppFooter";
import NotificationToast from "./components/NotificationToast";
import SettingsModal from "./components/SettingsModal";
import Sidebar from "./components/Sidebar";
import TitleBar from "./components/TitleBar";
import UpdateNotification from "./components/UpdateNotification";
import WelcomeScreen from "./components/WelcomeScreen";
import Workspace from "./components/Workspace";

import { useDiscordPresence } from "./hooks/useDiscordPresence";
import { useNotificationStore } from "./stores/notificationStore";
import { useProjectStore } from "./stores/projectStore";
import { useSettingsStore } from "./stores/settingsStore";
import { useThemeStore } from "./stores/themeStore";

export default function App() {
	const { loadProjects, activeProjectId, restoreWorkspace } = useProjectStore();
	const { loadTheme, loadThemes } = useThemeStore();
	const { isSettingsOpen, loadSettings, loadShells, discordPresence } = useSettingsStore();
	const {
		loadNotifications,
		loadSettings: loadNotifSettings,
		handleIncoming,
		navigateToNotification,
	} = useNotificationStore();

	// Discord Rich Presence
	useDiscordPresence(discordPresence);

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

	return (
		<div className="flex flex-col h-screen w-screen bg-connexio-bg">
			<TitleBar />
			<div className="flex flex-1 overflow-hidden">
				<Sidebar />
				<div className="flex flex-col flex-1 overflow-hidden">
					{activeProjectId ? <Workspace /> : <WelcomeScreen />}
				</div>
			</div>
			<AppFooter />

			{/* Settings Modal */}
			{isSettingsOpen && <SettingsModal />}

			{/* Auto-update notification */}
			<UpdateNotification />

			{/* Notification toast */}
			<NotificationToast />
		</div>
	);
}
