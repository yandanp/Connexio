import { create } from "zustand";
import type { AppTheme } from "../../shared/types";

interface ThemeStore {
	currentTheme: AppTheme | null;
	themes: AppTheme[];
	loadTheme: () => Promise<void>;
	loadThemes: () => Promise<void>;
	setTheme: (themeId: string) => Promise<void>;
	applyTheme: (theme: AppTheme) => void;
}

export const useThemeStore = create<ThemeStore>((set, _get) => ({
	currentTheme: null,
	themes: [],

	loadTheme: async () => {
		const theme = await window.connexio.theme.get();
		set({ currentTheme: theme });
		applyThemeToDOM(theme);
	},

	loadThemes: async () => {
		const themes = await window.connexio.theme.list();
		set({ themes });
	},

	setTheme: async (themeId: string) => {
		const theme = await window.connexio.theme.set(themeId);
		set({ currentTheme: theme });
		applyThemeToDOM(theme);
	},

	applyTheme: (theme: AppTheme) => {
		applyThemeToDOM(theme);
	},
}));

function applyThemeToDOM(theme: AppTheme) {
	const root = document.documentElement;
	root.style.setProperty("--bg-primary", theme.colors.bgPrimary);
	root.style.setProperty("--bg-secondary", theme.colors.bgSecondary);
	root.style.setProperty("--bg-tertiary", theme.colors.bgTertiary);
	root.style.setProperty("--border-color", theme.colors.borderColor);
	root.style.setProperty("--accent-color", theme.colors.accentColor);
	root.style.setProperty("--accent-hover", theme.colors.accentHover);
	root.style.setProperty("--text-primary", theme.colors.textPrimary);
	root.style.setProperty("--text-secondary", theme.colors.textSecondary);
	root.style.setProperty("--text-muted", theme.colors.textMuted);
}
