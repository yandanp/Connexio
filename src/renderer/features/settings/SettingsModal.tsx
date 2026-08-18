import { Activity, Bell, Globe, Monitor, Palette, Rocket, Terminal, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { AppSettings } from "../../../shared/types";
import { useSettingsStore } from "../../core/stores/settingsStore";
import { useThemeStore } from "../../core/stores/themeStore";
import { RemoteAccessSettings } from "../remote";
import AboutSettings from "./AboutSettings";
import AppearanceSettings from "./AppearanceSettings";
import GeneralSettings from "./GeneralSettings";
import NotificationsSettings from "./NotificationsSettings";
import PerformanceSettings from "./PerformanceSettings";
import TerminalSettings from "./TerminalSettings";

type SettingsTab =
	| "general"
	| "terminal"
	| "appearance"
	| "notifications"
	| "remote"
	| "performance"
	| "about";

const DEFAULT_SETTINGS: AppSettings = {
	defaultShell: "",
	fontSize: 13,
	fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace",
	cursorStyle: "bar",
	cursorBlink: false,
	scrollback: 1000,
	copyOnSelect: false,
	worktreeDir: "",
	webglRenderer: true,
	uiFontSize: "default",
};

export default function SettingsModal() {
	const { settings, shells, loadSettings, loadShells, updateSettings, closeSettings } =
		useSettingsStore();
	const { themes, currentTheme, setTheme } = useThemeStore();

	const [activeTab, setActiveTab] = useState<SettingsTab>("general");
	const [localSettings, setLocalSettings] = useState<AppSettings | null>(null);
	const [isDirty, setIsDirty] = useState(false);

	useEffect(() => {
		loadSettings();
		loadShells();
	}, []);

	// Sync local state when settings load from backend
	useEffect(() => {
		if (settings && !localSettings) {
			setLocalSettings({ ...settings });
		}
	}, [settings, localSettings]);

	const handleChange = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
		const current = localSettings || DEFAULT_SETTINGS;
		setLocalSettings({ ...current, [key]: value });
		setIsDirty(true);
	};

	const handleSave = async () => {
		if (!localSettings) return;
		await updateSettings(localSettings);
		setIsDirty(false);
	};

	const handleClose = () => {
		if (isDirty && localSettings) {
			updateSettings(localSettings);
		}
		closeSettings();
	};

	// Use local settings or fallback to defaults while loading
	const effectiveSettings = localSettings || settings || DEFAULT_SETTINGS;

	const tabs: Array<{
		id: SettingsTab;
		label: string;
		icon: React.ReactNode;
	}> = [
		{ id: "general", label: "General", icon: <Monitor size={14} /> },
		{ id: "terminal", label: "Terminal", icon: <Terminal size={14} /> },
		{ id: "appearance", label: "Appearance", icon: <Palette size={14} /> },
		{ id: "notifications", label: "Notifications", icon: <Bell size={14} /> },
		{ id: "remote", label: "Remote Access", icon: <Globe size={14} /> },
		{ id: "performance", label: "Performance", icon: <Activity size={14} /> },
		{ id: "about", label: "About", icon: <Rocket size={14} /> },
	];

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-md">
			<div className="glass-panel animate-fade-scale flex max-h-[560px] w-[680px] flex-col overflow-hidden rounded-2xl shadow-[0_28px_90px_rgba(0,0,0,0.42)]">
				{/* Header */}
				<div className="flex items-center justify-between px-4 py-3 soft-separator-bottom">
					<h2 className="text-sm font-semibold text-connexio-text">Settings</h2>
					<button onClick={handleClose} className="dock-button p-1" type="button">
						<X size={14} className="text-connexio-text-secondary" />
					</button>
				</div>

				<div className="flex flex-1 overflow-hidden">
					{/* Sidebar tabs */}
					<div className="w-44 space-y-1 px-2 py-2 soft-separator-right">
						{tabs.map((tab) => (
							<button
								key={tab.id}
								onClick={() => setActiveTab(tab.id)}
								className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
									activeTab === tab.id
										? "bg-connexio-accent/10 text-connexio-accent shadow-[inset_2px_0_0_var(--accent-color)]"
										: "text-connexio-text-secondary hover:bg-white/[0.04]"
								}`}
								type="button"
							>
								{tab.icon}
								{tab.label}
							</button>
						))}
					</div>

					{/* Content */}
					<div className="flex-1 space-y-4 overflow-y-auto p-5">
						{activeTab === "general" && (
							<GeneralSettings
								settings={effectiveSettings}
								shells={shells}
								onChange={handleChange}
							/>
						)}
						{activeTab === "terminal" && (
							<TerminalSettings settings={effectiveSettings} onChange={handleChange} />
						)}
						{activeTab === "appearance" && (
							<AppearanceSettings
								themes={themes}
								currentThemeId={currentTheme?.id || ""}
								onThemeChange={setTheme}
								settings={effectiveSettings}
								onChange={handleChange}
							/>
						)}
						{activeTab === "notifications" && <NotificationsSettings />}
						{activeTab === "remote" && <RemoteAccessSettings />}
						{activeTab === "performance" && <PerformanceSettings />}
						{activeTab === "about" && <AboutSettings />}
					</div>
				</div>

				{/* Footer */}
				{isDirty && (
					<div className="flex items-center justify-end px-4 py-3 soft-separator-top">
						<button
							onClick={handleSave}
							className="px-4 py-1.5 text-xs font-medium text-white bg-connexio-accent rounded hover:bg-connexio-accent-hover transition-colors"
							type="button"
						>
							Save Changes
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
