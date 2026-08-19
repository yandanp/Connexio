# Startup & Memory Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Startup <2s first-terminal-ready via lazy restore (shell hanya spawn saat tab pertama kali terlihat), pool spawn N=6, anti-leak PTY disposal — tanpa mengubah perilaku mid-session.

**Architecture:** `restoreWorkspace()` merekonstruksi struktur tanpa spawn; `ensureTerminalSpawned(projectId, tabId)` (idempotent, in-flight dedupe, disposal late-create, partial failure per pane) dipicu TerminalLayer via kondisi state; pool limiter global N=6; instrumentasi di `core/instrumentation` + panel About.

**Tech Stack:** Tauri v2 + React 18 + zustand + xterm.js + vitest.

**Spec:** `docs/superpowers/specs/2026-08-15-startup-memory-optimization-design.md`

## Global Constraints

- File ≤400 baris; baseline ratchet hanya turun (`config/max-lines-baseline.txt`)
- Boundary: no cross-feature internal imports; `core/instrumentation` legal untuk semua feature; `@tauri-apps/*` hanya di `core/api*`
- Tidak mengubah: Rust (`pty/manager.rs`), SSH path, format file persistence, CI workflow
- Mid-session tidak berubah: pindah tab/project tidak reset, scrollback utuh, xterm no-remount (key pane = paneId)
- Semua gate hijau: typecheck, oxlint, vitest, check:lines, check:boundaries, CI (web+rust), cargo fmt/clippy/test
- Windows + Git Bash; JANGAN panggil binary `bash` (WSL) — jalankan command langsung atau `sh -c "..."`
- Commit convention: `feat:`/`fix:`/`test:`/`chore:`/`docs:`

---

### Task 1: Startup metrics module + first-output global subscription

**Files:**

- Create: `src/renderer/core/instrumentation/startup-metrics.ts`
- Create: `src/renderer/core/instrumentation/startup-metrics.test.ts`

**Interfaces:**

- Consumes: `onTerminalData` dari `core/api/terminal-event-bus` (sudah ada, global & buffered)
- Produces (named exports):
  - `resetMetrics(): void`
  - `registerPhaseStart(name: string): void`
  - `registerPhaseComplete(name: string): number`
  - `registerSpawnStart(terminalId: string): void`
  - `registerSpawnComplete(terminalId: string): number`
  - `getStartupMetrics(): StartupMetrics` dengan shape:
    ```ts
    interface Stats {
    	min: number;
    	max: number;
    	median: number;
    	count: number;
    }
    interface StartupMetrics {
    	phases: Array<{ name: string; duration: number }>;
    	spawnStats: Stats;
    	outputStats: Stats;
    	firstTerminalReadyAt: number | null; // ms dari app-mount, null bila belum
    }
    ```
  - `notifyTerminalMounted(terminalId: string): void` — Terminal.tsx panggil saat mount; modul mencatat `firstTerminalReadyAt` sekali (terminal pertama).
- Side effect: saat modul di-import, langsung `onTerminalData((id) => recordFirstOutput(id))` — selalu aktif, tidak tergantung mount Terminal. Per-terminal hanya output PERTAMA yang dicatat.

- [ ] **Step 1: Write failing test**

```ts
// src/renderer/core/instrumentation/startup-metrics.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/terminal-event-bus", () => ({
	onTerminalData: vi.fn(() => () => {}),
}));

import {
	getStartupMetrics,
	notifyTerminalMounted,
	registerPhaseComplete,
	registerPhaseStart,
	registerSpawnComplete,
	registerSpawnStart,
	resetMetrics,
} from "./startup-metrics";

describe("startup-metrics", () => {
	beforeEach(() => resetMetrics());

	it("aggregates phase durations", () => {
		registerPhaseStart("app-mount");
		registerPhaseStart("projects-loaded");
		registerPhaseComplete("projects-loaded");
		const m = getStartupMetrics();
		expect(m.phases.map((p) => p.name)).toContain("projects-loaded");
	});

	it("computes min/median/max over spawn durations", () => {
		registerSpawnStart("t1");
		registerSpawnComplete("t1"); // duration ~0
		registerSpawnStart("t2");
		registerSpawnComplete("t2");
		const m = getStartupMetrics();
		expect(m.spawnStats.count).toBe(2);
		expect(m.spawnStats.min).toBeLessThanOrEqual(m.spawnStats.median);
		expect(m.spawnStats.median).toBeLessThanOrEqual(m.spawnStats.max);
	});

	it("records firstTerminalReadyAt once from first mount notification", () => {
		expect(getStartupMetrics().firstTerminalReadyAt).toBeNull();
		notifyTerminalMounted("t1");
		notifyTerminalMounted("t2");
		expect(getStartupMetrics().firstTerminalReadyAt).not.toBeNull();
	});
});
```

- [ ] **Step 2: Run — verify FAIL**

`npm run test -- src/renderer/core/instrumentation/startup-metrics.test.ts` → module not found.

- [ ] **Step 3: Implement** (module ~120 baris; Maps untuk phase/spawn/output; `performance.now()`; median dari sorted array; subscription `onTerminalData` sekali di top-level module scope; first-output per terminalId hanya sekali via Set)

- [ ] **Step 4: Run — verify PASS**

- [ ] **Step 5: Gate + commit**

```bash
npm run typecheck && npm run lint && npm run test && npm run check:lines && npm run check:boundaries
git add src/renderer/core/instrumentation/
git commit -m "feat(instrumentation): startup metrics module with global first-output subscription"
```

---

### Task 2: Spawn pool limiter

**Files:**

- Create: `src/renderer/features/workspace/spawn-pool.ts`
- Create: `src/renderer/features/workspace/spawn-pool.test.ts`

**Interfaces:**

- Produces:
  - `SPAWN_POOL_LIMIT = 6` (konstanta export)
  - `runWithSpawnLimit<T>(tasks: Array<() => Promise<T>>): Promise<T[]>` — menjalankan task dengan konkurensi global maksimum `SPAWN_POOL_LIMIT`; hasil berurut sesuai input; FIFO; error satu task TIDAK menghentikan lainnya (settled-all: hasil `T | undefined` untuk yang gagal, error ditelan — caller menangani per-pane).
  - Semantik: semua path spawn (restore-on-open, split baru, tab baru) WAJIB lewat pool ini; `Promise.all` polos untuk batch spawn dilarang.

- [ ] **Step 1: Write failing test**

```ts
// src/renderer/features/workspace/spawn-pool.test.ts
import { describe, expect, it, vi } from "vitest";
import { SPAWN_POOL_LIMIT, runWithSpawnLimit } from "./spawn-pool";

describe("runWithSpawnLimit", () => {
	it("never exceeds the concurrency limit", async () => {
		let active = 0;
		let peak = 0;
		const tasks = Array.from({ length: 20 }, (_, i) => async () => {
			active++;
			peak = Math.max(peak, active);
			await new Promise((r) => setTimeout(r, 5));
			active--;
			return i;
		});
		const results = await runWithSpawnLimit(tasks);
		expect(peak).toBeLessThanOrEqual(SPAWN_POOL_LIMIT);
		expect(results).toHaveLength(20);
	});

	it("keeps input order in results", async () => {
		const tasks = Array.from({ length: 10 }, (_, i) => async () => {
			await new Promise((r) => setTimeout(r, (10 - i) * 3));
			return i;
		});
		const results = await runWithSpawnLimit(tasks);
		expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
	});

	it("failed task yields undefined but others complete", async () => {
		const tasks = [
			async () => 1,
			async () => {
				throw new Error("boom");
			},
			async () => 3,
		];
		const results = await runWithSpawnLimit(tasks);
		expect(results[0]).toBe(1);
		expect(results[1]).toBeUndefined();
		expect(results[2]).toBe(3);
	});
});
```

- [ ] **Step 2: Run — verify FAIL** (module not found)

- [ ] **Step 3: Implement** (worker-pool sederhana: index pointer + rekursi `next()`; `Promise.resolve().then()` untuk kick; ~40 baris)

- [ ] **Step 4: Run — verify PASS**

- [ ] **Step 5: Gate + commit**

```bash
npm run typecheck && npm run lint && npm run test
git add src/renderer/features/workspace/spawn-pool.*
git commit -m "feat(workspace): bounded spawn pool limiter (N=6) for terminal creation"
```

---

### Task 3: Lazy restoreWorkspace — struktur tanpa spawn

**Files:**

- Modify: `src/renderer/features/workspace/workspace-store.ts` (`restoreWorkspace`, ~baris 850-959)
- Modify: `src/renderer/features/workspace/workspace-persistence.ts` (hapus pemakaian `createTerminalsForTree` di restore path; fungsi `createTerminalsForTree` sendiri dimodifikasi di Task 5 — di task ini restore berhenti memanggilnya)
- Test: `src/renderer/features/workspace/workspace-store-restore.test.ts` (baru)

**Interfaces:**

- Produces:
  - `restoreWorkspace()` baru: semua leaf terminal ter-restored dengan `terminalId = null` (termasuk tab single-pane yang hari ini menyimpan `terminalId` di level tab); TIDAK memanggil `window.connexio.terminal.create` sama sekali.
  - Runtime state tambahan di store:
    - `spawningTabs: Record<string, true>` (key `"${projectId}:${tabId}"`) — tab yang sedang in-flight
    - `paneErrors: Record<string, string>` (key paneId) — pesan error spawn per pane
  - Setelah restore selesai: `registerPhaseComplete("workspace-structure-restored")` (import dari core/instrumentation).

- [ ] **Step 1: Write failing test**

```ts
// src/renderer/features/workspace/workspace-store-restore.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const terminalCreate = vi.fn(async () => `term-${Math.random()}`);

vi.mock("../../core/api", () => ({
	terminal: { create: (...a: unknown[]) => terminalCreate(...(a as never[])), close: vi.fn() },
	// ... domain lain minimal stub sesuai kebutuhan import chain
}));

describe("restoreWorkspace (lazy)", () => {
	beforeEach(() => {
		terminalCreate.mockClear();
	});

	it("reconstructs tab structure without any terminal.create call", async () => {
		const { useWorkspaceStore } = await import("./workspace-store");
		await useWorkspaceStore.getState().restoreWorkspace();
		expect(terminalCreate).not.toHaveBeenCalled();
		const state = useWorkspaceStore.getState();
		for (const tabs of Object.values(state.workspaceTabs)) {
			for (const tab of tabs) {
				if (tab.terminalId != null && !tab.splitLayout) {
					throw new Error("single-pane tab masih punya terminalId setelah restore");
				}
				if (tab.splitLayout) {
					const leaves = collectTerminalLeaves(tab.splitLayout.root);
					for (const leaf of leaves) {
						if (leaf.terminalId != null) {
							throw new Error("split leaf masih punya terminalId setelah restore");
						}
					}
				}
			}
		}
	});
});
```

(`collectTerminalLeaves` helper test-local: rekursif kumpulkan leaf `kind !== "editor"`.)

- [ ] **Step 2: Run — verify FAIL** (implementasi lama memanggil createTerminalsForTree → terminal.create)

- [ ] **Step 3: Implement**
  - Hapus pemanggilan `createTerminalsForTree` dari `restoreWorkspace`; untuk tab split: `deserializeNode(...)` lalu `transformLeaves(tree, (leaf) => { leaf.terminalId = null; })` (helper lokal `transformLeaves`); untuk tab single: `terminalId: null` eksplisit.
  - Simpan struktur `label`, `shell`, split ratios, editor leaf (`filePath`) apa adanya.
  - `registerPhaseComplete("workspace-structure-restored")` di akhir try-block.
  - Error path project hilang: skip project (existing behavior).

- [ ] **Step 4: Run — verify PASS** (+ test restore lama jika ada di-update: struktur tetap ter-restore, terminalId null)

- [ ] **Step 5: Gate + commit**

```bash
npm run typecheck && npm run lint && npm run test && npm run check:lines && npm run check:boundaries
git add src/renderer/features/workspace/
git commit -m "feat(workspace): lazy restore - reconstruct structure without spawning shells"
```

---

### Task 4: ensureTerminalSpawned — idempotent, disposal, partial failure, retry

**Files:**

- Modify: `src/renderer/features/workspace/workspace-store.ts` (action baru + helper)
- Test: `src/renderer/features/workspace/workspace-store-spawn.test.ts` (baru)

**Interfaces:**

- Consumes: `runWithSpawnLimit` (Task 2), `registerSpawnStart/registerSpawnComplete` (Task 1)
- Produces (di store):
  - `ensureTerminalSpawned(projectId: string, tabId: string): Promise<void>`
  - `retryPaneSpawn(projectId: string, tabId: string, paneId: string): Promise<void>`
  - Helper internal: `leafExists(projectId, tabId, paneId): boolean` — cek leaf masih ada di tree SAAT INI.
- Kontrak:
  - In-flight map `Map<string, Promise<void>>` key `"${projectId}:${tabId}"`; pemanggilan ganda → promise sama.
  - Param snapshot saat mulai: projectPath, shell (tab shell ?? settings.defaultShell), context `{projectId, projectName, tabId, tabLabel}`.
  - Kumpulkan SEMUA leaf `kind !== "editor" && terminalId == null && !paneErrors[paneId]` dari tab → task per leaf via `runWithSpawnLimit` (non-atomic: leaf sukses → set terminalId; leaf gagal → `paneErrors[paneId] = msg`).
  - **Disposal late-create**: setelah tiap create resolve, `if (!leafExists(projectId, tabId, paneId)) { await window.connexio.terminal.close(id); return; }` — PTY tidak boleh yatim. Berlaku otomatis untuk closeTab, closeSplitPane, deleteProject (semua jalur menghapus leaf dari tree).
  - `retryPaneSpawn`: hapus `paneErrors[paneId]` → spawn ulang HANYA pane itu (via pool, dengan disposal check yang sama).
  - `registerSpawnStart(id)` sebelum invoke create; `registerSpawnComplete(id)` setelah resolve.
  - Operasi struktural pada tab in-flight: close/delete tetap boleh (disposal menangani); split baru pada tab in-flight menunggu promise tab selesai (simple: `await` in-flight promise dulu di action splitTerminal bila ada).

- [ ] **Step 1: Write failing tests**

```ts
// src/renderer/features/workspace/workspace-store-spawn.test.ts
// Setup: mock core/api terminal.create/close; seed store dengan 1 project + 1 tab split 3 leaf (terminalId null)

it("spawns all lazy leaves of a tab on ensureTerminalSpawned", async () => {
	await useWorkspaceStore.getState().ensureTerminalSpawned(pid, tid);
	expect(terminalCreate).toHaveBeenCalledTimes(3);
	// semua leaf kini punya terminalId
});

it("is idempotent under concurrent calls (StrictMode-safe)", async () => {
	await Promise.all([
		useWorkspaceStore.getState().ensureTerminalSpawned(pid, tid),
		useWorkspaceStore.getState().ensureTerminalSpawned(pid, tid),
	]);
	expect(terminalCreate).toHaveBeenCalledTimes(3); // bukan 6
});

it("does not spawn hidden tabs (only called for visible)", async () => {
	// ensureTerminalSpawned TIDAK dipanggil untuk tab lain — verifikasi via state:
	// tab kedua tetap terminalId null setelah spawn tab pertama
});

it("disposes late-created PTY when pane closed mid-spawn", async () => {
	let resolveCreate: (id: string) => void;
	terminalCreate.mockImplementation(
		() =>
			new Promise((res) => {
				resolveCreate = () => res("late-id");
			}),
	);
	const p = useWorkspaceStore.getState().ensureTerminalSpawned(pid, tid);
	// tutup tab saat masih in-flight
	useWorkspaceStore.getState().closeTerminalTab(pid, tid);
	resolveCreate!("late-id");
	await p;
	expect(terminalClose).toHaveBeenCalledWith("late-id");
});

it("partial failure: failed panes get error, successful panes stay ready", async () => {
	terminalCreate.mockImplementation(async (_path: string, _shell?: string, ctx?: unknown) => {
		const paneId = (ctx as { paneId?: string }).paneId;
		if (paneId === "pane-2") throw new Error("spawn failed");
		return `ok-${paneId}`;
	});
	await useWorkspaceStore.getState().ensureTerminalSpawned(pid, tid);
	const errors = useWorkspaceStore.getState().paneErrors;
	expect(errors["pane-2"]).toContain("spawn failed");
	expect(Object.keys(errors)).toHaveLength(1);
});

it("retryPaneSpawn respawns only the failed pane", async () => {
	// seed paneErrors['pane-2'] dari test sebelumnya
	terminalCreate.mockClear();
	await useWorkspaceStore.getState().retryPaneSpawn(pid, tid, "pane-2");
	expect(terminalCreate).toHaveBeenCalledTimes(1);
	expect(useWorkspaceStore.getState().paneErrors["pane-2"]).toBeUndefined();
});
```

- [ ] **Step 2: Run — verify FAIL**

- [ ] **Step 3: Implement** (action + in-flight Map module-level + leafExists walker + integrasi pool & metrics; ~150 baris di workspace-store; bila file mendekati cap baseline 1026, ekstrak spawn logic ke `workspace-spawn-actions.ts` baru dan panggil dari store — pilih yang menjaga file ≤ baseline)

- [ ] **Step 4: Run — verify PASS semua**

- [ ] **Step 5: Gate + commit**

```bash
npm run typecheck && npm run lint && npm run test && npm run check:lines && npm run check:boundaries
git add src/renderer/features/workspace/
git commit -m "feat(workspace): ensureTerminalSpawned with idempotency, PTY disposal, partial failure and retry"
```

---

### Task 5: createTerminalsForTree → pool paralel

**Files:**

- Modify: `src/renderer/features/workspace/workspace-persistence.ts`
- Test: extend `src/renderer/features/workspace/workspace-persistence.test.ts`

**Interfaces:**

- Consumes: `runWithSpawnLimit` (Task 2)
- Produces: `createTerminalsForTree(node, projectPath, projectId, projectName, tabLabel, shell?)` — signature TIDAK berubah; sekarang: kumpulkan leaf terminal → `runWithSpawnLimit(tasks)` → assign terminalId; leaf yang gagal dibiarkan `terminalId: null` (caller Task 4 menangani error mapping via context.paneId).
  - Context per leaf menambah `paneId: leaf.id` (dipakai Task 4 untuk mapping partial failure).

- [ ] **Step 1: Failing test**

```ts
it("spawns leaves in parallel with bounded concurrency", async () => {
	let active = 0;
	let peak = 0;
	terminalCreate.mockImplementation(async () => {
		active++;
		peak = Math.max(peak, active);
		await new Promise((r) => setTimeout(r, 5));
		active--;
		return "tid";
	});
	const tree = makeTreeWithLeaves(8); // helper: branch dengan 8 leaf terminal
	await createTerminalsForTree(tree, "/p", "pid", "pn", "tab");
	expect(peak).toBeLessThanOrEqual(6);
	expect(terminalCreate).toHaveBeenCalledTimes(8);
	// semua leaf kini terminalId != null
});
```

- [ ] **Step 2: verify FAIL** (implementasi lama serial: peak = 1)

- [ ] **Step 3: Implement** (kumpulkan via walker → tasks → `runWithSpawnLimit`; assign hasil; catch per-task → biarkan null)

- [ ] **Step 4: verify PASS** (test lama roundtrip tetap hijau)

- [ ] **Step 5: Gate + commit**

```bash
npm run typecheck && npm run lint && npm run test
git add src/renderer/features/workspace/workspace-persistence.ts src/renderer/features/workspace/workspace-persistence.test.ts
git commit -m "feat(workspace): parallelize createTerminalsForTree via spawn pool"
```

---

### Task 6: TerminalLayer — render pane null, trigger aktivasi, PendingPane, PaneError

**Files:**

- Modify: `src/renderer/features/terminal/TerminalLayer.tsx`
- Create: `src/renderer/features/workspace/PendingPane.tsx` (skeleton + "Menyiapkan shell…")
- Create: `src/renderer/features/workspace/PaneError.tsx` (pesan error + Coba lagi + tutup pane)

Catatan boundary: PendingPane/PaneError dipakai TerminalLayer (feature terminal) — simpan di `core/ui/` BILA dipakai lintas feature; karena hanya dirender dalam pane workspace context oleh TerminalLayer, tempatkan di `features/terminal/` agar satu feature (keputusan: **`features/terminal/PendingPane.tsx` & `features/terminal/PaneError.tsx`**, TerminalLayer yang render). PaneError mengonsumsi action store workspace via public barrel `features/workspace/index.ts` (import feature-root DARI feature lain diperbolehkan checker — verifikasi `config/check-feature-imports.mjs`; bila ternyata dilarang, pindahkan komponen ke `features/workspace/` dan render via slot — jaga tetap satu feature).

**Interfaces:**

- Consumes: `ensureTerminalSpawned`, `retryPaneSpawn`, `paneErrors` (Task 4); `spawningTabs` (Task 3)
- Produces:
  - Pane wrapper: **key = paneId** (stabil) untuk SEMUA pane (terminal, editor, pending, error)
  - Anak kondisional:
    - `terminalId != null` → `<Terminal terminalId isVisible />` + `onMounted` prop (Task 7)
    - `terminalId == null && paneErrors[paneId]` → `<PaneError message onRetry onClosePane />`
    - `terminalId == null && !error` → `<PendingPane />`
    - editor leaf → existing editor component
  - **Trigger effect** di TerminalLayer (satu untuk semua): subscribe state; pada setiap perubahan, untuk tab aktif (activeProject × activeTab): bila ada leaf `kind !== "editor" && terminalId == null && !paneErrors[paneId]` DAN tab tidak in-flight (`!spawningTabs[key]`) → `ensureTerminalSpawned(projectId, tabId)`. Tidak memicu untuk tab hidden (hanya tab visible yang dievaluasi).
  - Konsistensi: `Terminal` child mount di dalam wrapper pane yang sama — terminal yang sudah hidup tidak pernah remount saat pane lain materialisasi.

- [ ] **Step 1: Failing test** (render-level, gunakan @testing-library/react bila tersedia; bila tidak ada di config, buat test logic murni `shouldTriggerSpawn(state, projectId, tabId): boolean` di file terpisah `activation-trigger.ts` dan test itu — UI di-verify via smoke manual)

```ts
// src/renderer/features/terminal/activation-trigger.test.ts
import { shouldTriggerSpawn } from "./activation-trigger";

it("triggers for visible tab with null leaves", () => {
	expect(shouldTriggerSpawn(makeState({ visibleTabWithNullLeaf: true }), "p1", "t1")).toBe(true);
});
it("does not trigger when tab in-flight", () => {
	expect(
		shouldTriggerSpawn(makeState({ visibleTabWithNullLeaf: true, inFlight: true }), "p1", "t1"),
	).toBe(false);
});
it("does not trigger for hidden tabs", () => {
	expect(shouldTriggerSpawn(makeState({ hiddenTabWithNullLeaf: true }), "p1", "t1")).toBe(false);
});
it("does not trigger when only error panes remain (retry is explicit)", () => {
	expect(shouldTriggerSpawn(makeState({ visibleTabAllLeavesError: true }), "p1", "t1")).toBe(false);
});
it("does not trigger when all leaves ready", () => {
	expect(shouldTriggerSpawn(makeState({ visibleTabAllReady: true }), "p1", "t1")).toBe(false);
});
```

- [ ] **Step 2: verify FAIL**

- [ ] **Step 3: Implement** (`activation-trigger.ts` pure fn + PendingPane/PaneError + TerminalLayer rewrite pane routing & effect)

- [ ] **Step 4: verify PASS + `npm run dev` smoke visual singkat (dev)** — lihat skeleton muncul lalu terminal (manual, catat di report)

- [ ] **Step 5: Gate + commit**

```bash
npm run typecheck && npm run lint && npm run test && npm run check:lines && npm run check:boundaries
git add src/renderer/features/terminal/ src/renderer/features/workspace/
git commit -m "feat(terminal): lazy pane activation with PendingPane and PaneError UI"
```

---

### Task 7: Phase marks (App.tsx) + Terminal onMounted

**Files:**

- Modify: `src/renderer/App.tsx` (mark `app-mount` saat mount, `projects-loaded` setelah loadProjects)
- Modify: `src/renderer/features/workspace/workspace-store.ts` (mark `first-terminal-spawn-start` saat ensureTerminalSpawned pertama mulai)
- Modify: `src/renderer/features/terminal/Terminal.tsx` (prop `onMounted?: () => void` → panggil `notifyTerminalMounted(terminalId)` dari core/instrumentation — atau TerminalLayer yang panggil via callback; pilih: Terminal.tsx import langsung `notifyTerminalMounted` dan panggil sekali di effect mount)

**Interfaces:**

- Consumes: Task 1 metrics API
- Produces: metrik fase terisi penuh: app-mount → projects-loaded → workspace-structure-restored → first-terminal-spawn-start → first-terminal-ready (via notifyTerminalMounted pertama)

- [ ] **Step 1: Test** — extend Task 1 test: `notifyTerminalMounted` setelah `registerPhaseStart("app-mount")` menghasilkan `firstTerminalReadyAt >= 0` (logika murni sudah teruji; task ini wiring — verifikasi via unit test kecil bahwa App effect memanggil registerPhaseStart: mock & assert call order)

- [ ] **Step 2–4: implement wiring + verify tests hijau**

- [ ] **Step 5: Gate + commit**

```bash
npm run typecheck && npm run lint && npm run test
git add src/renderer/App.tsx src/renderer/features/
git commit -m "feat(instrumentation): wire startup phase marks and first-terminal-ready"
```

---

### Task 8: About Settings — panel Performance

**Files:**

- Modify: `src/renderer/features/settings/AboutSettings.tsx` (bagian "Performance")

**Interfaces:**

- Consumes: `getStartupMetrics()` dari `core/instrumentation/startup-metrics` (core — legal untuk settings)
- Produces: tabel fase startup (nama + durasi ms) + agregat spawn (min/median/max/count) + first-output (min/median/max/count) + first-terminal-ready total; refresh saat panel dibuka (baca ulang saat mount; tidak perlu live polling).

- [ ] **Step 1: Test** — komponen kecil `PerformanceStatsTable` (pure, props `StartupMetrics`) di `features/settings/PerformanceStatsTable.tsx` + test render angka; AboutSettings menyisipkan section.

- [ ] **Step 2–4: implement + verify**

- [ ] **Step 5: Gate + commit**

```bash
npm run typecheck && npm run lint && npm run test && npm run check:lines
git add src/renderer/features/settings/
git commit -m "feat(settings): performance metrics panel in About"
```

---

### Task 9: Baseline & verifikasi akhir (measurement + smoke + gates penuh)

**Files:**

- Create: `docs/superpowers/plans/2026-08-15-perf-baseline-results.md` (hasil pengukuran, dicatat)

**Langkah:**

- [ ] **Step 1: Baseline SEBELUM** — checkout `main` di worktree terpisah sementara ATAU `git stash` + jalankan `npm run dev` dengan fixture workspace 5 project × 3 tab (buat 5 project dummy berisi 3 tab masing-masing; restart app 2× ambil median): catat waktu ke first terminal interaktif & jumlah proses shell (`powershell "Get-Process | Where-Object {$_.ProcessName -match 'pwsh|powershell'} | Measure-Object | Select -Expand Count"`) setelah startup selesai. Catat di dokumen hasil.

- [ ] **Step 2: Ukur SESUDAH** — jalankan branch perf dengan fixture sama, restart 2×: catat `firstTerminalReadyAt` (dari About → Performance) & jumlah proses shell setelah startup (harus ≤ jumlah pane tab aktif).

- [ ] **Step 3: Smoke manual mid-session** — buka beberapa tab, jalankan command, pindah project, kembali: scrollback utuh, tidak ada reset, xterm tidak remount (visual). Tutup tab saat "Menyiapkan shell…" (disposal). Split tab → semua pane hidup. Simulasi error pane (rename project path sementara) → PaneError + Coba lagi.

- [ ] **Step 4: Semua gate dari nol**

```bash
npm run typecheck && npm run lint && npm run test && npm run check:lines && npm run check:boundaries
cd src-tauri && cargo fmt --check && cargo clippy -j 2 -- -D warnings && cargo test -j 2
```

- [ ] **Step 5: Push + CI + commit hasil pengukuran**

```bash
git add docs/superpowers/plans/2026-08-15-perf-baseline-results.md
git commit -m "docs: record startup/memory baseline vs after measurements"
git push origin perf/startup-memory-optimization
```

- [ ] **Step 6: Buat PR** ke main dengan ringkasan + angka baseline-vs-sesudah.

---

## Self-Review (dilakukan penulis plan)

- **Spec coverage**: §3.1→T3+T6; §3.2→T4; §3.3→T6; §3.4→T2+T5; §3.5→T3 (persistence untouched)+T6 (key paneId); §3.6→T6 (PaneError); §3.7→T1+T7+T8; §4 table→semua task; §5 tests→tiap task + T9; §8 kriteria→T9. ✅
- **Placeholder scan**: semua step punya kode/komando konkret; tidak ada TBD. ✅
- **Type consistency**: `runWithSpawnLimit` (T2) dipakai T4/T5 dengan signature sama; `registerSpawnStart/Complete` (T1) dipakai T4; `ensureTerminalSpawned/retryPaneSpawn/paneErrors/spawningTabs` (T4/T3) dipakai T6 dengan nama sama; `notifyTerminalMounted` (T1) dipakai T7; `getStartupMetrics` (T1) dipakai T8. ✅
