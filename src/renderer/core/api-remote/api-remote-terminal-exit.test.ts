import { expect, it, vi } from "vitest";

vi.stubGlobal("fetch", vi.fn());
vi.stubGlobal(
	"WebSocket",
	class {
		close() {}
	},
);
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

it("remote terminal.onExit subscribes to exit events and unsubscribes", async () => {
	const { terminal } = await import("./terminal");
	const { terminalExitListeners } = await import("./connection");

	const seen: string[] = [];
	const unsubscribe = terminal.onExit((id) => seen.push(id));

	// Dispatch the same way handleServerMessage does for term_exit.
	for (const cb of terminalExitListeners) cb("term-remote-1");
	expect(seen).toEqual(["term-remote-1"]);

	unsubscribe();
	for (const cb of terminalExitListeners) cb("term-remote-2");
	expect(seen).toEqual(["term-remote-1"]);
});
