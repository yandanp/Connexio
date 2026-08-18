import { CheckCircle2, Download, Loader2, Rocket, X } from "lucide-react";
import { useEffect, useState } from "react";
import SettingsCard from "../../core/ui/SettingsCard";

type UpdateCheckState =
	| "idle"
	| "checking"
	| "available"
	| "up-to-date"
	| "downloading"
	| "downloaded"
	| "error";

export default function AboutSettings() {
	const [version, setVersion] = useState("");
	const [updateState, setUpdateState] = useState<UpdateCheckState>("idle");
	const [updateVersion, setUpdateVersion] = useState("");
	const [downloadPercent, setDownloadPercent] = useState(0);
	const [errorMsg, setErrorMsg] = useState("");

	useEffect(() => {
		window.connexio.app
			.getVersion()
			.then(setVersion)
			.catch(() => {});

		const unsubs: Array<() => void> = [];

		unsubs.push(
			window.connexio.updater.onChecking(() => {
				setUpdateState("checking");
			}),
		);
		unsubs.push(
			window.connexio.updater.onAvailable((info) => {
				setUpdateState("available");
				setUpdateVersion(info.version);
			}),
		);
		unsubs.push(
			window.connexio.updater.onNotAvailable(() => {
				setUpdateState("up-to-date");
			}),
		);
		unsubs.push(
			window.connexio.updater.onProgress((progress) => {
				setUpdateState("downloading");
				setDownloadPercent(progress.percent);
			}),
		);
		unsubs.push(
			window.connexio.updater.onDownloaded(() => {
				setUpdateState("downloaded");
			}),
		);
		unsubs.push(
			window.connexio.updater.onError((message) => {
				setUpdateState("error");
				setErrorMsg(message);
			}),
		);

		return () => {
			for (const unsub of unsubs) unsub();
		};
	}, []);

	const handleCheckUpdate = () => {
		setUpdateState("checking");
		setErrorMsg("");
		window.connexio.updater.check();
	};

	const handleDownload = () => {
		window.connexio.updater.download();
	};

	const handleInstall = () => {
		window.connexio.updater.install();
	};

	return (
		<SettingsCard title="About" description="Version, updates, and project support.">
			{/* App Info */}
			<div className="flex items-center gap-3 rounded-2xl bg-white/[0.035] p-3">
				<img
					src={new URL("../../assets/icon.png", import.meta.url).href}
					alt="Connexio"
					className="w-10 h-10 rounded-lg"
				/>
				<div>
					<p className="text-sm font-semibold text-connexio-text">Connexio</p>
					<p className="text-[11px] text-connexio-text-secondary">Project-based Terminal Manager</p>
					{version && (
						<p className="text-[10px] text-connexio-text-muted mt-0.5">Version {version}</p>
					)}
				</div>
			</div>

			{/* Update Section */}
			<div className="space-y-3">
				<label className="block text-xs font-medium text-connexio-text-secondary">Updates</label>

				{/* Check for Update Button */}
				{(updateState === "idle" || updateState === "up-to-date" || updateState === "error") && (
					<div className="space-y-2">
						<button
							onClick={handleCheckUpdate}
							className="flex items-center gap-2 rounded-lg bg-white/[0.035] px-4 py-2 text-xs font-medium text-connexio-text-secondary transition-colors hover:bg-white/[0.055] hover:text-connexio-accent"
							type="button"
						>
							<Download size={13} />
							Check for Updates
						</button>

						{updateState === "up-to-date" && (
							<div className="flex items-center gap-2 text-[11px] text-green-400">
								<CheckCircle2 size={13} />
								<span>You're on the latest version.</span>
							</div>
						)}

						{updateState === "error" && (
							<div className="flex items-center gap-2 text-[11px] text-red-400">
								<X size={13} />
								<span className="truncate">{errorMsg || "Failed to check for updates."}</span>
							</div>
						)}
					</div>
				)}

				{/* Checking */}
				{updateState === "checking" && (
					<div className="flex items-center gap-2 text-[11px] text-connexio-text-secondary">
						<Loader2 size={13} className="animate-spin" />
						<span>Checking for updates...</span>
					</div>
				)}

				{/* Update Available */}
				{updateState === "available" && (
					<div className="space-y-2 rounded-2xl bg-connexio-accent/10 p-3 shadow-[inset_2px_0_0_var(--accent-color)]">
						<div className="flex items-center gap-2">
							<Rocket size={13} className="text-connexio-accent" />
							<span className="text-xs font-medium text-connexio-text">
								Version {updateVersion} is available!
							</span>
						</div>
						<button
							onClick={handleDownload}
							className="flex items-center gap-2 px-4 py-1.5 text-xs font-medium text-white bg-connexio-accent rounded hover:bg-connexio-accent-hover transition-colors"
							type="button"
						>
							<Download size={12} />
							Download Update
						</button>
					</div>
				)}

				{/* Downloading */}
				{updateState === "downloading" && (
					<div className="space-y-2 rounded-2xl bg-white/[0.035] p-3">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2 text-[11px] text-connexio-text-secondary">
								<Loader2 size={13} className="animate-spin" />
								<span>Downloading update...</span>
							</div>
							<span className="text-[11px] text-connexio-text-muted font-mono">
								{Math.round(downloadPercent)}%
							</span>
						</div>
						<div className="h-1.5 bg-connexio-bg rounded-full overflow-hidden">
							<div
								className="h-full bg-connexio-accent rounded-full transition-all duration-300"
								style={{ width: `${downloadPercent}%` }}
							/>
						</div>
					</div>
				)}

				{/* Downloaded */}
				{updateState === "downloaded" && (
					<div className="space-y-2 rounded-2xl bg-green-500/10 p-3 shadow-[inset_2px_0_0_rgba(74,222,128,0.75)]">
						<div className="flex items-center gap-2">
							<CheckCircle2 size={13} className="text-green-400" />
							<span className="text-xs font-medium text-connexio-text">
								Update downloaded. Restart to apply.
							</span>
						</div>
						<button
							onClick={handleInstall}
							className="flex items-center gap-2 px-4 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 transition-colors"
							type="button"
						>
							<Rocket size={12} />
							Restart & Update
						</button>
					</div>
				)}
			</div>

			<div className="soft-separator-top space-y-1.5 pt-3">
				<p className="text-[10px] text-connexio-text-muted">Made with ♥ by Connexio Team</p>
			</div>

			{/* Support / Donate */}
			<div className="soft-separator-top space-y-3 pt-4">
				<h3 className="section-label">Support</h3>
				<p className="text-[11px] text-connexio-text-muted leading-relaxed">
					Connexio is free and open source. If you find it useful, consider supporting development.
				</p>
				<div className="flex flex-col items-center gap-2 rounded-2xl bg-white/[0.035] p-4">
					<div className="bg-white p-2 rounded-md">
						<img
							src={new URL("../../assets/download.png", import.meta.url).href}
							alt="Donate QR Code"
							className="w-40 h-40 rounded-sm"
						/>
					</div>
					<p className="text-[10px] text-connexio-text-muted text-center">Scan to donate</p>
				</div>
			</div>
		</SettingsCard>
	);
}
