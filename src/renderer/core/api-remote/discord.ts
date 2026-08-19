// ─── Discord (disabled) ─────────────────────────────────────────────────────

export const discord = {
	connect: () => Promise.resolve(false),
	disconnect: () => Promise.resolve(false),
	update: () => Promise.resolve(false),
	isConnected: () => Promise.resolve(false),
};
