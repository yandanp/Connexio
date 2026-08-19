import { FolderTree, ListTodo, Monitor, Settings, Terminal, X } from "lucide-react";
import { useState } from "react";
import { useSettingsStore } from "../../core/stores/settingsStore";
import RemoteConnectionBadge from "./RemoteConnectionBadge";
import RemotePowerControls from "./RemotePowerControls";
import { Sidebar } from "../projects";

interface Props {
	children: React.ReactNode;
}

type Drawer = "projects" | null;

export default function RemoteMobileShell({ children }: Props) {
	const [drawer, setDrawer] = useState<Drawer>(null);
	const openSettings = useSettingsStore((s) => s.openSettings);

	const openTasks = () => {
		window.dispatchEvent(new CustomEvent("connexio:open-panel", { detail: "tasks" }));
	};

	const focusTerminal = () => {
		window.dispatchEvent(new CustomEvent("connexio:open-panel", { detail: "close" }));
	};

	return (
		<div className="flex h-[100dvh] w-screen flex-col overflow-hidden bg-connexio-bg">
			<header className="flex h-11 flex-shrink-0 items-center justify-between border-b border-connexio-border bg-connexio-bg-secondary px-3">
				<div className="flex items-center gap-2">
					<Monitor size={15} className="text-connexio-accent" />
					<span className="text-xs font-semibold text-connexio-text">Connexio Remote</span>
				</div>
				<div className="flex items-center gap-2">
					<RemoteConnectionBadge />
					<RemotePowerControls />
				</div>
			</header>

			<main className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>

			<nav className="grid h-14 flex-shrink-0 grid-cols-4 border-t border-connexio-border bg-connexio-bg-secondary pb-[env(safe-area-inset-bottom)]">
				<button
					onClick={() => setDrawer("projects")}
					className="flex flex-col items-center justify-center gap-0.5 text-[10px] text-connexio-text-secondary active:bg-connexio-bg-tertiary"
					type="button"
				>
					<FolderTree size={16} />
					Projects
				</button>
				<button
					onClick={focusTerminal}
					className="flex flex-col items-center justify-center gap-0.5 text-[10px] text-connexio-text-secondary active:bg-connexio-bg-tertiary"
					type="button"
				>
					<Terminal size={16} />
					Terminal
				</button>
				<button
					onClick={openTasks}
					className="flex flex-col items-center justify-center gap-0.5 text-[10px] text-connexio-text-secondary active:bg-connexio-bg-tertiary"
					type="button"
				>
					<ListTodo size={16} />
					Tasks
				</button>
				<button
					onClick={openSettings}
					className="flex flex-col items-center justify-center gap-0.5 text-[10px] text-connexio-text-secondary active:bg-connexio-bg-tertiary"
					type="button"
				>
					<Settings size={16} />
					Settings
				</button>
			</nav>

			{drawer === "projects" && (
				<div className="fixed inset-0 z-40 bg-black/50" onClick={() => setDrawer(null)}>
					<div
						className="absolute bottom-0 left-0 right-0 max-h-[75dvh] overflow-hidden rounded-t-2xl border border-connexio-border bg-connexio-bg-secondary shadow-2xl"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="flex items-center justify-between border-b border-connexio-border px-3 py-2">
							<span className="text-xs font-semibold text-connexio-text">Projects</span>
							<button
								onClick={() => setDrawer(null)}
								className="rounded p-1 hover:bg-connexio-bg-tertiary"
								type="button"
							>
								<X size={14} className="text-connexio-text-secondary" />
							</button>
						</div>
						<div className="h-[65dvh] overflow-hidden">
							<Sidebar />
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
