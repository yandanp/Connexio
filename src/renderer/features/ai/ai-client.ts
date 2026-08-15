import type { AIMessage, AIProviderConfig } from "./ai-types";
import { getBaseUrl } from "./ai-providers";

// ─── AI Provider API calls (non-streaming) ──────────────────────────────────

export async function fetchAIResponse(
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
						systemInstruction: systemMsg ? { parts: [{ text: systemMsg.content }] } : undefined,
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

export async function fetchAIResponseStreaming(
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
						systemInstruction: systemMsg ? { parts: [{ text: systemMsg.content }] } : undefined,
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

// ─── SSE stream reader ─────────────────────────────────────────────────────

export async function readSSEStream(
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
