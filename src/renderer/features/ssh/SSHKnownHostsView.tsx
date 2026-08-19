import { ShieldCheck, Server, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { SSHKnownHost } from "../../../shared/types";

export default function SSHKnownHostsView() {
	const [hosts, setHosts] = useState<SSHKnownHost[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	const load = async () => {
		setLoading(true);
		setError("");
		try {
			setHosts(await window.connexio.ssh.listKnownHosts());
		} catch (err) {
			setError(String(err));
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		load();
	}, []);

	const forget = async (host: SSHKnownHost) => {
		if (!window.confirm(`Forget trusted fingerprint for ${host.host}:${host.port}?`)) return;
		await window.connexio.ssh.forgetHost(host.host, host.port);
		await load();
	};

	return (
		<div className="p-3 space-y-2">
			<div className="flex items-center gap-2">
				<ShieldCheck size={14} className="text-green-400" />
				<div className="flex-1 min-w-0">
					<div className="text-[11px] font-semibold text-connexio-text">Known Hosts</div>
					<div className="text-[9px] text-connexio-text-muted">
						Fingerprints trusted by Connexio native SSH/SFTP
					</div>
				</div>
				<button
					onClick={load}
					className="px-2 py-1 text-[10px] rounded bg-connexio-bg-tertiary text-connexio-text-muted hover:text-connexio-text"
					type="button"
				>
					Refresh
				</button>
			</div>
			{error && <div className="text-[10px] text-red-400">{error}</div>}
			{loading && <div className="text-[10px] text-connexio-text-muted">Loading...</div>}
			{!loading && hosts.length === 0 && (
				<div className="text-[10px] text-connexio-text-muted">
					No trusted hosts yet. Test a connection and trust its fingerprint first.
				</div>
			)}
			{hosts.map((host) => (
				<div
					key={`${host.host}:${host.port}`}
					className="p-2 rounded border border-connexio-border bg-connexio-bg-secondary space-y-1"
				>
					<div className="flex items-center gap-2">
						<Server size={11} className="text-connexio-accent" />
						<div className="flex-1 min-w-0 text-[11px] text-connexio-text truncate">
							{host.host}:{host.port}
						</div>
						<button
							onClick={() => forget(host)}
							className="p-0.5 rounded hover:bg-red-500/100/20"
							type="button"
							title="Forget"
						>
							<Trash2 size={10} className="text-red-400" />
						</button>
					</div>
					<div className="text-[9px] text-connexio-text-muted font-mono break-all">
						{host.fingerprintSha256}
					</div>
					<div className="text-[9px] text-connexio-text-muted">Trusted at {host.trustedAt}</div>
				</div>
			))}
		</div>
	);
}
