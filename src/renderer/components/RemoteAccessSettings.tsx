import { Globe, Loader2, RefreshCw, Copy, Check, Wifi, WifiOff } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { remote, type RemoteStatus } from "../lib/tauri-api";

export default function RemoteAccessSettings() {
	const [status, setStatus] = useState<RemoteStatus | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);

	const fetchStatus = useCallback(async () => {
		try {
			const s = await remote.status();
			setStatus(s);
			setError(null);
		} catch (err) {
			setError(String(err));
		}
	}, []);

	useEffect(() => {
		fetchStatus();
		const interval = setInterval(fetchStatus, 3000);
		return () => clearInterval(interval);
	}, [fetchStatus]);

	const handleStart = async () => {
		setLoading(true);
		setError(null);
		try {
			const s = await remote.start();
			setStatus(s);
		} catch (err) {
			setError(String(err));
		} finally {
			setLoading(false);
		}
	};

	const handleStop = async () => {
		setLoading(true);
		setError(null);
		try {
			await remote.stop();
			await fetchStatus();
		} catch (err) {
			setError(String(err));
		} finally {
			setLoading(false);
		}
	};

	const handleRegeneratePin = async () => {
		try {
			const newPin = await remote.regeneratePin();
			setStatus((prev) => (prev ? { ...prev, pin: newPin } : null));
		} catch (err) {
			setError(String(err));
		}
	};

	const copyUrl = () => {
		if (!status?.localIp) return;
		const url = `http://${status.localIp}:${status.port}`;
		navigator.clipboard.writeText(url);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const isRunning = status?.isRunning ?? false;

	return (
		<div className="space-y-4">
			{/* Header */}
			<div className="flex items-center gap-2">
				<Globe size={14} className="text-connexio-accent" />
				<h3 className="text-xs font-semibold text-connexio-text">
					Remote Access
				</h3>
			</div>

			<p className="text-[11px] text-connexio-text-secondary leading-relaxed">
				Access your terminals from a phone or another device on the same
				network. Enable the server, then open the URL in your mobile browser.
			</p>

			{/* Status Card */}
			<div className="bg-connexio-bg-tertiary border border-connexio-border rounded-md p-3 space-y-3">
				{/* Toggle */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						{isRunning ? (
							<Wifi size={14} className="text-green-400" />
						) : (
							<WifiOff size={14} className="text-connexio-text-secondary" />
						)}
						<span className="text-xs font-medium text-connexio-text">
							{isRunning ? "Server Active" : "Server Inactive"}
						</span>
					</div>
					<button
						onClick={isRunning ? handleStop : handleStart}
						disabled={loading}
						className={`px-3 py-1.5 text-[11px] font-medium rounded transition-colors ${
							isRunning
								? "bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20"
								: "bg-connexio-accent/10 text-connexio-accent border border-connexio-accent/30 hover:bg-connexio-accent/20"
						}`}
						type="button"
					>
						{loading ? (
							<Loader2 size={12} className="animate-spin" />
						) : isRunning ? (
							"Stop"
						) : (
							"Start"
						)}
					</button>
				</div>

				{/* Connection Info */}
				{isRunning && status && (
					<div className="space-y-2 pt-2 border-t border-connexio-border">
						{/* URL */}
						<div className="flex items-center justify-between">
							<span className="text-[11px] text-connexio-text-secondary">
								URL
							</span>
							<div className="flex items-center gap-1.5">
								<code className="text-[11px] text-connexio-accent font-mono">
									http://{status.localIp}:{status.port}
								</code>
								<button
									onClick={copyUrl}
									className="p-1 rounded hover:bg-connexio-bg-secondary transition-colors"
									title="Copy URL"
									type="button"
								>
									{copied ? (
										<Check size={11} className="text-green-400" />
									) : (
										<Copy size={11} className="text-connexio-text-secondary" />
									)}
								</button>
							</div>
						</div>

						{/* PIN */}
						<div className="flex items-center justify-between">
							<span className="text-[11px] text-connexio-text-secondary">
								PIN
							</span>
							<div className="flex items-center gap-1.5">
								<code className="text-sm font-mono font-bold text-connexio-text tracking-[0.3em]">
									{status.pin}
								</code>
								<button
									onClick={handleRegeneratePin}
									className="p-1 rounded hover:bg-connexio-bg-secondary transition-colors"
									title="Regenerate PIN"
									type="button"
								>
									<RefreshCw
										size={11}
										className="text-connexio-text-secondary"
									/>
								</button>
							</div>
						</div>

						{/* Connected Clients */}
						<div className="flex items-center justify-between">
							<span className="text-[11px] text-connexio-text-secondary">
								Connected
							</span>
							<span className="text-[11px] text-connexio-text">
								{status.connectedClients}{" "}
								{status.connectedClients === 1 ? "device" : "devices"}
							</span>
						</div>
					</div>
				)}
			</div>

			{/* Instructions */}
			{isRunning && (
				<div className="bg-connexio-bg-tertiary border border-connexio-border rounded-md p-3">
					<p className="text-[11px] font-medium text-connexio-text mb-2">
						How to connect:
					</p>
					<ol className="text-[11px] text-connexio-text-secondary space-y-1 list-decimal list-inside">
						<li>Make sure your phone is on the same WiFi network</li>
						<li>Open the URL above in your phone's browser</li>
						<li>Enter the 6-digit PIN</li>
						<li>Select a terminal to start using it remotely</li>
					</ol>
				</div>
			)}

			{/* Error */}
			{error && (
				<p className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1.5">
					{error}
				</p>
			)}
		</div>
	);
}
