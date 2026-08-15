# Startup & Memory Optimization — Phase 2.0: Lazy Restore & Instrumentasi

- **Tanggal:** 2026-08-15
- **Status:** Disetujui (hasil brainstorming)
- **Branch:** `perf/startup-memory-optimization` (dari `main` @ bb3aa67, pasca-PR #9)
- **Prasyarat:** Connexio Phase 1 (PR #9 merged)

## 1. Latar Belakang

Keluhan pengguna: aplikasi berat saat pertama dibuka, loading terminal lama; dengan
banyak project workspace + banyak terminal, RAM background process tinggi.

**Diagnosis berbasis kode:**

- `workspace-store.ts` `restoreWorkspace()` → `createTerminalsForTree()`
  (workspace-persistence.ts) meng-spawn **semua** shell dari **semua** project ×
  semua tab × semua split pane secara **eager** pada startup, dan **serial**
  (`await` dalam loop rekursif).
- Setiap `terminal.create` = spawn proses shell baru (PowerShell ±300-800ms);
  bila profile shell memasang oh-my-posh, tiap spawn menambah exec binary +
  theme parse → 1-3s per shell. 15+ terminal = 20+ detik startup.
- Semua shell hasil restore tetap hidup selamanya (±50-150MB per shell dengan
  oh-my-posh child) — sumber RAM tinggi di startup.
- Scrollback xterm sudah dibatasi baik (clamp 500-2000) — bukan sumber masalah.
- `TerminalLayer` tidak pernah unmount terminal (hanya CSS hide) — perilaku ini
  **dipertahankan**.

**Prinsip keras (permintaan eksplisit pengguna): tidak ada terminal reset.**
Perpindahan tab/project dalam sesi tidak boleh berubah apa pun. Suspension
(kill proses idle) **dibuang dari scope**.

## 2. Keputusan yang Terkunci

| # | Keputusan | Pilihan |
|---|---|---|
| 1 | Saat tab restored dibuka pertama kali | **Auto-spawn** — shell langsung jalan, tanpa klik tambahan |
| 2 | Suspension proses idle | **Dibuang** — terminal tidak pernah reset demi RAM (keputusan pengguna) |
| 3 | Instrumentasi | **Console (dev) + panel About (produksi)** |
| 4 | Target metrik | **First-terminal-ready < 2s** pada workspace 5+ project × 3 tab; RAM startup proporsional shell aktif saja |
| 5 | Format persistence workspace | **Tidak berubah** — struktur saved state kompatibel penuh (lazy = perilaku restore, bukan format) |

## 3. Desain

### 3.1 Lazy restore

```
Startup (dulu):                            Startup (baru):
restoreWorkspace()                         restoreWorkspace()
  └─ untuk SEMUA tab/pane:                   └─ untuk SEMUA tab:
       await terminal.create (serial)             rekonstruksi STRUKTUR saja
       → SEMUA shell hidup                       (tab, split tree, label, shell)
                                                  terminalId = null, needsSpawn = true
                                                → TIDAK ADA spawn; UI siap

Saat user membuka tab (pertama kali):
  PaneRenderer/Terminal melihat terminalId == null && tab visible
    → ensureTerminalSpawned(projectId, tabId)   [idempotent, dedupe]
       → spawn shell untuk tab aktif
       → split tab: spawn SEMUA pane-nya secara PARALEL (Promise.all)
```

- State tab baru: `needsSpawn` implisit dari `terminalId === null` pada leaf
  yang tadinya punya terminal (distinguish dari editor leaf — sudah ada `kind`).
- **Auto-spawn trigger**: tab menjadi visible pertama kali (`isVisible` flip
  false→true dengan `terminalId == null`). Setelah spawn selesai, terminal
  hidup selamanya seperti hari ini — tidak ada perubahan perilaku mid-session.
- **Idempotensi & race**: `ensureTerminalSpawned` menyimpan promise in-flight
  per (projectId, tabId) — klik cepat/pindah-pindah tab tidak meng-double-spawn.
- **Error path**: project path sudah tidak ada → tab ditampilkan dengan state
  error existing (tidak crash) — sama seperti behavior createTerminalsForTree
  hari ini (`catch` → node tanpa terminalId).
- Tab yang tidak pernah dibuka setelah restart: tidak pernah spawn (itulah
  hematan RAM-nya). Dibuka kapan pun → shell fresh start (identik dengan
  perilaku restart hari ini — tidak ada yang hilang).

### 3.2 Spawn paralel

- `createTerminalsForTree` versi paralel: kumpulkan semua leaf terminal →
  `Promise.all(terminal.create)` (batas konkurensi 4-8 agar tidak banjir).
- Dipakai di: restore-tab-on-open (§3.1), split tab baru, dan path manual
  "new tab" yang men-create banyak terminal.
- Serial loop rekursif dihapus.

### 3.3 Instrumentasi

- **Fase startup** (`performance.now()` marks, dikirim ke log + store kecil):
  `app-mount` → `projects-loaded` → `workspace-structure-restored` →
  `first-terminal-spawn-start` → `first-terminal-ready` (shell spawn selesai;
  first paint terminal tetap momen DOM — cukup proximate).
- **Per-terminal**: durasi `terminal.create` (spawn) dan `spawn→first-output`
  (proxy kecepatan init shell/oh-my-posh) — agregat min/median/max per sesi.
- **Tampilan**:
  - Dev: `console.info` terstruktur saat tiap fase.
  - Produksi: panel **Settings → About** bagian baru "Performance" — tabel fase
    startup + agregat spawn shell sesi ini (menjawab langsung pertanyaan
    "oh-my-posh saya lambat atau bukan").
- Store kecil `startupMetrics` (plain module, bukan zustand global; dibaca
  AboutSettings via hook ringan).

### 3.4 Yang TIDAK berubah

- Perilaku mid-session: pindah tab/project = terminal tetap hidup, scrollback
  utuh, xterm tidak remount (`TerminalLayer` comment kontrak tetap berlaku).
- Format persistence `workspace-persistence.ts` (serialize/deserialize) —
  tidak diubah; saved state lama kompatibel.
- Rust side (`pty/manager.rs`) — tidak diubah sama sekali.
- Scrollback & WebGL behavior.

## 4. Arsitektur perubahan (file-level)

| File | Perubahan |
|---|---|
| `features/workspace/workspace-store.ts` | `restoreWorkspace` rekonstruksi struktur tanpa spawn; action baru `ensureTerminalSpawned(projectId, tabId)` (idempotent, in-flight dedupe); integrasi `needsSpawn` |
| `features/workspace/workspace-persistence.ts` | `createTerminalsForTree` → versi paralel dengan batas konkurensi; export helper spawn |
| `features/terminal/TerminalLayer.tsx` / `Terminal.tsx` | deteksi `terminalId == null && isVisible` → panggil `ensureTerminalSpawned`; tampilkan state loading singkat (skeleton/spinner) saat spawn in-flight |
| `features/settings/AboutSettings.tsx` | bagian "Performance" (baca metrics store) |
| BARU `features/workspace/startup-metrics.ts` | modul metrics (marks, agregat per-terminal, subscribe) |
| `App.tsx` | mark fase `app-mount` → `projects-loaded` → `workspace-structure-restored` |

Semua file baru ≤400 baris (ratchet); tidak ada slice import silang;
`@tauri-apps/*` tetap hanya di `core/api*`.

## 5. Testing

- **Vitest**:
  - restore: struktur tab/split ter-rekonstruksi **tanpa** memanggil
    `terminal.create` (mock api);
  - `ensureTerminalSpawned`: idempotent (pemanggilan ganda → satu spawn),
    parallel untuk split (Promise.all), error path (project path invalid →
    tab error state, tidak throw);
  - `createTerminalsForTree` paralel: urutan hasil stabil, concurrency ≤ N;
  - metrics: marks & agregat min/median/max benar.
- **Gates**: typecheck, oxlint, vitest, check:lines, check:boundaries, CI
  (web+rust) hijau — tanpa perubahan CI.
- **Manual smoke**: workspace 5 project × 3 tab → restart app → app siap cepat
  (<2s first terminal saat tab dibuka); pindah-pindah tab/project → tidak ada
  reset; About → Performance menampilkan angka.

## 6. Risiko & Guardrail

| Risiko | Mitigasi |
|---|---|
| Race rapid tab-switching → double spawn | In-flight promise map per (projectId, tabId); idempotent by design + test |
| Tab dibuka, spawn lama, user close tab mid-flight | Promise hasil di-abort/diignore (cek tab masih ada sebelum apply terminalId); close tab existing path kill session bila sudah hidup |
| Saved state dari versi lama | Format tidak berubah — deserialize path sama; hanya konsumsi setelahnya yang beda |
| Perilaku mid-session berubah (regresi UX) | Tidak menyentuh TerminalLayer kontrak no-remount; smoke checklist eksplisit |
| Metrik menyesatkan (first paint vs ready) | Definisi `first-terminal-ready` = spawn selesai + instance xterm attach; didokumentasikan di panel |

## 7. Non-Goals

- **Suspension proses idle** (dibuang — pengguna menolak terminal reset).
- Scrollback persisten lintas restart.
- Optimasi profile shell / oh-my-posh itu sendiri (hanya divisibilitas lewat
  metrik spawn→first-output; tuning profile urusan pengguna).
- Perubahan Rust/pty, SSH path, format persistence.
- Bundle-size/asset optimasi renderer.

## 8. Kriteria Sukses

- Workspace 5+ project × 3 tab: **app-open → UI siap tanpa spawn massal**;
  **first-terminal-ready < 2s** saat tab pertama dibuka (dari klik tab).
- Tab yang belum dibuka tidak memiliki proses shell hidup (verifikasi via
  Task Manager / metrics) — RAM startup proporsional project aktif.
- **Mid-session 100% tidak berubah**: pindah tab/project tidak reset, scrollback
  utuh, xterm tidak remount (smoke manual).
- Saved workspace versi lama ter-restore benar (kompatibilitas penuh).
- Panel About → Performance menampilkan fase startup + agregat spawn shell.
- Semua gate + CI hijau; test baru hijau; baseline ratchet hanya turun (bila
  ada file yang menyusut).
