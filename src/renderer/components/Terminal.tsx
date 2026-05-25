import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { WebglAddon } from "@xterm/addon-webgl";
import { Terminal as XTerm } from "@xterm/xterm";
import { Search, X as XIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { TerminalThemeColors } from "../../shared/types";
import { useSettingsStore } from "../stores/settingsStore";
import { useThemeStore } from "../stores/themeStore";
import TerminalContextMenu from "./TerminalContextMenu";
import "@xterm/xterm/css/xterm.css";

interface Props {
	terminalId: string;
	isVisible?: boolean;
}

function buildXtermTheme(terminal: TerminalThemeColors) {
	return {
		background: terminal.background,
		foreground: terminal.foreground,
		cursor: terminal.cursor,
		cursorAccent: terminal.cursorAccent,
		selectionBackground: terminal.selectionBackground,
		black: terminal.black,
		red: terminal.red,
		green: terminal.green,
		yellow: terminal.yellow,
		blue: terminal.blue,
		magenta: terminal.magenta,
		cyan: terminal.cyan,
		white: terminal.white,
		brightBlack: terminal.brightBlack,
		brightRed: terminal.brightRed,
		brightGreen: terminal.brightGreen,
		brightYellow: terminal.brightYellow,
		brightBlue: terminal.brightBlue,
		brightMagenta: terminal.brightMagenta,
		brightCyan: terminal.brightCyan,
		brightWhite: terminal.brightWhite,
	};
}

const MIN_SCROLLBACK = 500;
const MAX_SCROLLBACK = 2000;

function clampScrollback(value: number | undefined): number {
	const scrollback = Number(value ?? 1000);
	if (!Number.isFinite(scrollback)) return 1000;
	return Math.min(MAX_SCROLLBACK, Math.max(MIN_SCROLLBACK, scrollback));
}

export default function Terminal({ terminalId, isVisible }: Props) {
	const containerRef = useRef<HTMLDivElement>(null);
	const xtermRef = useRef<XTerm | null>(null);
	const fitAddonRef = useRef<FitAddon | null>(null);
	const searchAddonRef = useRef<SearchAddon | null>(null);
	// Global disposed flag — checked by ALL operations on this terminal
	const disposedRef = useRef(false);
	// Track visibility so the write batcher can check it
	const visibleRef = useRef(isVisible ?? false);
	visibleRef.current = isVisible ?? false;
	const { currentTheme } = useThemeStore();
	// Read settings once at mount — avoid re-renders when settings modal opens
	const settingsRef = useRef(useSettingsStore.getState().settings);
	const settings = settingsRef.current;

	// Search bar state
	const [showSearch, setShowSearch] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const searchInputRef = useRef<HTMLInputElement>(null);

	// Context menu state
	const [contextMenu, setContextMenu] = useState<{
		x: number;
		y: number;
		hasSelection: boolean;
	} | null>(null);

	const handleContextMenu = useCallback((e: MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		const xterm = xtermRef.current;
		const hasSelection = !!(xterm && xterm.getSelection());
		setContextMenu({ x: e.clientX, y: e.clientY, hasSelection });
	}, []);

	const handleCopy = useCallback(() => {
		const xterm = xtermRef.current;
		if (!xterm) return;
		const selection = xterm.getSelection();
		if (selection) {
			navigator.clipboard.writeText(selection).catch(() => {});
		}
	}, []);

	const handlePaste = useCallback(() => {
		navigator.clipboard
			.readText()
			.then((text) => {
				if (text && !disposedRef.current) {
					window.connexio.terminal.write(terminalId, text);
				}
			})
			.catch(() => {});
	}, [terminalId]);

	const closeContextMenu = useCallback(() => {
		setContextMenu(null);
	}, []);

	// Safe wrapper: only call xterm/fitAddon if not disposed
	const safeFit = () => {
		if (disposedRef.current) return;
		try {
			const el = containerRef.current;
			if (!el || el.offsetWidth === 0 || el.offsetHeight === 0) return;
			const fitAddon = fitAddonRef.current;
			if (!fitAddon) return;
			fitAddon.fit();
			const dims = fitAddon.proposeDimensions();
			if (dims && dims.cols > 0 && dims.rows > 0) {
				window.connexio.terminal.resize(terminalId, dims.cols, dims.rows);
			}
		} catch (_e) {
			// ignore — terminal may be mid-dispose
		}
	};

	// Effect: create and manage terminal instance
	useEffect(() => {
		if (!containerRef.current) return;

		disposedRef.current = false;

		const xterm = new XTerm({
			fontSize: settings?.fontSize || 13,
			fontFamily:
				settings?.fontFamily ||
				"'JetBrainsMono NF', 'JetBrainsMono Nerd Font', 'CaskaydiaCove Nerd Font', 'FiraCode Nerd Font', 'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace",
			cursorBlink: settings?.cursorBlink ?? false,
			cursorStyle: settings?.cursorStyle || "bar",
			scrollback: clampScrollback(settings?.scrollback),
			allowProposedApi: true,
			theme: currentTheme ? buildXtermTheme(currentTheme.terminal) : undefined,
			letterSpacing: 0,
			convertEol: false,
			altClickMovesCursor: true,
			fastScrollModifier: "alt",
			fastScrollSensitivity: 5,
		});

		const fitAddon = new FitAddon();
		const searchAddon = new SearchAddon();
		xterm.loadAddon(fitAddon);
		xterm.loadAddon(searchAddon);
		xterm.loadAddon(new WebLinksAddon());

		xterm.open(containerRef.current);

		// --- Paste handling: bypass xterm.js entirely, use Rust backend ---
		// WebView2 has a bug where clipboard image data is not available in
		// paste events. We block ALL xterm paste handling and do it ourselves.

		// 1. Block Ctrl+V keydown so xterm doesn't trigger browser paste
		xterm.attachCustomKeyEventHandler((e) => {
			if ((e.ctrlKey || e.metaKey) && e.key === "v" && e.type === "keydown") {
				return false;
			}
			return true;
		});

		// 2. Block DOM paste event so xterm's internal handler doesn't fire
		const blockPaste = (e: Event) => {
			e.preventDefault();
			e.stopPropagation();
		};
		containerRef.current.addEventListener("paste", blockPaste, true);

		// 3. Handle Ctrl+V ourselves via Rust clipboard API
		const handleCtrlV = async (e: KeyboardEvent) => {
			if (!(e.ctrlKey || e.metaKey) || e.key !== "v" || e.type !== "keydown") return;
			if (disposedRef.current) return;
			// Only handle if this terminal's container has focus
			if (!containerRef.current?.contains(document.activeElement)) return;
			e.preventDefault();
			try {
				// Check image FIRST — if clipboard has image, always send \x16
				// so TUI apps (opencode) can read it themselves
				const hasImage = await invoke<boolean>("clipboard_has_image");
				if (hasImage) {
					window.connexio.terminal.write(terminalId, "\x16");
					return;
				}
				// No image — paste text normally
				const text = await invoke<string | null>("clipboard_read_text");
				if (text) {
					window.connexio.terminal.write(terminalId, text);
				}
			} catch {
				window.connexio.terminal.write(terminalId, "\x16");
			}
		};
		document.addEventListener("keydown", handleCtrlV, true);

		xtermRef.current = xterm;
		fitAddonRef.current = fitAddon;
		searchAddonRef.current = searchAddon;

		// --- WebGL renderer (optional, must be explicitly enabled in settings) ---
		let webglAddon: WebglAddon | null = null;
		if (settings?.webglRenderer === true) {
			try {
				webglAddon = new WebglAddon();
				webglAddon.onContextLoss(() => {
					// Fallback to DOM renderer on context loss
					webglAddon?.dispose();
				});
				xterm.loadAddon(webglAddon);
			} catch (_e) {
				// WebGL not available, fall back to DOM renderer
				webglAddon = null;
			}
		}

		// --- Write batcher ---
		// Data from PTY is buffered and flushed in batches.
		// When the terminal container is hidden (display:none, 0×0),
		// xterm.write() crashes because viewport dimensions are undefined.
		// We defer writes until the container is visible and has size.
		let writeBuffer = "";
		let writeRafId: number | null = null;
		let writeTimeoutId: ReturnType<typeof setTimeout> | null = null;

		const isContainerReady = () => {
			const el = containerRef.current;
			return el != null && el.offsetWidth > 0 && el.offsetHeight > 0;
		};

		const flushWrites = () => {
			writeRafId = null;
			if (writeTimeoutId !== null) {
				clearTimeout(writeTimeoutId);
				writeTimeoutId = null;
			}
			if (disposedRef.current || writeBuffer.length === 0) {
				writeBuffer = "";
				return;
			}
			// Defer if container is hidden / has no size — xterm viewport
			// is not initialised and write() would throw "dimensions" error
			if (!isContainerReady()) {
				writeRafId = requestAnimationFrame(flushWrites);
				return;
			}
			const data = writeBuffer;
			writeBuffer = "";
			try {
				xterm.write(data);
			} catch (_e) {
				// terminal disposed mid-flush
			}
		};

		const batchWrite = (data: string) => {
			if (disposedRef.current) return;
			writeBuffer += data;
			if (writeRafId === null) {
				writeRafId = requestAnimationFrame(flushWrites);
			}
			if (writeTimeoutId === null) {
				writeTimeoutId = setTimeout(flushWrites, 8);
			}
		};

		// --- Event listeners ---
		const selectionDisposable = xterm.onSelectionChange(() => {
			if (disposedRef.current) return;
			const currentSettings = useSettingsStore.getState().settings;
			if (currentSettings?.copyOnSelect) {
				const selection = xterm.getSelection();
				if (selection) {
					navigator.clipboard.writeText(selection).catch(() => {});
				}
			}
		});

		const dataDisposable = xterm.onData((data) => {
			if (disposedRef.current) return;
			window.connexio.terminal.write(terminalId, data);
		});

		const unsubscribe = window.connexio.terminal.onData(
			(id: string, data: string) => {
				if (id === terminalId) {
					batchWrite(data);
				}
			},
		);

		// --- Resize ---
		let resizeTimer: ReturnType<typeof setTimeout> | null = null;
		const debouncedFit = () => {
			if (disposedRef.current) return;
			if (resizeTimer !== null) clearTimeout(resizeTimer);
			resizeTimer = setTimeout(() => {
				resizeTimer = null;
				safeFit();
			}, 100);
		};

		const resizeObserver = new ResizeObserver(() => debouncedFit());
		resizeObserver.observe(containerRef.current);

		// --- Context menu (right-click) ---
		const terminalEl = containerRef.current;
		terminalEl.addEventListener("contextmenu", handleContextMenu);

		const initTimer1 = setTimeout(safeFit, 50);
		const initTimer2 = setTimeout(safeFit, 200);
		const initTimer3 = setTimeout(safeFit, 500);

		// --- Cleanup ---
		return () => {
			// 1. Set disposed flag FIRST — stops all async operations immediately
			disposedRef.current = true;

			// 2. Cancel all pending timers
			clearTimeout(initTimer1);
			clearTimeout(initTimer2);
			clearTimeout(initTimer3);
			if (resizeTimer !== null) clearTimeout(resizeTimer);
			if (writeRafId !== null) cancelAnimationFrame(writeRafId);
			if (writeTimeoutId !== null) clearTimeout(writeTimeoutId);
			writeBuffer = "";

			// 3. Remove IPC listener (stops data flow from backend)
			unsubscribe();

			// 4. Remove xterm event listeners
			selectionDisposable.dispose();
			dataDisposable.dispose();

			// 5. Disconnect resize observer & context menu & paste handlers
			resizeObserver.disconnect();
			terminalEl.removeEventListener("contextmenu", handleContextMenu);
			terminalEl.removeEventListener("paste", blockPaste, true);
			document.removeEventListener("keydown", handleCtrlV, true);

			// 6. Dispose WebGL addon
			if (webglAddon) {
				try { webglAddon.dispose(); } catch (_e) { /* ignore */ }
			}

			// 7. Finally dispose xterm (after everything else is cleaned up)
			try {
				xterm.dispose();
			} catch (_e) {
				// ignore
			}
			xtermRef.current = null;
			fitAddonRef.current = null;
			searchAddonRef.current = null;
		};
	}, [terminalId]);

	// Effect: update theme
	useEffect(() => {
		if (disposedRef.current || !xtermRef.current || !currentTheme) return;
		try {
			xtermRef.current.options.theme = buildXtermTheme(currentTheme.terminal);
		} catch (_e) {
			// ignore
		}
	}, [currentTheme]);

	// Effect: re-fit when terminal becomes visible
	useEffect(() => {
		if (!isVisible || disposedRef.current) return;
		if (!xtermRef.current || !fitAddonRef.current) return;

		const timer = setTimeout(() => {
			safeFit();
			try {
				xtermRef.current?.focus();
			} catch (_e) {
				// ignore
			}
		}, 50);

		return () => clearTimeout(timer);
	}, [isVisible, terminalId]);

	// Effect: explicit fit requests from split layout changes.
	// ResizeObserver is not always enough when panes collapse/expand while the
	// terminal remains mounted and visible, so split actions dispatch this event.
	useEffect(() => {
		let fitTimer: ReturnType<typeof setTimeout> | null = null;
		let trailingTimer: ReturnType<typeof setTimeout> | null = null;

		const handleFitRequest = () => {
			if (!isVisible || disposedRef.current) return;

			// Debounce: cancel previous pending fit, schedule a new one
			if (fitTimer !== null) clearTimeout(fitTimer);
			if (trailingTimer !== null) clearTimeout(trailingTimer);

			// Immediate fit for responsiveness
			safeFit();

			// Trailing fit to catch final layout after animations/transitions
			trailingTimer = setTimeout(() => {
				trailingTimer = null;
				safeFit();
			}, 150);
		};

		window.addEventListener("resize", handleFitRequest);
		window.addEventListener("connexio:terminal-fit", handleFitRequest);
		return () => {
			window.removeEventListener("resize", handleFitRequest);
			window.removeEventListener("connexio:terminal-fit", handleFitRequest);
			if (fitTimer !== null) clearTimeout(fitTimer);
			if (trailingTimer !== null) clearTimeout(trailingTimer);
		};
	}, [isVisible, terminalId]);

	// Effect: subscribe to settings changes without triggering re-renders
	useEffect(() => {
		const unsubSettings = useSettingsStore.subscribe((state) => {
			if (disposedRef.current || !xtermRef.current || !state.settings) return;
			try {
				xtermRef.current.options.fontSize = state.settings.fontSize;
				xtermRef.current.options.fontFamily = state.settings.fontFamily;
				xtermRef.current.options.cursorBlink = state.settings.cursorBlink;
				xtermRef.current.options.cursorStyle = state.settings.cursorStyle;
				xtermRef.current.options.scrollback = clampScrollback(
					state.settings.scrollback,
				);
				safeFit();
			} catch (_e) {
				// ignore
			}
		});
		return unsubSettings;
	}, []);

	// Terminal search handlers
	const handleSearchOpen = useCallback(() => {
		setShowSearch(true);
		setTimeout(() => searchInputRef.current?.focus(), 50);
	}, []);

	const handleSearchClose = useCallback(() => {
		setShowSearch(false);
		setSearchQuery("");
		searchAddonRef.current?.clearDecorations();
		xtermRef.current?.focus();
	}, []);

	const handleSearchNext = useCallback(() => {
		if (searchQuery && searchAddonRef.current) {
			searchAddonRef.current.findNext(searchQuery);
		}
	}, [searchQuery]);

	const handleSearchPrev = useCallback(() => {
		if (searchQuery && searchAddonRef.current) {
			searchAddonRef.current.findPrevious(searchQuery);
		}
	}, [searchQuery]);

	// Ctrl+F to open search
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (!isVisible) return;
			if ((e.ctrlKey || e.metaKey) && e.key === "f") {
				e.preventDefault();
				e.stopPropagation();
				handleSearchOpen();
			}
		};
		window.addEventListener("keydown", handler, true);
		return () => window.removeEventListener("keydown", handler, true);
	}, [isVisible, handleSearchOpen]);

	// Auto-search as user types
	useEffect(() => {
		if (!showSearch || !searchAddonRef.current) return;
		if (searchQuery) {
			searchAddonRef.current.findNext(searchQuery);
		} else {
			searchAddonRef.current.clearDecorations();
		}
	}, [searchQuery, showSearch]);

	return (
		<div className="relative w-full h-full">
			{/* Search bar */}
			{showSearch && (
				<div className="absolute top-1 right-1 z-20 flex items-center gap-1 px-2 py-1 bg-connexio-bg-secondary border border-connexio-border rounded-md shadow-lg">
					<Search size={11} className="text-connexio-text-muted flex-shrink-0" />
					<input
						ref={searchInputRef}
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.shiftKey ? handleSearchPrev() : handleSearchNext();
							}
							if (e.key === "Escape") handleSearchClose();
						}}
						className="w-[160px] px-1.5 py-0.5 text-xs bg-connexio-bg-tertiary text-connexio-text border border-connexio-border rounded outline-none focus:border-connexio-accent"
						placeholder="Search..."
					/>
					<button onClick={handleSearchPrev} className="p-0.5 rounded hover:bg-connexio-bg-tertiary" title="Previous (Shift+Enter)" type="button">
						<span className="text-[10px] text-connexio-text-muted">↑</span>
					</button>
					<button onClick={handleSearchNext} className="p-0.5 rounded hover:bg-connexio-bg-tertiary" title="Next (Enter)" type="button">
						<span className="text-[10px] text-connexio-text-muted">↓</span>
					</button>
					<button onClick={handleSearchClose} className="p-0.5 rounded hover:bg-connexio-bg-tertiary" title="Close (Esc)" type="button">
						<XIcon size={11} className="text-connexio-text-muted" />
					</button>
				</div>
			)}

			<div
				ref={containerRef}
				className="terminal-container w-full h-full bg-connexio-bg"
				data-custom-context-menu=""
			/>
			{contextMenu && (
				<TerminalContextMenu
					x={contextMenu.x}
					y={contextMenu.y}
					hasSelection={contextMenu.hasSelection}
					onCopy={handleCopy}
					onPaste={handlePaste}
					onClose={closeContextMenu}
				/>
			)}
		</div>
	);
}
