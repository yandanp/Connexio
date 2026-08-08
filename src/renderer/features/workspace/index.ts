export { useWorkspaceStore } from "./workspace-store";
export type { WorkspaceStore, TerminalTab, TerminalStatus } from "./workspace-store";

// Public re-exports of the pure split-layout / geometry / persistence modules
// (previously re-exported temporarily from stores/projectStore.ts).
export * from "./split-layout";
export * from "./split-layout-geometry";
export * from "./workspace-persistence";

// Catatan: komponen UI `Workspace` (dan helper-nya WorkspaceTabBar/SidePanelHost)
// sengaja TIDAK di-re-export di barrel ini agar konsumen store (mis. test store di
// env node) tidak ikut memuat pohon terminal (xterm) yang butuh global browser.
// Composition root (App.tsx) mengimpor `Workspace` langsung dari "./Workspace".
