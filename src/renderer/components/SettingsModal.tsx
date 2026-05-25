import {
	Bell,
	CheckCircle2,
	Download,
	Loader2,
	Monitor,
	Palette,
	Rocket,
	Terminal,
	X,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { AppSettings } from "../../shared/types";
import { useSettingsStore } from "../stores/settingsStore";
import { useThemeStore } from "../stores/themeStore";
import AIIntegrationsSettings from "./AIIntegrationsSettings";

type SettingsTab =
	| "general"
	| "terminal"
	| "appearance"
	| "notifications"
	| "about";

const MIN_SCROLLBACK = 500;
const MAX_SCROLLBACK = 2000;

const DEFAULT_SETTINGS: AppSettings = {
	defaultShell: "",
	fontSize: 13,
	fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace",
	cursorStyle: "bar",
	cursorBlink: false,
	scrollback: 1000,
	copyOnSelect: false,
	webglRenderer: true,
};

function clampScrollback(value: number): number {
	return Math.min(MAX_SCROLLBACK, Math.max(MIN_SCROLLBACK, value));
}

export default function SettingsModal() {
	const {
		settings,
		shells,
		loadSettings,
		loadShells,
		updateSettings,
		closeSettings,
	} = useSettingsStore();
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

	const handleChange = <K extends keyof AppSettings>(
		key: K,
		value: AppSettings[K],
	) => {
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
		{ id: "about", label: "About", icon: <Rocket size={14} /> },
	];

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
			<div className="bg-connexio-bg-secondary border border-connexio-border rounded-lg w-[600px] max-h-[500px] shadow-2xl flex flex-col">
				{/* Header */}
				<div className="flex items-center justify-between px-4 py-3 border-b border-connexio-border">
					<h2 className="text-sm font-semibold text-connexio-text">Settings</h2>
					<button
						onClick={handleClose}
						className="p-1 rounded hover:bg-connexio-bg-tertiary transition-colors"
						type="button"
					>
						<X size={14} className="text-connexio-text-secondary" />
					</button>
				</div>

				<div className="flex flex-1 overflow-hidden">
					{/* Sidebar tabs */}
					<div className="w-40 border-r border-connexio-border py-2 px-2 space-y-0.5">
						{tabs.map((tab) => (
							<button
								key={tab.id}
								onClick={() => setActiveTab(tab.id)}
								className={`w-full flex items-center gap-2 px-3 py-2 rounded text-xs font-medium transition-colors ${
									activeTab === tab.id
										? "bg-connexio-accent/10 text-connexio-accent border border-connexio-accent/30"
										: "text-connexio-text-secondary hover:bg-connexio-bg-tertiary border border-transparent"
								}`}
								type="button"
							>
								{tab.icon}
								{tab.label}
							</button>
						))}
					</div>

					{/* Content */}
					<div className="flex-1 overflow-y-auto p-4 space-y-5">
						{activeTab === "general" && (
							<GeneralSettings
								settings={effectiveSettings}
								shells={shells}
								onChange={handleChange}
							/>
						)}
						{activeTab === "terminal" && (
							<TerminalSettings
								settings={effectiveSettings}
								onChange={handleChange}
							/>
						)}
						{activeTab === "appearance" && (
							<AppearanceSettings
								themes={themes}
								currentThemeId={currentTheme?.id || ""}
								onThemeChange={setTheme}
							/>
						)}
						{activeTab === "notifications" && <NotificationsSettings />}
						{activeTab === "about" && <AboutSettings />}
					</div>
				</div>

				{/* Footer */}
				{isDirty && (
					<div className="flex items-center justify-end px-4 py-3 border-t border-connexio-border">
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

// === General Settings ===
function GeneralSettings({
	settings,
	shells,
	onChange,
}: {
	settings: AppSettings;
	shells: import("../../shared/types").ShellInfo[];
	onChange: <K extends keyof AppSettings>(
		key: K,
		value: AppSettings[K],
	) => void;
}) {
	return (
		<div className="space-y-4">
			<h3 className="text-xs font-semibold text-connexio-text-secondary uppercase tracking-wider">
				General
			</h3>

			{/* Default Shell */}
			<div>
				<label className="block text-xs font-medium text-connexio-text-secondary mb-1.5">
					Default Shell
				</label>
				<select
					value={settings.defaultShell}
					onChange={(e) => onChange("defaultShell", e.target.value)}
					className="w-full px-3 py-2 text-sm bg-connexio-bg-tertiary border border-connexio-border rounded text-connexio-text outline-none focus:border-connexio-accent transition-colors appearance-none cursor-pointer"
				>
					<option value="">System Default</option>
					{shells.map((shell) => (
						<option key={shell.id} value={shell.path}>
							{shell.name}
						</option>
					))}
				</select>
				<p className="text-[10px] text-connexio-text-muted mt-1">
					Shell used when opening new terminal tabs
				</p>
			</div>

			{/* Copy on Select */}
			<div className="flex items-center justify-between">
				<div>
					<label className="block text-xs font-medium text-connexio-text-secondary">
						Copy on Select
					</label>
					<p className="text-[10px] text-connexio-text-muted mt-0.5">
						Automatically copy selected text to clipboard
					</p>
				</div>
				<ToggleSwitch
					checked={settings.copyOnSelect}
					onChange={(v) => onChange("copyOnSelect", v)}
				/>
			</div>

			{/* WebGL Renderer */}
			<div className="flex items-center justify-between">
				<div>
					<label className="block text-xs font-medium text-connexio-text-secondary">
						WebGL Renderer
					</label>
					<p className="text-[10px] text-connexio-text-muted mt-0.5">
						Hardware-accelerated rendering (faster for large output)
					</p>
				</div>
				<ToggleSwitch
					checked={settings.webglRenderer}
					onChange={(v) => onChange("webglRenderer", v)}
				/>
			</div>

			{/* Discord Presence */}
			<DiscordPresenceToggle />
		</div>
	);
}

// === Terminal Settings ===
function TerminalSettings({
	settings,
	onChange,
}: {
	settings: AppSettings;
	onChange: <K extends keyof AppSettings>(
		key: K,
		value: AppSettings[K],
	) => void;
}) {
	return (
		<div className="space-y-4">
			<h3 className="text-xs font-semibold text-connexio-text-secondary uppercase tracking-wider">
				Terminal
			</h3>

			{/* Font Size */}
			<div>
				<label className="block text-xs font-medium text-connexio-text-secondary mb-1.5">
					Font Size
				</label>
				<div className="flex items-center gap-3">
					<input
						type="range"
						min={10}
						max={24}
						value={settings.fontSize}
						onChange={(e) => onChange("fontSize", Number(e.target.value))}
						className="flex-1 accent-[var(--accent-color)]"
					/>
					<span className="text-xs text-connexio-text w-8 text-right">
						{settings.fontSize}px
					</span>
				</div>
			</div>

			{/* Font Family */}
			<div>
				<label className="block text-xs font-medium text-connexio-text-secondary mb-1.5">
					Font Family
				</label>
				<input
					type="text"
					value={settings.fontFamily}
					onChange={(e) => onChange("fontFamily", e.target.value)}
					className="w-full px-3 py-2 text-sm bg-connexio-bg-tertiary border border-connexio-border rounded text-connexio-text outline-none focus:border-connexio-accent transition-colors"
				/>
			</div>

			{/* Cursor Style */}
			<div>
				<label className="block text-xs font-medium text-connexio-text-secondary mb-1.5">
					Cursor Style
				</label>
				<div className="flex gap-2">
					{(["bar", "block", "underline"] as const).map((style) => (
						<button
							key={style}
							onClick={() => onChange("cursorStyle", style)}
							className={`px-3 py-1.5 text-xs rounded border transition-colors capitalize ${
								settings.cursorStyle === style
									? "border-connexio-accent bg-connexio-accent/10 text-connexio-accent"
									: "border-connexio-border text-connexio-text-secondary hover:border-connexio-text-muted"
							}`}
							type="button"
						>
							{style}
						</button>
					))}
				</div>
			</div>

			{/* Cursor Blink */}
			<div className="flex items-center justify-between">
				<div>
					<label className="block text-xs font-medium text-connexio-text-secondary">
						Cursor Blink
					</label>
					<p className="text-[10px] text-connexio-text-muted mt-0.5">
						Enable blinking cursor animation
					</p>
				</div>
				<ToggleSwitch
					checked={settings.cursorBlink}
					onChange={(v) => onChange("cursorBlink", v)}
				/>
			</div>

			{/* Scrollback */}
			<div>
				<label className="block text-xs font-medium text-connexio-text-secondary mb-1.5">
					Scrollback Lines
				</label>
				<div className="flex items-center gap-3">
					<input
						type="range"
						min={MIN_SCROLLBACK}
						max={MAX_SCROLLBACK}
						step={100}
						value={clampScrollback(settings.scrollback)}
						onChange={(e) =>
							onChange("scrollback", clampScrollback(Number(e.target.value)))
						}
						className="flex-1 accent-[var(--accent-color)]"
					/>
					<span className="text-xs text-connexio-text w-14 text-right">
						{clampScrollback(settings.scrollback).toLocaleString()}
					</span>
				</div>
			</div>
		</div>
	);
}

// === Appearance Settings ===
function AppearanceSettings({
	themes,
	currentThemeId,
	onThemeChange,
}: {
	themes: import("../../shared/types").AppTheme[];
	currentThemeId: string;
	onThemeChange: (themeId: string) => void;
}) {
	return (
		<div className="space-y-4">
			<h3 className="text-xs font-semibold text-connexio-text-secondary uppercase tracking-wider">
				Appearance
			</h3>

			{/* Theme */}
			<div>
				<label className="block text-xs font-medium text-connexio-text-secondary mb-2">
					Theme
				</label>
				<div className="grid grid-cols-1 gap-2">
					{themes.map((theme) => (
						<button
							key={theme.id}
							onClick={() => onThemeChange(theme.id)}
							className={`flex items-center gap-3 px-3 py-2.5 rounded border transition-colors text-left ${
								currentThemeId === theme.id
									? "border-connexio-accent bg-connexio-accent/10"
									: "border-connexio-border hover:border-connexio-text-muted"
							}`}
							type="button"
						>
							{/* Color preview */}
							<div className="flex gap-1">
								<div
									className="w-4 h-4 rounded-sm border border-white/10"
									style={{ backgroundColor: theme.colors.bgPrimary }}
								/>
								<div
									className="w-4 h-4 rounded-sm border border-white/10"
									style={{ backgroundColor: theme.colors.accentColor }}
								/>
								<div
									className="w-4 h-4 rounded-sm border border-white/10"
									style={{ backgroundColor: theme.terminal.green }}
								/>
							</div>
							<div className="flex-1">
								<p className="text-xs text-connexio-text font-medium">
									{theme.name}
								</p>
								<p className="text-[10px] text-connexio-text-muted capitalize">
									{theme.type}
								</p>
							</div>
							{currentThemeId === theme.id && (
								<div className="w-2 h-2 rounded-full bg-connexio-accent" />
							)}
						</button>
					))}
				</div>
			</div>
		</div>
	);
}

// === About Settings (with Check for Update) ===
type UpdateCheckState =
	| "idle"
	| "checking"
	| "available"
	| "up-to-date"
	| "downloading"
	| "downloaded"
	| "error";

function AboutSettings() {
	const [version, setVersion] = useState("");
	const [updateState, setUpdateState] = useState<UpdateCheckState>("idle");
	const [updateVersion, setUpdateVersion] = useState("");
	const [downloadPercent, setDownloadPercent] = useState(0);
	const [errorMsg, setErrorMsg] = useState("");

	useEffect(() => {
		window.connexio.app
			.getVersion()
			.then(setVersion)
			.catch(() => {});

		const unsubs: Array<() => void> = [];

		unsubs.push(
			window.connexio.updater.onChecking(() => {
				setUpdateState("checking");
			}),
		);
		unsubs.push(
			window.connexio.updater.onAvailable((info) => {
				setUpdateState("available");
				setUpdateVersion(info.version);
			}),
		);
		unsubs.push(
			window.connexio.updater.onNotAvailable(() => {
				setUpdateState("up-to-date");
			}),
		);
		unsubs.push(
			window.connexio.updater.onProgress((progress) => {
				setUpdateState("downloading");
				setDownloadPercent(progress.percent);
			}),
		);
		unsubs.push(
			window.connexio.updater.onDownloaded(() => {
				setUpdateState("downloaded");
			}),
		);
		unsubs.push(
			window.connexio.updater.onError((message) => {
				setUpdateState("error");
				setErrorMsg(message);
			}),
		);

		return () => {
			for (const unsub of unsubs) unsub();
		};
	}, []);

	const handleCheckUpdate = () => {
		setUpdateState("checking");
		setErrorMsg("");
		window.connexio.updater.check();
	};

	const handleDownload = () => {
		window.connexio.updater.download();
	};

	const handleInstall = () => {
		window.connexio.updater.install();
	};

	return (
		<div className="space-y-5">
			<h3 className="text-xs font-semibold text-connexio-text-secondary uppercase tracking-wider">
				About
			</h3>

			{/* App Info */}
			<div className="flex items-center gap-3 p-3 bg-connexio-bg-tertiary rounded-lg border border-connexio-border">
				<img
					src={new URL("../assets/icon.png", import.meta.url).href}
					alt="Connexio"
					className="w-10 h-10 rounded-lg"
				/>
				<div>
					<p className="text-sm font-semibold text-connexio-text">Connexio</p>
					<p className="text-[11px] text-connexio-text-secondary">
						Project-based Terminal Manager
					</p>
					{version && (
						<p className="text-[10px] text-connexio-text-muted mt-0.5">
							Version {version}
						</p>
					)}
				</div>
			</div>

			{/* Update Section */}
			<div className="space-y-3">
				<label className="block text-xs font-medium text-connexio-text-secondary">
					Updates
				</label>

				{/* Check for Update Button */}
				{(updateState === "idle" ||
					updateState === "up-to-date" ||
					updateState === "error") && (
					<div className="space-y-2">
						<button
							onClick={handleCheckUpdate}
							className="flex items-center gap-2 px-4 py-2 text-xs font-medium bg-connexio-bg-tertiary border border-connexio-border rounded-lg hover:border-connexio-accent hover:text-connexio-accent transition-colors text-connexio-text-secondary"
							type="button"
						>
							<Download size={13} />
							Check for Updates
						</button>

						{updateState === "up-to-date" && (
							<div className="flex items-center gap-2 text-[11px] text-green-400">
								<CheckCircle2 size={13} />
								<span>You're on the latest version.</span>
							</div>
						)}

						{updateState === "error" && (
							<div className="flex items-center gap-2 text-[11px] text-red-400">
								<X size={13} />
								<span className="truncate">
									{errorMsg || "Failed to check for updates."}
								</span>
							</div>
						)}
					</div>
				)}

				{/* Checking */}
				{updateState === "checking" && (
					<div className="flex items-center gap-2 text-[11px] text-connexio-text-secondary">
						<Loader2 size={13} className="animate-spin" />
						<span>Checking for updates...</span>
					</div>
				)}

				{/* Update Available */}
				{updateState === "available" && (
					<div className="p-3 bg-connexio-bg-tertiary rounded-lg border border-connexio-accent/30 space-y-2">
						<div className="flex items-center gap-2">
							<Rocket size={13} className="text-connexio-accent" />
							<span className="text-xs font-medium text-connexio-text">
								Version {updateVersion} is available!
							</span>
						</div>
						<button
							onClick={handleDownload}
							className="flex items-center gap-2 px-4 py-1.5 text-xs font-medium text-white bg-connexio-accent rounded hover:bg-connexio-accent-hover transition-colors"
							type="button"
						>
							<Download size={12} />
							Download Update
						</button>
					</div>
				)}

				{/* Downloading */}
				{updateState === "downloading" && (
					<div className="p-3 bg-connexio-bg-tertiary rounded-lg border border-connexio-border space-y-2">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2 text-[11px] text-connexio-text-secondary">
								<Loader2 size={13} className="animate-spin" />
								<span>Downloading update...</span>
							</div>
							<span className="text-[11px] text-connexio-text-muted font-mono">
								{Math.round(downloadPercent)}%
							</span>
						</div>
						<div className="h-1.5 bg-connexio-bg rounded-full overflow-hidden">
							<div
								className="h-full bg-connexio-accent rounded-full transition-all duration-300"
								style={{ width: `${downloadPercent}%` }}
							/>
						</div>
					</div>
				)}

				{/* Downloaded */}
				{updateState === "downloaded" && (
					<div className="p-3 bg-connexio-bg-tertiary rounded-lg border border-green-500/30 space-y-2">
						<div className="flex items-center gap-2">
							<CheckCircle2 size={13} className="text-green-400" />
							<span className="text-xs font-medium text-connexio-text">
								Update downloaded. Restart to apply.
							</span>
						</div>
						<button
							onClick={handleInstall}
							className="flex items-center gap-2 px-4 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 transition-colors"
							type="button"
						>
							<Rocket size={12} />
							Restart & Update
						</button>
					</div>
				)}
			</div>

			{/* Links */}
			<div className="pt-2 border-t border-connexio-border space-y-1.5">
				<p className="text-[10px] text-connexio-text-muted">
					Made with ♥ by Connexio Team
				</p>
			</div>

			{/* Support / Donate */}
			<div className="pt-3 border-t border-connexio-border space-y-3">
				<h3 className="text-xs font-semibold text-connexio-text-secondary uppercase tracking-wider">
					Support
				</h3>
				<p className="text-[11px] text-connexio-text-muted leading-relaxed">
					Connexio is free and open source. If you find it useful, consider supporting development.
				</p>
				<div className="flex flex-col items-center gap-2 p-4 bg-connexio-bg-tertiary rounded-lg border border-connexio-border">
					<div className="bg-white p-2 rounded-md">
						<img
							src={new URL("../assets/download.png", import.meta.url).href}
							alt="Donate QR Code"
							className="w-40 h-40 rounded-sm"
						/>
					</div>
					<p className="text-[10px] text-connexio-text-muted text-center">
						Scan to donate
					</p>
				</div>
			</div>
		</div>
	);
}

// === Notifications Settings ===
function NotificationsSettings() {
	const { settings, updateSettings } = useNotificationSettingsState();

	const handleSoundToggle = (value: boolean) => {
		if (settings) {
			updateSettings({ ...settings, sound: value });
		}
	};

	const handleVolumeChange = (value: number) => {
		if (settings) {
			updateSettings({ ...settings, soundVolume: value });
		}
	};

	const handleTestSound = () => {
		try {
			let soundUrl: string;
			if (settings?.customSoundPath) {
				soundUrl = `file://${settings.customSoundPath.replace(/\\/g, "/")}`;
			} else {
				soundUrl = new URL("../assets/notification.wav", import.meta.url).href;
			}
			const audio = new Audio(soundUrl);
			audio.volume = settings?.soundVolume ?? 0.5;
			audio.play().catch(() => {});
		} catch {
			// ignore
		}
	};

	const handleUploadSound = async () => {
		const result = await window.connexio.notification.uploadSound();
		if (result.success) {
			const updated = await window.connexio.notification.getSettings();
			if (settings) {
				updateSettings(updated);
			}
		}
	};

	const handleRemoveCustomSound = async () => {
		await window.connexio.notification.removeCustomSound();
		const updated = await window.connexio.notification.getSettings();
		if (settings) {
			updateSettings(updated);
		}
	};

	return (
		<div className="space-y-5">
			{/* Sound Settings */}
			<div className="space-y-4">
				<h3 className="text-xs font-semibold text-connexio-text-secondary uppercase tracking-wider">
					Sound
				</h3>

				{/* Sound toggle */}
				<div className="flex items-center justify-between">
					<div>
						<label className="block text-xs font-medium text-connexio-text-secondary">
							Notification Sound
						</label>
						<p className="text-[10px] text-connexio-text-muted mt-0.5">
							Play sound when notification arrives
						</p>
					</div>
					<ToggleSwitch
						checked={settings?.sound ?? true}
						onChange={handleSoundToggle}
					/>
				</div>

				{/* Volume slider */}
				{settings?.sound && (
					<div>
						<label className="block text-xs font-medium text-connexio-text-secondary mb-1.5">
							Volume
						</label>
						<div className="flex items-center gap-3">
							<input
								type="range"
								min={0}
								max={100}
								value={Math.round((settings?.soundVolume ?? 0.5) * 100)}
								onChange={(e) =>
									handleVolumeChange(Number(e.target.value) / 100)
								}
								className="flex-1 accent-[var(--accent-color)]"
							/>
							<span className="text-xs text-connexio-text w-8 text-right">
								{Math.round((settings?.soundVolume ?? 0.5) * 100)}%
							</span>
							<button
								onClick={handleTestSound}
								className="px-2 py-1 text-[10px] font-medium text-connexio-text-secondary bg-connexio-bg-tertiary border border-connexio-border rounded hover:border-connexio-accent hover:text-connexio-accent transition-colors"
								type="button"
							>
								Test
							</button>
						</div>
					</div>
				)}

				{/* Custom sound upload */}
				{settings?.sound && (
					<div>
						<label className="block text-xs font-medium text-connexio-text-secondary mb-1.5">
							Custom Sound
						</label>
						<div className="flex items-center gap-2">
							{settings.customSoundPath ? (
								<>
									<span className="text-[10px] text-green-400 truncate flex-1">
										✓ Custom sound active
									</span>
									<button
										onClick={handleRemoveCustomSound}
										className="px-2 py-1 text-[10px] font-medium text-red-400 bg-red-500/10 border border-red-500/20 rounded hover:bg-red-500/20 transition-colors"
										type="button"
									>
										Remove
									</button>
								</>
							) : (
								<button
									onClick={handleUploadSound}
									className="px-2.5 py-1 text-[10px] font-medium text-connexio-text-secondary bg-connexio-bg-tertiary border border-connexio-border rounded hover:border-connexio-accent hover:text-connexio-accent transition-colors"
									type="button"
								>
									Upload .wav / .mp3 / .ogg
								</button>
							)}
						</div>
					</div>
				)}
			</div>

			{/* AI Integrations */}
			<AIIntegrationsSettings />
		</div>
	);
}

function useNotificationSettingsState() {
	const [settings, setSettings] = useState<
		import("../../shared/types").NotificationSettings | null
	>(null);

	useEffect(() => {
		window.connexio.notification.getSettings().then(setSettings);
	}, []);

	const updateSettings = async (
		newSettings: import("../../shared/types").NotificationSettings,
	) => {
		const updated =
			await window.connexio.notification.updateSettings(newSettings);
		setSettings(updated);
	};

	return { settings, loadSettings: () => {}, updateSettings };
}

// === Discord Presence Toggle ===
function DiscordPresenceToggle() {
	const { discordPresence, setDiscordPresence } = useSettingsStore();
	return (
		<div className="flex items-center justify-between">
			<div>
				<label className="block text-xs font-medium text-connexio-text-secondary">
					Discord Presence
				</label>
				<p className="text-[10px] text-connexio-text-muted mt-0.5">
					Show Connexio activity on your Discord profile
				</p>
			</div>
			<ToggleSwitch
				checked={discordPresence}
				onChange={(v) => setDiscordPresence(v)}
			/>
		</div>
	);
}

// === Toggle Switch ===
function ToggleSwitch({
	checked,
	onChange,
}: {
	checked: boolean;
	onChange: (value: boolean) => void;
}) {
	return (
		<button
			onClick={() => onChange(!checked)}
			className={`relative w-9 h-5 rounded-full transition-colors ${
				checked
					? "bg-connexio-accent"
					: "bg-connexio-bg-tertiary border border-connexio-border"
			}`}
			type="button"
		>
			<div
				className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
					checked ? "translate-x-4" : "translate-x-0.5"
				}`}
			/>
		</button>
	);
}
