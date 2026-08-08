import type { AppSettings, AppTheme } from "../../../shared/types";
import SettingsCard from "../../core/ui/SettingsCard";

export default function AppearanceSettings({
	themes,
	currentThemeId,
	onThemeChange,
	settings,
	onChange,
}: {
	themes: AppTheme[];
	currentThemeId: string;
	onThemeChange: (themeId: string) => void;
	settings: AppSettings;
	onChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}) {
	return (
		<SettingsCard
			title="Appearance"
			description="Control the visual density and theme of Connexio."
		>
			{/* UI Font Size */}
			<div>
				<label className="block text-xs font-medium text-connexio-text-secondary mb-1.5">
					UI Font Size
				</label>
				<div className="flex gap-2">
					{(["small", "default", "large"] as const).map((size) => (
						<button
							key={size}
							onClick={() => onChange("uiFontSize", size)}
							className={`flex-1 px-3 py-2 text-xs rounded-lg transition-colors capitalize ${
								(settings.uiFontSize || "default") === size
									? "bg-connexio-accent/10 text-connexio-accent shadow-[inset_2px_0_0_var(--accent-color)]"
									: "soft-card text-connexio-text-secondary hover:bg-white/[0.045]"
							}`}
							type="button"
						>
							{size}
						</button>
					))}
				</div>
				<p className="text-[10px] text-connexio-text-muted mt-1">
					Adjusts text size across sidebars, panels, and tabs
				</p>
			</div>

			{/* Theme */}
			<div>
				<label className="block text-xs font-medium text-connexio-text-secondary mb-2">Theme</label>
				<div className="grid grid-cols-1 gap-2">
					{themes.map((theme) => (
						<button
							key={theme.id}
							onClick={() => onThemeChange(theme.id)}
							className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
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
								<p className="text-xs text-connexio-text font-medium">{theme.name}</p>
								<p className="text-[10px] text-connexio-text-muted capitalize">{theme.type}</p>
							</div>
							{currentThemeId === theme.id && (
								<div className="w-2 h-2 rounded-full bg-connexio-accent" />
							)}
						</button>
					))}
				</div>
			</div>
		</SettingsCard>
	);
}
