import { ChevronDown, ChevronRight, GitBranch, Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { WorktreeEntry } from "../../../shared/types";
import ConfirmDialog from "../../core/ui/ConfirmDialog";

interface Props {
	projectPath: string;
	projectName: string;
	/** Opens a terminal tab scoped to the worktree path. */
	onOpenWorktree: (path: string, name: string) => void;
}

/** Pending deletion: entry plus the divergence summary shown in the dialog. */
interface PendingDelete {
	entry: WorktreeEntry;
	summary: string;
}

/**
 * Collapsible worktree section rendered under a sidebar project row.
 * Lists worktrees via the backend, offers create/delete inline, and opens a
 * terminal scoped to the worktree path on click.
 */
export default function ProjectWorktrees({ projectPath, projectName, onOpenWorktree }: Props) {
	const [expanded, setExpanded] = useState(false);
	const [entries, setEntries] = useState<WorktreeEntry[] | null>(null);
	const [status, setStatus] = useState("");
	const [loading, setLoading] = useState(false);
	const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

	const refresh = useCallback(async () => {
		setLoading(true);
		try {
			const list = await window.connexio.worktree.list(projectPath);
			// Remote mode returns [] — keep the section usable but empty.
			setEntries(list);
		} catch {
			setEntries([]);
		} finally {
			setLoading(false);
		}
	}, [projectPath]);

	// Load once on first expand; refresh on every subsequent expand.
	useEffect(() => {
		if (expanded) void refresh();
	}, [expanded, refresh]);

	// Refresh when any worktree is created or deleted elsewhere in the app.
	useEffect(() => {
		const onChanged = () => void refresh();
		window.addEventListener("connexio:worktree-changed", onChanged);
		return () => window.removeEventListener("connexio:worktree-changed", onChanged);
	}, [refresh]);

	const notify = (title: string) => {
		// Lightweight status line inside the section — avoids pulling the
		// notification store (and its Tauri event listeners) into this tree.
		setStatus(title);
	};

	// Step 1: fetch divergence, then ask for confirmation via the dialog.
	const requestDelete = async (entry: WorktreeEntry) => {
		let summary = "";
		try {
			const s = await window.connexio.worktree.previewDiff(projectPath, entry.path, entry.baseRef);
			summary = `${s.changedFiles} changed file(s), ${s.ahead} commit(s) ahead of ${entry.baseRef}.`;
		} catch {
			// Preview is best-effort; deletion still requires branch confirmation.
		}
		setPendingDelete({ entry, summary });
	};

	// Step 2: the dialog confirmed — delete through the backend.
	const confirmDelete = async () => {
		if (!pendingDelete) return;
		const { entry } = pendingDelete;
		setPendingDelete(null); // close the dialog immediately (Enter can re-fire)

		try {
			const ws = await import("../workspace/workspace-store");
			const state = ws.useWorkspaceStore.getState();
			for (const [pid, tabs] of Object.entries(state.workspaceTabs)) {
				for (const tab of tabs) {
					if (tab.label === entry.name) {
						await ws.useWorkspaceStore.getState().closeTerminalTab(pid, tab.id);
						// Wait for OS to release the directory lock on Windows.
						await new Promise<void>((resolve) => setTimeout(resolve, 500));
					}
				}
			}
		} catch {
			/* ignore close errors */
		}

		try {
			const result = await window.connexio.worktree.delete(projectPath, entry.path, entry.branch);
			if (result?.leftoverDir) {
				notify(
					`${entry.name} branch deleted — folder left behind (a process is holding it). Close any editors/terminals and retry.`,
				);
			} else if (result?.preservedBranch) {
				notify(`${entry.name} removed — branch ${result.preservedBranch} kept (unmerged commits)`);
			} else {
				notify(`${entry.name} deleted`);
			}
			void refresh();
			window.dispatchEvent(new CustomEvent("connexio:worktree-changed"));
		} catch (e) {
			notify(`Delete failed: ${String(e)}`);
		}
	};

	return (
		<div className="ml-4 mt-0.5">
			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation();
					setExpanded((v) => !v);
				}}
				className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left hover:bg-connexio-bg-tertiary/60 transition-colors"
			>
				{expanded ? (
					<ChevronDown size={10} className="text-connexio-text-muted" />
				) : (
					<ChevronRight size={10} className="text-connexio-text-muted" />
				)}
				<GitBranch size={11} className="text-connexio-text-muted" />
				<span className="text-[11px] font-medium text-connexio-text-muted">Worktrees</span>
				{entries && entries.length > 0 && (
					<span className="ml-auto text-[10px] text-connexio-text-muted">{entries.length}</span>
				)}
			</button>

			{expanded && (
				<div className="ml-3 mt-0.5 space-y-0.5 border-l border-connexio-border/60 pl-2">
					{loading && (
						<div className="flex items-center gap-1.5 px-1.5 py-1 text-[11px] text-connexio-text-muted">
							<Loader2 size={10} className="animate-spin" />
							Loading…
						</div>
					)}
					{status && !loading && (
						<p className="px-1.5 py-0.5 text-[10px] text-connexio-text-muted">{status}</p>
					)}
					{!loading &&
						entries?.map((entry) => (
							<div
								key={entry.id}
								role="button"
								tabIndex={0}
								onClick={() => onOpenWorktree(entry.path, entry.name)}
								onKeyDown={(e) => {
									if (e.key === "Enter" || e.key === " ") {
										e.preventDefault();
										onOpenWorktree(entry.path, entry.name);
									}
								}}
								className="group flex w-full cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-connexio-bg-tertiary/60 transition-colors"
							>
								<GitBranch size={10} className="flex-shrink-0 text-connexio-text-muted" />
								<span className="min-w-0 flex-1 truncate text-[11px] text-connexio-text-secondary">
									{entry.name}
								</span>
								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										void requestDelete(entry);
									}}
									className="opacity-0 group-hover:opacity-100 rounded p-0.5 hover:bg-red-500/20 transition-all flex-shrink-0"
									title={`Delete ${entry.name}`}
								>
									<Trash2 size={10} className="text-red-400" />
								</button>
							</div>
						))}
					{!loading && entries?.length === 0 && (
						<p className="px-1.5 py-1 text-[10px] text-connexio-text-muted italic">
							No worktrees for {projectName}
						</p>
					)}
					<a
						href="#create-worktree"
						onClick={(e) => {
							e.preventDefault();
							window.dispatchEvent(
								new CustomEvent("connexio:create-worktree", { detail: projectPath }),
							);
						}}
						className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] text-connexio-text-muted hover:bg-connexio-bg-tertiary/60 hover:text-connexio-accent transition-colors"
					>
						<Plus size={10} />
						New worktree…
					</a>
				</div>
			)}

			{pendingDelete && (
				<ConfirmDialog
					title={`Delete worktree "${pendingDelete.entry.name}"?`}
					message={`${pendingDelete.summary}\n\nBranch ${pendingDelete.entry.branch} and all files at ${pendingDelete.entry.path} will be removed. Branches with unmerged commits are kept in the repo.`}
					confirmLabel="Delete"
					variant="danger"
					onConfirm={() => void confirmDelete()}
					onCancel={() => setPendingDelete(null)}
				/>
			)}
		</div>
	);
}
