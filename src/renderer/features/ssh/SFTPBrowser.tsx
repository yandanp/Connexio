import { FileText, FolderOpen, Pencil, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import ContextMenu from "../../core/ui/ContextMenu";
import ConfirmDialog from "../../core/ui/ConfirmDialog";
import { useProjectsStore } from "../projects";
import { useWorkspaceStore } from "../workspace";
import type { SFTPEntry, SSHConnection, SSHSecretRef } from "../../../shared/types";

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
	const { activeProjectId } = useProjectsStore();
	const { openRemoteEditorTab } = useWorkspaceStore();
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
					<ContextMenu
						x={contextMenu.x}
						y={contextMenu.y}
						onClose={() => setContextMenu(null)}
						minWidth={176}
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
