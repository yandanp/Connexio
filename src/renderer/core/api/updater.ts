// ─── Updater ─────────────────────────────────────────────────────────────────

import { check as checkUpdate } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

type UpdaterCallbacks = {
	onChecking: Set<() => void>;
	onAvailable: Set<(info: any) => void>;
	onNotAvailable: Set<() => void>;
	onProgress: Set<(progress: any) => void>;
	onDownloaded: Set<(info: any) => void>;
	onError: Set<(error: string) => void>;
};

const updaterCallbacks: UpdaterCallbacks = {
	onChecking: new Set(),
	onAvailable: new Set(),
	onNotAvailable: new Set(),
	onProgress: new Set(),
	onDownloaded: new Set(),
	onError: new Set(),
};

export const updater = {
	check: async (): Promise<any> => {
		for (const cb of updaterCallbacks.onChecking) cb();
		try {
			const update = await checkUpdate();
			if (update) {
				for (const cb of updaterCallbacks.onAvailable)
					cb({ version: update.version, body: update.body });
				return { available: true, version: update.version };
			} else {
				for (const cb of updaterCallbacks.onNotAvailable) cb();
				return { available: false, version: "" };
			}
		} catch (e: any) {
			for (const cb of updaterCallbacks.onError) cb(e?.message || String(e));
			return { available: false, version: "" };
		}
	},
	download: async (): Promise<void> => {
		try {
			const update = await checkUpdate();
			if (update) {
				let downloaded = 0;
				await update.downloadAndInstall((event) => {
					if (event.event === "Started") {
						for (const cb of updaterCallbacks.onProgress)
							cb({ percent: 0, total: event.data.contentLength });
					} else if (event.event === "Progress") {
						downloaded += event.data.chunkLength;
						for (const cb of updaterCallbacks.onProgress)
							cb({ percent: downloaded, transferred: downloaded });
					} else if (event.event === "Finished") {
						for (const cb of updaterCallbacks.onDownloaded) cb({ version: update.version });
					}
				});
			}
		} catch (e: any) {
			for (const cb of updaterCallbacks.onError) cb(e?.message || String(e));
		}
	},
	install: async (): Promise<void> => {
		await relaunch();
	},
	onChecking: (cb: () => void) => {
		updaterCallbacks.onChecking.add(cb);
		return () => {
			updaterCallbacks.onChecking.delete(cb);
		};
	},
	onAvailable: (cb: (info: any) => void) => {
		updaterCallbacks.onAvailable.add(cb);
		return () => {
			updaterCallbacks.onAvailable.delete(cb);
		};
	},
	onNotAvailable: (cb: () => void) => {
		updaterCallbacks.onNotAvailable.add(cb);
		return () => {
			updaterCallbacks.onNotAvailable.delete(cb);
		};
	},
	onProgress: (cb: (progress: any) => void) => {
		updaterCallbacks.onProgress.add(cb);
		return () => {
			updaterCallbacks.onProgress.delete(cb);
		};
	},
	onDownloaded: (cb: (info: any) => void) => {
		updaterCallbacks.onDownloaded.add(cb);
		return () => {
			updaterCallbacks.onDownloaded.delete(cb);
		};
	},
	onError: (cb: (error: string) => void) => {
		updaterCallbacks.onError.add(cb);
		return () => {
			updaterCallbacks.onError.delete(cb);
		};
	},
};
