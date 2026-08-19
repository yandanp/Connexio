import type { AIConfig, AIProviderConfig } from "./ai-types";

// ─── Default Providers ───────────────────────────────────────────────────────

export const DEFAULT_PROVIDERS: AIProviderConfig[] = [
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
		models: [
			"anthropic/claude-sonnet-4-20250514",
			"openai/gpt-4o",
			"google/gemini-2.0-flash-exp:free",
		],
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

export const DEFAULT_CONFIG: AIConfig = {
	activeProviderId: "openai",
	activeModel: "gpt-4o-mini",
	systemPrompt:
		"You are a helpful coding assistant integrated into Connexio terminal manager. Help the user with coding tasks, terminal commands, and project management. Be concise and practical. When suggesting commands, format them in code blocks.",
	providers: DEFAULT_PROVIDERS,
	streamingEnabled: true,
};

// ─── Base URL ──────────────────────────────────────────────────────────────

export function getBaseUrl(provider: AIProviderConfig): string {
	if (provider.baseUrl) return provider.baseUrl;
	switch (provider.type) {
		case "openai":
			return "https://api.openai.com/v1";
		case "groq":
			return "https://api.groq.com/openai/v1";
		case "deepseek":
			return "https://api.deepseek.com/v1";
		case "openrouter":
			return "https://openrouter.ai/api/v1";
		case "local":
			return "http://localhost:1234/v1";
		default:
			return "https://api.openai.com/v1";
	}
}
