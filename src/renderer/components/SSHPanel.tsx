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
		<div className="flex flex-col h-full overflow-hidden">
			<div className="p-3 border-b border-connexio-border space-y-2">
				<div className="flex items-center gap-2">
					<Server size={14} className="text-connexio-accent" />
					<div className="flex-1 min-w-0">
						<div className="text-[11px] font-semibold text-connexio-text">SSH</div>
						<div className="text-[9px] text-connexio-text-muted">Quick connect</div>
					</div>
				</div>
				<button onClick={onOpenManager} className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded bg-connexio-accent/10 text-connexio-accent text-[10px] hover:bg-connexio-accent/15" type="button">
					<Key size={10} /> Open SSH Manager
				</button>
			</div>

			<div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
				{allConnections.length === 0 && (
					<button onClick={onOpenManager} className="w-full flex items-center gap-2 p-2 rounded border border-dashed border-connexio-border text-left text-[10px] text-connexio-text-muted hover:text-connexio-text" type="button">
						<Plus size={11} /> Add your first SSH host
					</button>
				)}
				{allConnections.map((conn) => (
					<div key={conn.id} className="group flex items-center gap-1.5 p-1.5 rounded hover:bg-connexio-bg-tertiary">
						<button onClick={() => connect(conn)} className="flex items-center gap-1.5 flex-1 min-w-0 text-left" type="button">
							<Server size={10} className={`${connectingId === conn.id ? "text-connexio-accent animate-pulse" : "text-green-400"} flex-shrink-0`} />
							<div className="min-w-0">
								<div className="text-[11px] text-connexio-text truncate">{conn.name}</div>
								<div className="text-[9px] text-connexio-text-muted truncate">{conn.username}@{conn.host}</div>
							</div>
						</button>
						<button onClick={() => onOpenSftp?.(conn)} className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-connexio-bg" type="button" title="Open SFTP tab">
							<FolderOpen size={10} className="text-connexio-text-muted" />
						</button>
					</div>
				))}
			</div>
		</div>
	);
}
