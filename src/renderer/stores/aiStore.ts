import { create } from "zustand";

// ─── Types ───────────────────────────────────────────────────────────────────

export type AIProviderType = "openai" | "anthropic" | "google" | "groq" | "deepseek" | "openrouter" | "local";

export interface AIProviderConfig {
	id: string;
	type: AIProviderType;
	name: string;
	apiKey: string;
	baseUrl?: string;
	models: string[];
	defaultModel: string;
	enabled: boolean;
}

export interface AIMessage {
	id: string;
	role: "user" | "assistant" | "system";
	content: string;
	timestamp: number;
	isStreaming?: boolean;
	context?: {
		file?: string;
		terminal?: string;
	};
}

export interface AIConfig {
	activeProviderId: string;
	activeModel: string;
	systemPrompt: string;
	providers: AIProviderConfig[];
	streamingEnabled: boolean;
}

export interface ChatSession {
	id: string;
	projectId: string;
	title: string;
	messages: AIMessage[];
	createdAt: number;
	updatedAt: number;
}

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

// ─── Default Providers ───────────────────────────────────────────────────────

const DEFAULT_PROVIDERS: AIProviderConfig[] = [
	{
		id: "openai",
		type: "openai",
		name: "OpenAI",
		apiKey: "",
		models: ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo", "o3-mini", "o4-mini"],
		defaultModel: "gpt-4o-mini",
		enabled: true,
	},
	{
		id: "anthropic",
		type: "anthropic",
		name: "Anthropic",
		apiKey: "",
		models: ["claude-sonnet-4-20250514", "claude-3-5-haiku-20241022", "claude-3-5-sonnet-20241022"],
		defaultModel: "claude-sonnet-4-20250514",
		enabled: true,
	},
	{
		id: "google",
		type: "google",
		name: "Google",
		apiKey: "",
		models: ["gemini-2.0-flash", "gemini-2.5-flash-preview-05-20", "gemini-2.5-pro-preview-05-06"],
		defaultModel: "gemini-2.0-flash",
		enabled: true,
	},
	{
		id: "groq",
		type: "groq",
		name: "Groq",
		apiKey: "",
		models: ["llama-3.3-70b-versatile", "mixtral-8x7b-32768", "llama-3.1-8b-instant"],
		defaultModel: "llama-3.3-70b-versatile",
		enabled: true,
	},
	{
		id: "deepseek",
		type: "deepseek",
		name: "DeepSeek",
		apiKey: "",
		models: ["deepseek-chat", "deepseek-reasoner"],
		defaultModel: "deepseek-chat",
		enabled: true,
	},
	{
		id: "openrouter",
		type: "openrouter",
		name: "OpenRouter",
		apiKey: "",
		models: ["anthropic/claude-sonnet-4-20250514", "openai/gpt-4o", "google/gemini-2.0-flash-exp:free"],
		defaultModel: "anthropic/claude-sonnet-4-20250514",
		enabled: true,
	},
	{
		id: "local",
		type: "local",
		name: "Local (LM Studio / Ollama)",
		apiKey: "",
		baseUrl: "http://localhost:1234/v1",
		models: ["default"],
		defaultModel: "default",
		enabled: true,
	},
];

const DEFAULT_CONFIG: AIConfig = {
	activeProviderId: "openai",
	activeModel: "gpt-4o-mini",
	systemPrompt:
		"You are a helpful coding assistant integrated into Connexio terminal manager. Help the user with coding tasks, terminal commands, and project management. Be concise and practical. When suggesting commands, format them in code blocks.",
	providers: DEFAULT_PROVIDERS,
	streamingEnabled: true,
};

// ─── Storage ─────────────────────────────────────────────────────────────────

function loadConfigFromStorage(): AIConfig {
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

function saveConfigToStorage(config: AIConfig) {
	try {
		// Save providers with API keys (stored locally only)
		localStorage.setItem("connexio-ai-config-v2", JSON.stringify(config));
	} catch {}
}

function loadChatSessions(): ChatSession[] {
	try {
		const stored = localStorage.getItem("connexio-ai-chat-sessions");
		if (stored) return JSON.parse(stored);
	} catch {}
	return [];
}

function saveChatSessions(sessions: ChatSession[]) {
	try {
		// Keep max 50 sessions
		const trimmed = sessions.slice(-50);
		localStorage.setItem("connexio-ai-chat-sessions", JSON.stringify(trimmed));
	} catch {}
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
								m.id === assistantMessage.id
									? { ...m, content: m.content + chunk }
									: m,
							),
						}));
					},
				);
			} else {
				const response = await fetchAIResponse(provider, config.activeModel, allMessages);
				set((state) => ({
					messages: state.messages.map((m) =>
						m.id === assistantMessage.id
							? { ...m, content: response }
							: m,
					),
				}));
			}

			set((state) => ({
				messages: state.messages.map((m) =>
					m.id === assistantMessage.id
						? { ...m, isStreaming: false }
						: m,
				),
				isLoading: false,
			}));
			currentAbortController = null;
		} catch (error: any) {
			if (error.name === "AbortError") {
				set((state) => ({
					messages: state.messages.map((m) =>
						m.id === assistantMessage.id
							? { ...m, isStreaming: false }
							: m,
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
				s.id === activeChatId
					? { ...s, messages, title, updatedAt: now }
					: s,
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

// ─── AI Provider API calls (non-streaming) ──────────────────────────────────

async function fetchAIResponse(
	provider: AIProviderConfig,
	model: string,
	messages: AIMessage[],
): Promise<string> {
	const formattedMessages = messages.map((m) => ({
		role: m.role,
		content: m.content,
	}));

	switch (provider.type) {
		case "openai":
		case "groq":
		case "deepseek":
		case "openrouter":
		case "local": {
			const baseUrl = getBaseUrl(provider);

			const headers: Record<string, string> = {
				"Content-Type": "application/json",
				Authorization: `Bearer ${provider.apiKey}`,
			};

			if (provider.type === "openrouter") {
				headers["HTTP-Referer"] = "https://connexio.dev";
				headers["X-Title"] = "Connexio";
			}

			const res = await fetch(`${baseUrl}/chat/completions`, {
				method: "POST",
				headers,
				body: JSON.stringify({
					model,
					messages: formattedMessages,
					max_tokens: 4096,
				}),
			});

			if (!res.ok) {
				const err = await res.text();
				throw new Error(`API error (${res.status}): ${err}`);
			}

			const data = await res.json();
			return data.choices?.[0]?.message?.content || "No response";
		}

		case "anthropic": {
			const systemMsg = formattedMessages.find((m) => m.role === "system");
			const chatMessages = formattedMessages.filter((m) => m.role !== "system");

			const res = await fetch("https://api.anthropic.com/v1/messages", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": provider.apiKey,
					"anthropic-version": "2023-06-01",
					"anthropic-dangerous-direct-browser-access": "true",
				},
				body: JSON.stringify({
					model,
					max_tokens: 4096,
					system: systemMsg?.content || "",
					messages: chatMessages,
				}),
			});

			if (!res.ok) {
				const err = await res.text();
				throw new Error(`API error (${res.status}): ${err}`);
			}

			const data = await res.json();
			return data.content?.[0]?.text || "No response";
		}

		case "google": {
			const systemMsg = formattedMessages.find((m) => m.role === "system");
			const chatMessages = formattedMessages
				.filter((m) => m.role !== "system")
				.map((m) => ({
					role: m.role === "assistant" ? "model" : "user",
					parts: [{ text: m.content }],
				}));

			const res = await fetch(
				`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${provider.apiKey}`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						systemInstruction: systemMsg
							? { parts: [{ text: systemMsg.content }] }
							: undefined,
						contents: chatMessages,
					}),
				},
			);

			if (!res.ok) {
				const err = await res.text();
				throw new Error(`API error (${res.status}): ${err}`);
			}

			const data = await res.json();
			return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response";
		}

		default:
			throw new Error(`Unsupported provider: ${provider.type}`);
	}
}

// ─── Streaming API calls ─────────────────────────────────────────────────────

async function fetchAIResponseStreaming(
	provider: AIProviderConfig,
	model: string,
	messages: AIMessage[],
	signal: AbortSignal,
	onChunk: (chunk: string) => void,
): Promise<void> {
	const formattedMessages = messages.map((m) => ({
		role: m.role,
		content: m.content,
	}));

	switch (provider.type) {
		case "openai":
		case "groq":
		case "deepseek":
		case "openrouter":
		case "local": {
			const baseUrl = getBaseUrl(provider);

			const headers: Record<string, string> = {
				"Content-Type": "application/json",
				Authorization: `Bearer ${provider.apiKey}`,
			};

			if (provider.type === "openrouter") {
				headers["HTTP-Referer"] = "https://connexio.dev";
				headers["X-Title"] = "Connexio";
			}

			const res = await fetch(`${baseUrl}/chat/completions`, {
				method: "POST",
				headers,
				body: JSON.stringify({
					model,
					messages: formattedMessages,
					max_tokens: 4096,
					stream: true,
				}),
				signal,
			});

			if (!res.ok) {
				const err = await res.text();
				throw new Error(`API error (${res.status}): ${err}`);
			}

			await readSSEStream(res, signal, (data) => {
				if (data === "[DONE]") return;
				try {
					const parsed = JSON.parse(data);
					const delta = parsed.choices?.[0]?.delta?.content;
					if (delta) onChunk(delta);
				} catch {}
			});
			break;
		}

		case "anthropic": {
			const systemMsg = formattedMessages.find((m) => m.role === "system");
			const chatMessages = formattedMessages.filter((m) => m.role !== "system");

			const res = await fetch("https://api.anthropic.com/v1/messages", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": provider.apiKey,
					"anthropic-version": "2023-06-01",
					"anthropic-dangerous-direct-browser-access": "true",
				},
				body: JSON.stringify({
					model,
					max_tokens: 4096,
					system: systemMsg?.content || "",
					messages: chatMessages,
					stream: true,
				}),
				signal,
			});

			if (!res.ok) {
				const err = await res.text();
				throw new Error(`API error (${res.status}): ${err}`);
			}

			await readSSEStream(res, signal, (data) => {
				try {
					const parsed = JSON.parse(data);
					if (parsed.type === "content_block_delta") {
						const text = parsed.delta?.text;
						if (text) onChunk(text);
					}
				} catch {}
			});
			break;
		}

		case "google": {
			// Google Gemini uses a different streaming format
			const systemMsg = formattedMessages.find((m) => m.role === "system");
			const chatMessages = formattedMessages
				.filter((m) => m.role !== "system")
				.map((m) => ({
					role: m.role === "assistant" ? "model" : "user",
					parts: [{ text: m.content }],
				}));

			const res = await fetch(
				`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${provider.apiKey}`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						systemInstruction: systemMsg
							? { parts: [{ text: systemMsg.content }] }
							: undefined,
						contents: chatMessages,
					}),
					signal,
				},
			);

			if (!res.ok) {
				const err = await res.text();
				throw new Error(`API error (${res.status}): ${err}`);
			}

			await readSSEStream(res, signal, (data) => {
				try {
					const parsed = JSON.parse(data);
					const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
					if (text) onChunk(text);
				} catch {}
			});
			break;
		}

		default:
			throw new Error(`Unsupported provider: ${provider.type}`);
	}
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getBaseUrl(provider: AIProviderConfig): string {
	if (provider.baseUrl) return provider.baseUrl;
	switch (provider.type) {
		case "openai": return "https://api.openai.com/v1";
		case "groq": return "https://api.groq.com/openai/v1";
		case "deepseek": return "https://api.deepseek.com/v1";
		case "openrouter": return "https://openrouter.ai/api/v1";
		case "local": return "http://localhost:1234/v1";
		default: return "https://api.openai.com/v1";
	}
}

async function readSSEStream(
	response: Response,
	signal: AbortSignal,
	onData: (data: string) => void,
): Promise<void> {
	const reader = response.body?.getReader();
	if (!reader) throw new Error("No response body");

	const decoder = new TextDecoder();
	let buffer = "";

	try {
		while (true) {
			if (signal.aborted) break;
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split("\n");
			buffer = lines.pop() || "";

			for (const line of lines) {
				if (line.startsWith("data: ")) {
					const data = line.slice(6).trim();
					if (data) onData(data);
				}
			}
		}
	} finally {
		reader.releaseLock();
	}
}
