import { create } from "zustand";
import type {
	ConnexioNotification,
	NotificationSettings,
} from "../../shared/types";

// Shared audio instance to prevent overlapping sounds
// biome-ignore lint/style/useLet: reassigned in handleIncoming
let notificationAudio: HTMLAudioElement | null = null;
// biome-ignore lint/style/useLet: reassigned in handleIncoming
let lastSoundUrl: string | null = null;

interface NotificationStore {
	notifications: ConnexioNotification[];
	unreadCount: number;
	settings: NotificationSettings | null;
	isOpen: boolean;
	toast: ConnexioNotification | null;

	// Actions
	loadNotifications: () => Promise<void>;
	loadSettings: () => Promise<void>;
	updateSettings: (settings: NotificationSettings) => Promise<void>;
	markRead: (id: string) => Promise<void>;
	markAllRead: () => Promise<void>;
	remove: (id: string) => Promise<void>;
	clear: () => Promise<void>;
	togglePanel: () => void;
	closePanel: () => void;
	navigateToNotification: (notification: ConnexioNotification) => void;

	// Real-time
	handleIncoming: (notification: ConnexioNotification) => void;
	dismissToast: () => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
	notifications: [],
	unreadCount: 0,
	settings: null,
	isOpen: false,
	toast: null,

	loadNotifications: async () => {
		const notifications = await window.connexio.notification.list();
		const unreadCount = await window.connexio.notification.unreadCount();
		set({ notifications, unreadCount });
	},

	loadSettings: async () => {
		const settings = await window.connexio.notification.getSettings();
		set({ settings });
	},

	updateSettings: async (settings: NotificationSettings) => {
		const updated = await window.connexio.notification.updateSettings(settings);
		set({ settings: updated });
	},

	markRead: async (id: string) => {
		await window.connexio.notification.markRead(id);
		const { notifications } = get();
		const updated = notifications.map((n) =>
			n.id === id ? { ...n, isRead: true } : n,
		);
		set({
			notifications: updated,
			unreadCount: updated.filter((n) => !n.isRead).length,
		});
	},

	markAllRead: async () => {
		await window.connexio.notification.markAllRead();
		const { notifications } = get();
		set({
			notifications: notifications.map((n) => ({ ...n, isRead: true })),
			unreadCount: 0,
		});
	},

	remove: async (id: string) => {
		await window.connexio.notification.remove(id);
		const { notifications } = get();
		const updated = notifications.filter((n) => n.id !== id);
		set({
			notifications: updated,
			unreadCount: updated.filter((n) => !n.isRead).length,
		});
	},

	clear: async () => {
		await window.connexio.notification.clear();
		set({ notifications: [], unreadCount: 0 });
	},

	togglePanel: () => {
		set((state) => ({ isOpen: !state.isOpen }));
	},

	closePanel: () => {
		set({ isOpen: false });
	},

	navigateToNotification: (notification: ConnexioNotification) => {
		if (!notification.projectId || !notification.tabId) return;
		// Import lazily to avoid circular dependency at module init time
		import("./projectStore").then(({ useProjectStore }) => {
			const projectStore = useProjectStore.getState();
			const tabs = projectStore.workspaceTabs[notification.projectId!] || [];
			const tabExists = tabs.some((tab) => tab.id === notification.tabId);
			if (!tabExists) return;

			// Set both in one synchronous state update. Calling setActiveProject first
			// can auto-open tabs/persist state before the target tab is selected.
			useProjectStore.setState((state) => ({
				activeProjectId: notification.projectId!,
				activeTabIds: {
					...state.activeTabIds,
					[notification.projectId!]: notification.tabId!,
				},
			}));
			useProjectStore.getState().persistWorkspace();
		});
	},

	handleIncoming: (notification: ConnexioNotification) => {
		const { notifications, settings } = get();
		const updated = [notification, ...notifications];
		set({
			notifications: updated,
			unreadCount: updated.filter((n) => !n.isRead).length,
			toast: notification,
		});

		// Auto-dismiss toast after 4 seconds
		setTimeout(() => {
			const { toast } = get();
			if (toast?.id === notification.id) {
				set({ toast: null });
			}
		}, 4000);

		// Play sound if enabled — uses shared Audio instance to prevent overlap
		if (settings?.sound) {
			try {
				let soundUrl: string;
				if (settings.customSoundPath) {
					soundUrl = `file://${settings.customSoundPath.replace(/\\/g, "/")}`;
				} else {
					soundUrl = new URL("../assets/notification.wav", import.meta.url)
						.href;
				}

				// Reuse or create audio instance
				if (!notificationAudio || lastSoundUrl !== soundUrl) {
					notificationAudio = new Audio(soundUrl);
					lastSoundUrl = soundUrl;
				}

				notificationAudio.volume = settings.soundVolume ?? 0.5;
				// Reset to start if already playing (prevents overlap)
				notificationAudio.currentTime = 0;
				notificationAudio.play().catch(() => {});
			} catch {
				// Ignore audio errors
			}
		}
	},

	dismissToast: () => {
		set({ toast: null });
	},
}));
