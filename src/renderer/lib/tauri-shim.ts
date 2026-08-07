/**
 * Tauri / Remote compatibility shim
 *
 * Detects whether we're running inside Tauri (desktop) or in a browser (remote mode).
 * Provides `window.connexio` with the appropriate API adapter.
 */

const isTauri = !!(window as any).__TAURI_INTERNALS__;

/** Resolves when window.connexio is ready */
export const shimReady: Promise<void> = (async () => {
	if ((window as any).connexio) return;

	if (isTauri) {
		const { connexioApi } = await import("../core/api");
		(window as any).connexio = connexioApi;
	} else {
		const { connexioRemoteApi } = await import("../core/api-remote");
		(window as any).connexio = connexioRemoteApi;
		(window as any).__CONNEXIO_REMOTE__ = true;
	}
})();

/** Check if running in remote browser mode */
export function isRemoteMode(): boolean {
	return !!(window as any).__CONNEXIO_REMOTE__;
}
