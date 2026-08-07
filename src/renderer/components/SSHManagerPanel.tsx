import {
	Check,
	Eye,
	EyeOff,
	FileText,
	FolderOpen,
	Key,
	Pencil,
	Plus,
	Search,
	Server,
	ShieldCheck,
	Trash2,
	X,
	Zap,
} from "lucide-react";
import ContextMenu from "../core/ui/ContextMenu";
import { useEffect, useRef, useState } from "react";
import { v4 as uuid } from "uuid";
import { open, save } from "@tauri-apps/plugin-dialog";
import { useProjectStore } from "../stores/projectStore";
import ConfirmDialog from "../core/ui/ConfirmDialog";
import type { SFTPEntry, SSHConnection, SSHSecretRef } from "../../shared/types";

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
	const [connections, setConnections] = useState<SSHConnection[]>([]);
	const [globalConnections, setGlobalConnections] = useState<SSHConnection[]>([]);
	const [showProject, setShowProject] = useState(true);
	const [showGlobal, setShowGlobal] = useState(true);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [isAdding, setIsAdding] = useState<"project" | "global" | null>(null);
	const [connectPrompt, setConnectPrompt] = useState<SSHConnection | null>(null);
	const [connectPassword, setConnectPassword] = useState("");
	const [rememberConnectSecret, setRememberConnectSecret] = useState(false);
	const [connectingId, setConnectingId] = useState<string | null>(null);
	const [connectStatus, setConnectStatus] = useState("");
	const [activeView, setActiveView] = useState<"hosts" | "identities" | "knownHosts">(initialView);
	const [searchQuery, setSearchQuery] = useState("");
	const [showConnectPassword, setShowConnectPassword] = useState(false);
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

	useEffect(() => {
		window.connexio.ssh
			.list(projectId)
			.then(setConnections)
			.catch(() => {});
		window.connexio.ssh
			.listGlobal()
			.then(setGlobalConnections)
			.catch(() => {});
	}, [projectId]);

	const saveProjectConnections = async (conns: SSHConnection[]) => {
		setConnections(conns);
		await window.connexio.ssh.save(projectId, conns);
	};

	const saveGlobal = async (conns: SSHConnection[]) => {
		setGlobalConnections(conns);
		await window.connexio.ssh.saveGlobal(conns);
	};

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
				setConnectPassword("");
				setRememberConnectSecret(false);
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
	const handleConnectWithPassword = async () => {
		if (!connectPrompt) return;
		const conn = connectPrompt;
		const password = connectPassword || undefined;
		setConnectingId(conn.id);
		setConnectStatus("Opening native SSH session...");
		if (rememberConnectSecret && password && conn.authMethod !== "agent") {
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
		setConnectPassword("");
		setRememberConnectSecret(false);
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

	const matchesSearch = (conn: SSHConnection) => {
		const query = searchQuery.trim().toLowerCase();
		if (!query) return true;
		return [conn.name, conn.host, conn.username, conn.folder, ...(conn.tags || [])]
			.filter(Boolean)
			.some((value) => String(value).toLowerCase().includes(query));
	};

	const filteredProjectConnections = connections.filter(matchesSearch);
	const filteredGlobalConnections = globalConnections.filter(matchesSearch);
	const filteredConnections = [...filteredProjectConnections, ...filteredGlobalConnections];
	const allConnections = [...connections, ...globalConnections];

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
					<div className="m-2 p-2 rounded border border-connexio-accent/40 bg-connexio-bg-tertiary space-y-2">
						<div className="flex items-center gap-2">
							<Key size={12} className="text-connexio-accent" />
							<div className="flex-1 min-w-0">
								<div className="text-[11px] font-semibold text-connexio-text truncate">
									Connect to {connectPrompt.name}
								</div>
								<div className="text-[9px] text-connexio-text-muted truncate">
									{connectPrompt.username}@{connectPrompt.host}:{connectPrompt.port}
								</div>
							</div>
							<button
								onClick={() => setConnectPrompt(null)}
								className="p-0.5 rounded hover:bg-connexio-bg"
								type="button"
							>
								<X size={10} />
							</button>
						</div>
						<div className="relative">
							<input
								type={showConnectPassword ? "text" : "password"}
								value={connectPassword}
								onChange={(e) => setConnectPassword(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") handleConnectWithPassword();
									if (e.key === "Escape") setConnectPrompt(null);
								}}
								placeholder={
									connectPrompt.authMethod === "key" ? "Private key passphrase" : "Password"
								}
								className="w-full pr-7 px-2 py-1 text-[11px] bg-connexio-bg border border-connexio-border rounded text-connexio-text outline-none focus:border-connexio-accent"
								autoFocus
							/>
							<button
								onClick={() => setShowConnectPassword((value) => !value)}
								className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-connexio-bg-tertiary"
								type="button"
							>
								{showConnectPassword ? (
									<EyeOff size={10} className="text-connexio-text-muted" />
								) : (
									<Eye size={10} className="text-connexio-text-muted" />
								)}
							</button>
						</div>
						<label className="flex items-center gap-1 text-[9px] text-connexio-text-muted">
							<input
								type="checkbox"
								checked={rememberConnectSecret}
								onChange={(e) => setRememberConnectSecret(e.target.checked)}
								className="w-3 h-3"
							/>
							Save {connectPrompt.authMethod === "key" ? "passphrase" : "password"} in OS keychain
						</label>
						<div className="flex gap-1">
							<button
								onClick={handleConnectWithPassword}
								className="px-2 py-1 text-[10px] rounded bg-connexio-accent text-connexio-bg"
								type="button"
							>
								Connect
							</button>
							<button
								onClick={() => setConnectPrompt(null)}
								className="px-2 py-1 text-[10px] rounded text-connexio-text-muted hover:bg-connexio-bg"
								type="button"
							>
								Cancel
							</button>
						</div>
					</div>
				)}
				{activeView === "hosts" && (
					<div className="p-6">
						<div className="flex items-center gap-2 mb-7">
							<button
								onClick={() => setIsAdding("project")}
								className="flex items-center gap-2 px-4 py-2 rounded-xl bg-connexio-bg-secondary text-connexio-text border border-connexio-border  hover:border-connexio-accent/50"
								type="button"
							>
								<Plus size={15} />
								<span className="text-sm font-semibold">New host</span>
							</button>
							<button
								onClick={() => setIsAdding("global")}
								className="flex items-center gap-2 px-4 py-2 rounded-xl text-connexio-text-muted hover:bg-connexio-bg-secondary/70"
								type="button"
							>
								<Plus size={13} />
								<span className="text-xs">Global</span>
							</button>
						</div>

						<div className="flex items-center justify-between mb-4">
							<div className="text-base font-semibold text-connexio-text">Hosts</div>
							{connectStatus && (
								<div className="text-xs text-connexio-accent animate-pulse">{connectStatus}</div>
							)}
						</div>
						{isAdding === "project" && (
							<div className="mb-4 max-w-2xl">
								<div className="text-[10px] text-connexio-text-muted mb-1">
									Adding to this project
								</div>
								<SSHEditForm
									section={editSection}
									onSectionChange={setEditSection}
									onSave={(c) => handleSave(c, "project")}
									onCancel={() => setIsAdding(null)}
								/>
							</div>
						)}
						{isAdding === "global" && (
							<div className="mb-4 max-w-2xl">
								<div className="text-[10px] text-connexio-text-muted mb-1">
									Adding as global (available in all projects)
								</div>
								<SSHEditForm
									section={editSection}
									onSectionChange={setEditSection}
									onSave={(c) => handleSave(c, "global")}
									onCancel={() => setIsAdding(null)}
								/>
							</div>
						)}
						<div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-3">
							{filteredConnections.map((conn) =>
								editingId === conn.id ? (
									<div
										key={conn.id}
										className="rounded-2xl bg-connexio-bg-secondary border border-connexio-border p-3"
									>
										<SSHEditForm
											connection={conn}
											section={editSection}
											onSectionChange={setEditSection}
											onSave={(c) =>
												handleSave(
													c,
													connections.some((item) => item.id === conn.id) ? "project" : "global",
												)
											}
											onCancel={() => setEditingId(null)}
										/>
									</div>
								) : (
									<SSHHostCard
										key={conn.id}
										connection={conn}
										isConnecting={connectingId === conn.id}
										onConnect={() => handleConnect(conn)}
										onSftp={() => onOpenSftp?.(conn)}
										onEdit={() => setEditingId(conn.id)}
										onDelete={() =>
											handleDelete(
												conn.id,
												connections.some((item) => item.id === conn.id) ? "project" : "global",
											)
										}
										onContextMenu={(e: React.MouseEvent) => {
											e.preventDefault();
											setHostMenu({
												x: e.clientX,
												y: e.clientY,
												conn,
												scope: connections.some((item) => item.id === conn.id)
													? "project"
													: "global",
											});
										}}
									/>
								),
							)}
						</div>
						{filteredConnections.length === 0 && (
							<div className="text-sm text-connexio-text-muted">No hosts found.</div>
						)}
					</div>
				)}

				{hostMenu && (
					<SSHManagerContextMenu
						x={hostMenu.x}
						y={hostMenu.y}
						onClose={() => setHostMenu(null)}
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

				{activeView === "identities" && <IdentitiesManager />}

				{activeView === "knownHosts" && <KnownHostsManager />}
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

// ============================================
// SSH Connection Item
// ============================================
function SSHItem({
	connection,
	onConnect,
	isConnecting,
	onSftp,
	onEdit,
	onDelete,
}: {
	connection: SSHConnection;
	onConnect: () => void;
	isConnecting?: boolean;
	onSftp: () => void;
	onEdit: () => void;
	onDelete: () => void;
}) {
	const [fixingKnownHost, setFixingKnownHost] = useState(false);

	const fixOpenSSHKnownHost = async () => {
		if (
			!window.confirm(
				`Remove old OpenSSH known_hosts entry for ${connection.host}:${connection.port}?`,
			)
		)
			return;
		setFixingKnownHost(true);
		try {
			await window.connexio.ssh.forgetOpenSSHHost(connection.host, connection.port);
		} catch (error) {
			window.alert(String(error));
		} finally {
			setFixingKnownHost(false);
		}
	};
	return (
		<div className="group flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-connexio-bg-tertiary transition-colors">
			<button
				onClick={onConnect}
				className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
				type="button"
				title={`Connect to ${connection.username}@${connection.host}:${connection.port}`}
			>
				<Server
					size={10}
					className={`${isConnecting ? "text-connexio-accent animate-pulse" : "text-green-400"} flex-shrink-0`}
				/>
				<div className="flex flex-col min-w-0">
					<span className="text-[11px] text-connexio-text truncate leading-tight">
						{connection.name}
					</span>
					<span className="text-[9px] text-connexio-text-muted truncate leading-tight">
						{connection.username}@{connection.host}
						{connection.port !== 22 ? `:${connection.port}` : ""}
					</span>
					{((connection.tags && connection.tags.length > 0) || connection.folder) && (
						<div className="flex items-center gap-1 mt-0.5 overflow-hidden">
							{connection.folder && (
								<span className="px-1 py-0.5 rounded bg-connexio-bg text-[8px] text-connexio-text-muted truncate">
									{connection.folder}
								</span>
							)}
							{(connection.tags || []).slice(0, 2).map((tag) => (
								<span
									key={tag}
									className="px-1 py-0.5 rounded bg-connexio-accent/10 text-[8px] text-connexio-accent truncate"
								>
									{tag}
								</span>
							))}
						</div>
					)}
				</div>
			</button>

			{/* Auth indicator */}
			<div
				className="flex-shrink-0"
				title={
					connection.authMethod === "key"
						? "Key auth"
						: connection.authMethod === "agent"
							? "SSH agent auth"
							: "Password auth"
				}
			>
				<Key
					size={9}
					className={
						connection.authMethod === "key"
							? "text-yellow-400"
							: connection.authMethod === "agent"
								? "text-green-400"
								: "text-connexio-text-muted"
					}
				/>
			</div>

			{/* Actions */}
			<div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
				<button
					onClick={onSftp}
					className="p-0.5 rounded hover:bg-connexio-bg transition-colors"
					type="button"
					title="Browse SFTP"
				>
					<FolderOpen size={9} className="text-connexio-text-muted" />
				</button>
				<button
					onClick={fixOpenSSHKnownHost}
					disabled={fixingKnownHost}
					className="p-0.5 rounded hover:bg-yellow-500/20 transition-colors disabled:opacity-40"
					type="button"
					title="Remove old OpenSSH known_hosts entry"
				>
					<Key size={9} className="text-yellow-400" />
				</button>
				<button
					onClick={onEdit}
					className="p-0.5 rounded hover:bg-connexio-bg transition-colors"
					type="button"
					title="Edit"
				>
					<Pencil size={9} className="text-connexio-text-muted" />
				</button>
				<button
					onClick={onDelete}
					className="p-0.5 rounded hover:bg-red-500/100/20 transition-colors"
					type="button"
					title="Delete"
				>
					<Trash2 size={9} className="text-red-400" />
				</button>
			</div>
		</div>
	);
}

// ============================================
// SSH Edit/Add Form
// ============================================
function SSHEditForm({
	connection,
	section = "basic",
	onSectionChange,
	onSave,
	onCancel,
}: {
	connection?: SSHConnection;
	section?: "basic" | "auth" | "advanced";
	onSectionChange?: (section: "basic" | "auth" | "advanced") => void;
	onSave: (conn: SSHConnection) => void;
	onCancel: () => void;
}) {
	const [name, setName] = useState(connection?.name || "");
	const [host, setHost] = useState(connection?.host || "");
	const [port, setPort] = useState(connection?.port || 22);
	const [username, setUsername] = useState(connection?.username || "");
	const [authMethod, setAuthMethod] = useState<"password" | "key" | "agent">(
		connection?.authMethod || "password",
	);
	const [privateKeyPath, setPrivateKeyPath] = useState(connection?.privateKeyPath || "");
	const [testPassword, setTestPassword] = useState("");
	const [rememberSecret, setRememberSecret] = useState(false);
	const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
	const [testMessage, setTestMessage] = useState("");
	const [testFingerprint, setTestFingerprint] = useState<string | null>(null);
	const [testHostTrust, setTestHostTrust] = useState<"unknown" | "trusted" | "changed" | null>(
		null,
	);
	const [folder, setFolder] = useState(connection?.folder || "");
	const [tags, setTags] = useState((connection?.tags || []).join(", "));
	const [keepAliveSecs, setKeepAliveSecs] = useState(connection?.keepAliveSecs || 30);
	const [validationError, setValidationError] = useState("");
	const nameRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		nameRef.current?.focus();
	}, []);

	const handleSelectKey = async () => {
		const keyPath = await window.connexio.ssh.selectKey();
		if (keyPath) {
			setPrivateKeyPath(keyPath);
		}
	};

	const secretKey = (connId: string, kind: "password" | "passphrase") => `ssh:${connId}:${kind}`;
	const secretRef = (connId: string, kind: "password" | "passphrase"): SSHSecretRef => ({
		provider: "keychain",
		key: secretKey(connId, kind),
	});

	const handleSave = async () => {
		if (!name.trim() || !host.trim() || !username.trim()) {
			const missing = [
				!name.trim() && "name",
				!host.trim() && "host",
				!username.trim() && "username",
			].filter(Boolean);
			setValidationError(`Required: ${missing.join(", ")}`);
			return;
		}
		setValidationError("");
		const id = connection?.id || uuid();
		const shouldSavePassword = rememberSecret && authMethod === "password" && testPassword;
		const shouldSavePassphrase = rememberSecret && authMethod === "key" && testPassword;
		if (shouldSavePassword || shouldSavePassphrase) {
			await window.connexio.ssh.setSecret(
				secretKey(id, authMethod === "password" ? "password" : "passphrase"),
				testPassword,
			);
		}
		onSave({
			id,
			name: name.trim(),
			host: host.trim(),
			port,
			username: username.trim(),
			authMethod,
			privateKeyPath: authMethod === "key" ? privateKeyPath : undefined,
			folder: folder.trim() || undefined,
			tags: tags
				.split(",")
				.map((tag) => tag.trim())
				.filter(Boolean),
			passwordSecretRef: shouldSavePassword
				? secretRef(id, "password")
				: connection?.passwordSecretRef,
			passphraseSecretRef: shouldSavePassphrase
				? secretRef(id, "passphrase")
				: connection?.passphraseSecretRef,
			keepAliveSecs,
			startupCommands: connection?.startupCommands || [],
			tunnels: connection?.tunnels || [],
		});
	};

	const buildDraftConnection = (): SSHConnection => ({
		id: connection?.id || uuid(),
		name: name.trim() || "Untitled SSH",
		host: host.trim(),
		port,
		username: username.trim(),
		authMethod,
		privateKeyPath: authMethod === "key" ? privateKeyPath : undefined,
		folder: folder.trim() || undefined,
		tags: tags
			.split(",")
			.map((tag) => tag.trim())
			.filter(Boolean),
		keepAliveSecs,
		startupCommands: connection?.startupCommands || [],
		tunnels: connection?.tunnels || [],
	});

	const handleTestConnection = async () => {
		if (!host.trim() || !username.trim()) return;
		setTestStatus("testing");
		setTestMessage("Testing SSH connection...");
		try {
			const result = await window.connexio.ssh.testConnection(
				buildDraftConnection(),
				testPassword || undefined,
			);
			setTestStatus(result.success ? "success" : "error");
			setTestFingerprint(result.fingerprintSha256 || null);
			setTestHostTrust(result.hostTrust);
			if (result.success) {
				setTestMessage("Connection successful");
			} else {
				setTestMessage(result.message);
			}
		} catch (error) {
			setTestStatus("error");
			setTestFingerprint(null);
			setTestHostTrust(null);
			setTestMessage(String(error));
		}
	};

	const handleTrustHost = async () => {
		if (!host.trim() || !testFingerprint) return;
		await window.connexio.ssh.trustHost(host.trim(), port, testFingerprint);
		setTestHostTrust("trusted");
		setTestMessage("Host trusted");
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			e.preventDefault();
			handleSave();
		}
		if (e.key === "Escape") {
			e.preventDefault();
			onCancel();
		}
	};

	return (
		<div className="p-4 space-y-4 bg-connexio-bg-tertiary rounded-xl border border-connexio-border">
			<div className="flex items-center gap-1 rounded-lg bg-connexio-bg p-1 border border-connexio-border">
				{(["basic", "auth", "advanced"] as const).map((item) => (
					<button
						key={item}
						onClick={() => onSectionChange?.(item)}
						className={`flex-1 px-3 py-1.5 text-xs rounded-md capitalize transition-colors ${section === item ? "bg-connexio-accent/15 text-connexio-accent font-medium" : "text-connexio-text-muted hover:text-connexio-text"}`}
						type="button"
					>
						{item}
					</button>
				))}
			</div>

			{section === "basic" && (
				<div className="space-y-3">
					<div>
						<label className="block text-[11px] font-medium text-connexio-text-secondary mb-1">
							Connection name
						</label>
						<input
							ref={nameRef}
							type="text"
							placeholder="e.g. Production Server"
							value={name}
							onChange={(e) => setName(e.target.value)}
							onKeyDown={handleKeyDown}
							className="w-full px-3 py-2 text-xs bg-connexio-bg border border-connexio-border rounded-lg text-connexio-text outline-none focus:border-connexio-accent transition-colors"
						/>
					</div>
					<div>
						<label className="block text-[11px] font-medium text-connexio-text-secondary mb-1">
							Host & Port
						</label>
						<div className="flex gap-2">
							<input
								type="text"
								placeholder="hostname or IP"
								value={host}
								onChange={(e) => setHost(e.target.value)}
								onKeyDown={handleKeyDown}
								className="flex-1 px-3 py-2 text-xs bg-connexio-bg border border-connexio-border rounded-lg text-connexio-text outline-none focus:border-connexio-accent transition-colors"
							/>
							<input
								type="number"
								placeholder="22"
								value={port}
								onChange={(e) => setPort(Number(e.target.value) || 22)}
								onKeyDown={handleKeyDown}
								className="w-20 px-3 py-2 text-xs bg-connexio-bg border border-connexio-border rounded-lg text-connexio-text outline-none focus:border-connexio-accent text-center transition-colors"
							/>
						</div>
					</div>
					<div>
						<label className="block text-[11px] font-medium text-connexio-text-secondary mb-1">
							Username
						</label>
						<input
							type="text"
							placeholder="root"
							value={username}
							onChange={(e) => setUsername(e.target.value)}
							onKeyDown={handleKeyDown}
							className="w-full px-3 py-2 text-xs bg-connexio-bg border border-connexio-border rounded-lg text-connexio-text outline-none focus:border-connexio-accent transition-colors"
						/>
					</div>
				</div>
			)}

			{section === "auth" && (
				<div className="space-y-3">
					<div>
						<label className="block text-[11px] font-medium text-connexio-text-secondary mb-1">
							Authentication method
						</label>
						<div className="flex gap-1">
							{(["password", "key", "agent"] as const).map((method) => (
								<button
									key={method}
									onClick={() => setAuthMethod(method)}
									className={`flex-1 px-3 py-2 text-xs rounded-lg border transition-colors ${authMethod === method ? "border-connexio-accent bg-connexio-accent/10 text-connexio-accent font-medium" : "border-connexio-border text-connexio-text-muted hover:border-connexio-text-muted"}`}
									type="button"
								>
									{method === "password" ? "Password" : method === "key" ? "SSH Key" : "Agent"}
								</button>
							))}
						</div>
					</div>
					{authMethod === "key" && (
						<div>
							<label className="block text-[11px] font-medium text-connexio-text-secondary mb-1">
								Private key path
							</label>
							<div className="flex gap-2">
								<input
									type="text"
									placeholder="~/.ssh/id_rsa"
									value={privateKeyPath}
									onChange={(e) => setPrivateKeyPath(e.target.value)}
									onKeyDown={handleKeyDown}
									className="flex-1 px-3 py-2 text-xs bg-connexio-bg border border-connexio-border rounded-lg text-connexio-text outline-none focus:border-connexio-accent font-mono transition-colors"
								/>
								<button
									onClick={handleSelectKey}
									className="px-3 py-2 bg-connexio-bg border border-connexio-border rounded-lg hover:border-connexio-accent/50 transition-colors"
									type="button"
									title="Browse for key file"
								>
									<FolderOpen size={13} className="text-connexio-text-muted" />
								</button>
							</div>
						</div>
					)}
					{authMethod !== "agent" && (
						<div>
							<label className="block text-[11px] font-medium text-connexio-text-secondary mb-1">
								{authMethod === "key" ? "Passphrase" : "Password"}
							</label>
							<input
								type="password"
								placeholder={
									authMethod === "key" ? "Optional — for test & save" : "For test & save"
								}
								value={testPassword}
								onChange={(e) => setTestPassword(e.target.value)}
								onKeyDown={handleKeyDown}
								className="w-full px-3 py-2 text-xs bg-connexio-bg border border-connexio-border rounded-lg text-connexio-text outline-none focus:border-connexio-accent transition-colors"
							/>
							<label className="flex items-center gap-1.5 mt-2 text-[11px] text-connexio-text-muted cursor-pointer">
								<input
									type="checkbox"
									checked={rememberSecret}
									onChange={(e) => setRememberSecret(e.target.checked)}
									className="w-3.5 h-3.5 rounded"
								/>
								Save in OS keychain
							</label>
						</div>
					)}
					{testMessage && (
						<div
							className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs ${testStatus === "success" ? "text-green-400 bg-green-500/10" : testStatus === "error" ? "text-red-400 bg-red-500/10" : "text-connexio-text-muted bg-connexio-bg"}`}
						>
							{testStatus === "success" && <Check size={12} />}
							{testMessage}
						</div>
					)}
					{testFingerprint && testHostTrust !== "trusted" && (
						<button
							onClick={handleTrustHost}
							className={`w-full text-left text-xs px-3 py-2 rounded-lg border transition-colors ${testHostTrust === "changed" ? "border-red-500/50 text-red-300 bg-red-500/10" : "border-yellow-500/40 text-yellow-300 bg-yellow-500/10"}`}
							type="button"
						>
							{testHostTrust === "changed"
								? "Host key changed — trust new fingerprint"
								: "Trust this host fingerprint"}
						</button>
					)}
				</div>
			)}

			{section === "advanced" && (
				<div className="space-y-3">
					<div>
						<label className="block text-[11px] font-medium text-connexio-text-secondary mb-1">
							Folder & Keep-alive
						</label>
						<div className="flex gap-2">
							<input
								type="text"
								placeholder="Group folder"
								value={folder}
								onChange={(e) => setFolder(e.target.value)}
								onKeyDown={handleKeyDown}
								className="flex-1 px-3 py-2 text-xs bg-connexio-bg border border-connexio-border rounded-lg text-connexio-text outline-none focus:border-connexio-accent transition-colors"
							/>
							<div className="flex items-center gap-1">
								<input
									type="number"
									value={keepAliveSecs}
									onChange={(e) => setKeepAliveSecs(Number(e.target.value) || 30)}
									onKeyDown={handleKeyDown}
									className="w-16 px-2 py-2 text-xs bg-connexio-bg border border-connexio-border rounded-lg text-connexio-text outline-none focus:border-connexio-accent text-center transition-colors"
								/>
								<span className="text-[10px] text-connexio-text-muted">sec</span>
							</div>
						</div>
					</div>
					<div>
						<label className="block text-[11px] font-medium text-connexio-text-secondary mb-1">
							Tags
						</label>
						<input
							type="text"
							placeholder="production, web, aws"
							value={tags}
							onChange={(e) => setTags(e.target.value)}
							onKeyDown={handleKeyDown}
							className="w-full px-3 py-2 text-xs bg-connexio-bg border border-connexio-border rounded-lg text-connexio-text outline-none focus:border-connexio-accent transition-colors"
						/>
					</div>
				</div>
			)}

			{/* Actions */}
			{validationError && (
				<div className="text-xs text-red-400 bg-red-500/10 px-3 py-1.5 rounded-lg">
					{validationError}
				</div>
			)}
			<div className="flex items-center gap-2 pt-1 border-t border-connexio-border">
				<button
					onClick={handleTestConnection}
					disabled={!host.trim() || !username.trim() || testStatus === "testing"}
					className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-connexio-accent border border-connexio-accent/40 rounded-lg hover:bg-connexio-accent/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
					type="button"
				>
					<Zap size={11} />
					{testStatus === "testing" ? "Testing..." : "Test"}
				</button>
				<div className="flex-1" />
				<button
					onClick={onCancel}
					className="px-3 py-1.5 text-xs text-connexio-text-muted hover:text-connexio-text rounded-lg hover:bg-connexio-bg transition-colors"
					type="button"
				>
					Cancel
				</button>
				<button
					onClick={handleSave}
					className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-connexio-accent text-connexio-bg rounded-lg hover:bg-connexio-accent-hover transition-colors"
					type="button"
				>
					<Check size={12} />
					{connection ? "Save" : "Add Host"}
				</button>
			</div>
		</div>
	);
}

// Module-level cache to persist SFTP state across remounts
interface SFTPCacheEntry {
	path: string;
	entries: SFTPEntry[];
	password: string;
	passwordLoaded: boolean;
	passwordSaved: boolean;
}
const sftpStateCache = new Map<string, SFTPCacheEntry>();

export function SFTPBrowser({
	connection,
	onBack,
}: {
	connection: SSHConnection;
	onBack?: () => void;
}) {
	const { activeProjectId, openRemoteEditorTab } = useProjectStore();
	const mountedRef = useRef(true);

	// Restore from cache on mount
	const cached = sftpStateCache.get(connection.id);
	const [path, setPath] = useState(cached?.path || ".");
	const [entries, setEntries] = useState<SFTPEntry[]>(cached?.entries || []);
	const [password, setPassword] = useState(cached?.password || "");
	const [passwordLoaded, setPasswordLoaded] = useState(cached?.passwordLoaded || false);
	const [passwordSaved, setPasswordSaved] = useState(cached?.passwordSaved || false);
	const [rememberSftpSecret, setRememberSftpSecret] = useState(false);
	const [operationLabel, setOperationLabel] = useState("");
	const [operationDetail, setOperationDetail] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [previewPath, setPreviewPath] = useState<string | null>(null);
	const [previewContent, setPreviewContent] = useState("");
	const [newFolderName, setNewFolderName] = useState("");
	const [renamingPath, setRenamingPath] = useState<string | null>(null);
	const [renameValue, setRenameValue] = useState("");
	const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: SFTPEntry } | null>(
		null,
	);
	const [deleteConfirm, setDeleteConfirm] = useState<SFTPEntry | null>(null);

	const needsPassword = connection.authMethod !== "agent";

	useEffect(() => {
		mountedRef.current = true;
		const handleClosed = (event: Event) => {
			const detail = (event as CustomEvent).detail;
			if (detail?.connectionId === connection.id) {
				sftpStateCache.delete(connection.id);
			}
		};
		window.addEventListener("connexio:sftp-tab-closed", handleClosed);
		return () => {
			mountedRef.current = false;
			window.removeEventListener("connexio:sftp-tab-closed", handleClosed);
		};
	}, [connection.id]);

	// Sync important state to cache whenever it changes
	useEffect(() => {
		sftpStateCache.set(connection.id, { path, entries, password, passwordLoaded, passwordSaved });
	}, [connection.id, path, entries, password, passwordLoaded, passwordSaved]);

	// Load saved secret only once per connection (skip if already loaded from cache)
	useEffect(() => {
		if (cached?.passwordLoaded) return; // already loaded from cache
		const ref =
			connection.authMethod === "key"
				? connection.passphraseSecretRef
				: connection.passwordSecretRef;
		if (!ref?.key) {
			setPasswordLoaded(true);
			return;
		}
		window.connexio.ssh
			.getSecret(ref.key)
			.then((secret) => {
				if (secret) {
					setPassword(secret);
					setPasswordSaved(true);
				}
			})
			.finally(() => setPasswordLoaded(true));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [connection.id]);

	const loadPath = async (nextPath = path) => {
		setLoading(true);
		setOperationLabel(`Loading ${nextPath}...`);
		setOperationDetail("Reading remote directory");
		setError("");
		try {
			await ensureSecretSaved();
			const result = await window.connexio.ssh.sftpList(
				connection,
				nextPath,
				password || undefined,
			);
			setEntries(result);
			setPath(nextPath);
			setPreviewPath(null);
			setPreviewContent("");
		} catch (err) {
			setError(String(err));
		} finally {
			setLoading(false);
			setOperationLabel("");
			setOperationDetail("");
		}
	};

	const MAX_PREVIEW_BYTES = 1024 * 1024;

	const openEntry = async (entry: SFTPEntry) => {
		if (entry.isDir) {
			await loadPath(entry.path);
			return;
		}
		if (entry.size != null && entry.size > MAX_PREVIEW_BYTES) {
			setPreviewPath(entry.path);
			setPreviewContent(
				`File is too large to preview safely (${formatSize(entry.size)}). Use download support in a later update, or open smaller text files.`,
			);
			return;
		}
		setLoading(true);
		setError("");
		try {
			await ensureSecretSaved();
			const content = await window.connexio.ssh.sftpRead(
				connection,
				entry.path,
				password || undefined,
			);
			if (content.includes("\u0000")) {
				setPreviewPath(entry.path);
				setPreviewContent("Binary file preview is disabled.");
				return;
			}
			setPreviewPath(entry.path);
			setPreviewContent(content);
		} catch (err) {
			setError(String(err));
		} finally {
			setLoading(false);
		}
	};

	const openInEditor = async () => {
		if (!activeProjectId || !previewPath) return;
		if (previewContent.startsWith("File is too large") || previewContent.startsWith("Binary file"))
			return;
		openRemoteEditorTab(activeProjectId, connection, previewPath, previewContent, false);
	};

	const openEntryInEditor = async (entry: SFTPEntry) => {
		if (!activeProjectId || entry.isDir) return;
		if (entry.size != null && entry.size > MAX_PREVIEW_BYTES) {
			setError(`File is too large to edit safely (${formatSize(entry.size)}).`);
			return;
		}
		setLoading(true);
		setOperationLabel("Opening remote file in editor...");
		setOperationDetail(entry.path);
		setError("");
		try {
			await ensureSecretSaved();
			const content = await window.connexio.ssh.sftpRead(
				connection,
				entry.path,
				password || undefined,
			);
			if (content.includes("\u0000")) {
				setError("Binary file editing is disabled.");
				return;
			}
			openRemoteEditorTab(activeProjectId, connection, entry.path, content, false);
		} catch (err) {
			setError(String(err));
		} finally {
			setLoading(false);
			setOperationLabel("");
		}
	};

	const joinRemotePath = (base: string, name: string) => {
		const cleanName = name.replace(/^\/+/, "");
		if (!base || base === ".") return cleanName;
		return base.endsWith("/") ? `${base}${cleanName}` : `${base}/${cleanName}`;
	};

	const parentPath = () => {
		const normalized = path.replace(/\/+$/, "");
		if (!normalized || normalized === "/" || normalized === ".") return "/";
		const parent = normalized.split("/").slice(0, -1).join("/");
		return parent || "/";
	};

	const secretKind = connection.authMethod === "key" ? "passphrase" : "password";
	const saveSftpSecret = async () => {
		if (!password || connection.authMethod === "agent") return connection;
		const key = `ssh:${connection.id}:${secretKind}`;
		await window.connexio.ssh.setSecret(key, password);
		setPasswordSaved(true);
		setRememberSftpSecret(false);
		return {
			...connection,
			...(secretKind === "password"
				? { passwordSecretRef: { provider: "keychain", key } as SSHSecretRef }
				: { passphraseSecretRef: { provider: "keychain", key } as SSHSecretRef }),
		};
	};

	const ensureSecretSaved = async () => {
		if (rememberSftpSecret && password && !passwordSaved) {
			await saveSftpSecret();
		}
	};

	const createFolder = async () => {
		const folderName = newFolderName.trim();
		if (!folderName) return;
		setLoading(true);
		setError("");
		try {
			await ensureSecretSaved();
			await window.connexio.ssh.sftpMkdir(
				connection,
				joinRemotePath(path, folderName),
				password || undefined,
			);
			setNewFolderName("");
			await loadPath(path);
		} catch (err) {
			setError(String(err));
		} finally {
			setLoading(false);
		}
	};

	const uploadFile = async () => {
		const selected = await open({ multiple: false });
		if (!selected || Array.isArray(selected)) return;
		setLoading(true);
		setOperationLabel("Uploading file...");
		setOperationDetail(selected.replace(/\\/g, "/").split("/").pop() || "file");
		setError("");
		try {
			await ensureSecretSaved();
			const name = selected.replace(/\\/g, "/").split("/").pop() || "upload";
			await window.connexio.ssh.sftpUpload(
				connection,
				selected,
				joinRemotePath(path, name),
				password || undefined,
			);
			await loadPath(path);
		} catch (err) {
			setError(String(err));
		} finally {
			setLoading(false);
			setOperationLabel("");
		}
	};

	const downloadEntry = async (entry: SFTPEntry) => {
		if (entry.isDir) return;
		const target = await save({ defaultPath: entry.name });
		if (!target) return;
		setLoading(true);
		setOperationLabel("Downloading file...");
		setOperationDetail(entry.path);
		setError("");
		try {
			await ensureSecretSaved();
			await window.connexio.ssh.sftpDownload(connection, entry.path, target, password || undefined);
		} catch (err) {
			setError(String(err));
		} finally {
			setLoading(false);
			setOperationLabel("");
		}
	};

	const deleteEntry = async (entry: SFTPEntry) => {
		setDeleteConfirm(entry);
	};

	const confirmDeleteEntry = async () => {
		if (!deleteConfirm) return;
		const entry = deleteConfirm;
		setDeleteConfirm(null);
		setLoading(true);
		setError("");
		try {
			await ensureSecretSaved();
			await window.connexio.ssh.sftpDelete(
				connection,
				entry.path,
				entry.isDir,
				password || undefined,
			);
			if (previewPath === entry.path) {
				setPreviewPath(null);
				setPreviewContent("");
			}
			await loadPath(path);
		} catch (err) {
			setError(String(err));
		} finally {
			setLoading(false);
		}
	};

	const startRename = (entry: SFTPEntry) => {
		setRenamingPath(entry.path);
		setRenameValue(entry.name);
	};

	const commitRename = async (entry: SFTPEntry) => {
		const nextName = renameValue.trim();
		if (!nextName || nextName === entry.name) {
			setRenamingPath(null);
			return;
		}
		setLoading(true);
		setError("");
		try {
			await ensureSecretSaved();
			const nextPath = joinRemotePath(path, nextName);
			await window.connexio.ssh.sftpRename(connection, entry.path, nextPath, password || undefined);
			if (previewPath === entry.path) setPreviewPath(nextPath);
			setRenamingPath(null);
			await loadPath(path);
		} catch (err) {
			setError(String(err));
		} finally {
			setLoading(false);
		}
	};

	const formatSize = (size?: number) => {
		if (size == null) return "";
		if (size < 1024) return `${size} B`;
		if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
		return `${(size / 1024 / 1024).toFixed(1)} MB`;
	};

	const breadcrumbParts = path.split("/").filter(Boolean);

	return (
		<div className="flex flex-col h-full overflow-hidden bg-connexio-bg text-connexio-text">
			<div className="flex items-center gap-3 px-5 py-4 border-b border-connexio-border bg-connexio-bg-secondary">
				{onBack && (
					<button
						onClick={onBack}
						className="text-sm text-connexio-text-muted hover:text-connexio-text"
						type="button"
					>
						← Hosts
					</button>
				)}
				<div className="w-10 h-10 rounded-2xl bg-connexio-accent text-connexio-bg flex items-center justify-center font-bold">
					{connection.name.slice(0, 2).toUpperCase()}
				</div>
				<div className="min-w-0 flex-1">
					<div className="text-base font-semibold truncate">{connection.name}</div>
					<div className="text-xs text-connexio-text-muted truncate">
						{connection.username}@{connection.host}:{connection.port}
					</div>
				</div>
				<button
					onClick={uploadFile}
					disabled={loading}
					className="px-3 py-2 rounded-xl bg-connexio-bg-tertiary text-sm font-medium disabled:opacity-50"
					type="button"
				>
					Upload
				</button>
				<button
					onClick={() => loadPath(path)}
					disabled={loading}
					className="px-3 py-2 rounded-xl bg-connexio-bg-tertiary text-sm font-medium disabled:opacity-50"
					type="button"
				>
					Refresh
				</button>
			</div>

			<div className="flex-1 min-h-0 flex">
				<aside className="w-64 border-r border-connexio-border bg-connexio-bg-secondary p-3 space-y-3 hidden lg:block">
					<div className="text-xs font-semibold text-connexio-text-muted uppercase tracking-wider">
						Connection
					</div>
					{needsPassword && (
						<div className="space-y-2">
							<input
								type="password"
								placeholder={
									passwordLoaded && password
										? "saved secret loaded"
										: connection.authMethod === "key"
											? "passphrase"
											: "password"
								}
								value={password}
								onChange={(e) => {
									setPassword(e.target.value);
									setPasswordSaved(false);
								}}
								className="w-full px-3 py-2 text-sm bg-connexio-bg border border-connexio-border rounded-xl outline-none focus:border-connexio-accent"
							/>
							<label className="flex items-center gap-2 text-xs text-connexio-text-muted">
								<input
									type="checkbox"
									checked={rememberSftpSecret}
									onChange={(e) => setRememberSftpSecret(e.target.checked)}
								/>
								Save {secretKind} for SFTP/editor
							</label>
							{passwordSaved && (
								<div className="text-xs text-green-600">Saved credential loaded</div>
							)}
						</div>
					)}
					<div className="space-y-1">
						<button
							onClick={() => loadPath(".")}
							className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-connexio-bg-tertiary text-sm text-left"
							type="button"
						>
							<FolderOpen size={15} /> Home
						</button>
						<button
							onClick={() => loadPath("/")}
							className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-connexio-bg-tertiary text-sm text-left"
							type="button"
						>
							<FolderOpen size={15} /> Root
						</button>
					</div>
					<div className="pt-3 border-t border-connexio-border space-y-2">
						<div className="text-xs font-semibold text-connexio-text-muted uppercase tracking-wider">
							New folder
						</div>
						<input
							value={newFolderName}
							onChange={(e) => setNewFolderName(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") createFolder();
							}}
							placeholder="folder name"
							className="w-full px-3 py-2 text-sm bg-connexio-bg border border-connexio-border rounded-xl outline-none"
						/>
						<button
							onClick={createFolder}
							disabled={loading || !newFolderName.trim()}
							className="w-full px-3 py-2 rounded-xl bg-connexio-accent text-connexio-bg text-sm disabled:opacity-40"
							type="button"
						>
							Create
						</button>
					</div>
				</aside>

				<main className="flex-1 min-w-0 flex flex-col">
					<div className="px-5 py-3 border-b border-connexio-border bg-connexio-bg-secondary space-y-2">
						<div className="flex gap-2">
							<input
								value={path}
								onChange={(e) => setPath(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") loadPath(path);
								}}
								className="flex-1 px-3 py-2 text-sm bg-connexio-bg border border-connexio-border rounded-xl outline-none font-mono"
							/>
							<button
								onClick={() => loadPath(path)}
								disabled={loading}
								className="px-4 py-2 rounded-xl bg-connexio-accent text-connexio-bg text-sm disabled:opacity-50"
								type="button"
							>
								Go
							</button>
						</div>
						<div className="flex items-center gap-1 text-xs text-connexio-text-muted">
							<button
								onClick={() => loadPath("/")}
								className="hover:text-connexio-text"
								type="button"
							>
								/
							</button>
							{breadcrumbParts.map((part, index) => {
								const next = `/${breadcrumbParts.slice(0, index + 1).join("/")}`;
								return (
									<button
										key={`${part}-${index}`}
										onClick={() => loadPath(next)}
										className="hover:text-connexio-text"
										type="button"
									>
										{part} /
									</button>
								);
							})}
						</div>
						{error && <div className="text-xs text-red-400">{error}</div>}
					</div>

					<div className="flex-1 min-h-0 overflow-auto bg-connexio-bg-secondary relative">
						{loading && (
							<div className="absolute inset-0 z-20 flex items-center justify-center bg-connexio-bg/60 backdrop-blur-sm">
								<div className="rounded-xl border border-connexio-border bg-connexio-bg-secondary px-4 py-3 shadow-2xl min-w-64">
									<div className="text-sm font-medium text-connexio-text">
										{operationLabel || "Working..."}
									</div>
									{operationDetail && (
										<div className="mt-1 text-xs text-connexio-text-muted truncate max-w-80">
											{operationDetail}
										</div>
									)}
									<div className="mt-3 h-1.5 rounded-full overflow-hidden bg-connexio-bg-tertiary">
										<div className="h-full w-1/2 rounded-full bg-connexio-accent animate-pulse" />
									</div>
								</div>
							</div>
						)}
						<table className="w-full text-sm">
							<thead className="sticky top-0 bg-connexio-bg border-b border-connexio-border text-xs text-connexio-text-muted">
								<tr>
									<th className="text-left font-medium px-5 py-2">Name</th>
									<th className="text-right font-medium px-3 py-2 w-28">Size</th>
									<th className="text-right font-medium px-3 py-2 w-28">Actions</th>
								</tr>
							</thead>
							<tbody>
								<tr className="border-b border-connexio-border/50 hover:bg-connexio-bg">
									<td className="px-5 py-2">
										<button
											onClick={() => loadPath(parentPath())}
											className="flex items-center gap-2 text-connexio-text-muted"
											type="button"
										>
											<FolderOpen size={15} /> ..
										</button>
									</td>
									<td />
									<td />
								</tr>
								{entries.map((entry) => (
									<tr
										key={entry.path}
										onContextMenu={(e) => {
											e.preventDefault();
											e.stopPropagation();
											setContextMenu({ x: e.clientX, y: e.clientY, entry });
										}}
										className="group border-b border-connexio-border/50 hover:bg-connexio-bg"
									>
										<td className="px-5 py-2">
											<button
												onClick={() => openEntry(entry)}
												className="flex items-center gap-2 min-w-0 text-left w-full"
												type="button"
											>
												{entry.isDir ? (
													<FolderOpen size={15} className="text-yellow-400 flex-shrink-0" />
												) : (
													<FileText size={15} className="text-connexio-text-muted flex-shrink-0" />
												)}
												{renamingPath === entry.path ? (
													<input
														value={renameValue}
														onChange={(e) => setRenameValue(e.target.value)}
														onClick={(e) => e.stopPropagation()}
														onKeyDown={(e) => {
															if (e.key === "Enter") commitRename(entry);
															if (e.key === "Escape") setRenamingPath(null);
														}}
														className="flex-1 px-2 py-1 bg-connexio-bg text-connexio-text border border-connexio-accent/50 rounded outline-none focus:border-connexio-accent"
														autoFocus
													/>
												) : (
													<span className="truncate">{entry.name}</span>
												)}
											</button>
										</td>
										<td className="px-3 py-2 text-right text-connexio-text-muted text-xs">
											{entry.isDir ? "--" : formatSize(entry.size)}
										</td>
										<td className="px-3 py-2">
											<div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
												{!entry.isDir && (
													<button
														onClick={() => openEntryInEditor(entry)}
														className="p-1 rounded hover:bg-connexio-bg-tertiary"
														type="button"
														title="Open in Connexio editor"
													>
														<Pencil size={13} />
													</button>
												)}
												<button
													onClick={() =>
														renamingPath === entry.path ? commitRename(entry) : startRename(entry)
													}
													className="p-1 rounded hover:bg-connexio-bg-tertiary"
													type="button"
													title="Rename"
												>
													<span className="text-[11px]">Aa</span>
												</button>
												{!entry.isDir && (
													<button
														onClick={() => downloadEntry(entry)}
														className="p-1 rounded hover:bg-connexio-bg-tertiary"
														type="button"
														title="Download"
													>
														<FileText size={13} />
													</button>
												)}
												<button
													onClick={() => deleteEntry(entry)}
													className="p-1 rounded hover:bg-red-500/10"
													type="button"
												>
													<Trash2 size={13} className="text-red-400" />
												</button>
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
						{loading && (
							<div className="p-4 text-sm text-connexio-text-muted">
								{operationLabel || "Loading..."}
							</div>
						)}
					</div>
				</main>

				{contextMenu && (
					<SSHManagerContextMenu
						x={contextMenu.x}
						y={contextMenu.y}
						onClose={() => setContextMenu(null)}
						items={[
							{
								label: contextMenu.entry.isDir ? "Open Folder" : "Preview",
								onClick: () => openEntry(contextMenu.entry),
							},
							...(contextMenu.entry.isDir
								? []
								: [
										{
											label: "Open in Connexio Editor",
											onClick: () => openEntryInEditor(contextMenu.entry),
										},
										{ label: "Download", onClick: () => downloadEntry(contextMenu.entry) },
									]),
							{ label: "Rename", onClick: () => startRename(contextMenu.entry) },
							{ label: "Delete", danger: true, onClick: () => deleteEntry(contextMenu.entry) },
						]}
					/>
				)}

				{previewPath && (
					<aside className="w-[38%] max-w-[560px] min-w-[320px] border-l border-connexio-border bg-connexio-bg-secondary hidden xl:flex flex-col">
						<div className="flex items-center gap-2 px-4 py-3 border-b border-connexio-border">
							<FileText size={15} className="text-connexio-accent" />
							<span className="flex-1 min-w-0 truncate text-sm font-mono text-connexio-text-secondary">
								{previewPath}
							</span>
							<button
								onClick={openInEditor}
								className="px-2 py-1 text-xs rounded-lg bg-connexio-accent/10 text-connexio-accent"
								type="button"
							>
								Edit
							</button>
							<button
								onClick={() => {
									setPreviewPath(null);
									setPreviewContent("");
								}}
								className="p-1 rounded hover:bg-connexio-bg-tertiary"
								type="button"
							>
								<X size={14} />
							</button>
						</div>
						<pre className="flex-1 overflow-auto p-4 text-xs text-connexio-text bg-connexio-bg font-mono whitespace-pre-wrap">
							{previewContent}
						</pre>
					</aside>
				)}
			</div>

			{deleteConfirm && (
				<ConfirmDialog
					title={deleteConfirm.isDir ? "Delete Folder" : "Delete File"}
					message={`Delete "${deleteConfirm.name}" from remote server? This cannot be undone.`}
					confirmLabel="Delete"
					variant="danger"
					onConfirm={confirmDeleteEntry}
					onCancel={() => setDeleteConfirm(null)}
				/>
			)}
		</div>
	);
}

function KnownHostsManager() {
	const [hosts, setHosts] = useState<import("../../shared/types").SSHKnownHost[]>([]);
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

	const forget = async (host: import("../../shared/types").SSHKnownHost) => {
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

function IdentitiesManager() {
	return (
		<div className="p-3 space-y-3">
			<div className="flex items-center gap-2">
				<Key size={14} className="text-connexio-accent" />
				<div>
					<div className="text-[11px] font-semibold text-connexio-text">Identities</div>
					<div className="text-[9px] text-connexio-text-muted">
						Reusable credentials are planned for the next SSH milestone.
					</div>
				</div>
			</div>
			<div className="rounded border border-connexio-border bg-connexio-bg-secondary p-3 text-[10px] text-connexio-text-muted leading-relaxed">
				Current hosts can already save passwords/passphrases securely in the OS keychain. This tab
				will later promote those into reusable identities shared across hosts.
			</div>
		</div>
	);
}

function SSHHostCard({
	connection,
	isConnecting,
	onConnect,
	onSftp,
	onEdit,
	onDelete,
	onContextMenu,
}: {
	connection: SSHConnection;
	isConnecting?: boolean;
	onConnect: () => void;
	onSftp: () => void;
	onEdit: () => void;
	onDelete: () => void;
	onContextMenu?: (e: React.MouseEvent) => void;
}) {
	const iconText = (connection.name || connection.host).slice(0, 2).toUpperCase();
	const authLabel =
		connection.authMethod === "key"
			? "Key"
			: connection.authMethod === "agent"
				? "Agent"
				: "Password";
	const authColor =
		connection.authMethod === "key"
			? "text-yellow-400"
			: connection.authMethod === "agent"
				? "text-green-400"
				: "text-connexio-text-muted";
	return (
		<div
			onContextMenu={onContextMenu}
			className="group min-h-[76px] rounded-2xl bg-connexio-bg-secondary border border-connexio-border hover:border-connexio-accent/40 transition-all px-4 py-3 flex items-center gap-3"
		>
			<button
				onClick={onConnect}
				className="flex items-center gap-3 flex-1 min-w-0 text-left"
				type="button"
			>
				<div
					className={`${isConnecting ? "animate-pulse bg-connexio-accent" : "bg-connexio-accent"} w-12 h-12 rounded-2xl flex items-center justify-center text-connexio-bg font-bold text-sm flex-shrink-0`}
				>
					{iconText}
				</div>
				<div className="min-w-0">
					<div className="text-sm font-semibold text-connexio-text truncate">{connection.name}</div>
					<div className="text-xs text-connexio-text-muted truncate">
						{connection.username}@{connection.host}
						{connection.port !== 22 ? `:${connection.port}` : ""}
					</div>
					<div className="flex items-center gap-2 mt-0.5">
						<span className={`text-[10px] ${authColor}`}>{authLabel}</span>
						{connection.tags && connection.tags.length > 0 && (
							<div className="flex gap-1 overflow-hidden">
								{connection.tags.slice(0, 2).map((tag) => (
									<span
										key={tag}
										className="px-1.5 py-0.5 rounded bg-connexio-bg-tertiary text-[10px] text-connexio-text-muted"
									>
										{tag}
									</span>
								))}
							</div>
						)}
					</div>
				</div>
			</button>
			<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
				<button
					onClick={onSftp}
					className="p-1.5 rounded-lg hover:bg-connexio-bg-tertiary"
					type="button"
					title="Browse files (SFTP)"
				>
					<FolderOpen size={14} className="text-connexio-text-muted" />
				</button>
				<button
					onClick={onEdit}
					className="p-1.5 rounded-lg hover:bg-connexio-bg-tertiary"
					type="button"
					title="Edit connection"
				>
					<Pencil size={14} className="text-connexio-text-muted" />
				</button>
				<button
					onClick={onDelete}
					className="p-1.5 rounded-lg hover:bg-red-500/10"
					type="button"
					title="Delete connection"
				>
					<Trash2 size={14} className="text-red-400" />
				</button>
			</div>
		</div>
	);
}

function SSHManagerContextMenu({
	x,
	y,
	items,
	onClose,
}: {
	x: number;
	y: number;
	items: Array<{ label: string; danger?: boolean; onClick: () => void | Promise<void> }>;
	onClose: () => void;
}) {
	return (
		<ContextMenu
			x={x}
			y={y}
			onClose={onClose}
			minWidth={176}
			items={items.map((item) => ({
				label: item.label,
				danger: item.danger,
				onClick: item.onClick,
			}))}
		/>
	);
}
