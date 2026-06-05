import type { LucideIcon } from "lucide-react";

interface SidePanelHeaderAction {
	label: string;
	onClick: () => void;
	icon: LucideIcon;
}

interface SidePanelHeaderProps {
	icon: LucideIcon;
	title: string;
	subtitle?: string;
	actions?: SidePanelHeaderAction[];
}

export default function SidePanelHeader({ icon: Icon, title, subtitle, actions = [] }: SidePanelHeaderProps) {
	return (
		<div className="flex flex-shrink-0 items-center gap-3 border-b border-connexio-border bg-connexio-bg-secondary/45 px-4 py-3">
			<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-connexio-accent/10 text-connexio-accent ring-1 ring-connexio-accent/15">
				<Icon size={16} />
			</div>
			<div className="min-w-0 flex-1">
				<div className="truncate text-sm font-semibold text-connexio-text">{title}</div>
				{subtitle && <div className="truncate text-[11px] text-connexio-text-muted">{subtitle}</div>}
			</div>
			{actions.length > 0 && (
				<div className="flex items-center gap-1">
					{actions.map((action) => {
						const ActionIcon = action.icon;
						return (
							<button
								key={action.label}
								onClick={action.onClick}
								className="rounded-md p-1.5 text-connexio-text-muted transition-colors hover:bg-connexio-bg-tertiary hover:text-connexio-text"
								type="button"
								title={action.label}
							>
								<ActionIcon size={14} />
							</button>
						);
					})}
				</div>
			)}
		</div>
	);
}
