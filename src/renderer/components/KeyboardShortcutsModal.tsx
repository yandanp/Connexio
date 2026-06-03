import { X } from "lucide-react";

interface Props {
	open: boolean;
	onClose: () => void;
}

const shortcutGroups = [
	{
		title: "Global",
		items: [
			["Command Palette", "Ctrl/Cmd K"],
			["Keyboard Shortcuts", "Ctrl/Cmd /"],
			["Open Settings", "From palette"],
		],
	},
	{
		title: "Terminal",
		items: [
			["New Terminal Tab", "Ctrl T"],
			["Close Current Tab", "Ctrl W"],
			["Split Right", "Ctrl Shift D"],
			["Split Down", "Ctrl Shift E"],
		],
	},
	{
		title: "Navigation",
		items: [
			["Next Tab", "Ctrl Tab"],
			["Previous Tab", "Ctrl Shift Tab"],
			["Toggle Side Panel", "Ctrl `"],
			["Search Files", "Ctrl Shift F"],
		],
	},
	{
		title: "Editing",
		items: [
			["Rename Tab", "F2"],
			["Confirm Inline Edit", "Enter"],
			["Cancel Inline Edit", "Esc"],
		],
	},
];

export default function KeyboardShortcutsModal({ open, onClose }: Props) {
	if (!open) return null;

	return (
		<div
			className="fixed inset-0 z-[390] flex items-center justify-center bg-black/55 p-6 backdrop-blur-md"
			onMouseDown={onClose}
		>
			<div
				className="glass-panel animate-fade-scale w-[min(760px,calc(100vw-2rem))] overflow-hidden rounded-2xl shadow-[0_28px_90px_rgba(0,0,0,0.46)]"
				onMouseDown={(event) => event.stopPropagation()}
			>
				<div className="flex items-center justify-between px-5 py-4 soft-separator-bottom">
					<div>
						<h2 className="text-sm font-semibold text-connexio-text">Keyboard Shortcuts</h2>
						<p className="mt-0.5 text-xs text-connexio-text-muted">Move faster through projects, terminals, and panels.</p>
					</div>
					<button
						onClick={onClose}
						className="dock-button p-1.5 hover:text-connexio-text"
						type="button"
					>
						<X size={16} />
					</button>
				</div>

				<div className="grid max-h-[520px] grid-cols-2 gap-3 overflow-y-auto p-4 max-md:grid-cols-1">
					{shortcutGroups.map((group) => (
						<section key={group.title} className="rounded-2xl soft-card p-3">
							<h3 className="section-label mb-2">
								{group.title}
							</h3>
							<div className="space-y-1">
								{group.items.map(([label, keys]) => (
									<div key={label} className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/[0.03]">
										<span className="text-xs text-connexio-text-secondary">{label}</span>
										<span className="rounded-lg bg-connexio-bg-tertiary/80 px-2 py-1 text-[10px] font-semibold text-connexio-text">{keys}</span>
									</div>
								))}
							</div>
						</section>
					))}
				</div>
			</div>
		</div>
	);
}
