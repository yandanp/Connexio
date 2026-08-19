import type { AIConfig, ChatSession } from "./ai-types";
import { DEFAULT_CONFIG, DEFAULT_PROVIDERS } from "./ai-providers";

// ─── Storage ─────────────────────────────────────────────────────────────────

export function loadConfigFromStorage(): AIConfig {
	try {
		const stored = localStorage.getItem("connexio-ai-config-v2");
		if (stored) {
			const parsed = JSON.parse(stored);
			// Merge with defaults to handle new fields
			return {
				...DEFAULT_CONFIG,
				...parsed,
				providers: parsed.providers?.length ? parsed.providers : DEFAULT_PROVIDERS,
			};
		}
		// Migrate from v1
		const v1 = localStorage.getItem("connexio-ai-config");
		if (v1) {
			const old = JSON.parse(v1);
			const config = { ...DEFAULT_CONFIG };
			if (old.provider && old.model) {
				config.activeProviderId = old.provider;
				config.activeModel = old.model;
			}
			if (old.systemPrompt) config.systemPrompt = old.systemPrompt;
			return config;
		}
	} catch {}
	return DEFAULT_CONFIG;
}

export function saveConfigToStorage(config: AIConfig) {
	try {
		// Save providers with API keys (stored locally only)
		localStorage.setItem("connexio-ai-config-v2", JSON.stringify(config));
	} catch {}
}

export function loadChatSessions(): ChatSession[] {
	try {
		const stored = localStorage.getItem("connexio-ai-chat-sessions");
		if (stored) return JSON.parse(stored);
	} catch {}
	return [];
}

export function saveChatSessions(sessions: ChatSession[]) {
	try {
		// Keep max 50 sessions
		const trimmed = sessions.slice(-50);
		localStorage.setItem("connexio-ai-chat-sessions", JSON.stringify(trimmed));
	} catch {}
}
