import { Minus, Settings, Square, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useSettingsStore } from "../stores/settingsStore";
import NotificationBell from "./NotificationBell";

export default function TitleBar() {
	const { openSettings } = useSettingsStore();
	const [version, setVersion] = useState("");

	useEffect(() => {
		window.connexio.app
			.getVersion()
			.then(setVersion)
			.catch(() => {});
	}, []);

	return (
		<div className="titlebar-drag flex items-center justify-between h-9 bg-connexio-bg-secondary border-b border-connexio-border px-3 select-none">
			{/* App title */}
			<div className="flex items-center gap-2">
				<img
					src={new URL("../assets/icon.png", import.meta.url).href}
					alt="Connexio"
					className="w-4 h-4 rounded"
				/>
				<span className="text-xs font-semibold text-connexio-text-secondary">
					Connexio
				</span>
				{version && (
					<span className="text-[9px] text-connexio-text-muted opacity-60">
						v{version}
					</span>
				)}
			</div>

			{/* Window controls */}
			<div className="titlebar-no-drag flex items-center gap-0.5">
				<NotificationBell />
				<button
					onClick={openSettings}
					className="p-1.5 rounded hover:bg-connexio-bg-tertiary transition-colors"
					title="Settings"
					type="button"
				>
					<Settings size={12} className="text-connexio-text-secondary" />
				</button>
				<button
					onClick={() => window.connexio.app.minimize()}
					className="p-1.5 rounded hover:bg-connexio-bg-tertiary transition-colors"
					type="button"
				>
					<Minus size={12} className="text-connexio-text-secondary" />
				</button>
				<button
					onClick={() => window.connexio.app.maximize()}
					className="p-1.5 rounded hover:bg-connexio-bg-tertiary transition-colors"
					type="button"
				>
					<Square size={10} className="text-connexio-text-secondary" />
				</button>
				<button
					onClick={() => window.connexio.app.close()}
					className="p-1.5 rounded hover:bg-red-500/20 transition-colors group"
					type="button"
				>
					<X
						size={12}
						className="text-connexio-text-secondary group-hover:text-red-400"
					/>
				</button>
			</div>
		</div>
	);
}
