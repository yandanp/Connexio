import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";

// ─── Notification ────────────────────────────────────────────────────────────

// Global notification listener
type NotificationCallback = (notification: any) => void;
const notificationReceivedListeners = new Set<NotificationCallback>();
const notificationNavigateListeners = new Set<NotificationCallback>();

listen<any>("notification:received", (event) => {
	for (const cb of notificationReceivedListeners) {
		cb(event.payload);
	}
});

listen<any>("notification:navigate", (event) => {
	for (const cb of notificationNavigateListeners) {
		cb(event.payload);
	}
});

export const notification = {
	list: (): Promise<any[]> => invoke("notification_list"),
	unreadCount: (): Promise<number> => invoke("notification_unread_count"),
	markRead: (id: string): Promise<void> => invoke("notification_mark_read", { id }),
	markAllRead: (): Promise<void> => invoke("notification_mark_all_read"),
	remove: (id: string): Promise<void> => invoke("notification_remove", { id }),
	clear: (): Promise<void> => invoke("notification_clear"),
	getSettings: (): Promise<any> => invoke("notification_get_settings"),
	updateSettings: (settings: any): Promise<any> =>
		invoke("notification_update_settings", { settings }),
	getPort: (): Promise<number | null> => invoke("notification_get_port"),
	onReceived: (cb: (n: any) => void) => {
		notificationReceivedListeners.add(cb);
		return () => {
			notificationReceivedListeners.delete(cb);
		};
	},
	onNavigate: (cb: (n: any) => void) => {
		notificationNavigateListeners.add(cb);
		return () => {
			notificationNavigateListeners.delete(cb);
		};
	},
	getProviders: (): Promise<any[]> => invoke("notification_get_providers"),
	installHook: (providerId: string): Promise<void> =>
		invoke("notification_install_hook", { providerId }),
	uninstallHook: (providerId: string): Promise<void> =>
		invoke("notification_uninstall_hook", { providerId }),
	uploadSound: async (): Promise<any> => {
		const selected = await open({
			multiple: false,
			filters: [{ name: "Audio", extensions: ["wav", "mp3", "ogg"] }],
		});
		if (!selected) return { success: false };
		// Copy file to app data and update settings
		return invoke("notification_upload_sound", { path: selected });
	},
	removeCustomSound: (): Promise<void> => invoke("notification_remove_custom_sound"),
	getSoundPath: (): Promise<string | null> => invoke("notification_get_sound_path"),
};
