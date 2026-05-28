import {
	Check,
	ChevronDown,
	ChevronRight,
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
import { useEffect, useRef, useState } from "react";
import { v4 as uuid } from "uuid";
import type { SFTPEntry, SSHConnection, SSHSecretRef } from "../../shared/types";

interface Props {
	projectId: string;
	onConnect: (connection: SSHConnection, label: string, password?: string) => void;
}

export default function SSHPanel({ projectId, onConnect }: Props) {
	const [connections, setConnections] = useState<SSHConnection[]>([]);
	const [globalConnections, setGlobalConnections] = useState<SSHConnection[]>(
		[],
	);
	const [showProject, setShowProject] = useState(true);
	const [showGlobal, setShowGlobal] = useState(true);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [isAdding, setIsAdding] = useState<"project" | "global" | null>(null);
	const [sftpConnection, setSftpConnection] = useState<SSHConnection | null>(null);
	const [connectPrompt, setConnectPrompt] = useState<SSHConnection | null>(null);
	const [connectPassword, setConnectPassword] = useState("");
	const [rememberConnectSecret, setRememberConnectSecret] = useState(false);
	const [connectingId, setConnectingId] = useState<string | null>(null);
	const [activeView, setActiveView] = useState<"hosts" | "sftp" | "identities" | "knownHosts">("hosts");
	const [searchQuery, setSearchQuery] = useState("");
	const [showConnectPassword, setShowConnectPassword] = useState(false);

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
		try {
			const savedSecret = await resolveSavedSecret(conn);
			if (conn.authMethod !== "agent" && !savedSecret) {
				setConnectPrompt(conn);
				setConnectPassword("");
				setRememberConnectSecret(false);
				return;
			}
			onConnect(conn, `SSH: ${conn.name}`, savedSecret || undefined);
		} finally {
			setConnectingId(null);
		}
	};

	const secretKey = (connId: string, kind: "password" | "passphrase") => `ssh:${connId}:${kind}`;
	const handleConnectWithPassword = async () => {
		if (!connectPrompt) return;
		const conn = connectPrompt;
		const password = connectPassword || undefined;
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
			const updateList = (list: SSHConnection[]) => list.map((item) => item.id === conn.id ? updatedConn : item);
			if (connections.some((item) => item.id === conn.id)) await saveProjectConnections(updateList(connections));
			if (globalConnections.some((item) => item.id === conn.id)) await saveGlobal(updateList(globalConnections));
			onConnect(updatedConn, `SSH: ${updatedConn.name}`, password);
		} else {
			onConnect(conn, `SSH: ${conn.name}`, password);
		}
		setConnectPrompt(null);
		setConnectPassword("");
		setRememberConnectSecret(false);
	};



	const handleDelete = async (id: string, scope: "project" | "global") => {
		if (scope === "project") {
			await saveProjectConnections(connections.filter((c) => c.id !== id));
		} else {
			await saveGlobal(globalConnections.filter((c) => c.id !== id));
		}
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
	const allConnections = [...connections, ...globalConnections];

	const handleSave = async (
		conn: SSHConnection,
		scope: "project" | "global",
	) => {
		if (scope === "project") {
			const existing = connections.find((c) => c.id === conn.id);
			if (existing) {
				await saveProjectConnections(
					connections.map((c) => (c.id === conn.id ? conn : c)),
				);
			} else {
				await saveProjectConnections([...connections, conn]);
			}
		} else {
			const existing = globalConnections.find((c) => c.id === conn.id);
			if (existing) {
				await saveGlobal(
					globalConnections.map((c) => (c.id === conn.id ? conn : c)),
				);
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
						<div className="text-[9px] text-connexio-text-muted">Hosts, SFTP, identities, and trust</div>
					</div>
				</div>
				<div className="grid grid-cols-4 gap-1 rounded bg-connexio-bg p-0.5 border border-connexio-border">
					{([
						["hosts", "Hosts"],
						["sftp", "SFTP"],
						["identities", "IDs"],
						["knownHosts", "Trust"],
					] as const).map(([view, label]) => (
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
							<div className="text-[11px] font-semibold text-connexio-text truncate">Connect to {connectPrompt.name}</div>
							<div className="text-[9px] text-connexio-text-muted truncate">{connectPrompt.username}@{connectPrompt.host}:{connectPrompt.port}</div>
						</div>
						<button onClick={() => setConnectPrompt(null)} className="p-0.5 rounded hover:bg-connexio-bg" type="button"><X size={10} /></button>
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
						placeholder={connectPrompt.authMethod === "key" ? "Private key passphrase" : "Password"}
						className="w-full pr-7 px-2 py-1 text-[11px] bg-connexio-bg border border-connexio-border rounded text-connexio-text outline-none focus:border-connexio-accent"
						autoFocus
					/>
					<button
						onClick={() => setShowConnectPassword((value) => !value)}
						className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-connexio-bg-tertiary"
						type="button"
					>
						{showConnectPassword ? <EyeOff size={10} className="text-connexio-text-muted" /> : <Eye size={10} className="text-connexio-text-muted" />}
					</button>
					</div>
					<label className="flex items-center gap-1 text-[9px] text-connexio-text-muted">
						<input type="checkbox" checked={rememberConnectSecret} onChange={(e) => setRememberConnectSecret(e.target.checked)} className="w-3 h-3" />
						Save {connectPrompt.authMethod === "key" ? "passphrase" : "password"} in OS keychain
					</label>
					<div className="flex gap-1">
						<button onClick={handleConnectWithPassword} className="px-2 py-1 text-[10px] rounded bg-connexio-accent text-white" type="button">Connect</button>
						<button onClick={() => setConnectPrompt(null)} className="px-2 py-1 text-[10px] rounded text-connexio-text-muted hover:bg-connexio-bg" type="button">Cancel</button>
					</div>
				</div>
			)}
			{activeView === "hosts" && <>
			{/* Project SSH Connections */}
			<div className="border-b border-connexio-border">
				<button
					onClick={() => setShowProject(!showProject)}
					className="flex items-center gap-1.5 w-full px-3 py-2 text-left hover:bg-connexio-bg-tertiary transition-colors"
					type="button"
				>
					{showProject ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
					<Server size={11} className="text-connexio-accent" />
					<span className="text-[10px] font-semibold text-connexio-text-secondary uppercase tracking-wider">
						Project
					</span>
					<span className="text-[9px] text-connexio-text-muted ml-auto">
						{connections.length}
					</span>
				</button>

				{showProject && (
					<div className="px-2 pb-2 space-y-0.5">
						{filteredProjectConnections.map((conn) =>
							editingId === conn.id ? (
								<SSHEditForm
									key={conn.id}
									connection={conn}
									onSave={(c) => handleSave(c, "project")}
									onCancel={() => setEditingId(null)}
								/>
							) : (
								<SSHItem
									key={conn.id}
									connection={conn}
									onConnect={() => handleConnect(conn)}
									isConnecting={connectingId === conn.id}
									onSftp={() => setSftpConnection(conn)}
									onEdit={() => setEditingId(conn.id)}
									onDelete={() => handleDelete(conn.id, "project")}
								/>
							),
						)}

						{isAdding === "project" ? (
							<SSHEditForm
								onSave={(c) => handleSave(c, "project")}
								onCancel={() => setIsAdding(null)}
							/>
						) : (
							<button
								onClick={() => setIsAdding("project")}
								className="flex items-center gap-1 px-2 py-1 text-[10px] text-connexio-text-muted hover:text-connexio-text transition-colors w-full"
								type="button"
							>
								<Plus size={10} />
								Add connection
							</button>
						)}
					</div>
				)}
			</div>

			{/* Global SSH Connections */}
			<div>
				<button
					onClick={() => setShowGlobal(!showGlobal)}
					className="flex items-center gap-1.5 w-full px-3 py-2 text-left hover:bg-connexio-bg-tertiary transition-colors"
					type="button"
				>
					{showGlobal ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
					<Zap size={11} className="text-yellow-400" />
					<span className="text-[10px] font-semibold text-connexio-text-secondary uppercase tracking-wider">
						Global
					</span>
					<span className="text-[9px] text-connexio-text-muted ml-auto">
						{globalConnections.length}
					</span>
				</button>

				{showGlobal && (
					<div className="px-2 pb-2 space-y-0.5">
						{filteredGlobalConnections.map((conn) =>
							editingId === conn.id ? (
								<SSHEditForm
									key={conn.id}
									connection={conn}
									onSave={(c) => handleSave(c, "global")}
									onCancel={() => setEditingId(null)}
								/>
							) : (
								<SSHItem
									key={conn.id}
									connection={conn}
									onConnect={() => handleConnect(conn)}
									isConnecting={connectingId === conn.id}
									onSftp={() => setSftpConnection(conn)}
									onEdit={() => setEditingId(conn.id)}
									onDelete={() => handleDelete(conn.id, "global")}
								/>
							),
						)}

						{isAdding === "global" ? (
							<SSHEditForm
								onSave={(c) => handleSave(c, "global")}
								onCancel={() => setIsAdding(null)}
							/>
						) : (
							<button
								onClick={() => setIsAdding("global")}
								className="flex items-center gap-1 px-2 py-1 text-[10px] text-connexio-text-muted hover:text-connexio-text transition-colors w-full"
								type="button"
							>
								<Plus size={10} />
								Add global connection
							</button>
						)}
					</div>
				)}
			</div>
			</>}

			{activeView === "sftp" && (
				sftpConnection ? (
					<SFTPBrowser connection={sftpConnection} onBack={() => setSftpConnection(null)} />
				) : (
					<div className="p-3 space-y-2">
						<div className="text-[10px] uppercase tracking-wider text-connexio-text-muted">Choose a host for SFTP</div>
						{allConnections.map((conn) => (
							<button key={conn.id} onClick={() => setSftpConnection(conn)} className="w-full flex items-center gap-2 p-2 rounded border border-connexio-border bg-connexio-bg-secondary hover:border-connexio-accent/50 text-left" type="button">
								<FolderOpen size={12} className="text-yellow-400" />
								<div className="flex-1 min-w-0">
									<div className="text-[11px] text-connexio-text truncate">{conn.name}</div>
									<div className="text-[9px] text-connexio-text-muted truncate">{conn.username}@{conn.host}</div>
								</div>
							</button>
						))}
					</div>
				)
			)}

			{activeView === "identities" && <IdentitiesManager />}

			{activeView === "knownHosts" && <KnownHostsManager />}
			</div>
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
		if (!window.confirm(`Remove old OpenSSH known_hosts entry for ${connection.host}:${connection.port}?`)) return;
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
				<Server size={10} className={`${isConnecting ? "text-connexio-accent animate-pulse" : "text-green-400"} flex-shrink-0`} />
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
							{connection.folder && <span className="px-1 py-0.5 rounded bg-connexio-bg text-[8px] text-connexio-text-muted truncate">{connection.folder}</span>}
							{(connection.tags || []).slice(0, 2).map((tag) => <span key={tag} className="px-1 py-0.5 rounded bg-connexio-accent/10 text-[8px] text-connexio-accent truncate">{tag}</span>)}
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
					className="p-0.5 rounded hover:bg-red-500/20 transition-colors"
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
	onSave,
	onCancel,
}: {
	connection?: SSHConnection;
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
	const [privateKeyPath, setPrivateKeyPath] = useState(
		connection?.privateKeyPath || "",
	);
	const [testPassword, setTestPassword] = useState("");
	const [rememberSecret, setRememberSecret] = useState(false);
	const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
	const [testMessage, setTestMessage] = useState("");
	const [testFingerprint, setTestFingerprint] = useState<string | null>(null);
	const [testHostTrust, setTestHostTrust] = useState<"unknown" | "trusted" | "changed" | null>(null);
	const [folder, setFolder] = useState(connection?.folder || "");
	const [tags, setTags] = useState((connection?.tags || []).join(", "));
	const [keepAliveSecs, setKeepAliveSecs] = useState(
		connection?.keepAliveSecs || 30,
	);
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
		if (!name.trim() || !host.trim() || !username.trim()) return;
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
			tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
			passwordSecretRef: shouldSavePassword ? secretRef(id, "password") : connection?.passwordSecretRef,
			passphraseSecretRef: shouldSavePassphrase ? secretRef(id, "passphrase") : connection?.passphraseSecretRef,
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
		tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
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
			setTestMessage(
				result.fingerprintSha256
					? `${result.message} · host ${result.hostTrust} · ${result.fingerprintSha256}`
					: result.message,
			);
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
		setTestMessage(`Host trusted · ${testFingerprint}`);
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
		<div className="px-1.5 py-2 space-y-1.5 bg-connexio-bg-tertiary rounded border border-connexio-border">
			{/* Name */}
			<input
				ref={nameRef}
				type="text"
				placeholder="Connection name"
				value={name}
				onChange={(e) => setName(e.target.value)}
				onKeyDown={handleKeyDown}
				className="w-full px-2 py-1 text-[10px] bg-connexio-bg border border-connexio-border rounded text-connexio-text outline-none focus:border-connexio-accent"
			/>

			{/* Host + Port */}
			<div className="flex gap-1">
				<input
					type="text"
					placeholder="hostname or IP"
					value={host}
					onChange={(e) => setHost(e.target.value)}
					onKeyDown={handleKeyDown}
					className="flex-1 px-2 py-1 text-[10px] bg-connexio-bg border border-connexio-border rounded text-connexio-text outline-none focus:border-connexio-accent"
				/>
				<input
					type="number"
					placeholder="22"
					value={port}
					onChange={(e) => setPort(Number(e.target.value) || 22)}
					onKeyDown={handleKeyDown}
					className="w-12 px-2 py-1 text-[10px] bg-connexio-bg border border-connexio-border rounded text-connexio-text outline-none focus:border-connexio-accent text-center"
				/>
			</div>

			{/* Username */}
			<input
				type="text"
				placeholder="username"
				value={username}
				onChange={(e) => setUsername(e.target.value)}
				onKeyDown={handleKeyDown}
				className="w-full px-2 py-1 text-[10px] bg-connexio-bg border border-connexio-border rounded text-connexio-text outline-none focus:border-connexio-accent"
			/>

			{/* Auth method */}
			<div className="flex gap-1">
				{(["password", "key", "agent"] as const).map((method) => (
					<button
						key={method}
						onClick={() => setAuthMethod(method)}
						className={`flex-1 px-2 py-1 text-[9px] rounded border transition-colors ${
							authMethod === method
								? "border-connexio-accent bg-connexio-accent/10 text-connexio-accent"
								: "border-connexio-border text-connexio-text-muted hover:border-connexio-text-muted"
						}`}
						type="button"
					>
						{method === "password" ? "Password" : method === "key" ? "SSH Key" : "Agent"}
					</button>
				))}
			</div>

			{/* Key path (if key auth) */}
			{authMethod === "key" && (
				<div className="flex gap-1">
					<input
						type="text"
						placeholder="~/.ssh/id_rsa"
						value={privateKeyPath}
						onChange={(e) => setPrivateKeyPath(e.target.value)}
						onKeyDown={handleKeyDown}
						className="flex-1 px-2 py-1 text-[10px] bg-connexio-bg border border-connexio-border rounded text-connexio-text outline-none focus:border-connexio-accent font-mono"
					/>
					<button
						onClick={handleSelectKey}
						className="px-1.5 py-1 bg-connexio-bg border border-connexio-border rounded hover:border-connexio-accent/50 transition-colors"
						type="button"
						title="Browse for key file"
					>
						<FolderOpen size={10} className="text-connexio-text-muted" />
					</button>
				</div>
			)}

			<div className="flex gap-1">
				<input
					type="text"
					placeholder="folder"
					value={folder}
					onChange={(e) => setFolder(e.target.value)}
					onKeyDown={handleKeyDown}
					className="flex-1 px-2 py-1 text-[10px] bg-connexio-bg border border-connexio-border rounded text-connexio-text outline-none focus:border-connexio-accent"
				/>
				<input
					type="number"
					placeholder="keepalive"
					value={keepAliveSecs}
					onChange={(e) => setKeepAliveSecs(Number(e.target.value) || 30)}
					onKeyDown={handleKeyDown}
					className="w-20 px-2 py-1 text-[10px] bg-connexio-bg border border-connexio-border rounded text-connexio-text outline-none focus:border-connexio-accent text-center"
					title="Keepalive seconds"
				/>
			</div>

			<input
				type="text"
				placeholder="tags, comma separated"
				value={tags}
				onChange={(e) => setTags(e.target.value)}
				onKeyDown={handleKeyDown}
				className="w-full px-2 py-1 text-[10px] bg-connexio-bg border border-connexio-border rounded text-connexio-text outline-none focus:border-connexio-accent"
			/>

			{authMethod !== "agent" && (
				<>
					<input
						type="password"
						placeholder={authMethod === "key" ? "passphrase for test/save (optional)" : "password for test/save"}
						value={testPassword}
						onChange={(e) => setTestPassword(e.target.value)}
						onKeyDown={handleKeyDown}
						className="w-full px-2 py-1 text-[10px] bg-connexio-bg border border-connexio-border rounded text-connexio-text outline-none focus:border-connexio-accent"
					/>
					<label className="flex items-center gap-1 text-[9px] text-connexio-text-muted">
						<input
							type="checkbox"
							checked={rememberSecret}
							onChange={(e) => setRememberSecret(e.target.checked)}
							className="w-3 h-3"
						/>
						Save {authMethod === "key" ? "passphrase" : "password"} in OS keychain
					</label>
				</>
			)}

			{testMessage && (
				<div className={`text-[9px] leading-snug ${testStatus === "success" ? "text-green-400" : testStatus === "error" ? "text-red-400" : "text-connexio-text-muted"}`}>
					{testMessage}
				</div>
			)}

			{testFingerprint && testHostTrust !== "trusted" && (
				<button
					onClick={handleTrustHost}
					className={`text-left text-[9px] px-2 py-1 rounded border transition-colors ${testHostTrust === "changed" ? "border-red-500/50 text-red-300 bg-red-500/10" : "border-yellow-500/40 text-yellow-300 bg-yellow-500/10"}`}
					type="button"
				>
					{testHostTrust === "changed" ? "Host key changed - trust new fingerprint" : "Trust this host fingerprint"}
				</button>
			)}

			{/* Actions */}
			<div className="flex gap-1 pt-0.5">
				<button
					onClick={handleTestConnection}
					disabled={!host.trim() || !username.trim() || testStatus === "testing"}
					className="flex items-center gap-1 px-2 py-0.5 text-[9px] text-connexio-accent border border-connexio-accent/40 rounded hover:bg-connexio-accent/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
					type="button"
				>
					{testStatus === "testing" ? "Testing" : "Test"}
				</button>
				<button
					onClick={handleSave}
					disabled={!name.trim() || !host.trim() || !username.trim()}
					className="flex items-center gap-1 px-2 py-0.5 text-[9px] bg-connexio-accent text-white rounded hover:bg-connexio-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
					type="button"
				>
					<Check size={8} />
					{connection ? "Save" : "Add"}
				</button>
				<button
					onClick={onCancel}
					className="flex items-center gap-1 px-2 py-0.5 text-[9px] text-connexio-text-muted hover:text-connexio-text transition-colors"
					type="button"
				>
					<X size={8} />
					Cancel
				</button>
			</div>
		</div>
	);
}

function SFTPBrowser({ connection, onBack }: { connection: SSHConnection; onBack: () => void }) {
	const [path, setPath] = useState(".");
	const [entries, setEntries] = useState<SFTPEntry[]>([]);
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [previewPath, setPreviewPath] = useState<string | null>(null);
	const [previewContent, setPreviewContent] = useState("");
	const [newFolderName, setNewFolderName] = useState("");
	const [renamingPath, setRenamingPath] = useState<string | null>(null);
	const [renameValue, setRenameValue] = useState("");

	const needsPassword = connection.authMethod !== "agent";

	const loadPath = async (nextPath = path) => {
		setLoading(true);
		setError("");
		try {
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
		}
	};

	const openEntry = async (entry: SFTPEntry) => {
		if (entry.isDir) {
			await loadPath(entry.path);
			return;
		}
		setLoading(true);
		setError("");
		try {
			const content = await window.connexio.ssh.sftpRead(
				connection,
				entry.path,
				password || undefined,
			);
			setPreviewPath(entry.path);
			setPreviewContent(content);
		} catch (err) {
			setError(String(err));
		} finally {
			setLoading(false);
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

	const createFolder = async () => {
		const folderName = newFolderName.trim();
		if (!folderName) return;
		setLoading(true);
		setError("");
		try {
			await window.connexio.ssh.sftpMkdir(connection, joinRemotePath(path, folderName), password || undefined);
			setNewFolderName("");
			await loadPath(path);
		} catch (err) {
			setError(String(err));
		} finally {
			setLoading(false);
		}
	};

	const deleteEntry = async (entry: SFTPEntry) => {
		if (!window.confirm(`Delete ${entry.path}?`)) return;
		setLoading(true);
		setError("");
		try {
			await window.connexio.ssh.sftpDelete(connection, entry.path, entry.isDir, password || undefined);
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

	return (
		<div className="flex flex-col h-full overflow-hidden">
			<div className="flex items-center gap-2 px-3 py-2 border-b border-connexio-border">
				<button onClick={onBack} className="text-[11px] text-connexio-accent hover:underline" type="button">← SSH</button>
				<FolderOpen size={12} className="text-connexio-accent" />
				<div className="min-w-0 flex-1">
					<div className="text-[10px] font-semibold text-connexio-text truncate">{connection.name}</div>
					<div className="text-[9px] text-connexio-text-muted truncate">{connection.username}@{connection.host}</div>
				</div>
			</div>

			<div className="p-2 border-b border-connexio-border space-y-1.5">
				{needsPassword && (
					<input
						type="password"
						placeholder={connection.authMethod === "key" ? "passphrase (optional)" : "password"}
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						className="w-full px-2 py-1 text-[10px] bg-connexio-bg border border-connexio-border rounded text-connexio-text outline-none focus:border-connexio-accent"
					/>
				)}
				<div className="flex gap-1">
					<input
						value={path}
						onChange={(e) => setPath(e.target.value)}
						onKeyDown={(e) => { if (e.key === "Enter") loadPath(path); }}
						className="flex-1 px-2 py-1 text-[10px] bg-connexio-bg border border-connexio-border rounded text-connexio-text outline-none focus:border-connexio-accent font-mono"
					/>
					<button onClick={() => loadPath(path)} disabled={loading} className="px-2 py-1 text-[10px] rounded bg-connexio-accent/10 text-connexio-accent disabled:opacity-40" type="button">Load</button>
				</div>
				<div className="flex gap-1">
					<input
						value={newFolderName}
						onChange={(e) => setNewFolderName(e.target.value)}
						onKeyDown={(e) => { if (e.key === "Enter") createFolder(); }}
						placeholder="new folder"
						className="flex-1 px-2 py-1 text-[10px] bg-connexio-bg border border-connexio-border rounded text-connexio-text outline-none focus:border-connexio-accent"
					/>
					<button onClick={createFolder} disabled={loading || !newFolderName.trim()} className="px-2 py-1 text-[10px] rounded bg-connexio-bg-tertiary text-connexio-text-muted disabled:opacity-40" type="button">Mkdir</button>
				</div>
				{error && <div className="text-[9px] text-red-400 leading-snug">{error}</div>}
			</div>

			<div className="flex-1 min-h-0 overflow-y-auto">
				<button onClick={() => loadPath(parentPath())} className="flex items-center gap-1.5 w-full px-3 py-1.5 text-left hover:bg-connexio-bg-tertiary text-[11px] text-connexio-text-muted" type="button">
					<FolderOpen size={10} /> ..
				</button>
				{entries.map((entry) => (
					<div key={entry.path} className="group flex items-center gap-1.5 px-3 py-1.5 hover:bg-connexio-bg-tertiary">
						<button onClick={() => openEntry(entry)} className="flex items-center gap-1.5 flex-1 min-w-0 text-left" type="button">
							{entry.isDir ? <FolderOpen size={10} className="text-yellow-400 flex-shrink-0" /> : <FileText size={10} className="text-connexio-text-muted flex-shrink-0" />}
							{renamingPath === entry.path ? (
								<input
									value={renameValue}
									onChange={(e) => setRenameValue(e.target.value)}
									onClick={(e) => e.stopPropagation()}
									onKeyDown={(e) => {
										if (e.key === "Enter") commitRename(entry);
										if (e.key === "Escape") setRenamingPath(null);
									}}
									className="flex-1 min-w-0 px-1 py-0.5 text-[11px] bg-connexio-bg border border-connexio-border rounded text-connexio-text outline-none"
									autoFocus
								/>
							) : (
								<span className="flex-1 min-w-0 truncate text-[11px] text-connexio-text">{entry.name}</span>
							)}
						</button>
						{!entry.isDir && entry.size != null && <span className="text-[9px] text-connexio-text-muted">{entry.size}</span>}
						<div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
							<button onClick={() => renamingPath === entry.path ? commitRename(entry) : startRename(entry)} className="p-0.5 rounded hover:bg-connexio-bg" type="button" title="Rename"><Pencil size={9} className="text-connexio-text-muted" /></button>
							<button onClick={() => deleteEntry(entry)} className="p-0.5 rounded hover:bg-red-500/20" type="button" title="Delete"><Trash2 size={9} className="text-red-400" /></button>
						</div>
					</div>
				))}
				{loading && <div className="px-3 py-2 text-[10px] text-connexio-text-muted">Loading...</div>}
			</div>

			{previewPath && (
				<div className="max-h-[42%] border-t border-connexio-border flex flex-col">
					<div className="flex items-center gap-2 px-3 py-1.5 bg-connexio-bg-secondary">
						<FileText size={10} className="text-connexio-accent" />
						<span className="flex-1 min-w-0 truncate text-[10px] text-connexio-text-muted font-mono">{previewPath}</span>
						<button onClick={() => { setPreviewPath(null); setPreviewContent(""); }} className="p-0.5 rounded hover:bg-connexio-bg-tertiary" type="button"><X size={10} /></button>
					</div>
					<pre className="flex-1 min-h-0 overflow-auto p-2 text-[10px] text-connexio-text bg-connexio-bg font-mono whitespace-pre-wrap">{previewContent}</pre>
				</div>
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

	useEffect(() => { load(); }, []);

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
					<div className="text-[9px] text-connexio-text-muted">Fingerprints trusted by Connexio native SSH/SFTP</div>
				</div>
				<button onClick={load} className="px-2 py-1 text-[10px] rounded bg-connexio-bg-tertiary text-connexio-text-muted hover:text-connexio-text" type="button">Refresh</button>
			</div>
			{error && <div className="text-[10px] text-red-400">{error}</div>}
			{loading && <div className="text-[10px] text-connexio-text-muted">Loading...</div>}
			{!loading && hosts.length === 0 && <div className="text-[10px] text-connexio-text-muted">No trusted hosts yet. Test a connection and trust its fingerprint first.</div>}
			{hosts.map((host) => (
				<div key={`${host.host}:${host.port}`} className="p-2 rounded border border-connexio-border bg-connexio-bg-secondary space-y-1">
					<div className="flex items-center gap-2">
						<Server size={11} className="text-connexio-accent" />
						<div className="flex-1 min-w-0 text-[11px] text-connexio-text truncate">{host.host}:{host.port}</div>
						<button onClick={() => forget(host)} className="p-0.5 rounded hover:bg-red-500/20" type="button" title="Forget"><Trash2 size={10} className="text-red-400" /></button>
					</div>
					<div className="text-[9px] text-connexio-text-muted font-mono break-all">{host.fingerprintSha256}</div>
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
					<div className="text-[9px] text-connexio-text-muted">Reusable credentials are planned for the next SSH milestone.</div>
				</div>
			</div>
			<div className="rounded border border-connexio-border bg-connexio-bg-secondary p-3 text-[10px] text-connexio-text-muted leading-relaxed">
				Current hosts can already save passwords/passphrases securely in the OS keychain. This tab will later promote those into reusable identities shared across hosts.
			</div>
		</div>
	);
}
