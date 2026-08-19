import { waitForState } from "./connection";

// ─── App Window (no-op) ─────────────────────────────────────────────────────

export const app = {
	minimize: () => Promise.resolve(),
	maximize: () => Promise.resolve(),
	close: () => Promise.resolve(),
	isMaximized: () => Promise.resolve(false),
	getVersion: async (): Promise<string> => {
		const s = await waitForState();
		return s.version;
	},
};
