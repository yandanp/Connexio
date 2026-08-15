/**
 * Pure function to decide whether lazy terminal activation should fire for a given tab.
 *
 * Contract: returns true IFF:
 * - the tab is visible AND active (activeProjectId × activeTabIds[projectId] === tabId)
 * - the tab has at least one leaf with kind !== "editor" && terminalId === null
 * - that leaf has NO pane error in paneErrors[paneId]
 * - the tab is NOT already in-flight (spawningTabs[key] !== true where key = `${projectId}:${tabId}`)
 */

import { collectLeaves, type TerminalTab } from "../workspace";
interface ActivationState {
	spawningTabs: Record<string, true>;
	paneErrors: Record<string, string>;
	workspaceTabs: Record<string, Array<TerminalTab>>;
	activeProjectId: string;
	activeTabIds: Record<string, string>;
}

/** Collect terminal leaves awaiting spawn (kind !== "editor" && terminalId === null). */
function collectNullTerminalLeaves(tab: TerminalTab): Array<{ id: string }> {
	const targets: Array<{ id: string }> = [];
	if (tab.splitLayout?.root) {
		for (const leaf of collectLeaves(tab.splitLayout.root)) {
			if (leaf.kind !== "editor" && leaf.terminalId === null) {
				targets.push({ id: leaf.id });
			}
		}
	} else if (tab.type === "terminal" || tab.type === undefined) {
		// Single-pane terminal tab
		if (tab.terminalId === null) {
			targets.push({ id: tab.id });
		}
	}
	return targets;
}

export function shouldTriggerSpawn(
	state: ActivationState,
	projectId: string,
	tabId: string,
): boolean {
	// Guard: tab must belong to active project and be the active tab
	if (state.activeProjectId !== projectId) return false;
	const tabs = state.workspaceTabs[projectId];
	if (!tabs) return false;
	const tab = tabs.find((t) => t.id === tabId);
	if (!tab) return false;
	if (state.activeTabIds[projectId] !== tabId) return false;

	// In-flight check: do not re-trigger while spawning
	const key = `${projectId}:${tabId}`;
	if (key in state.spawningTabs) return false;

	// Collect leaves awaiting spawn
	const nullLeaves = collectNullTerminalLeaves(tab);
	if (nullLeaves.length === 0) return false;

	// Filter out leaves that have errors (they need explicit retry, not auto-spawn)
	const liveNullLeaves = nullLeaves.filter((l) => !state.paneErrors[l.id]);

	return liveNullLeaves.length > 0;
}
