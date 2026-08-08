import { Search, Server } from "lucide-react";
import ContextMenu from "../../core/ui/ContextMenu";
import { useEffect, useState } from "react";
import { v4 as uuid } from "uuid";
import ConfirmDialog from "../../core/ui/ConfirmDialog";
import type { SSHConnection, SSHSecretRef } from "../../../shared/types";
import SSHConnectPrompt from "./SSHConnectPrompt";
import { useSshConnections } from "./use-ssh-connections";
import SSHHostsView from "./SSHHostsView";
import SSHIdentitiesView from "./SSHIdentitiesView";
import SSHKnownHostsView from "./SSHKnownHostsView";

interface Props {
	projectId: string;
	onConnect: (connection: SSHConnection, label: string, password?: string) => void;
	onOpenSftp?: (connection: SSHConnection) => void;
	initialView?: "hosts" | "identities" | "knownHosts";
}

export default function SSHManagerPanel({
	projectId,
	onConnect,
	onOpenSftp,
	initialView = "hosts",
}: Props) {
	const [editingId, setEditingId] = useState<string | null>(null);
	const [isAdding, setIsAdding] = useState<"project" | "global" | null>(null);
	const [connectPrompt, setConnectPrompt] = useState<SSHConnection | null>(null);
	const [connectingId, setConnectingId] = useState<string | null>(null);
	const [connectStatus, setConnectStatus] = useState("");
	const [activeView, setActiveView] = useState<"hosts" | "identities" | "knownHosts">(initialView);
	const [searchQuery, setSearchQuery] = useState("");

	const {
		connections,
		globalConnections,
		saveProjectConnections,
		saveGlobal,
		filteredProjectConnections,
		filteredGlobalConnections,
	} = useSshConnections(projectId, searchQuery);
	const [editSection, setEditSection] = useState<"basic" | "auth" | "advanced">("basic");
	const [hostMenu, setHostMenu] = useState<{
		x: number;
		y: number;
		conn: SSHConnection;
		scope: "project" | "global";
	} | null>(null);
	const [deleteConfirm, setDeleteConfirm] = useState<{
		id: string;
		name: string;
		scope: "project" | "global";
	} | null>(null);

	const resolveSavedSecret = async (conn: SSHConnection) => {
		const ref = conn.authMethod === "key" ? conn.passphraseSecretRef : conn.passwordSecretRef;
		if (!ref?.key) return null;
		return window.connexio.ssh.getSecret(ref.key).catch(() => null);
	};

	const handleConnect = async (conn: SSHConnection) => {
		setConnectingId(conn.id);
		setConnectStatus(`Preparing ${conn.name}...`);
		try {
			setConnectStatus("Checking saved credentials...");
			const savedSecret = await resolveSavedSecret(conn);
			if (conn.authMethod !== "agent" && !savedSecret) {
				setConnectPrompt(conn);
				setConnectStatus("Waiting for password/passphrase...");
				return;
			}
			setConnectStatus("Opening native SSH session...");
			onConnect(conn, `SSH: ${conn.name}`, savedSecret || undefined);
			setTimeout(() => setConnectStatus(""), 1500);
		} finally {
			setConnectingId(null);
		}
	};

	const secretKey = (connId: string, kind: "password" | "passphrase") => `ssh:${connId}:${kind}`;
	const handleConnectWithPassword = async (passwordInput: string, remember: boolean) => {
		if (!connectPrompt) return;
		const conn = connectPrompt;
		const password = passwordInput || undefined;
		setConnectingId(conn.id);
		setConnectStatus("Opening native SSH session...");
		if (remember && password && conn.authMethod !== "agent") {
			const kind = conn.authMethod === "key" ? "passphrase" : "password";
			const key = secretKey(conn.id, kind);
			await window.connexio.ssh.setSecret(key, password);
			const updatedConn: SSHConnection = {
				...conn,
				...(kind === "password"
					? { passwordSecretRef: { provider: "keychain", key } as SSHSecretRef }
					: { passphraseSecretRef: { provider: "keychain", key } as SSHSecretRef }),
			};
			const updateList = (list: SSHConnection[]) =>
				list.map((item) => (item.id === conn.id ? updatedConn : item));
			if (connections.some((item) => item.id === conn.id))
				await saveProjectConnections(updateList(connections));
			if (globalConnections.some((item) => item.id === conn.id))
				await saveGlobal(updateList(globalConnections));
			onConnect(updatedConn, `SSH: ${updatedConn.name}`, password);
		} else {
			onConnect(conn, `SSH: ${conn.name}`, password);
		}
		setConnectPrompt(null);
		setConnectingId(null);
		setTimeout(() => setConnectStatus(""), 1500);
	};

	const handleDelete = async (id: string, scope: "project" | "global") => {
		const conn = [...connections, ...globalConnections].find((c) => c.id === id);
		setDeleteConfirm({ id, name: conn?.name || "this host", scope });
	};

	const confirmDelete = async () => {
		if (!deleteConfirm) return;
		if (deleteConfirm.scope === "project") {
			await saveProjectConnections(connections.filter((c) => c.id !== deleteConfirm.id));
		} else {
			await saveGlobal(globalConnections.filter((c) => c.id !== deleteConfirm.id));
		}
		setDeleteConfirm(null);
	};

	const filteredConnections = [...filteredProjectConnections, ...filteredGlobalConnections];

	const handleSave = async (conn: SSHConnection, scope: "project" | "global") => {
		if (scope === "project") {
			const existing = connections.find((c) => c.id === conn.id);
			if (existing) {
				await saveProjectConnections(connections.map((c) => (c.id === conn.id ? conn : c)));
			} else {
				await saveProjectConnections([...connections, conn]);
			}
		} else {
			const existing = globalConnections.find((c) => c.id === conn.id);
			if (existing) {
				await saveGlobal(globalConnections.map((c) => (c.id === conn.id ? conn : c)));
			} else {
				await saveGlobal([...globalConnections, conn]);
			}
		}
		setEditingId(null);
		setIsAdding(null);
	};

	return (
		<div className="flex flex-col h-full overflow-hidden">
			<div className="px-3 py-2 border-b border-connexio-border bg-connexio-bg-secondary/70 space-y-2">
				<div className="flex items-center gap-2">
					<Server size={13} className="text-connexio-accent" />
					<div className="flex-1 min-w-0">
						<div className="text-[11px] font-semibold text-connexio-text">SSH Manager</div>
						<div className="text-[9px] text-connexio-text-muted">
							Hosts, SFTP, identities, and trust
						</div>
					</div>
				</div>
				<div className="grid grid-cols-3 gap-1 rounded bg-connexio-bg p-0.5 border border-connexio-border">
					{(
						[
							["hosts", "Hosts"],
							["identities", "IDs"],
							["knownHosts", "Trust"],
						] as const
					).map(([view, label]) => (
						<button
							key={view}
							onClick={() => setActiveView(view)}
							className={`px-1.5 py-1 text-[9px] rounded transition-colors ${activeView === view ? "bg-connexio-accent/15 text-connexio-accent" : "text-connexio-text-muted hover:text-connexio-text"}`}
							type="button"
						>
							{label}
						</button>
					))}
				</div>
				{activeView === "hosts" && (
					<div className="flex items-center gap-1 px-2 py-1 rounded border border-connexio-border bg-connexio-bg">
						<Search size={10} className="text-connexio-text-muted" />
						<input
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Search hosts, tags, folders..."
							className="flex-1 bg-transparent text-[10px] text-connexio-text outline-none placeholder:text-connexio-text-muted"
						/>
					</div>
				)}
			</div>
			<div className="flex-1 min-h-0 overflow-y-auto">
				{connectPrompt && (
					<SSHConnectPrompt
						key={connectPrompt.id}
						connection={connectPrompt}
						status={connectStatus}
						onConfirm={handleConnectWithPassword}
						onCancel={() => setConnectPrompt(null)}
					/>
				)}
				{activeView === "hosts" && (
					<SSHHostsView
						connections={connections}
						filteredConnections={filteredConnections}
						isAdding={isAdding}
						editingId={editingId}
						editSection={editSection}
						connectingId={connectingId}
						connectStatus={connectStatus}
						onStartAdd={setIsAdding}
						onCancelAdd={() => setIsAdding(null)}
						onEditHost={setEditingId}
						onCancelEdit={() => setEditingId(null)}
						onSectionChange={setEditSection}
						onSave={handleSave}
						onConnect={handleConnect}
						onOpenSftp={onOpenSftp}
						onDelete={handleDelete}
						onHostContextMenu={(e, conn, scope) => {
							e.preventDefault();
							setHostMenu({ x: e.clientX, y: e.clientY, conn, scope });
						}}
					/>
				)}

				{hostMenu && (
					<ContextMenu
						x={hostMenu.x}
						y={hostMenu.y}
						onClose={() => setHostMenu(null)}
						minWidth={176}
						items={[
							{ label: "Connect", onClick: () => handleConnect(hostMenu.conn) },
							{ label: "Open SFTP", onClick: () => onOpenSftp?.(hostMenu.conn) },
							{ label: "Edit Host", onClick: () => setEditingId(hostMenu.conn.id) },
							{
								label: "Duplicate",
								onClick: () =>
									handleSave(
										{ ...hostMenu.conn, id: uuid(), name: `${hostMenu.conn.name} Copy` },
										hostMenu.scope,
									),
							},
							{
								label: "Delete",
								danger: true,
								onClick: () => handleDelete(hostMenu.conn.id, hostMenu.scope),
							},
						]}
					/>
				)}

				{activeView === "identities" && <SSHIdentitiesView />}

				{activeView === "knownHosts" && <SSHKnownHostsView />}
			</div>

			{deleteConfirm && (
				<ConfirmDialog
					title="Delete Host"
					message={`Delete "${deleteConfirm.name}"? This cannot be undone.`}
					confirmLabel="Delete"
					variant="danger"
					onConfirm={confirmDelete}
					onCancel={() => setDeleteConfirm(null)}
				/>
			)}
		</div>
	);
}
