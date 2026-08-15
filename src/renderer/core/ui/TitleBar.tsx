import { Minus, Settings, Square, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useSettingsStore } from "../stores/settingsStore";
import { NotificationBell } from "../../features/notifications";

export default function TitleBar() {
	const { openSettings } = useSettingsStore();
	const [version, setVersion] = useState("");

	useEffect(() => {
		window.connexio.app
			.getVersion()
			.then(setVersion)
			.catch(() => {});
	}, []);

	const controlClass =
		"rounded-md p-1.5 text-connexio-text-secondary transition-colors hover:bg-connexio-bg-tertiary hover:text-connexio-text";

	return (
		<div className="titlebar-drag relative z-10 flex h-10 select-none items-center justify-between bg-connexio-bg-secondary/90 px-3 soft-separator-bottom backdrop-blur-xl">
			{/* App title */}
			<div className="flex items-center gap-2.5">
				<div className="flex h-6 w-6 items-center justify-center rounded-lg bg-connexio-bg-elevated shadow-[0_0_18px_rgba(56,189,248,0.12)]">
					<img
						src={new URL("../../assets/icon.png", import.meta.url).href}
						alt="Connexio"
						className="h-4 w-4 rounded"
					/>
				</div>
				<div className="flex items-baseline gap-2">
					<span className="text-xs font-semibold tracking-wide text-connexio-text">Connexio</span>
					{version && (
						<span className="rounded-full bg-connexio-bg-tertiary/70 px-1.5 py-0.5 text-[9px] font-medium text-connexio-text-muted">
							v{version}
						</span>
					)}
				</div>
			</div>

			{/* Window controls */}
			<div className="titlebar-no-drag flex items-center gap-1">
				<NotificationBell />
				<button onClick={openSettings} className={controlClass} title="Settings" type="button">
					<Settings size={12} />
				</button>
				<button
					onClick={() => window.connexio.app.minimize()}
					className={controlClass}
					type="button"
				>
					<Minus size={12} />
				</button>
				<button
					onClick={() => window.connexio.app.maximize()}
					className={controlClass}
					type="button"
				>
					<Square size={10} />
				</button>
				<button
					onClick={() => window.connexio.app.close()}
					className="group rounded-md p-1.5 text-connexio-text-secondary transition-colors hover:bg-red-500/20 hover:text-red-300"
					type="button"
				>
					<X size={12} />
				</button>
			</div>
		</div>
	);
}
