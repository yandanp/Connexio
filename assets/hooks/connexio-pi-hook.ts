// Connexio notification extension for Pi Agent
// Sends notification to Connexio when Pi agent finishes processing
// Auto-loaded from ~/.pi/agent/extensions/

import { createConnection } from "net";

export default function (pi: any) {
	pi.on("agent_end", async (event) => {
		const port = process.env.CONNEXIO_NOTIFICATION_PORT;
		if (!port) return;

		let body = "Task completed";

		if (event.messages && event.messages.length > 0) {
			const lastAssistant = [...event.messages]
				.reverse()
				.find((m: any) => m.role === "assistant");
			if (lastAssistant) {
				const content = (lastAssistant as any).content;
				if (typeof content === "string" && content.length > 0) {
					body = content.replace(/[\n\r|]+/g, " ").slice(0, 200);
				} else if (Array.isArray(content)) {
					const text = content
						.filter((p: any) => p.type === "text")
						.map((p: any) => p.text || "")
						.join("");
					if (text) {
						body = text.replace(/[\n\r|]+/g, " ").slice(0, 200);
					}
				}
			}
		}

		const payload = {
			provider: "pi",
			title: "Pi Agent",
			body,
			projectId: process.env.CONNEXIO_PROJECT_ID,
			projectName: process.env.CONNEXIO_PROJECT_NAME,
			tabId: process.env.CONNEXIO_TAB_ID,
			tabLabel: process.env.CONNEXIO_TAB_LABEL,
			terminalId: process.env.CONNEXIO_TERMINAL_ID,
		};
		const message = JSON.stringify(payload);

		try {
			const conn = createConnection({
				port: parseInt(port),
				host: "127.0.0.1",
			});
			conn.on("error", () => {});
			conn.write(message, () => conn.end());
			await new Promise<void>((resolve) => {
				conn.on("close", resolve);
				setTimeout(resolve, 3000);
			});
		} catch {
			// Silently fail — Connexio may not be running
		}
	});
}
