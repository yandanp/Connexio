import { FolderGit2, GitBranch, Info } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import type { AppSettings } from "../../../shared/types";
import SettingsCard from "../../core/ui/SettingsCard";

export default function WorkflowSettings({
	settings,
	onChange,
}: {
	settings: AppSettings;
	onChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}) {
	return (
		<SettingsCard
			title="Workflow"
			description="Where task worktrees live and how branches are named."
		>
			{/* Worktree Directory */}
			<div>
				<label className="block text-xs font-medium text-connexio-text-secondary mb-1.5">
					<FolderGit2 className="inline mr-1 -mt-0.5" size={12} />
					Worktree Directory
				</label>
				<div className="flex gap-1.5">
					<input
						value={settings.worktreeDir}
						onChange={(e) => onChange("worktreeDir", e.target.value)}
						placeholder="Default: <user home>/.connexio/worktrees"
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
					Central workspace for all worktrees. Default is{" "}
					<span className="font-mono">&lt;user home&gt;/ .connexio/worktrees</span>. Leave empty to
					auto-create in the default location; set a folder path to override.
				</p>
			</div>

			{/* Branch prefix */}
			<div>
				<label className="block text-xs font-medium text-connexio-text-secondary mb-1.5">
					<GitBranch className="inline mr-1 -mt-0.5" size={12} />
					Branch Prefix
				</label>
				<input
					value={settings.branchPrefix}
					onChange={(e) => onChange("branchPrefix", e.target.value)}
					placeholder="connexio"
					className="field-soft w-full px-3 py-2 text-sm transition-colors"
				/>
				<p className="text-[10px] text-connexio-text-muted mt-1">
					New worktree branches are named{" "}
					<span className="font-mono">&lt;prefix&gt;/&lt;task-slug&gt;</span> (e.g.{" "}
					<span className="font-mono">connexio/login-flow</span>).
				</p>
			</div>

			{/* Default base ref */}
			<div>
				<label className="block text-xs font-medium text-connexio-text-secondary mb-1.5">
					Default Start From
				</label>
				<input
					value={settings.defaultBaseRef}
					onChange={(e) => onChange("defaultBaseRef", e.target.value)}
					placeholder="HEAD"
					className="field-soft w-full px-3 py-2 text-sm transition-colors"
				/>
				<p className="text-[10px] text-connexio-text-muted mt-1">
					Ref new worktrees start from when the picker is left at its default (branch, tag, or SHA —
					e.g. <span className="font-mono">main</span>, <span className="font-mono">develop</span>).
				</p>
			</div>

			<p className="flex items-start gap-1.5 text-[10px] text-connexio-text-muted">
				<Info size={11} className="flex-shrink-0 mt-0.5" />
				Changes apply to worktrees created after saving.
			</p>
		</SettingsCard>
	);
}
