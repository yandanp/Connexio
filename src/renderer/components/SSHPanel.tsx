import {
	Check,
	ChevronDown,
	ChevronRight,
	FolderOpen,
	Key,
	Pencil,
	Plus,
	Server,
	Trash2,
	X,
	Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { v4 as uuid } from "uuid";
import type { SSHConnection } from "../../shared/types";

interface Props {
	projectId: string;
	onConnect: (command: string, label: string) => void;
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

	const handleConnect = async (conn: SSHConnection) => {
		const command = await window.connexio.ssh.buildCommand(conn);
		onConnect(command, `SSH: ${conn.name}`);
	};

	const handleDelete = async (id: string, scope: "project" | "global") => {
		if (scope === "project") {
			await saveProjectConnections(connections.filter((c) => c.id !== id));
		} else {
			await saveGlobal(globalConnections.filter((c) => c.id !== id));
		}
	};

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
		<div className="flex flex-col h-full overflow-y-auto">
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
						{connections.map((conn) =>
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
						{globalConnections.map((conn) =>
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
		</div>
	);
}

// ============================================
// SSH Connection Item
// ============================================
function SSHItem({
	connection,
	onConnect,
	onEdit,
	onDelete,
}: {
	connection: SSHConnection;
	onConnect: () => void;
	onEdit: () => void;
	onDelete: () => void;
}) {
	return (
		<div className="group flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-connexio-bg-tertiary transition-colors">
			<button
				onClick={onConnect}
				className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
				type="button"
				title={`Connect to ${connection.username}@${connection.host}:${connection.port}`}
			>
				<Server size={10} className="text-green-400 flex-shrink-0" />
				<div className="flex flex-col min-w-0">
					<span className="text-[11px] text-connexio-text truncate leading-tight">
						{connection.name}
					</span>
					<span className="text-[9px] text-connexio-text-muted truncate leading-tight">
						{connection.username}@{connection.host}
						{connection.port !== 22 ? `:${connection.port}` : ""}
					</span>
				</div>
			</button>

			{/* Auth indicator */}
			<div
				className="flex-shrink-0"
				title={connection.authMethod === "key" ? "Key auth" : "Password auth"}
			>
				<Key
					size={9}
					className={
						connection.authMethod === "key"
							? "text-yellow-400"
							: "text-connexio-text-muted"
					}
				/>
			</div>

			{/* Actions */}
			<div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
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
	const [authMethod, setAuthMethod] = useState<"password" | "key">(
		connection?.authMethod || "password",
	);
	const [privateKeyPath, setPrivateKeyPath] = useState(
		connection?.privateKeyPath || "",
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

	const handleSave = () => {
		if (!name.trim() || !host.trim() || !username.trim()) return;
		onSave({
			id: connection?.id || uuid(),
			name: name.trim(),
			host: host.trim(),
			port,
			username: username.trim(),
			authMethod,
			privateKeyPath: authMethod === "key" ? privateKeyPath : undefined,
		});
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
				<button
					onClick={() => setAuthMethod("password")}
					className={`flex-1 px-2 py-1 text-[9px] rounded border transition-colors ${
						authMethod === "password"
							? "border-connexio-accent bg-connexio-accent/10 text-connexio-accent"
							: "border-connexio-border text-connexio-text-muted hover:border-connexio-text-muted"
					}`}
					type="button"
				>
					Password
				</button>
				<button
					onClick={() => setAuthMethod("key")}
					className={`flex-1 px-2 py-1 text-[9px] rounded border transition-colors ${
						authMethod === "key"
							? "border-connexio-accent bg-connexio-accent/10 text-connexio-accent"
							: "border-connexio-border text-connexio-text-muted hover:border-connexio-text-muted"
					}`}
					type="button"
				>
					SSH Key
				</button>
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

			{/* Actions */}
			<div className="flex gap-1 pt-0.5">
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
