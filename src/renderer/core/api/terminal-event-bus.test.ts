import { beforeEach, describe, expect, it, vi } from "vitest";

const { listeners } = vi.hoisted(() => ({
	listeners: new Map<string, (event: { payload: unknown }) => void>(),
}));

vi.mock("@tauri-apps/api/event", () => ({
	listen: vi.fn((eventName: string, callback: (event: { payload: unknown }) => void) => {
		listeners.set(eventName, callback);
		return Promise.resolve(() => {});
	}),
}));

async function importBus() {
	return import("./terminal-event-bus");
}

describe("terminal event bus", () => {
	beforeEach(() => {
		vi.resetModules();
		listeners.clear();
		vi.useFakeTimers();
	});

	it("buffers data until a terminal consumer mounts when only an observer is registered", async () => {
		const bus = await importBus();
		const observed: string[] = [];
		bus.observeTerminalData((_terminalId, data) => observed.push(data));

		listeners.get("terminal:data")?.({ payload: ["terminal-1", "early prompt"] });

		expect(observed).toEqual(["early prompt"]);
		expect(bus.terminalDataBuffer.get("terminal-1")).toEqual(["early prompt"]);

		const rendered: string[] = [];
		bus.onTerminalData("terminal-1", (_terminalId, data) => rendered.push(data));
		await vi.advanceTimersByTimeAsync(500);

		expect(rendered).toEqual(["early prompt"]);
		expect(observed).toEqual(["early prompt"]);
	});

	it("does not drain one terminal's buffer when a different terminal mounts", async () => {
		const bus = await importBus();
		listeners.get("terminal:data")?.({ payload: ["terminal-2", "early prompt"] });

		const rendered: string[] = [];
		bus.onTerminalData("terminal-1", (_terminalId, data) => rendered.push(data));
		await vi.advanceTimersByTimeAsync(500);

		expect(rendered).toEqual([]);
		expect(bus.terminalDataBuffer.get("terminal-2")).toEqual(["early prompt"]);
	});

	it("replays a terminal's buffered data after another terminal mounted first", async () => {
		const bus = await importBus();
		listeners.get("terminal:data")?.({ payload: ["terminal-2", "early prompt"] });

		bus.onTerminalData("terminal-1", () => {});
		await vi.advanceTimersByTimeAsync(500);

		const rendered: string[] = [];
		bus.onTerminalData("terminal-2", (_terminalId, data) => rendered.push(data));
		await vi.advanceTimersByTimeAsync(500);

		expect(rendered).toEqual(["early prompt"]);
	});

	it("replays each buffered terminal when both consumers mount together", async () => {
		const bus = await importBus();
		listeners.get("terminal:data")?.({ payload: ["terminal-1", "first prompt"] });
		listeners.get("terminal:data")?.({ payload: ["terminal-2", "second prompt"] });

		const firstRendered: string[] = [];
		const secondRendered: string[] = [];
		bus.onTerminalData("terminal-1", (_terminalId, data) => firstRendered.push(data));
		bus.onTerminalData("terminal-2", (_terminalId, data) => secondRendered.push(data));
		await vi.advanceTimersByTimeAsync(500);

		expect(firstRendered).toEqual(["first prompt"]);
		expect(secondRendered).toEqual(["second prompt"]);
	});

	it("replays buffered data after a consumer unmounts before its scheduled flush", async () => {
		const bus = await importBus();
		listeners.get("terminal:data")?.({ payload: ["terminal-1", "early prompt"] });

		const unsubscribe = bus.onTerminalData("terminal-1", () => {});
		unsubscribe();
		await vi.advanceTimersByTimeAsync(500);

		const rendered: string[] = [];
		bus.onTerminalData("terminal-1", (_terminalId, data) => rendered.push(data));
		await vi.advanceTimersByTimeAsync(500);

		expect(rendered).toEqual(["early prompt"]);
	});
});
