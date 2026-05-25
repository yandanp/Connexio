import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { Save, X, Clipboard, Copy, Scissors, TextSelect } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useThemeStore } from "../../stores/themeStore";

function buildEditorTheme(appTheme: { colors: any; terminal: any } | null) {
	if (!appTheme) {
		return EditorView.theme({
			"&": { backgroundColor: "#0f1117", color: "#e2e8f0", height: "100%", fontSize: "12px" },
			".cm-content": { fontFamily: "'JetBrains Mono', 'Cascadia Code', monospace", caretColor: "#7c3aed" },
			".cm-cursor": { borderLeftColor: "#7c3aed" },
			".cm-activeLine": { backgroundColor: "#1e203020" },
			".cm-activeLineGutter": { backgroundColor: "#1e203040" },
			".cm-gutters": { backgroundColor: "#0f1117", color: "#64748b", border: "none", fontFamily: "'JetBrains Mono', monospace", fontSize: "11px" },
			".cm-scroller": { overflow: "auto" },
			"&.cm-focused .cm-selectionBackground, .cm-selectionBackground": { backgroundColor: "#7c3aed30" },
			".cm-selectionMatch": { backgroundColor: "#7c3aed20" },
		}, { dark: true });
	}

	const { colors, terminal } = appTheme;
	const isDark = appTheme && (appTheme as any).type !== "light";

	return EditorView.theme({
		"&": { backgroundColor: terminal.background, color: terminal.foreground, height: "100%", fontSize: "12px" },
		".cm-content": { fontFamily: "'JetBrains Mono', 'Cascadia Code', monospace", caretColor: colors.accentColor },
		".cm-cursor": { borderLeftColor: colors.accentColor },
		".cm-activeLine": { backgroundColor: `${colors.bgTertiary}40` },
		".cm-activeLineGutter": { backgroundColor: `${colors.bgTertiary}60` },
		".cm-gutters": { backgroundColor: terminal.background, color: colors.textMuted, border: "none", fontFamily: "'JetBrains Mono', monospace", fontSize: "11px" },
		".cm-scroller": { overflow: "auto" },
		"&.cm-focused .cm-selectionBackground, .cm-selectionBackground": { backgroundColor: `${colors.accentColor}30` },
		".cm-selectionMatch": { backgroundColor: `${colors.accentColor}20` },
	}, { dark: isDark !== false });
}

interface Props {
	filePath: string;
	onClose: () => void;
	/** Called when dirty state changes — used by parent to show tab indicator */
	onDirtyChange?: (dirty: boolean) => void;
}

function getLanguageExtension(filePath: string) {
	const ext = filePath.split(".").pop()?.toLowerCase();
	switch (ext) {
		case "js": case "jsx": return javascript({ jsx: true });
		case "ts": case "tsx": return javascript({ jsx: true, typescript: true });
		case "json": return json();
		case "html": case "htm": return html();
		case "css": case "scss": return css();
		case "md": case "mdx": return markdown();
		case "py": return python();
		case "rs": return rust();
		default: return javascript();
	}
}

export default function CodeEditor({ filePath, onClose, onDirtyChange }: Props) {
	const containerRef = useRef<HTMLDivElement>(null);
	const viewRef = useRef<EditorView | null>(null);
	const themeCompartment = useRef(new Compartment());
	const [isDirty, setIsDirty] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [saveStatus, setSaveStatus] = useState<string | null>(null);
	const [showCloseConfirm, setShowCloseConfirm] = useState(false);
	const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
	const originalContentRef = useRef("");
	const filePathRef = useRef(filePath);
	filePathRef.current = filePath;
	const { currentTheme } = useThemeStore();

	const editorTheme = useMemo(() => buildEditorTheme(currentTheme), [currentTheme]);

	const saveRef = useRef<() => Promise<void>>(async () => {});

	const fileName = filePath.replace(/\\/g, "/").split("/").pop() || "untitled";

	// Notify parent of dirty state changes
	const setDirty = (dirty: boolean) => {
		setIsDirty(dirty);
		onDirtyChange?.(dirty);
	};

	// Keep saveRef always up to date
	saveRef.current = async () => {
		const view = viewRef.current;
		if (!view) return;
		const content = view.state.doc.toString();
		setSaving(true);
		setError(null);
		try {
			await invoke("explorer_write_file", {
				filePath: filePathRef.current,
				content,
			});
			originalContentRef.current = content;
			setDirty(false);
			setSaveStatus("Saved ✓");
			setTimeout(() => setSaveStatus(null), 2000);
		} catch (e: any) {
			setError(typeof e === "string" ? e : e?.message || "Save failed");
		}
		setSaving(false);
	};

	// Close handler — confirm if dirty
	const handleClose = () => {
		if (isDirty) {
			setShowCloseConfirm(true);
		} else {
			onClose();
		}
	};

	// Context menu
	const handleContextMenu = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setCtxMenu({ x: e.clientX, y: e.clientY });
	}, []);

	const execCommand = useCallback((cmd: "cut" | "copy" | "paste" | "selectAll") => {
		setCtxMenu(null);
		const view = viewRef.current;
		if (!view) return;
		view.focus();
		switch (cmd) {
			case "cut":
				document.execCommand("cut");
				break;
			case "copy":
				document.execCommand("copy");
				break;
			case "paste":
				navigator.clipboard.readText().then((text) => {
					if (text && view) {
						const { from, to } = view.state.selection.main;
						view.dispatch({ changes: { from, to, insert: text } });
					}
				}).catch(() => {});
				break;
			case "selectAll":
				view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } });
				break;
		}
	}, []);

	// Global Ctrl+S
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
				e.preventDefault();
				e.stopPropagation();
				saveRef.current();
			}
		};
		window.addEventListener("keydown", handler, true);
		return () => window.removeEventListener("keydown", handler, true);
	}, []);

	// Listen for AI insert-text events
	useEffect(() => {
		const handler = (e: Event) => {
			const detail = (e as CustomEvent).detail;
			if (detail?.filePath && detail.filePath !== filePath) return;
			if (!detail?.text || !viewRef.current) return;
			const view = viewRef.current;
			const { from, to } = view.state.selection.main;
			view.dispatch({ changes: { from, to, insert: detail.text } });
			view.focus();
		};
		window.addEventListener("connexio:editor-insert-text", handler);
		return () => window.removeEventListener("connexio:editor-insert-text", handler);
	}, [filePath]);

	// Listen for goto-line events
	useEffect(() => {
		const handler = (e: Event) => {
			const detail = (e as CustomEvent).detail;
			if (detail?.filePath === filePath && detail?.lineNumber && viewRef.current) {
				const view = viewRef.current;
				const line = view.state.doc.line(Math.min(detail.lineNumber, view.state.doc.lines));
				view.dispatch({
					selection: { anchor: line.from },
					scrollIntoView: true,
					effects: EditorView.scrollIntoView(line.from, { y: "center" }),
				});
				view.focus();
			}
		};
		window.addEventListener("connexio:editor-goto-line", handler);
		return () => window.removeEventListener("connexio:editor-goto-line", handler);
	}, [filePath]);

	// Load file and create editor — only depends on filePath (NOT theme)
	useEffect(() => {
		if (!containerRef.current) return;
		if (viewRef.current) {
			viewRef.current.destroy();
			viewRef.current = null;
		}
		containerRef.current.innerHTML = "";

		let destroyed = false;

		invoke<string>("explorer_read_file", { filePath })
			.then((content) => {
				if (destroyed || !containerRef.current) return;
				originalContentRef.current = content;
				setDirty(false);

				const state = EditorState.create({
					doc: content,
					extensions: [
						lineNumbers(),
						highlightActiveLine(),
						highlightActiveLineGutter(),
						history(),
						keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
						getLanguageExtension(filePath),
						themeCompartment.current.of(editorTheme),
						EditorView.updateListener.of((update) => {
							if (update.docChanged) {
								setDirty(true);
							}
						}),
					],
				});

				const view = new EditorView({ state, parent: containerRef.current });
				viewRef.current = view;
			})
			.catch((e) => setError(String(e)));

		return () => {
			destroyed = true;
			if (viewRef.current) {
				viewRef.current.destroy();
				viewRef.current = null;
			}
		};
	}, [filePath]); // NO editorTheme dependency — theme updates handled separately

	// Update theme in-place without destroying editor (preserves content + undo)
	useEffect(() => {
		if (!viewRef.current) return;
		viewRef.current.dispatch({
			effects: themeCompartment.current.reconfigure(editorTheme),
		});
	}, [editorTheme]);

	return (
		<div className="flex flex-col h-full">
			{/* Header */}
			<div className="flex items-center justify-between px-3 py-1.5 border-b border-connexio-border bg-connexio-bg-secondary">
				<div className="flex items-center gap-2">
					<span className="text-[11px] text-connexio-text font-medium">{fileName}</span>
					{isDirty && <span className="w-2 h-2 rounded-full bg-connexio-accent" title="Unsaved changes" />}
					{saveStatus && <span className="text-[10px] text-green-400">{saveStatus}</span>}
				</div>
				<div className="flex items-center gap-1">
					<button
						onClick={() => saveRef.current()}
						disabled={saving}
						className="flex items-center gap-1 px-2 py-0.5 text-[10px] rounded bg-connexio-accent/10 text-connexio-accent hover:bg-connexio-accent/20 disabled:opacity-30 transition-colors"
						title="Save (Ctrl+S)"
						type="button"
					>
						<Save size={10} />
						{saving ? "Saving..." : "Save"}
					</button>
					<button
						onClick={handleClose}
						className="p-1 rounded hover:bg-connexio-bg-tertiary transition-colors"
						title="Close editor"
						type="button"
					>
						<X size={12} className="text-connexio-text-muted" />
					</button>
				</div>
			</div>

			{error && (
				<div className="px-3 py-1.5 text-[11px] text-red-400 bg-red-500/10 border-b border-red-500/20">{error}</div>
			)}

			<div ref={containerRef} className="flex-1 overflow-hidden" data-custom-context-menu="" onContextMenu={handleContextMenu} />

			{/* Editor context menu */}
			{ctxMenu && (
				<EditorContextMenu
					x={ctxMenu.x}
					y={ctxMenu.y}
					onClose={() => setCtxMenu(null)}
					onCut={() => execCommand("cut")}
					onCopy={() => execCommand("copy")}
					onPaste={() => execCommand("paste")}
					onSelectAll={() => execCommand("selectAll")}
				/>
			)}

			{/* Unsaved changes confirmation */}
			{showCloseConfirm && (
				<div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40">
					<div className="bg-connexio-bg-secondary border border-connexio-border rounded-lg p-4 shadow-xl max-w-sm">
						<p className="text-sm text-connexio-text mb-1 font-medium">Unsaved Changes</p>
						<p className="text-xs text-connexio-text-secondary mb-4">
							"{fileName}" has unsaved changes. Save before closing?
						</p>
						<div className="flex items-center justify-end gap-2">
							<button
								onClick={() => { setShowCloseConfirm(false); onClose(); }}
								className="px-3 py-1.5 text-[11px] text-red-400 hover:bg-red-500/10 rounded transition-colors"
								type="button"
							>
								Discard
							</button>
							<button
								onClick={() => setShowCloseConfirm(false)}
								className="px-3 py-1.5 text-[11px] text-connexio-text-muted hover:bg-connexio-bg-tertiary rounded transition-colors"
								type="button"
							>
								Cancel
							</button>
							<button
								onClick={async () => { await saveRef.current(); setShowCloseConfirm(false); onClose(); }}
								className="px-3 py-1.5 text-[11px] font-medium bg-connexio-accent text-white rounded hover:bg-connexio-accent-hover transition-colors"
								type="button"
							>
								Save & Close
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

// ─── Editor Context Menu ──────────────────────────────────────────────────────

function EditorContextMenu({ x, y, onClose, onCut, onCopy, onPaste, onSelectAll }: {
	x: number;
	y: number;
	onClose: () => void;
	onCut: () => void;
	onCopy: () => void;
	onPaste: () => void;
	onSelectAll: () => void;
}) {
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const handleClick = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
		};
		const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
		document.addEventListener("mousedown", handleClick);
		document.addEventListener("keydown", handleKey);
		return () => {
			document.removeEventListener("mousedown", handleClick);
			document.removeEventListener("keydown", handleKey);
		};
	}, [onClose]);

	const items = [
		{ icon: Scissors, label: "Cut", shortcut: "Ctrl+X", action: onCut },
		{ icon: Copy, label: "Copy", shortcut: "Ctrl+C", action: onCopy },
		{ icon: Clipboard, label: "Paste", shortcut: "Ctrl+V", action: onPaste },
		{ icon: TextSelect, label: "Select All", shortcut: "Ctrl+A", action: onSelectAll },
	];

	return (
		<div
			ref={menuRef}
			className="fixed z-[300] min-w-[160px] py-1 bg-connexio-bg-secondary border border-connexio-border rounded-lg shadow-xl"
			style={{ top: y, left: x }}
		>
			{items.map((item) => (
				<button
					key={item.label}
					onClick={item.action}
					className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[11px] text-connexio-text hover:bg-connexio-bg-tertiary transition-colors"
					type="button"
				>
					<item.icon size={12} className="text-connexio-text-muted" />
					<span className="flex-1 text-left">{item.label}</span>
					<span className="text-[10px] text-connexio-text-muted">{item.shortcut}</span>
				</button>
			))}
		</div>
	);
}
