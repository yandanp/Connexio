import { expect, it, vi } from "vitest";

vi.stubGlobal("fetch", vi.fn());
vi.stubGlobal(
	"WebSocket",
	class {
		close() {}
	},
);

// connection.ts reads stored credentials at import time — the node test
// environment has no browser storage, so stub it alongside fetch/WebSocket.
vi.stubGlobal("sessionStorage", {
	getItem: vi.fn(() => null),
	setItem: vi.fn(),
	removeItem: vi.fn(),
});
vi.stubGlobal("localStorage", {
	getItem: vi.fn(() => null),
	setItem: vi.fn(),
	removeItem: vi.fn(),
});
it("connexioRemoteApi exposes exactly the 15 public domains", async () => {
	// Dynamic import: the globals above must be stubbed before module init.
	const { connexioRemoteApi } = await import("./index");

	expect(Object.keys(connexioRemoteApi)).toEqual([
		"terminal",
		"project",
		"session",
		"settings",
		"workspace",
		"tasks",
		"pinned",
		"ssh",
		"git",
		"theme",
		"app",
		"updater",
		"notification",
		"discord",
		"remote",
	]);
});
