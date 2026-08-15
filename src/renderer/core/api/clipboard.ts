import { invoke } from "@tauri-apps/api/core";

// ─── Clipboard ───────────────────────────────────────────────────────────────
// Wrappers untuk command clipboard_* yang saat ini masih dipanggil langsung
// (invoke) oleh Terminal.tsx (LEGACY); dipakai saat migrasi T12.

export const clipboard = {
	hasImage: (): Promise<boolean> => invoke("clipboard_has_image"),
	readText: (): Promise<string | null> => invoke("clipboard_read_text"),
};
