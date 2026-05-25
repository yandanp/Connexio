import { useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useProjectStore } from "../stores/projectStore";
import { useAIStore } from "../stores/aiStore";

/**
 * Hook that manages Discord Rich Presence.
 * Updates presence based on current app state:
 * - Number of terminals/projects open
 * - Whether AI chat is active (streaming)
 * - Which AI provider is being used
 */
export function useDiscordPresence(enabled: boolean) {
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const connectedRef = useRef(false);

	const connect = useCallback(async () => {
		if (connectedRef.current) return;
		try {
			const result = await invoke<boolean>("discord_presence_connect");
			connectedRef.current = result;
		} catch (e) {
			console.warn("[Discord] Failed to connect:", e);
			connectedRef.current = false;
		}
	}, []);

	const disconnect = useCallback(async () => {
		if (!connectedRef.current) return;
		try {
			await invoke<boolean>("discord_presence_disconnect");
		} catch {
			// ignore
		}
		connectedRef.current = false;
	}, []);

	const updatePresence = useCallback(async () => {
		if (!connectedRef.current) return;

		const { projects, workspaceTabs } = useProjectStore.getState();
		const { isLoading, config } = useAIStore.getState();

		// Count active terminals
		let terminalCount = 0;
		let projectCount = 0;
		for (const [, tabs] of Object.entries(workspaceTabs)) {
			if (tabs.length > 0) {
				projectCount++;
				terminalCount += tabs.filter((t) => t.terminalId || t.splitLayout).length;
			}
		}

		// Build details and state strings
		let details: string;
		let status: string;

		if (isLoading) {
			const provider = config.providers.find((p) => p.id === config.activeProviderId);
			details = `Chatting with ${provider?.name || "AI"}`;
			status = `${terminalCount} terminal${terminalCount !== 1 ? "s" : ""} open`;
		} else {
			details = `Managing ${terminalCount} terminal${terminalCount !== 1 ? "s" : ""}`;
			status = `${projectCount} project${projectCount !== 1 ? "s" : ""} active`;
		}

		try {
			await invoke<boolean>("discord_presence_update", { details, status });
		} catch {
			// Connection lost
			connectedRef.current = false;
		}
	}, []);

	useEffect(() => {
		if (enabled) {
			connect().then(() => {
				updatePresence();
			});
			// Update presence every 15 seconds
			intervalRef.current = setInterval(updatePresence, 15000);
		} else {
			disconnect();
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		}

		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
			if (!enabled) {
				disconnect();
			}
		};
	}, [enabled, connect, disconnect, updatePresence]);

	// Also update immediately when AI streaming state changes
	useEffect(() => {
		if (enabled && connectedRef.current) {
			updatePresence();
		}
	}, [enabled, updatePresence]);
}
