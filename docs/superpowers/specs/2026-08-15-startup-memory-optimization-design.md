# Startup & Memory Optimization — Phase 2.0: Lazy Restore & Instrumentasi

- **Tanggal:** 2026-08-15
- **Status:** Disetujui (hasil brainstorming, revisi 2 setelah spec review)
- **Branch:** `perf/startup-memory-optimization` (dari `main` @ bb3aa67, pasca-PR #9)
- **Prasyarat:** Connexio Phase 1 (PR #9 merged)

## 1. Latar Belakang

Keluhan pengguna: aplikasi berat saat pertama dibuka, loading terminal lama; dengan
banyak project workspace + banyak terminal, RAM background process tinggi.

**Diagnosis berbasis kode (akurat):**

- `workspace-store.ts` `restoreWorkspace()` meng-iterate SEMUA project tersimpan
  secara serial; untuk setiap tab split, `createTerminalsForTree()`
  (workspace-persistence.ts) memanggil `await terminal.create` **serial per leaf
  dalam satu loop rekursif** — seluruh restore berjalan satu-per-satu.
- Setiap `terminal.create` = spawn proses shell baru (PowerShell ±300-800ms);
  bila profile shell memasang oh-my-posh, tiap spawn menambah exec binary +
  theme parse → 1-3s per shell. 15+ terminal = 20+ detik startup.
- Semua shell hasil restore tetap hidup selamanya (±50-150MB per shell dengan
  oh-my-posh child) — sumber RAM tinggi di startup.
- Scrollback xterm sudah dibatasi baik (clamp 500-2000) — bukan sumber masalah.
- `TerminalLayer` tidak pernah unmount terminal (hanya CSS hide) — kontrak
  no-remount ini **dipertahankan** (lihat §3.5).

**Prinsip keras (permintaan eksplisit pengguna): tidak ada terminal reset.**
Perpindahan tab/project dalam sesi tidak boleh berubah apa pun. Suspension
(kill proses idle) **dibuang dari scope**.

## 2. Keputusan yang Terkunci

| #   | Keputusan                        | Pilihan                                                                                                                                                              |
| --- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Tab restored dibuka pertama kali | **Auto-spawn** shell, tanpa klik tambahan                                                                                                                            |
| 2   | Tab aktif tersimpan saat startup | **Auto-spawn segera** setelah struktur workspace direstore (tetap hanya 1 tab yang menspawn — inilah yang membuat first-terminal tetap cepat)                        |
| 3   | Suspension proses idle           | **Dibuang** — terminal tidak pernah reset demi RAM (keputusan pengguna)                                                                                              |
| 4   | Instrumentasi                    | Console (dev) + panel About (produksi), modul di `core/` (bukan feature)                                                                                             |
| 5   | Target metrik                    | First-terminal-ready **< 2s dari app-mount** untuk tab aktif tersimpan, pada workspace 5+ project × 3 tab; proses shell hidup setelah startup = hanya pane tab aktif |
| 6   | Format persistence               | Field/format file saved state **tidak berubah**; restore SELALU mengabaikan `terminalId` tersimpan (selalu lazy)                                                     |
| 7   | Konkurensi spawn                 | Limiter global **N = 6** (module-level pool) — bukan `Promise.all` tak berbatas                                                                                      |
| 8   | Kegagalan partial split          | **Non-atomic per pane**: pane sukses tetap hidup; pane gagal masuk state error dengan retry per-pane                                                                 |

## 3. Desain

### 3.1 Lazy restore & aktivasi

```
Startup:
restoreWorkspace()
  └─ rekonstruksi STRUKTUR semua tab (tab, split tree, label, shell)
     terminalId = null untuk semua leaf terminal
     → TIDAK ADA spawn; UI siap; mark workspace-structure-restored

Setelah restore: tab aktif tersimpan (project aktif × tab aktif) otomatis
  memenuhi kondisi aktivasi → spawn dimulai segera (lihat trigger).

Trigger aktivasi (satu mekanisme untuk semua kasus):
  TerminalLayer effect: untuk setiap leaf terminal dari tab yang VISIBLE:
    (terminalId == null && spawnStatus != in-flight && spawnStatus != error)
    → ensureTerminalSpawned(projectId, tabId)
```

- Trigger dievaluasi dengan **kondisi state**, bukan event flip `isVisible`
  false→true — sehingga kasus initial-visible (tab aktif saat startup) dan
  user-klik tab keduanya tertangani oleh mekanisme yang sama, dan aman
  terhadap StrictMode double-effect.
- `spawnStatus` per leaf: `idle → in-flight → ready | error` (runtime state di
  workspace-store, TIDAK dipersist).
- Tab yang tidak pernah dibuka: tidak pernah spawn. Dibuka kapan pun → shell
  fresh (identik perilaku restart hari ini — tidak ada yang hilang; scrollback
  memang tidak pernah survive restart, sebelum maupun sesudah change ini).

### 3.2 `ensureTerminalSpawned` — kontrak lengkap

- Idempotent + dedupe: map in-flight per `(projectId, tabId)`; pemanggilan
  ganda mengembalikan promise yang sama.
- Param snapshot (projectPath, shell, context) dibaca **saat mulai**; perubahan
  settings setelahnya tidak memengaruhi spawn berjalan.
- **Split tab**: spawn SEMUA leaf terminal tab tersebut via pool limiter
  (§3.4). Non-atomic per pane (§2.8).
- **Disposal late-create (wajib)**: saat promise resolve, cek leaf masih ada
  di state workspace; bila tab/pane sudah ditutup (closeTab, closeSplitPane,
  deleteProject) → panggil `terminal.close(id)` untuk melepas PTY Rust, lalu
  buang hasil. Tidak boleh ada PTY yatim.
- **Partial failure**: pane yang gagal → `spawnStatus=error` + pesan error
  disimpan di leaf; pane yang sukses → `ready` dan tetap hidup.
- **Mutasi saat spawning**: rename tab aman (independen); close/split/delete
  mengikuti aturan disposal; operasi struktural baru (mis. split lagi) pada tab
  yang masih in-flight menunggu promise selesai (queue sederhana di store).

### 3.3 Routing & render leaf null (agar trigger punya rumah)

- `TerminalLayer` merender **semua pane struktural** dengan **key = paneId**
  (stabil — BUKAN terminalId), sehingga:
  - leaf null tetap dirender (hari ini leaf tanpa terminalId tidak dirender);
  - saat materialisasi (null → id), Terminal child mount di DALAM pane wrapper
    yang sama tanpa mem-remount pane lain — kontrak no-remount tetap berlaku
    untuk terminal yang sudah hidup.
- Anak pane:
  - `terminalId != null` → `<Terminal terminalId isVisible>` (seperti hari ini).
  - `terminalId == null && in-flight` → `PendingPane` (skeleton + spinner
    "Menyiapkan shell…") — berlaku untuk single pane, tiap pane split
    independen, dan tab aktif saat startup.
  - `terminalId == null && error` → `PaneError` (§3.6).
  - leaf editor → tanpa loading (tidak menspawn).

### 3.4 Pool konkurensi spawn

- Satu limiter global module-level (dipakai SEMUA path spawn: restore-on-open,
  split baru, tab baru): `mapWithLimit(tasks, N)` dengan **N = 6** (konstanta;
  konfigurasi menyusul bila terbukti perlu).
- `Promise.all` polos dilarang untuk batch spawn; loop serial rekursif di
  `createTerminalsForTree` digantikan: kumpulkan leaf → pool.

### 3.5 Kontrak yang TIDAK berubah

- Perilaku mid-session: pindah tab/project = terminal tetap hidup, scrollback
  utuh, xterm tidak remount (TerminalLayer hanya CSS-hide; kini juga key stabil
  per paneId).
- `serializeNode/deserializeNode` & seluruh format saved state — field sama,
  nilai sama (terminalId tetap ditulis seperti biasa; restore mengabaikannya).
- Rust (`pty/manager.rs`) tidak berubah. Scrollback & WebGL behavior tidak
  berubah.

### 3.6 State error pane (BARU — tidak ada sebelumnya)

- `PaneError`: pesan "Gagal memulai shell: {error}" + tombol **Coba lagi**
  (respawn pane itu saja via `ensureTerminalSpawned` reset status) + tombol
  tutup pane (jalur close existing). Jangan crash tab/pane lain.
- Error tidak dipersist (persistence tetap hanya struktur).

### 3.7 Instrumentasi

- Lokasi: **`core/instrumentation/startup-metrics.ts`** (core — boleh
  dikonsumsi semua feature; menyelesaikan isu boundary dengan settings).
- **Fase startup**: marks `app-mount` → `projects-loaded` →
  `workspace-structure-restored` → `first-terminal-spawn-start` →
  `first-terminal-ready` (promise spawn tab aktif selesai + Terminal child
  ter-mount; mount ditandai via callback dari Terminal.tsx pertama).
- **Per-terminal**: durasi `terminal.create`, dan `spawn→first-output`.
  First-output diukur via **subscription global selalu-aktif** di
  `core/instrumentation` yang memakai `onTerminalData` (terminal-event-bus)
  — buffer global menjamin tidak ada jendela output yang terlewat walau
  Terminal component belum mount. Cleanup per-ID saat close.
- **Tampilan**: dev → `console.info` terstruktur; produksi → Settings → About
  bagian "Performance" (tabel fase startup + agregat min/median/max durasi
  spawn & first-output sesi ini) — menjawab langsung "oh-my-posh saya lambat
  atau bukan".

## 4. Arsitektur perubahan (file-level)

| File                                                       | Perubahan                                                                                                                                      |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `features/workspace/workspace-store.ts`                    | `restoreWorkspace` rekonstruksi struktur tanpa spawn; action `ensureTerminalSpawned` (kontrak §3.2); `spawnStatus`+error di leaf runtime state |
| `features/workspace/workspace-persistence.ts`              | `createTerminalsForTree` → kumpulkan-leaf + pool limiter (hapus loop serial)                                                                   |
| BARU `features/workspace/PendingPane.tsx`, `PaneError.tsx` | loading & error UI (≤80 baris each)                                                                                                            |
| `features/terminal/TerminalLayer.tsx`                      | render semua pane key=paneId; effect trigger aktivasi; anak kondisional (§3.3)                                                                 |
| `features/terminal/Terminal.tsx`                           | callback `onMounted` untuk mark ready                                                                                                          |
| BARU `core/instrumentation/startup-metrics.ts`             | marks, agregat, subscribe first-output global, tampilan data                                                                                   |
| `features/settings/AboutSettings.tsx`                      | bagian "Performance" (baca via core/instrumentation)                                                                                           |
| `App.tsx`                                                  | marks `app-mount`, `projects-loaded`                                                                                                           |

Semua file baru ≤400 baris (ratchet); boundary: instrumentation di core
(legal untuk semua); `@tauri-apps/*` tetap hanya di `core/api*`.

## 5. Testing

- **Vitest** (mock `core/api` terminal):
  - restore: struktur semua tab ter-rekonstruksi **tanpa** satu pun
    `terminal.create`;
  - trigger: tab visible + terminalId null → spawn; tab hidden → tidak;
    StrictMode double-invoke → satu spawn (dedupe);
  - disposal: tab ditutup saat in-flight → promise resolve → `terminal.close`
    terpanggil untuk ID late-create (closeTab, closeSplitPane, deleteProject);
  - partial failure split: 1 dari 3 leaf gagal → 2 ready + 1 error + retry
    per-pane hanya menspawn 1;
  - pool limiter: 10 task, N=6 → tidak pernah >6 concurrent;
  - persistence: serialize/roundtrip tetap identik (format lama kompatibel);
  - metrics: marks & agregat min/median/max benar; first-output global
    subscription mencatat walau Terminal belum mount.
- **Gates**: typecheck, oxlint, vitest, check:lines, check:boundaries, CI
  (web+rust) hijau — CI tidak berubah.
- **Baseline & verifikasi manual** (task pertama implementasi): ukur baseline
  SEBELUM perubahan dengan fixture workspace 5 project × 3 tab (angka
  startup & jumlah proses shell dicatat di plan); SETELAH: first-terminal-ready
  < 2s dari app-mount; proses shell hidup setelah startup ≤ jumlah pane tab
  aktif (verifikasi `Get-Process` pwsh/pwsh count); pindah tab/project tidak
  ada reset; About → Performance menampilkan angka.

## 6. Risiko & Guardrail

| Risiko                                      | Mitigasi                                                                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Race rapid tab-switching → double spawn     | In-flight map per (projectId, tabId) + kondisi-state trigger (bukan event) + test dedupe                                       |
| PTY bocor saat close mid-spawn              | Disposal late-create wajib (§3.2) + lifecycle test untuk 3 jalur close                                                         |
| Partial failure split membingungkan         | Non-atomic per pane + PaneError + retry per-pane (§3.6)                                                                        |
| Kontrak no-remunt rusak                     | Key pane = paneId stabil; Terminal child hanya mount saat id ada; smoke: terminal hidup tidak re-render saat tab lain di-spawn |
| Saved state lama/baru                       | Format tidak berubah dua arah; restore selalu abaikan terminalId; roundtrip test                                               |
| Metrik first-output terlewat                | Subscription global terminal-event-bus (buffered) sejak modul import                                                           |
| Limiter global memperebutkan slot antar tab | N=6 cukup untuk pane per tab; antrian FIFO adil; observable via metrics                                                        |

## 7. Non-Goals

- **Suspension proses idle** (dibuang — pengguna menolak terminal reset).
- Scrollback persisten lintas restart.
- Optimasi profile shell / oh-my-posh itu sendiri (hanya divisibilitas lewat
  metrik; tuning profile urusan pengguna).
- Perubahan Rust/pty, SSH path, format persistence file.
- Bundle-size/asset optimasi renderer.
- Konfigurasi user untuk N limiter.

## 8. Kriteria Sukses

- Workspace 5+ project × 3 tab: app siap **tanpa spawn massal**; **first-terminal-ready < 2s** diukur dari `app-mount` untuk tab aktif tersimpan; angka baseline-vs-sesudah tercatat (instrumentasi) di plan/PR.
- Proses shell hidup setelah startup ≤ jumlah pane tab aktif — diverifikasi via jumlah proses shell OS.
- **Mid-session 100% tidak berubah**: pindah tab/project tidak reset, scrollback utuh, xterm tidak remount (smoke manual eksplisit).
- Saved workspace versi lama ter-restore benar; format file tidak berubah (roundtrip test).
- Tidak ada PTY leak pada close-mid-spawn (test lifecycle 3 jalur).
- Panel About → Performance menampilkan fase startup + agregat spawn & first-output.
- Semua gate + CI hijau; test baru hijau; baseline ratchet hanya turun.
