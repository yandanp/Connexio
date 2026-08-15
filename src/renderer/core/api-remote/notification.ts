// ─── Notification (minimal) ─────────────────────────────────────────────────

export const notification = {
	list: (): Promise<any[]> => Promise.resolve([]),
	unreadCount: (): Promise<number> => Promise.resolve(0),
	markRead: (_id: string): Promise<void> => Promise.resolve(),
	markAllRead: (): Promise<void> => Promise.resolve(),
	remove: (_id: string): Promise<void> => Promise.resolve(),
	clear: (): Promise<void> => Promise.resolve(),
	getSettings: (): Promise<any> => Promise.resolve({ enabled: false }),
	updateSettings: (_s: any): Promise<any> => Promise.resolve({}),
	getPort: (): Promise<number | null> => Promise.resolve(null),
	onReceived: (_cb: (n: any) => void) => () => {},
	onNavigate: (_cb: (n: any) => void) => () => {},
	getProviders: (): Promise<any[]> => Promise.resolve([]),
	installHook: (_id: string): Promise<void> => Promise.resolve(),
	uninstallHook: (_id: string): Promise<void> => Promise.resolve(),
	uploadSound: async () => ({ success: false }),
	removeCustomSound: (): Promise<void> => Promise.resolve(),
	getSoundPath: (): Promise<string | null> => Promise.resolve(null),
};
