import { create } from "zustand";
import type { AIConfig, AIMessage, AIProviderConfig, ChatSession } from "./ai-types";
import { fetchAIResponse, fetchAIResponseStreaming } from "./ai-client";
import {
	loadChatSessions,
	loadConfigFromStorage,
	saveChatSessions,
	saveConfigToStorage,
} from "./ai-storage";

interface AIStore {
	// State
	messages: AIMessage[];
	isLoading: boolean;
	config: AIConfig;
	isOpen: boolean;
	chatSessions: ChatSession[];
	activeChatId: string | null;

	// Actions
	setOpen: (open: boolean) => void;
	toggleOpen: () => void;
	sendMessage: (content: string, context?: { file?: string; terminal?: string }) => Promise<void>;
	stopStreaming: () => void;
	clearMessages: () => void;
	setConfig: (config: Partial<AIConfig>) => void;
	loadConfig: () => void;

	// Provider management
	addProvider: (provider: AIProviderConfig) => void;
	updateProvider: (id: string, updates: Partial<AIProviderConfig>) => void;
	removeProvider: (id: string) => void;
	setActiveProvider: (providerId: string, model?: string) => void;

	// Chat history
	saveChatSession: (projectId: string) => void;
	loadChatSession: (sessionId: string) => void;
	deleteChatSession: (sessionId: string) => void;
	getChatSessionsForProject: (projectId: string) => ChatSession[];
	newChat: () => void;
}

// ─── Abort Controller for streaming ─────────────────────────────────────────

let currentAbortController: AbortController | null = null;

// ─── Store ───────────────────────────────────────────────────────────────────

export const useAIStore = create<AIStore>((set, get) => ({
	messages: [],
	isLoading: false,
	config: loadConfigFromStorage(),
	isOpen: false,
	chatSessions: loadChatSessions(),
	activeChatId: null,

	setOpen: (open) => set({ isOpen: open }),
	toggleOpen: () => set((s) => ({ isOpen: !s.isOpen })),

	sendMessage: async (content, context) => {
		const { config, messages } = get();
		const provider = config.providers.find((p) => p.id === config.activeProviderId);

		if (!provider || (!provider.apiKey && provider.type !== "local")) {
			set({
				messages: [
					...messages,
					{
						id: crypto.randomUUID(),
						role: "user",
						content,
						timestamp: Date.now(),
						context,
					},
					{
						id: crypto.randomUUID(),
						role: "assistant",
						content: `⚠️ No API key configured for ${provider?.name || "selected provider"}. Go to Settings to add your API key.`,
						timestamp: Date.now(),
					},
				],
			});
			return;
		}

		const userMessage: AIMessage = {
			id: crypto.randomUUID(),
			role: "user",
			content,
			timestamp: Date.now(),
			context,
		};

		const assistantMessage: AIMessage = {
			id: crypto.randomUUID(),
			role: "assistant",
			content: "",
			timestamp: Date.now(),
			isStreaming: true,
		};

		set({
			messages: [...messages, userMessage, assistantMessage],
			isLoading: true,
		});

		try {
			// Build context-enriched system prompt
			let systemContent = config.systemPrompt;
			if (context?.file) {
				systemContent += `\n\nCurrently open file:\n\`\`\`\n${context.file}\n\`\`\``;
			}
			if (context?.terminal) {
				systemContent += `\n\nRecent terminal output:\n\`\`\`\n${context.terminal}\n\`\`\``;
			}

			const systemMessages: AIMessage[] = [
				{
					id: "system",
					role: "system",
					content: systemContent,
					timestamp: 0,
				},
			];

			const allMessages = [...systemMessages, ...messages, userMessage];

			if (config.streamingEnabled) {
				currentAbortController = new AbortController();
				await fetchAIResponseStreaming(
					provider,
					config.activeModel,
					allMessages,
					currentAbortController.signal,
					(chunk) => {
						set((state) => ({
							messages: state.messages.map((m) =>
								m.id === assistantMessage.id ? { ...m, content: m.content + chunk } : m,
							),
						}));
					},
				);
			} else {
				const response = await fetchAIResponse(provider, config.activeModel, allMessages);
				set((state) => ({
					messages: state.messages.map((m) =>
						m.id === assistantMessage.id ? { ...m, content: response } : m,
					),
				}));
			}

			set((state) => ({
				messages: state.messages.map((m) =>
					m.id === assistantMessage.id ? { ...m, isStreaming: false } : m,
				),
				isLoading: false,
			}));
			currentAbortController = null;
		} catch (error: any) {
			if (error.name === "AbortError") {
				set((state) => ({
					messages: state.messages.map((m) =>
						m.id === assistantMessage.id ? { ...m, isStreaming: false } : m,
					),
					isLoading: false,
				}));
			} else {
				set((state) => ({
					messages: state.messages.map((m) =>
						m.id === assistantMessage.id
							? {
									...m,
									content: `❌ Error: ${error.message || "Failed to get response"}`,
									isStreaming: false,
								}
							: m,
					),
					isLoading: false,
				}));
			}
			currentAbortController = null;
		}
	},

	stopStreaming: () => {
		if (currentAbortController) {
			currentAbortController.abort();
			currentAbortController = null;
		}
	},

	clearMessages: () => set({ messages: [], activeChatId: null }),

	setConfig: (partial) => {
		const newConfig = { ...get().config, ...partial };
		set({ config: newConfig });
		saveConfigToStorage(newConfig);
	},

	loadConfig: () => {
		set({ config: loadConfigFromStorage() });
	},

	// Provider management
	addProvider: (provider) => {
		const { config } = get();
		const newConfig = { ...config, providers: [...config.providers, provider] };
		set({ config: newConfig });
		saveConfigToStorage(newConfig);
	},

	updateProvider: (id, updates) => {
		const { config } = get();
		const newConfig = {
			...config,
			providers: config.providers.map((p) => (p.id === id ? { ...p, ...updates } : p)),
		};
		set({ config: newConfig });
		saveConfigToStorage(newConfig);
	},

	removeProvider: (id) => {
		const { config } = get();
		const newConfig = {
			...config,
			providers: config.providers.filter((p) => p.id !== id),
		};
		set({ config: newConfig });
		saveConfigToStorage(newConfig);
	},

	setActiveProvider: (providerId, model) => {
		const { config } = get();
		const provider = config.providers.find((p) => p.id === providerId);
		const newConfig = {
			...config,
			activeProviderId: providerId,
			activeModel: model || provider?.defaultModel || provider?.models[0] || "",
		};
		set({ config: newConfig });
		saveConfigToStorage(newConfig);
	},

	// Chat history
	saveChatSession: (projectId) => {
		const { messages, chatSessions, activeChatId } = get();
		if (messages.length === 0) return;

		const title = messages.find((m) => m.role === "user")?.content.slice(0, 50) || "Untitled";
		const now = Date.now();

		if (activeChatId) {
			// Update existing session
			const updated = chatSessions.map((s) =>
				s.id === activeChatId ? { ...s, messages, title, updatedAt: now } : s,
			);
			set({ chatSessions: updated });
			saveChatSessions(updated);
		} else {
			// Create new session
			const session: ChatSession = {
				id: crypto.randomUUID(),
				projectId,
				title,
				messages,
				createdAt: now,
				updatedAt: now,
			};
			const updated = [...chatSessions, session];
			set({ chatSessions: updated, activeChatId: session.id });
			saveChatSessions(updated);
		}
	},

	loadChatSession: (sessionId) => {
		const { chatSessions } = get();
		const session = chatSessions.find((s) => s.id === sessionId);
		if (session) {
			set({ messages: session.messages, activeChatId: session.id });
		}
	},

	deleteChatSession: (sessionId) => {
		const { chatSessions, activeChatId } = get();
		const updated = chatSessions.filter((s) => s.id !== sessionId);
		set({
			chatSessions: updated,
			...(activeChatId === sessionId ? { messages: [], activeChatId: null } : {}),
		});
		saveChatSessions(updated);
	},

	getChatSessionsForProject: (projectId) => {
		return get().chatSessions.filter((s) => s.projectId === projectId);
	},

	newChat: () => {
		set({ messages: [], activeChatId: null });
	},
}));
