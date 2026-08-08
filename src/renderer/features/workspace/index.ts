export { useWorkspaceStore } from "./workspace-store";
export type { WorkspaceStore, TerminalTab, TerminalStatus } from "./workspace-store";

// Public re-exports of the pure split-layout / geometry / persistence modules
// (previously re-exported temporarily from stores/projectStore.ts).
export * from "./split-layout";
export * from "./split-layout-geometry";
export * from "./workspace-persistence";
