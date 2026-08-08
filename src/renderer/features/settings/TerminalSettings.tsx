import type { AppSettings } from "../../../shared/types";
import SettingsCard from "../../core/ui/SettingsCard";
import ToggleSwitch from "../../core/ui/ToggleSwitch";

const MIN_SCROLLBACK = 500;
const MAX_SCROLLBACK = 2000;

function clampScrollback(value: number): number {
	return Math.min(MAX_SCROLLBACK, Math.max(MIN_SCROLLBACK, value));
}

export default function TerminalSettings({
	settings,
	onChange,
}: {
	settings: AppSettings;
	onChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}) {
	return (
		<SettingsCard title="Terminal" description="Tune rendering, cursor, font, and scrollback.">
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
					<span className="text-xs text-connexio-text w-8 text-right">{settings.fontSize}px</span>
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
					className="field-soft w-full px-3 py-2 text-sm transition-colors"
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
							className={`px-3 py-1.5 text-xs rounded-lg transition-colors capitalize ${
								settings.cursorStyle === style
									? "bg-connexio-accent/10 text-connexio-accent shadow-[inset_2px_0_0_var(--accent-color)]"
									: "soft-card text-connexio-text-secondary hover:bg-white/[0.045]"
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
				<ToggleSwitch checked={settings.cursorBlink} onChange={(v) => onChange("cursorBlink", v)} />
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
						onChange={(e) => onChange("scrollback", clampScrollback(Number(e.target.value)))}
						className="flex-1 accent-[var(--accent-color)]"
					/>
					<span className="text-xs text-connexio-text w-14 text-right">
						{clampScrollback(settings.scrollback).toLocaleString()}
					</span>
				</div>
			</div>
		</SettingsCard>
	);
}
