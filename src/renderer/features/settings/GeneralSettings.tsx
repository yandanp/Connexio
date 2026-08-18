import { open } from "@tauri-apps/plugin-dialog";
import type { AppSettings, ShellInfo } from "../../../shared/types";
import { useSettingsStore } from "../../core/stores/settingsStore";
import SettingsCard from "../../core/ui/SettingsCard";
import ToggleSwitch from "../../core/ui/ToggleSwitch";

export default function GeneralSettings({
	settings,
	shells,
	onChange,
}: {
	settings: AppSettings;
	shells: ShellInfo[];
	onChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}) {
	return (
		<SettingsCard title="General" description="Default behavior for new workspaces and terminals.">
			{/* Default Shell */}
			<div>
				<label className="block text-xs font-medium text-connexio-text-secondary mb-1.5">
					Default Shell
				</label>
				<select
					value={settings.defaultShell}
					onChange={(e) => onChange("defaultShell", e.target.value)}
					className="field-soft w-full px-3 py-2 text-sm transition-colors appearance-none cursor-pointer"
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

			{/* Worktree Directory */}
			<div>
				<label className="block text-xs font-medium text-connexio-text-secondary mb-1.5">
					Worktree Directory
				</label>
				<div className="flex gap-1.5">
					<input
						value={settings.worktreeDir}
						onChange={(e) => onChange("worktreeDir", e.target.value)}
						placeholder="Default: <project>/.worktrees"
						className="field-soft flex-1 px-3 py-2 text-sm transition-colors"
					/>
					<button
						type="button"
						onClick={async () => {
							const picked = await open({ directory: true, multiple: false });
							if (typeof picked === "string") onChange("worktreeDir", picked);
						}}
						className="px-3 py-2 text-xs font-medium text-connexio-text-secondary border border-connexio-border rounded-lg hover:bg-white/[0.04] transition-colors flex-shrink-0"
					>
						Browse…
					</button>
				</div>
				<p className="text-[10px] text-connexio-text-muted mt-1">
					Where new worktrees are created. Empty keeps them inside each project (
					<span className="font-mono">.worktrees</span>); setting a folder stores them centrally
					under <span className="font-mono">&lt;folder&gt;/&lt;project-name&gt;</span> so the
					original repo stays untouched.
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
		</SettingsCard>
	);
}

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
			<ToggleSwitch checked={discordPresence} onChange={(v) => setDiscordPresence(v)} />
		</div>
	);
}
