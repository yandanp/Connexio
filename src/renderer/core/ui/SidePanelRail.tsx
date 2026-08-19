import { PanelRight, type LucideIcon } from "lucide-react";
import { useSettingsStore } from "../../core/stores/settingsStore";

interface RailItem<T extends string> {
	id: T;
	label: string;
	icon: LucideIcon;
	badge?: string | number | boolean;
}

interface SidePanelRailProps<T extends string> {
	items: RailItem<T>[];
	activeId: T;
	onSelect: (id: T) => void;
	onClose: () => void;
	closeIcon: LucideIcon;
}

export default function SidePanelRail<T extends string>({
	items,
	activeId,
	onSelect,
	onClose,
	closeIcon: CloseIcon,
}: SidePanelRailProps<T>) {
	const panelDockMode = useSettingsStore((s) => s.settings?.panelDockMode ?? false);
	const toggleDockMode = () => {
		const current = useSettingsStore.getState().settings;
		if (current) {
			useSettingsStore.getState().updateSettings({ ...current, panelDockMode: !panelDockMode });
		}
	};
	return (
		<div className="flex w-14 flex-shrink-0 flex-col items-center border-l border-connexio-border bg-connexio-bg-secondary/45 py-2">
			<div className="flex flex-1 flex-col items-center gap-1">
				{items.map((item) => {
					const Icon = item.icon;
					const active = item.id === activeId;
					return (
						<button
							key={item.id}
							onClick={() => onSelect(item.id)}
							className={`group relative flex h-11 w-11 items-center justify-center rounded-xl transition-all ${
								active
									? "bg-connexio-accent/12 text-connexio-accent shadow-[inset_-2px_0_0_var(--accent-color)]"
									: "text-connexio-text-muted hover:bg-connexio-bg-tertiary hover:text-connexio-text-secondary"
							}`}
							type="button"
							title={item.label}
						>
							<Icon size={16} />
							{item.badge && (
								<span className="absolute right-1.5 top-1.5 min-h-1.5 min-w-1.5 rounded-full bg-connexio-accent px-1 text-[8px] font-bold leading-3 text-connexio-bg shadow-[0_0_8px_var(--accent-color)]">
									{typeof item.badge === "boolean" ? "" : item.badge}
								</span>
							)}
							<span className="pointer-events-none absolute right-12 z-[20] rounded-md border border-connexio-border bg-connexio-bg-secondary px-2 py-1 text-[10px] font-medium text-connexio-text opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
								{item.label}
							</span>
						</button>
					);
				})}
			</div>
			<button
				onClick={toggleDockMode}
				className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors hover:bg-connexio-bg-tertiary ${panelDockMode ? "text-connexio-accent" : "text-connexio-text-muted hover:text-connexio-text"}`}
				type="button"
				title={panelDockMode ? "Dock mode (pushes terminal)" : "Overlay mode (floats over terminal)"}
			>
				<PanelRight size={15} />
			</button>
			<button
				onClick={onClose}
				className="flex h-10 w-10 items-center justify-center rounded-xl text-connexio-text-muted transition-colors hover:bg-connexio-bg-tertiary hover:text-connexio-text"
				type="button"
				title="Hide sidebar"
			>
				<CloseIcon size={15} />
			</button>
		</div>
	);
}
