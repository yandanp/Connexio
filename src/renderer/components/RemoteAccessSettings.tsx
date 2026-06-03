import { Globe, Loader2, RefreshCw, Copy, Check, Wifi, WifiOff } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import QRCode from "qrcode";
import { remote, type RemoteStatus } from "../lib/tauri-api";

export default function RemoteAccessSettings() {
	const [status, setStatus] = useState<RemoteStatus | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
	const [wolMac, setWolMac] = useState(localStorage.getItem("connexio_wol_mac") || "");
	const [wolBroadcast, setWolBroadcast] = useState(localStorage.getItem("connexio_wol_broadcast") || "255.255.255.255");
	const [wolPort, setWolPort] = useState(Number(localStorage.getItem("connexio_wol_port") || "9"));
	const [wolStatus, setWolStatus] = useState<string | null>(null);

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

	useEffect(() => {
		if (!status?.loginUrl) {
			setQrDataUrl(null);
			return;
		}
		QRCode.toDataURL(status.loginUrl, {
			margin: 1,
			width: 180,
			color: { dark: "#0d1117", light: "#ffffff" },
		})
			.then(setQrDataUrl)
			.catch(() => setQrDataUrl(null));
	}, [status?.loginUrl]);

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
		const url = status.loginUrl || `http://${status.localIp}:${status.port}`;
		navigator.clipboard.writeText(url);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const handleSendWol = async () => {
		setWolStatus(null);
		try {
			localStorage.setItem("connexio_wol_mac", wolMac);
			localStorage.setItem("connexio_wol_broadcast", wolBroadcast);
			localStorage.setItem("connexio_wol_port", String(wolPort || 9));
			await remote.sendWol(wolMac, wolBroadcast, wolPort || 9);
			setWolStatus("Magic packet sent.");
		} catch (err) {
			setWolStatus(String(err));
		}
	};

	const isRunning = status?.isRunning ?? false;
	const clients = status?.clients || [];

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
								Login link
							</span>
							<div className="flex items-center gap-1.5">
								<code className="text-[11px] text-connexio-accent font-mono">
									{status.loginUrl || `http://${status.localIp}:${status.port}`}
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

						{qrDataUrl && (
							<div className="flex items-center gap-3 rounded border border-connexio-border bg-white p-2">
								<img src={qrDataUrl} alt="Remote login QR code" className="h-28 w-28" />
								<div className="text-[11px] text-slate-700">
									<p className="font-semibold">Scan to login</p>
									<p>Opens Connexio Remote with PIN pre-filled.</p>
								</div>
							</div>
						)}

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

						{clients.length > 0 && (
							<div className="space-y-1 pt-2 border-t border-connexio-border">
								<p className="text-[11px] text-connexio-text-secondary">
									Connected devices
								</p>
								{clients.map((client) => (
									<div
										key={client.id}
										className="rounded bg-connexio-bg-secondary px-2 py-1 text-[10px] text-connexio-text-muted"
										title={client.userAgent}
									>
										{client.userAgent.split(" ").slice(0, 3).join(" ")}
									</div>
								))}
							</div>
						)}
					</div>
				)}
			</div>

			{/* Wake-on-LAN helper */}
			<div className="bg-connexio-bg-tertiary border border-connexio-border rounded-md p-3 space-y-3">
				<p className="text-[11px] font-medium text-connexio-text">
					Wake-on-LAN setup
				</p>
				<div className="grid grid-cols-3 gap-2">
					<input
						value={wolMac}
						onChange={(e) => setWolMac(e.target.value)}
						placeholder="MAC address"
						className="col-span-3 px-2 py-1 text-[11px] bg-connexio-bg-secondary border border-connexio-border rounded text-connexio-text outline-none focus:border-connexio-accent"
					/>
					<input
						value={wolBroadcast}
						onChange={(e) => setWolBroadcast(e.target.value)}
						placeholder="Broadcast IP"
						className="col-span-2 px-2 py-1 text-[11px] bg-connexio-bg-secondary border border-connexio-border rounded text-connexio-text outline-none focus:border-connexio-accent"
					/>
					<input
						value={wolPort}
						onChange={(e) => setWolPort(Number(e.target.value) || 9)}
						placeholder="Port"
						type="number"
						className="px-2 py-1 text-[11px] bg-connexio-bg-secondary border border-connexio-border rounded text-connexio-text outline-none focus:border-connexio-accent"
					/>
				</div>
				<button
					onClick={handleSendWol}
					disabled={!wolMac.trim()}
					className="px-3 py-1.5 text-[11px] font-medium rounded bg-connexio-accent/10 text-connexio-accent border border-connexio-accent/30 hover:bg-connexio-accent/20 disabled:opacity-50"
					type="button"
				>
					Send Magic Packet
				</button>
				{wolStatus && <p className="text-[10px] text-connexio-text-muted">{wolStatus}</p>}
				<ol className="text-[11px] text-connexio-text-secondary space-y-1 list-decimal list-inside">
					<li>Enable Wake-on-LAN / PCI-E wake in BIOS</li>
					<li>Use Ethernet when possible; WiFi WoL is often unreliable</li>
					<li>Enable Windows NIC option: Allow this device to wake the computer</li>
					<li>For sleeping/off host PC, send WoL from phone/router/relay, then open the login link</li>
				</ol>
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
