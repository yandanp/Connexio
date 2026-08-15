// ─── Updater (disabled) ─────────────────────────────────────────────────────

export const updater = {
	check: async () => ({ available: false, version: "" }),
	download: async () => {},
	install: async () => {},
	onChecking: () => () => {},
	onAvailable: () => () => {},
	onNotAvailable: () => () => {},
	onProgress: () => () => {},
	onDownloaded: () => () => {},
	onError: () => () => {},
};
