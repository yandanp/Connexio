import { useEffect, useState } from "react";
import type { NotificationSettings } from "../../../shared/types";
import AIIntegrationsSettings from "../../components/AIIntegrationsSettings";
import SettingsCard from "../../core/ui/SettingsCard";
import ToggleSwitch from "../../core/ui/ToggleSwitch";

export default function NotificationsSettings() {
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
				soundUrl = new URL("../../assets/notification.wav", import.meta.url).href;
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
		<div className="space-y-4">
			{/* Sound Settings */}
			<SettingsCard title="Sound" description="Control notification audio and custom alert sounds.">
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
					<ToggleSwitch checked={settings?.sound ?? true} onChange={handleSoundToggle} />
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
								onChange={(e) => handleVolumeChange(Number(e.target.value) / 100)}
								className="flex-1 accent-[var(--accent-color)]"
							/>
							<span className="text-xs text-connexio-text w-8 text-right">
								{Math.round((settings?.soundVolume ?? 0.5) * 100)}%
							</span>
							<button
								onClick={handleTestSound}
								className="rounded-lg bg-white/[0.035] px-2 py-1 text-[10px] font-medium text-connexio-text-secondary transition-colors hover:bg-white/[0.055] hover:text-connexio-accent"
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
										className="rounded-lg bg-red-500/10 px-2 py-1 text-[10px] font-medium text-red-400 transition-colors hover:bg-red-500/20"
										type="button"
									>
										Remove
									</button>
								</>
							) : (
								<button
									onClick={handleUploadSound}
									className="rounded-lg bg-white/[0.035] px-2.5 py-1 text-[10px] font-medium text-connexio-text-secondary transition-colors hover:bg-white/[0.055] hover:text-connexio-accent"
									type="button"
								>
									Upload .wav / .mp3 / .ogg
								</button>
							)}
						</div>
					</div>
				)}
			</SettingsCard>

			{/* AI Integrations */}
			<AIIntegrationsSettings />
		</div>
	);
}

function useNotificationSettingsState() {
	const [settings, setSettings] = useState<NotificationSettings | null>(null);

	useEffect(() => {
		window.connexio.notification.getSettings().then(setSettings);
	}, []);

	const updateSettings = async (newSettings: NotificationSettings) => {
		const updated = await window.connexio.notification.updateSettings(newSettings);
		setSettings(updated);
	};

	return { settings, loadSettings: () => {}, updateSettings };
}
