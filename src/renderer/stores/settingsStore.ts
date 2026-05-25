import { create } from "zustand";
import type { AppSettings, ShellInfo } from "../../shared/types";

interface SettingsStore {
	settings: AppSettings | null;
	shells: ShellInfo[];
	isSettingsOpen: boolean;
	discordPresence: boolean;

	loadSettings: () => Promise<void>;
	loadShells: () => Promise<void>;
	updateSettings: (settings: AppSettings) => Promise<void>;
	openSettings: () => void;
	closeSettings: () => void;
	setDiscordPresence: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
	settings: null,
	shells: [],
	isSettingsOpen: false,
	discordPresence: localStorage.getItem("connexio:discord-presence") === "true",

	loadSettings: async () => {
		const settings = await window.connexio.settings.get();
		set({ settings });
	},

	loadShells: async () => {
		const shells = await window.connexio.settings.getShells();
		set({ shells });
	},

	updateSettings: async (settings: AppSettings) => {
		const updated = await window.connexio.settings.set(settings);
		set({ settings: updated });
	},

	openSettings: () => set({ isSettingsOpen: true }),
	closeSettings: () => set({ isSettingsOpen: false }),

	setDiscordPresence: (enabled: boolean) => {
		localStorage.setItem("connexio:discord-presence", String(enabled));
		set({ discordPresence: enabled });
	},
}));
