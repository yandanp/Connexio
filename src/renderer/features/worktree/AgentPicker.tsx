import { Bot, Check } from "lucide-react";
import { AGENT_OPTIONS, type AgentOption } from "./agents";

interface Props {
	agentId: string;
	onSelect: (id: string) => void;
	/** null while detection is in flight; agents not in the set are disabled. */
	installedCommands: Set<string> | null;
}

/**
 * Orca-style agent picker. Installed agents are selectable; missing ones
 * render dimmed with a "not installed" note so the list still teaches what
 * is available.
 */
export default function AgentPicker({ agentId, onSelect, installedCommands }: Props) {
	const isSelectable = (command: string) =>
		installedCommands === null || installedCommands.has(command);

	const installedCount =
		installedCommands === null
			? null
			: AGENT_OPTIONS.filter((a) => installedCommands.has(a.command)).length;

	const renderCard = (
		key: string,
		selected: boolean,
		selectable: boolean,
		icon: React.ReactNode,
		label: string,
		hint: string,
		title: string,
	) => (
		<button
			key={key}
			type="button"
			disabled={!selectable}
			onClick={() => onSelect(key)}
			title={title}
			className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${
				selected
					? "border-connexio-accent bg-connexio-accent/10"
					: selectable
						? "border-connexio-border hover:border-connexio-accent/40"
						: "border-connexio-border/40 opacity-40 cursor-not-allowed"
			}`}
		>
			{icon}
			<span className="min-w-0 flex-1">
				<span
					className={`block truncate text-[11px] font-medium ${
						selected ? "text-connexio-accent" : "text-connexio-text-secondary"
					}`}
				>
					{label}
				</span>
				<span className="block truncate text-[9px] text-connexio-text-muted">{hint}</span>
			</span>
			{selected && <Check size={12} className="flex-shrink-0 text-connexio-accent" />}
		</button>
	);

	const agentIcon = (agent: AgentOption, selected: boolean) => (
		<Bot size={13} className={selected ? "text-connexio-accent" : "text-connexio-text-muted"} />
	);

	return (
		<div>
			<span className="block text-xs font-medium text-connexio-text-secondary mb-1.5">
				Agent{" "}
				<span className="text-connexio-text-muted">
					({installedCount === null ? "detecting…" : `${installedCount} installed`})
				</span>
			</span>
			<div className="grid grid-cols-2 gap-1.5">
				{renderCard(
					"none",
					agentId === "none",
					true,
					<span className="text-xs">💤</span>,
					"None (terminal only)",
					"Just a shell",
					"No agent",
				)}
				{AGENT_OPTIONS.map((agent) => {
					const selected = agentId === agent.id;
					const selectable = isSelectable(agent.command);
					return renderCard(
						agent.id,
						selected,
						selectable,
						agentIcon(agent, selected),
						agent.label,
						selectable ? agent.hint : "not installed",
						selectable ? agent.command : `${agent.command} is not installed`,
					);
				})}
			</div>
		</div>
	);
}
