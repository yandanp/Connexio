import { invoke } from "@tauri-apps/api/core";
import type { Session } from "@shared/types";

// ─── Session ─────────────────────────────────────────────────────────────────

export const session = {
	save: (sess: Session): Promise<void> => invoke("session_save", { session: sess }),

	load: (id: string): Promise<Session | null> => invoke("session_load", { id }),

	list: (): Promise<Session[]> => invoke("session_list"),

	delete: (id: string): Promise<void> => invoke("session_delete", { id }),
};
