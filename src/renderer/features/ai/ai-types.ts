// ─── Types ───────────────────────────────────────────────────────────────────

export type AIProviderType =
	| "openai"
	| "anthropic"
	| "google"
	| "groq"
	| "deepseek"
	| "openrouter"
	| "local";

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
