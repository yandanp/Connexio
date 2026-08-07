import type { FitAddon } from "@xterm/addon-fit";
import type { Terminal } from "@xterm/xterm";
import { useCallback, useEffect, useRef } from "react";

const FIT_DEBOUNCE_MS = 8;
const PTY_RESIZE_DEBOUNCE_MS = 256;
const MIN_FIT_WIDTH = 40;
const MIN_FIT_HEIGHT = 40;

interface UseTerminalResizeV2Options {
	onPtyResize: (cols: number, rows: number) => void;
	terminalRef: React.RefObject<Terminal | null>;
	fitAddonRef: React.RefObject<FitAddon | null>;
	containerRef: React.RefObject<HTMLDivElement | null>;
	isVisible?: boolean;
}

interface UseTerminalResizeV2Return {
	forceFit: () => void;
}

export function useTerminalResizeV2({
	onPtyResize,
	terminalRef,
	fitAddonRef,
	containerRef,
	isVisible = true,
}: UseTerminalResizeV2Options): UseTerminalResizeV2Return {
	const fitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const ptyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const lastContainerWidthRef = useRef(0);
	const lastContainerHeightRef = useRef(0);
	const lastColsRef = useRef(0);
	const lastRowsRef = useRef(0);
	const isVisibleRef = useRef(isVisible);
	isVisibleRef.current = isVisible;

	const onPtyResizeRef = useRef(onPtyResize);
	onPtyResizeRef.current = onPtyResize;

	const performFit = useCallback(
		(force = false): boolean => {
			const fitAddon = fitAddonRef.current;
			const terminal = terminalRef.current;
			const container = containerRef.current;
			if (!fitAddon || !terminal || !container) return false;

			const rect = container.getBoundingClientRect();
			const width = Math.round(rect.width);
			const height = Math.round(rect.height);

			// Do not fit while the layout is collapsed or mid-transition.
			if (width < MIN_FIT_WIDTH || height < MIN_FIT_HEIGHT) return false;

			if (
				!force &&
				width === lastContainerWidthRef.current &&
				height === lastContainerHeightRef.current
			) {
				return false;
			}

			const buffer = terminal.buffer.active;
			const viewportY = buffer.viewportY;
			const baseY = buffer.baseY;
			const wasAtBottom = viewportY >= Math.max(0, baseY - 1);

			try {
				fitAddon.fit();
			} catch {
				return false;
			}

			lastContainerWidthRef.current = width;
			lastContainerHeightRef.current = height;

			requestAnimationFrame(() => {
				if (terminalRef.current !== terminal) return;
				if (wasAtBottom) {
					terminal.scrollToBottom();
				} else if (viewportY > 0 && viewportY <= baseY) {
					terminal.scrollToLine(viewportY);
				}
			});

			return true;
		},
		[containerRef, fitAddonRef, terminalRef],
	);

	const performFitRef = useRef(performFit);
	performFitRef.current = performFit;

	const schedulePtyResize = useCallback((cols: number, rows: number) => {
		if (cols === lastColsRef.current && rows === lastRowsRef.current) return;
		if (ptyTimerRef.current) clearTimeout(ptyTimerRef.current);

		ptyTimerRef.current = setTimeout(() => {
			ptyTimerRef.current = null;
			if (cols === lastColsRef.current && rows === lastRowsRef.current) return;
			lastColsRef.current = cols;
			lastRowsRef.current = rows;
			onPtyResizeRef.current(cols, rows);
		}, PTY_RESIZE_DEBOUNCE_MS);
	}, []);

	const schedulePtyResizeRef = useRef(schedulePtyResize);
	schedulePtyResizeRef.current = schedulePtyResize;

	const forceFit = useCallback(() => {
		if (ptyTimerRef.current) {
			clearTimeout(ptyTimerRef.current);
			ptyTimerRef.current = null;
		}

		const didFit = performFitRef.current(true);
		const terminal = terminalRef.current;
		if (!didFit || !terminal) return;

		lastColsRef.current = terminal.cols;
		lastRowsRef.current = terminal.rows;
		onPtyResizeRef.current(terminal.cols, terminal.rows);
	}, [terminalRef]);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const handleResize = () => {
			if (!isVisibleRef.current) return;
			if (fitTimerRef.current) clearTimeout(fitTimerRef.current);

			fitTimerRef.current = setTimeout(() => {
				fitTimerRef.current = null;
				const didFit = performFitRef.current(false);
				const terminal = terminalRef.current;
				if (!didFit || !terminal) return;
				schedulePtyResizeRef.current(terminal.cols, terminal.rows);
			}, FIT_DEBOUNCE_MS);
		};

		const observer = new ResizeObserver(handleResize);
		observer.observe(container);

		return () => {
			observer.disconnect();
			if (fitTimerRef.current) clearTimeout(fitTimerRef.current);
			if (ptyTimerRef.current) clearTimeout(ptyTimerRef.current);
		};
	}, [containerRef, terminalRef]);

	return { forceFit };
}
