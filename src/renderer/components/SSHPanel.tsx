import { FolderOpen, Key, Plus, Server } from "lucide-react";
import { useEffect, useState } from "react";
import type { SSHConnection } from "../../shared/types";

interface Props {
	projectId: string;
	onConnect: (connection: SSHConnection, label: string, password?: string) => void;
	onOpenManager?: () => void;
	onOpenSftp?: (connection: SSHConnection) => void;
}

export default function SSHPanel({ projectId, onConnect, onOpenManager, onOpenSftp }: Props) {
	const [connections, setConnections] = useState<SSHConnection[]>([]);
	const [globalConnections, setGlobalConnections] = useState<SSHConnection[]>([]);
	const [connectingId, setConnectingId] = useState<string | null>(null);

	useEffect(() => {
		window.connexio.ssh.list(projectId).then(setConnections).catch(() => {});
		window.connexio.ssh.listGlobal().then(setGlobalConnections).catch(() => {});
	}, [projectId]);

	const allConnections = [...connections, ...globalConnections];

	const resolveSavedSecret = async (conn: SSHConnection) => {
		const ref = conn.authMethod === "key" ? conn.passphraseSecretRef : conn.passwordSecretRef;
		if (!ref?.key) return null;
		return window.connexio.ssh.getSecret(ref.key).catch(() => null);
	};

	const connect = async (conn: SSHConnection) => {
		setConnectingId(conn.id);
		try {
			const secret = await resolveSavedSecret(conn);
			onConnect(conn, `SSH: ${conn.name}`, secret || undefined);
		} finally {
			setConnectingId(null);
		}
	};

	return (
		<div className="flex h-full flex-col overflow-hidden bg-connexio-bg-secondary/35">
			<div className="space-y-3 p-3 shadow-[inset_0_-1px_0_rgba(255,255,255,0.05)]">
				<div className="flex items-center gap-2">
					<div className="flex h-8 w-8 items-center justify-center rounded-xl bg-connexio-accent/10 shadow-[inset_2px_0_0_var(--accent-color)]">
						<Server size={14} className="text-connexio-accent" />
					</div>
					<div className="min-w-0 flex-1">
						<div className="text-[12px] font-semibold text-connexio-text">SSH quick connect</div>
						<div className="text-[10px] text-connexio-text-muted">Saved project and global hosts</div>
					</div>
				</div>
				<button
					onClick={onOpenManager}
					className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-connexio-accent/10 px-2 py-2 text-[10px] font-semibold text-connexio-accent transition-colors hover:bg-connexio-accent/15"
					type="button"
				>
					<Key size={10} /> Open SSH Manager
				</button>
			</div>

			<div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
				{allConnections.length === 0 && (
					<button
						onClick={onOpenManager}
						className="flex w-full items-center gap-3 rounded-2xl bg-white/[0.035] p-3 text-left text-[10px] text-connexio-text-muted transition-colors hover:bg-white/[0.055] hover:text-connexio-text"
						type="button"
					>
						<Plus size={13} className="text-connexio-accent" />
						<span>Add your first SSH host</span>
					</button>
				)}
				{allConnections.map((conn) => (
					<div key={conn.id} className="group flex items-center gap-1.5 rounded-xl p-1.5 transition-colors hover:bg-white/[0.04]">
						<button onClick={() => connect(conn)} className="flex min-w-0 flex-1 items-center gap-2 text-left" type="button">
							<Server size={11} className={`${connectingId === conn.id ? "animate-pulse text-connexio-accent" : "text-[var(--success-color)]"} flex-shrink-0`} />
							<div className="min-w-0">
								<div className="truncate text-[11px] font-medium text-connexio-text">{conn.name}</div>
								<div className="truncate text-[9px] text-connexio-text-muted">{conn.username}@{conn.host}</div>
							</div>
						</button>
						<button onClick={() => onOpenSftp?.(conn)} className="rounded-md p-1 opacity-0 transition-opacity hover:bg-connexio-bg group-hover:opacity-100" type="button" title="Open SFTP tab">
							<FolderOpen size={10} className="text-connexio-text-muted" />
						</button>
					</div>
				))}
			</div>
		</div>
	);
}
