import type { Session } from "@shared/types";

// ─── Session ─────────────────────────────────────────────────────────────────

export const session = {
	save: (_sess: Session): Promise<void> => Promise.resolve(),
	load: (_id: string): Promise<Session | null> => Promise.resolve(null),
	list: (): Promise<Session[]> => Promise.resolve([]),
	delete: (_id: string): Promise<void> => Promise.resolve(),
};
