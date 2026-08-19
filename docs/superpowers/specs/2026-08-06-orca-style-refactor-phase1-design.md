# Connexio Refactor Phase 1 — Konvensi & Arsitektur ala Orca

- **Tanggal:** 2026-08-06
- **Status:** Disetujui (hasil brainstorming)
- **Branch:** `refactor-project-like-orca-dev-https-github.com-stablyai-orca`
- **Referensi:** [stablyai/orca](https://github.com/stablyai/orca)

## 1. Latar Belakang

Connexio adalah project-based terminal manager (Tauri v2 + Rust + React 18, ±25k LOC).
Kondisi saat ini:

- File raksasa yang tangled: `SSHManagerPanel.tsx` (1.366 baris), `projectStore.ts`
  (1.207), `SourcePanel.tsx` (1.182), `SettingsModal.tsx` (944), `aiStore.ts` (783),
  `Workspace.tsx` (768), `remote/server.rs` (839), `ssh.rs` (750),
  `tauri-api.ts` (579), `remote-api.ts` (673).
- Tidak ada test (vitest/cargo test), tidak ada lint/format (hanya `typecheck`),
  tidak ada konvensi tertulis.

Orca dijadikan model bukan karena fiturnya (itu Phase 2+), tapi karena **disiplin
engineering-nya**: file kecil terfokus dengan nama domain konkret, test colocated,
quality gates di CI (max-lines ratchet, lint ketat), dan konvensi tertulis
(`AGENTS.md`, `docs/STYLEGUIDE.md`).

## 2. Keputusan yang Terkunci

| #   | Keputusan             | Pilihan                                                                                                    |
| --- | --------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | Tujuan jangka panjang | Dua-duanya bertahap: Phase 1 fondasi konvensi & arsitektur, Phase 2+ fitur produk ala Orca                 |
| 2   | Stack                 | Tetap **Tauri v2 + Rust** (tidak migrasi ke Electron)                                                      |
| 3   | Pain utama            | File raksasa & kode tangled                                                                                |
| 4   | Testing               | Characterization test secukupnya, hanya untuk area yang direfactor                                         |
| 5   | Scope                 | **Frontend-led**: renderer + shared TS fokus utama; Rust hanya rustfmt/clippy gate + split 2 file terbesar |
| 6   | Pendekatan            | **Feature slices + Orca gates**, eksekusi incremental (1 slice per PR, selalu releasable)                  |

## 3. Arsitektur Target

```
Connexio/
├── AGENTS.md                    # Konvensi tertulis untuk AI agent & kontributor
├── docs/
│   ├── STYLEGUIDE.md            # Design tokens, komponen, spacing (canonical)
│   └── superpowers/specs/       # Dokumen desain seperti ini
├── config/                      # Tooling & gate scripts
│   ├── oxlint.json
│   ├── check-max-lines.mjs      # Ratchet checker
│   ├── max-lines-baseline.txt   # Baseline file besar (hanya boleh turun)
│   ├── check-feature-imports.mjs# Boundary checker
│   └── vitest.config.ts
├── src/
│   ├── shared/                  # Types & konstanta frontend ↔ Rust (murni, tanpa import React/Tauri)
│   └── renderer/
│       ├── core/                # Kernel — boleh diimpor semua feature
│       │   ├── ui/              # Primitif kecil: ContextMenu, ConfirmDialog, SidePanelRail, ToggleSwitch, SettingsCard
│       │   ├── api/             # IPC wrapper per-domain (pengganti tauri-api.ts & remote-api.ts)
│       │   ├── hooks/           # useGitFileStatus, use-terminal-resize-v2, useDiscordPresence
│       │   ├── stores/          # Hanya store cross-cutting: settings, theme, notifications
│       │   └── styles/
│       ├── features/            # 1 folder = 1 domain; API publik hanya lewat index.ts
│       │   ├── terminal/        # Terminal, TerminalLayer, ShellPicker, SearchPanel
│       │   ├── workspace/       # Workspace komposisi, WorkspaceTab, split layout, tab bar
│       │   ├── projects/        # Sidebar, AddProjectModal, project store slice
│       │   ├── git/             # SourcePanel, GitStatusBar, BranchPicker, CommitBox, DiffViewer, GitHistoryPanel
│       │   ├── ssh/             # SSHManagerPanel (split), SSHPanel, SFTP browser
│       │   ├── remote/          # RemoteLoginGate, RemoteMobileShell, RemoteAccessSettings, badge & power controls
│       │   ├── tasks/           # TaskPanel + pinned commands
│       │   ├── explorer/        # FileExplorer
│       │   ├── editor/          # CodeEditor + RemoteEditorWrapper
│       │   ├── ai/              # AIChatPanel + provider client
│       │   ├── settings/        # SettingsModal + tab-tab settings
│       │   └── notifications/   # NotificationBell, NotificationToast
│       └── App.tsx / main.tsx   # Composition root — satu-satunya tempat feature digabung
├── src-tauri/
│   └── src/modules/
│       ├── ssh/                 # ssh.rs → folder modul (connection, secrets, sftp, known-hosts)
│       ├── remote/              # server.rs dipecah: server core, protocol handlers, auth/session
│       └── …                    # Modul lain tidak disentuh di Phase 1
└── tests/                       # Setup vitest + fixture bersama
```

### 3.1 Aturan Batas (Boundary Rules)

Ditulis di `AGENTS.md` dan dipaksa oleh CI script:

1. **Feature dilarang mengimpor internal feature lain** — hanya lewat `index.ts`
   feature tujuan atau lewat `core/`. Komunikasi antar-feature via store/events di `core`.
2. **`invoke()`/`listen()` dilarang di luar `core/api/`** — semua IPC melalui typed
   wrapper. Feature menjadi testable (mockable) dan kontrak frontend↔Rust terpusat.
3. **`shared/` hanya berisi tipe & konstanta murni** — tanpa import React atau Tauri API.

### 3.2 Penempatan Store

- Store domain tinggal bersama feature-nya: `features/projects/projects-store.ts`,
  `features/workspace/workspace-store.ts`, `features/ai/ai-store.ts`, dst.
- Hanya store cross-cutting yang tinggal di `core/stores/`: settings, theme, notifications.
- `projectStore.ts` saat ini dipecah lintas feature (projects + workspace), lihat §4.

### 3.3 Konvensi Penamaan

- File komponen React (`.tsx`): **PascalCase** (`WorkspaceTab.tsx`) — sesuai norma React,
  meminimalkan churn.
- Modul non-komponen (`.ts`): **kebab-case** dengan nama domain konkret ala Orca
  (`split-layout-geometry.ts`, `git-diff-cache.ts`). Nama generik (`utils`, `helpers`,
  `common`) dilarang — mengikuti AGENTS.md Orca.
- Test colocated: `foo.ts` ↔ `foo.test.ts` di folder yang sama.

### 3.4 Alur Data

```
komponen feature → store feature (zustand) → core/api (typed wrapper)
  → Tauri invoke → modul Rust
arah balik: Tauri event → listener di core/api (event bus) → update store → re-render
```

## 4. Rencana Pembelahan Monolith

| File saat ini                                | Target                                       | Unit hasil split                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `projectStore.ts` (1.207)                    | `features/workspace/` + `features/projects/` | `split-layout.ts` (tipe tree + find/replace/remove/collect — murni), `split-layout-geometry.ts` (computePaneBounds, computeResizeHandleBounds — murni), `workspace-persistence.ts` (serialize/deserialize + createTerminalsForTree), `projects-store.ts` (CRUD project & group), `workspace-store.ts` (tab, terminal, layout)                                                                                                                  |
| `SSHManagerPanel.tsx` (1.366)                | `features/ssh/`                              | `SSHManagerPanel.tsx` (shell ramping + view switcher), `SSHHostsView.tsx`, `SSHIdentitiesView.tsx`, `SSHKnownHostsView.tsx`, `SSHConnectPrompt.tsx`, `SSHEditForm.tsx`, `SFTPBrowser.tsx`, `use-ssh-connections.ts`                                                                                                                                                                                                                            |
| `SourcePanel.tsx` (1.182)                    | `features/git/`                              | `git-diff-cache.ts` (logika cache module-level — murni), `git-file-grouping.ts` (groupFiles, filterFiles, status helpers — murni), `ChangedFileItem.tsx` (memo component), `SkeletonList.tsx`, `SourcePanel.tsx` (utama, dirampingkan)                                                                                                                                                                                                         |
| `SettingsModal.tsx` (944)                    | `features/settings/` + `core/ui/`            | `SettingsModal.tsx` (shell + tabs), `GeneralSettings.tsx`, `TerminalSettings.tsx`, `AppearanceSettings.tsx`, `NotificationsSettings.tsx`, `AboutSettings.tsx`; `SettingsCard` & `ToggleSwitch` pindah ke `core/ui/`                                                                                                                                                                                                                            |
| `Workspace.tsx` (768)                        | `features/workspace/` + `features/editor/`   | `Workspace.tsx` (komposisi ramping), `WorkspaceTabBar.tsx`, `SidePanelHost.tsx` (rail + header + switching konten); `RemoteEditorWrapper` → `features/editor/`                                                                                                                                                                                                                                                                                 |
| `aiStore.ts` (783)                           | `features/ai/`                               | `ai-types.ts`, `ai-providers.ts` (DEFAULT_PROVIDERS + base URL), `ai-client.ts` (fetch/streaming/SSE — murni), `ai-storage.ts`, `ai-store.ts` (zustand)                                                                                                                                                                                                                                                                                        |
| `tauri-api.ts` (579) + `remote-api.ts` (673) | `core/api/`                                  | Satu modul per domain: terminal, projects, session, settings, workspace, tasks, pinned, ssh, git, theme, app, updater, notification, discord, remote; `terminal-event-bus.ts` (buffering data terminal); barrel `index.ts` mengekspor `connexioApi` dengan bentuk identik                                                                                                                                                                      |
| `ssh.rs` (750)                               | `src-tauri/src/modules/ssh/`                 | `mod.rs` + `types.rs` (SSHConnection, auth method, identity, SFTPEntry, tunnel), `storage.rs` (path & persistensi file + command list/save), `command-builder.rs` (ssh_build_command/_args + shell_quote), `trust.rs` (known-hosts, fingerprint, trust/forget), `connection.rs` (ssh_test_connection, ssh_connect_session), `sftp.rs` (list/download/upload/read/write/mkdir/delete/rename), `secrets.rs` (keyring set/get/delete, key_exists) |
| `remote/server.rs` (839)                     | `src-tauri/src/modules/remote/`              | `state.rs` (RemoteState, RemoteAccessState, konstanta), `commands.rs` (remote_start/stop/status/wol/regenerate_pin), `http.rs` (auth endpoint, ws_upgrade, fallback UI, generate_pin), `websocket.rs` (handle_ws_client, handle_client_message, send_to_client, gather_init_state), `pty-bridge.rs` (write/resize session), `wol.rs` (magic packet + parse_mac), `power.rs` (lock/sleep per-platform), `tailscale.rs` (deteksi IP)             |

## 5. Tooling & Quality Gates (ala Orca)

| Alat                    | Peran                                                                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **oxlint + oxfmt**      | Lint & format (alat yang dipakai Orca); config di `config/`                                                                                                                           |
| **husky + lint-staged** | Pre-commit: oxlint + oxfmt pada file staged                                                                                                                                           |
| **max-lines ratchet**   | `config/check-max-lines.mjs` + `max-lines-baseline.txt`: CI gagal jika file melebihi baseline; file baru hard-cap **≤400 baris**; angka baseline hanya boleh turun                    |
| **Boundary checker**    | `config/check-feature-imports.mjs`: menolak import lintas-internal feature dan `invoke()`/`listen()` di luar `core/api`                                                               |
| **AGENTS.md**           | Konvensi: penamaan, boundary rules, aturan IPC, cross-platform (Windows/macOS/Linux), ekspektasi test, gaya komentar singkat                                                          |
| **docs/STYLEGUIDE.md**  | Canonical design tokens: palette `connexio-*`, kelas `glass-panel`, `dock-button`, `field-soft`, dst. UI baru tidak boleh menambah nilai warna/spacing baru bila token sudah mencakup |

**CI PR workflow (GitHub Actions)** harus hijau semua:

1. `typecheck` (tsc --noEmit)
2. oxlint
3. vitest run
4. `cargo fmt --check` + `cargo clippy -- -D warnings`
5. check-max-lines
6. check-feature-imports

## 6. Strategi Testing

- **vitest** untuk TS, test colocated (`foo.test.ts` di samping `foo.ts`).
- Target characterization test pertama (logika murni, risiko tertinggi):
  - split-layout: operasi tree (find/replace/remove/collect)
  - split-layout-geometry: komputasi bounds & resize handles
  - workspace-persistence: roundtrip serialize/deserialize
  - git-file-grouping: grouping & filtering file berubah
  - ai-client: parsing SSE/streaming (dengan fixture)
  - ssh search/filter matching
- **cargo test** hanya untuk dua modul Rust yang di-split (ssh, remote server).
- **Tidak ada e2e di Phase 1** — Tauri WebDriver/Playwright dipertimbangkan di Phase 2.
- Test ditulis **sebelum** split (characterization) untuk mengunci behavior saat ini.

## 7. Rencana Eksekusi

Satu PR per langkah; setiap PR harus hijau semua gate dan app tetap releasable:

| #   | Langkah          | Isi                                                                                                                                 |
| --- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Baseline gates   | Pasang oxlint/oxfmt, husky, vitest wiring, CI gates, baseline ratchet, AGENTS.md awal — **tanpa memindahkan kode apa pun**          |
| 1   | `core/api`       | Split `tauri-api.ts`/`remote-api.ts` per domain; bentuk ekspor `connexioApi` tidak berubah sehingga `window.connexio` tetap bekerja |
| 2   | `projectStore`   | Characterization test dulu, lalu split ke workspace/projects                                                                        |
| 3   | Slice settings   | `SettingsModal` → `features/settings` + primitif ke `core/ui`                                                                       |
| 4   | Slice ssh        | `SSHManagerPanel` → `features/ssh`                                                                                                  |
| 5   | Slice git/source | `SourcePanel` → `features/git`                                                                                                      |
| 6   | Slice ai         | `aiStore` + `AIChatPanel` → `features/ai`                                                                                           |
| 7   | Slice workspace  | `Workspace.tsx` dirampingkan; tab bar & side panel host diekstrak                                                                   |
| 8   | Rust             | Split `ssh.rs` + `remote/server.rs` + cargo test; clippy/fmt gates aktif                                                            |
| 9   | Perketat         | Turunkan angka baseline ratchet bertahap; hapus file flat lama yang sudah kosong; finalisasi AGENTS.md + STYLEGUIDE.md              |

## 8. Risiko & Guardrail

| Risiko                          | Mitigasi                                                                                                                                                    |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Regresi behavior saat split     | Characterization test ditulis sebelum split; manual smoke checklist per slice (terminal spawn, SSH connect, git status, settings persistence, remote login) |
| Churn import path besar-besaran | Ekspor alias dipertahankan selama migrasi (`window.connexio`, nama hook store); imports diperbarui per feature                                              |
| PR macet/tidak releasable       | 1 slice per PR, CI selalu hijau; jika regresi lolos → **revert PR**, bukan fix-forward                                                                      |
| Ratchet menghalangi kerja       | Baseline awal = ukuran sekarang; aturan hanya mencegah pertumbuhan, tidak memaksa shrink di muka                                                            |
| Drift konvensi                  | AGENTS.md + CI gates memaksa otomatis, bukan mengandalkan disiplin manual                                                                                   |

## 9. Non-Goals (Phase 1)

- Tidak ada redesign UI / perubahan visual.
- Tidak ada perubahan behavior atau fitur baru.
- Tidak ada migrasi stack (tetap Tauri v2 + Rust + React 18).
- Modul Rust selain `ssh.rs` dan `remote/server.rs` tidak disentuh.
- Tidak ada e2e test.

## 10. Roadmap Phase 2+ (sub-project terpisah, masing-masing lewat brainstorm → spec → plan)

1. **Git worktrees** — worktree per task/agen, fondasi orkestrasi ala Orca.
2. **Agent sessions** — deteksi & orkestrasi CLI agent (Codex, Claude Code, Pi, dst.)
   dalam terminal: status parsing, notifikasi selesai, follow-up.
3. **Diff review & anotasi** — review perubahan buatan agent, komentar per baris.
4. **Mobile companion upgrade** — membangun di atas remote access yang sudah ada.
5. **CLI** — scripting workflow Connexio dari terminal.

## 11. Kriteria Sukses Phase 1

- Tidak ada file >400 baris kecuali yang terdaftar eksplisit di `max-lines-baseline.txt`
  (dan setiap angka baseline ≤ ukuran file saat Phase 1 dimulai).
- Semua target monolith (§4) selesai di-split; folder `features/` + `core/` berdiri
  sesuai §3 dan ketiga boundary rule lolos CI.
- Gate CI lengkap berjalan di setiap PR: typecheck, oxlint, vitest, cargo fmt/clippy,
  max-lines, feature-imports.
- Test characterization hijau untuk semua modul murni yang di-split; cargo test ada
  untuk `ssh` dan `remote`.
- `AGENTS.md` dan `docs/STYLEGUIDE.md` ter-commit dan menjadi acuan review.
- API publik `window.connexio` tidak berubah bentuk; tidak ada perubahan fitur/behavior
  (verifikasi: smoke checklist §8 + rilis normal tetap jalan).
