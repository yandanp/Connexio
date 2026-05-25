import { Download, RefreshCw, Rocket, X } from "lucide-react";
import { useEffect, useState } from "react";

type UpdateState =
	| { status: "idle" }
	| { status: "checking" }
	| { status: "available"; version: string; releaseNotes: string }
	| { status: "not-available" }
	| { status: "downloading"; percent: number }
	| { status: "downloaded"; version: string }
	| { status: "error"; message: string };

export default function UpdateNotification() {
	const [state, setState] = useState<UpdateState>({ status: "idle" });
	const [dismissed, setDismissed] = useState(false);

	useEffect(() => {
		const unsubs: Array<() => void> = [];

		unsubs.push(
			window.connexio.updater.onChecking(() => {
				setState({ status: "checking" });
			}),
		);

		unsubs.push(
			window.connexio.updater.onAvailable((info) => {
				setState({
					status: "available",
					version: info.version,
					releaseNotes: info.releaseNotes,
				});
				setDismissed(false);
			}),
		);

		unsubs.push(
			window.connexio.updater.onNotAvailable(() => {
				setState({ status: "not-available" });
			}),
		);

		unsubs.push(
			window.connexio.updater.onProgress((progress) => {
				setState({ status: "downloading", percent: progress.percent });
			}),
		);

		unsubs.push(
			window.connexio.updater.onDownloaded((info) => {
				setState({ status: "downloaded", version: info.version });
				setDismissed(false);
			}),
		);

		unsubs.push(
			window.connexio.updater.onError((message) => {
				setState({ status: "error", message });
			}),
		);

		return () => {
			for (const unsub of unsubs) unsub();
		};
	}, []);

	const handleDownload = () => {
		window.connexio.updater.download();
	};

	const handleInstall = () => {
		window.connexio.updater.install();
	};

	const handleDismiss = () => {
		setDismissed(true);
	};

	// Don't show for idle, checking, not-available, or dismissed
	if (
		state.status === "idle" ||
		state.status === "checking" ||
		state.status === "not-available"
	) {
		return null;
	}
	if (dismissed && state.status !== "downloaded") {
		return null;
	}

	return (
		<div className="fixed bottom-4 right-4 z-50 w-80 bg-connexio-bg-secondary border border-connexio-border rounded-lg shadow-2xl overflow-hidden">
			{/* Update available */}
			{state.status === "available" && (
				<div className="p-3">
					<div className="flex items-start gap-2">
						<Rocket
							size={16}
							className="text-connexio-accent mt-0.5 flex-shrink-0"
						/>
						<div className="flex-1 min-w-0">
							<p className="text-xs font-semibold text-connexio-text">
								Update Available
							</p>
							<p className="text-[11px] text-connexio-text-secondary mt-0.5">
								Version {state.version} is ready to download.
							</p>
							{state.releaseNotes && (
								<p className="text-[10px] text-connexio-text-muted mt-1 line-clamp-3">
									{state.releaseNotes.replace(/<[^>]*>/g, "").slice(0, 200)}
								</p>
							)}
						</div>
						<button
							onClick={handleDismiss}
							className="p-0.5 rounded hover:bg-connexio-bg-tertiary transition-colors flex-shrink-0"
							type="button"
						>
							<X size={12} className="text-connexio-text-muted" />
						</button>
					</div>
					<div className="flex gap-2 mt-3">
						<button
							onClick={handleDownload}
							className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium bg-connexio-accent text-white rounded hover:bg-connexio-accent-hover transition-colors"
							type="button"
						>
							<Download size={12} />
							Download
						</button>
						<button
							onClick={handleDismiss}
							className="px-3 py-1.5 text-[11px] text-connexio-text-muted hover:text-connexio-text transition-colors"
							type="button"
						>
							Later
						</button>
					</div>
				</div>
			)}

			{/* Downloading */}
			{state.status === "downloading" && (
				<div className="p-3">
					<div className="flex items-center gap-2">
						<RefreshCw
							size={14}
							className="text-connexio-accent animate-spin flex-shrink-0"
						/>
						<div className="flex-1">
							<p className="text-xs font-medium text-connexio-text">
								Downloading update...
							</p>
							<p className="text-[10px] text-connexio-text-muted">
								{Math.round(state.percent)}%
							</p>
						</div>
					</div>
					{/* Progress bar */}
					<div className="mt-2 h-1.5 bg-connexio-bg-tertiary rounded-full overflow-hidden">
						<div
							className="h-full bg-connexio-accent rounded-full transition-all duration-300"
							style={{ width: `${state.percent}%` }}
						/>
					</div>
				</div>
			)}

			{/* Downloaded — ready to install */}
			{state.status === "downloaded" && (
				<div className="p-3">
					<div className="flex items-start gap-2">
						<Download
							size={16}
							className="text-green-400 mt-0.5 flex-shrink-0"
						/>
						<div className="flex-1 min-w-0">
							<p className="text-xs font-semibold text-connexio-text">
								Update Ready
							</p>
							<p className="text-[11px] text-connexio-text-secondary mt-0.5">
								Version {state.version} downloaded. Restart to apply.
							</p>
						</div>
						<button
							onClick={handleDismiss}
							className="p-0.5 rounded hover:bg-connexio-bg-tertiary transition-colors flex-shrink-0"
							type="button"
						>
							<X size={12} className="text-connexio-text-muted" />
						</button>
					</div>
					<div className="flex gap-2 mt-3">
						<button
							onClick={handleInstall}
							className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
							type="button"
						>
							<Rocket size={12} />
							Restart & Update
						</button>
						<button
							onClick={handleDismiss}
							className="px-3 py-1.5 text-[11px] text-connexio-text-muted hover:text-connexio-text transition-colors"
							type="button"
						>
							Later
						</button>
					</div>
				</div>
			)}

			{/* Error */}
			{state.status === "error" && (
				<div className="p-3">
					<div className="flex items-start gap-2">
						<X size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
						<div className="flex-1 min-w-0">
							<p className="text-xs font-medium text-red-400">Update Error</p>
							<p className="text-[10px] text-connexio-text-muted mt-0.5 truncate">
								{state.message}
							</p>
						</div>
						<button
							onClick={handleDismiss}
							className="p-0.5 rounded hover:bg-connexio-bg-tertiary transition-colors flex-shrink-0"
							type="button"
						>
							<X size={12} className="text-connexio-text-muted" />
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
