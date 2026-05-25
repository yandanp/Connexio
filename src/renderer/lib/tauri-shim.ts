/**
 * Tauri compatibility shim
 *
 * Provides a `window.connexio` object that routes to Tauri API.
 * This allows existing React components to work without modification
 * while we gradually migrate them to direct imports from tauri-api.ts.
 */

import { connexioApi } from "./tauri-api";

// Only install shim if window.connexio doesn't exist (i.e., not running in Electron)
if (!(window as any).connexio) {
	(window as any).connexio = connexioApi;
}
