import { useCallback, useRef } from "react";
import type { TerminalTab } from "../workspace";
import { useWorkspaceStore } from "../workspace";
import { useProjectsStore } from "../projects";
import CodeEditor from "./CodeEditor";

// === Remote Editor Wrapper ===
// Stabilizes loadContent/saveContent references to prevent CodeEditor re-mount loops
export default function RemoteEditorWrapper({
	tab,
	onClose,
	onDirtyChange,
}: {
	tab: TerminalTab;
	onClose: () => void;
	onDirtyChange: (dirty: boolean) => void;
}) {
	const { workspaceTabs } = useWorkspaceStore();
	const { activeProjectId } = useProjectsStore();

	// Stable loadContent — only recreated when tab.id changes
	const loadContent = useCallback(async () => {
		return tab.remoteContent || "";
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [tab.id]);

	// Stable saveContent — uses refs internally
	const tabRef = useRef(tab);
	tabRef.current = tab;

	const saveContent = useCallback(
		async (content: string) => {
			const currentTab = tabRef.current;
			const conn = currentTab.remoteConnection!;
			const ref = conn.authMethod === "key" ? conn.passphraseSecretRef : conn.passwordSecretRef;
			const password = ref?.key ? await window.connexio.ssh.getSecret(ref.key) : null;
			if (conn.authMethod !== "agent" && !password) {
				throw new Error(
					"Saved SSH secret is required to save this remote file. Reopen SFTP and save the password/passphrase first.",
				);
			}
			await window.connexio.ssh.sftpWrite(
				conn,
				currentTab.remotePath!,
				content,
				password || undefined,
			);
			// Update store immutably
			const projId = useProjectsStore.getState().activeProjectId;
			if (projId) {
				const store = useWorkspaceStore.getState();
				const tabs = store.workspaceTabs[projId] || [];
				const updated = tabs.map((t) =>
					t.id === currentTab.id ? { ...t, remoteContent: content } : t,
				);
				useWorkspaceStore.setState({
					workspaceTabs: { ...store.workspaceTabs, [projId]: updated },
				});
			}
			// eslint-disable-next-line react-hooks/exhaustive-deps
		},
		[tab.id],
	);

	return (
		<CodeEditor
			filePath={tab.filePath!}
			loadContent={loadContent}
			saveContent={saveContent}
			onClose={onClose}
			onDirtyChange={onDirtyChange}
		/>
	);
}
