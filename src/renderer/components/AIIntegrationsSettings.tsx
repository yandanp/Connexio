import { AlertCircle, CheckCircle2, Download, Loader2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { AIProvider } from "../../shared/types";

export default function AIIntegrationsSettings() {
	const [providers, setProviders] = useState<AIProvider[]>([]);
	const [loading, setLoading] = useState(true);
	const [actionLoading, setActionLoading] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	const loadProviders = async () => {
		setLoading(true);
		const result = await window.connexio.notification.getProviders();
		setProviders(result);
		setLoading(false);
	};

	useEffect(() => {
		loadProviders();
	}, []);

	const handleInstall = async (providerId: string) => {
		setActionLoading(providerId);
		setError(null);
		setSuccess(null);
		const result = await window.connexio.notification.installHook(providerId);
		if (result.success) {
			setSuccess(`Hook installed for ${providerId}`);
			await loadProviders();
		} else {
			setError(result.error || "Failed to install hook");
		}
		setActionLoading(null);

		// Auto-dismiss messages
		setTimeout(() => {
			setSuccess(null);
			setError(null);
		}, 3000);
	};

	const handleUninstall = async (providerId: string) => {
		setActionLoading(providerId);
		setError(null);
		setSuccess(null);
		const result = await window.connexio.notification.uninstallHook(providerId);
		if (result.success) {
			setSuccess(`Hook removed for ${providerId}`);
			await loadProviders();
		} else {
			setError(result.error || "Failed to uninstall hook");
		}
		setActionLoading(null);

		setTimeout(() => {
			setSuccess(null);
			setError(null);
		}, 3000);
	};

	if (loading) {
		return (
			<div className="flex items-center gap-2 py-4">
				<Loader2 size={13} className="animate-spin text-connexio-text-muted" />
				<span className="text-xs text-connexio-text-muted">Detecting AI agents...</span>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			<h3 className="section-label">AI Agent Integrations</h3>
			<p className="text-[10px] text-connexio-text-muted leading-relaxed">
				Install notification hooks to get alerted when AI agents finish processing. Your existing
				settings are preserved — hooks are added non-destructively.
			</p>

			{/* Provider list */}
			<div className="space-y-2">
				{providers.map((provider) => (
					<div
						key={provider.id}
						className="flex items-center justify-between rounded-xl bg-white/[0.035] p-2.5"
					>
						<div className="flex items-center gap-2.5">
							{/* Status indicator */}
							<div
								className={`w-2 h-2 rounded-full ${
									!provider.isInstalled
										? "bg-connexio-text-muted/30"
										: provider.isHookInstalled
											? "bg-green-400"
											: "bg-orange-400"
								}`}
							/>
							<div>
								<p className="text-xs font-medium text-connexio-text">{provider.name}</p>
								<p className="text-[10px] text-connexio-text-muted">
									{!provider.isInstalled
										? "Not detected"
										: provider.isHookInstalled
											? "Hook installed ✓"
											: "Available — hook not installed"}
								</p>
							</div>
						</div>

						{/* Action button */}
						{provider.isInstalled && (
							<div>
								{actionLoading === provider.id ? (
									<Loader2 size={13} className="animate-spin text-connexio-text-muted" />
								) : provider.isHookInstalled ? (
									<button
										onClick={() => handleUninstall(provider.id)}
										className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-2.5 py-1 text-[10px] font-medium text-red-400 transition-colors hover:bg-red-500/20"
										type="button"
									>
										<Trash2 size={10} />
										Remove
									</button>
								) : (
									<button
										onClick={() => handleInstall(provider.id)}
										className="flex items-center gap-1.5 rounded-lg bg-connexio-accent/10 px-2.5 py-1 text-[10px] font-medium text-connexio-accent transition-colors hover:bg-connexio-accent/20"
										type="button"
									>
										<Download size={10} />
										Install
									</button>
								)}
							</div>
						)}
					</div>
				))}
			</div>

			{/* Status messages */}
			{success && (
				<div className="flex items-center gap-2 text-[11px] text-green-400">
					<CheckCircle2 size={12} />
					<span>{success}</span>
				</div>
			)}
			{error && (
				<div className="flex items-center gap-2 text-[11px] text-red-400">
					<AlertCircle size={12} />
					<span>{error}</span>
				</div>
			)}

			{/* Info */}
			<div className="soft-separator-top pt-3">
				<p className="text-[10px] text-connexio-text-muted/60 leading-relaxed">
					Hooks communicate via TCP localhost. Set{" "}
					<code className="rounded bg-connexio-bg px-1 text-connexio-text-muted">
						CONNEXIO_NOTIFICATION_PORT
					</code>{" "}
					environment variable for the agents to connect.
				</p>
			</div>
		</div>
	);
}
