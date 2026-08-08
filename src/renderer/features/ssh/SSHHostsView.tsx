import { FolderOpen, Pencil, Plus, Trash2 } from "lucide-react";
import type { SSHConnection } from "../../../shared/types";
import SSHEditForm from "./SSHEditForm";

interface SSHHostsViewProps {
	connections: SSHConnection[];
	filteredConnections: SSHConnection[];
	isAdding: "project" | "global" | null;
	editingId: string | null;
	editSection: "basic" | "auth" | "advanced";
	connectingId: string | null;
	connectStatus: string;
	onStartAdd: (scope: "project" | "global") => void;
	onCancelAdd: () => void;
	onEditHost: (id: string) => void;
	onCancelEdit: () => void;
	onSectionChange: (section: "basic" | "auth" | "advanced") => void;
	onSave: (conn: SSHConnection, scope: "project" | "global") => void;
	onConnect: (conn: SSHConnection) => void;
	onOpenSftp?: (conn: SSHConnection) => void;
	onDelete: (id: string, scope: "project" | "global") => void;
	onHostContextMenu: (
		e: React.MouseEvent,
		conn: SSHConnection,
		scope: "project" | "global",
	) => void;
}

export default function SSHHostsView({
	connections,
	filteredConnections,
	isAdding,
	editingId,
	editSection,
	connectingId,
	connectStatus,
	onStartAdd,
	onCancelAdd,
	onEditHost,
	onCancelEdit,
	onSectionChange,
	onSave,
	onConnect,
	onOpenSftp,
	onDelete,
	onHostContextMenu,
}: SSHHostsViewProps) {
	return (
		<div className="p-6">
			<div className="flex items-center gap-2 mb-7">
				<button
					onClick={() => onStartAdd("project")}
					className="flex items-center gap-2 px-4 py-2 rounded-xl bg-connexio-bg-secondary text-connexio-text border border-connexio-border  hover:border-connexio-accent/50"
					type="button"
				>
					<Plus size={15} />
					<span className="text-sm font-semibold">New host</span>
				</button>
				<button
					onClick={() => onStartAdd("global")}
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
					<div className="text-[10px] text-connexio-text-muted mb-1">Adding to this project</div>
					<SSHEditForm
						section={editSection}
						onSectionChange={onSectionChange}
						onSave={(c) => onSave(c, "project")}
						onCancel={onCancelAdd}
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
						onSectionChange={onSectionChange}
						onSave={(c) => onSave(c, "global")}
						onCancel={onCancelAdd}
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
								onSectionChange={onSectionChange}
								onSave={(c) =>
									onSave(c, connections.some((item) => item.id === conn.id) ? "project" : "global")
								}
								onCancel={onCancelEdit}
							/>
						</div>
					) : (
						<SSHHostCard
							key={conn.id}
							connection={conn}
							isConnecting={connectingId === conn.id}
							onConnect={() => onConnect(conn)}
							onSftp={() => onOpenSftp?.(conn)}
							onEdit={() => onEditHost(conn.id)}
							onDelete={() =>
								onDelete(
									conn.id,
									connections.some((item) => item.id === conn.id) ? "project" : "global",
								)
							}
							onContextMenu={(e: React.MouseEvent) =>
								onHostContextMenu(
									e,
									conn,
									connections.some((item) => item.id === conn.id) ? "project" : "global",
								)
							}
						/>
					),
				)}
			</div>
			{filteredConnections.length === 0 && (
				<div className="text-sm text-connexio-text-muted">No hosts found.</div>
			)}
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
