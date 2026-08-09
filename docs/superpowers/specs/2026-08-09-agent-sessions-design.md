# Agent Sessions — Phase 2.1: Deteksi & Status Agent CLI ala Orca

- **Tanggal:** 2026-08-09
- **Status:** Disetujui (hasil brainstorming, revisi 2 setelah spec review)
- **Branch:** TBA (worktree baru dari `main` setelah PR #9 merge)
- **Referensi:** [stablyai/orca](https://github.com/stablyai/orca) — `src/main/agent-hooks/`
- **Prasyarat:** Connexio Phase 1 (arsitektur `core/` + `features/`, gates, PR #9)

## 1. Latar Belakang

Connexio adalah project-based terminal manager. Fase 1 (selesai di PR #9) membangun
fondasi: arsitektur feature slices, quality gates, dan test. Fase 2 membawa fitur
produk ala Orca; sub-project pertama adalah **agent sessions**.

Kondisi saat ini:

- Connexio sudah punya fondasi hook agent di `notification.rs`: deteksi 3 CLI
  (Claude Code, OpenCode, Pi), installer hook (Claude `Stop` event via
  `~/.claude/settings.json` + script ps1; OpenCode plugin js; Pi extension ts),
  dan TCP notification server (`start_notification_server`) yang menerima pesan
  dari hook.
- Yang belum ada: konsep **session** (hook hanya one-shot saat stop), linkage
  agent ↔ terminal Connexio, status live (working / waiting-input), UI manajemen
  session, dan notifikasi waiting-input.

Orca menyelesaikan ini dengan hook agent yang dipasang di config masing-masing
agent + registry session di main process + UI status. Desain ini mengadaptasi pola
tersebut di atas fondasi Connexio yang sudah ada.

## 2. Keputusan yang Terkunci

| # | Keputusan | Pilihan |
| 1 | Bentuk UX v1 | **Session dashboard** (panel daftar session) + **badge status di tab terminal** |
| 2 | Linkage agent ↔ terminal | **Env var** — adapter membaca `CONNEXIO_TERMINAL_ID` (sudah disuntik pty manager saat context ada) + `CONNEXIO_NOTIFICATION_PORT`; TIDAK menambah var baru |
| 3 | Kedalaman dukungan agent | **Matriks kemampuan per-agent** (lihat §5.1): Claude Code penuh (working/waiting_input/done); OpenCode & Pi sesuai kemampuan event API mereka — diverifikasi saat planning |
| 4 | Arsitektur | **Backend-owned session state** (`modules/agent_sessions.rs`) + protokol hook ternormalisasi + slice frontend baru `features/agents/` |
| 5 | Persistensi | **In-memory dulu** untuk v1; history persisten = phase berikutnya |
| 6 | API publik | Domain baru `window.connexio.agents` — test api-shape diupdate 15 → 16 key (perubahan bentuk yang disengaja untuk fitur baru); `src/renderer/types/global.d.ts` dan `src/shared/types.ts` ikut diupdate; kedua command baru didaftarkan di `invoke_handler` lib.rs |
| 7 | Platform hook Claude | **Windows dulu** (ps1, sesuai implementasi existing); varian sh/bash macOS/Linux = susulan eksplisit (§9) |
| 8 | Scope terminal | Hanya terminal lokal (pty manager). **Terminal SSH dikecualikan** v1 |

## 3. Arsitektur

```
Claude Code / OpenCode / Pi   (berjalan di terminal LOKAL Connexio)
  │  adapter per-agent (lihat §5):
  │   - Claude  : hooks SessionStart / UserPromptSubmit / Notification / Stop
  │               (~/.claude/settings.json + connexio-claude-hook.ps1)
  │   - OpenCode: plugin js (event sesuai API plugin OpenCode)
  │   - Pi      : extension ts (event sesuai API extension Pi)
  │  payload JSON seragam (kontrak §5.2), memakai:
  │   - CONNEXIO_TERMINAL_ID  → field "terminal"
  │   - CONNEXIO_NOTIFICATION_PORT → alamat tujuan TCP
  ▼
TCP notification server (diperluas — protokol & routing §5.3)
  ▼
modules/agent_sessions.rs (BARU)
  - AgentSessionRegistry: HashMap<(agent, session_id), AgentSession>
  - AgentSession { id, agent, terminal_id, cwd, status, started_at,
                   last_event_at, last_message }
  - state machine transisi (§4)
  - commands: agent_sessions_list, agent_sessions_dismiss
  - emit tauri event "agent-session:update" (payload: session lengkap)
  ▼
core/api/agent-sessions.ts (BARU)
  - list(), dismiss(id), onUpdate(cb) via listen
  - diekspor sebagai connexioApi.agents (api-shape: 16 domain, order-sensitive)
  ▼
features/agents/ (slice BARU, mematuhi boundary checker)
  - components/: AgentsPanel, AgentSessionCard, SessionStatusPill
  - stores/: agentSessionsStore
  - integrasi: item dock/sidebar "Agents" (SidePanelHost); badge tab terminal
    via event/store workspace (bukan import silang feature); aksi baru
    focusTerminalByTerminalId(projectId, terminalId) di workspace-store
    (termasuk navigasi lintas project: switch project dulu, lalu fokus)
```

Aturan arsitektur Phase 1 tetap berlaku: file ≤400 baris di luar baseline, slice
tidak import silang, `@tauri-apps/*` hanya dari `core/api*`.

**Persiapan ratchet (wajib sebelum menambah kode):**

- `notification.rs` saat ini tepat di cap baseline (639/639) dan akan bertambah.
  Task pertama phase ini: **split `notification.rs`** — ekstrak TCP server +
  protokol parsing ke `modules/notification_server.rs` (sekaligus memungkinkan
  unit test parsing yang kini mustahil karena `process_message` memegang
  `AppHandle`). Baseline `notification.rs` turun; file baru ≤400 tanpa baseline.
- `pty/manager.rs` tepat di cap (523/523). Perubahan env injection harus
  **net-neutral atau kurang** (kompensasi bila perlu); bila tak mungkin, split
  ringan lebih dulu.

**Bundling hook assets (wajib):**

- `hooks_dir()` membaca `resource_dir()/assets/hooks`, tetapi `tauri.conf.json`
  belum punya `bundle.resources` — di app terpasang, install hook gagal ("Hook
  source not found"). Tambahkan `bundle.resources` untuk `assets/hooks/*`
  (verifikasi dev + packaged) sebelum memperluas installer.

## 4. Model Status & Lifecycle

Status: `working` | `waiting_input` | `done` | `exited`.

| Event adapter | Transisi status | Efek samping |
|---|---|---|
| `session_start` (atau event pertama ID baru) | → `working` | session muncul di registry + dashboard |
| `working` | → `working` | update `last_event_at` / `last_message` |
| `waiting_input` | → `waiting_input` | + notifikasi (menghormati settings sound) |
| `done` | → `done` | + notifikasi |
| `session_end` | → `exited` | tetap di list (muted) sampai di-dismiss |

Detil:

- **Session ID**: ID asli agent bila tersedia di payload hook (Claude menyediakan
  `session_id` di stdin hook); fallback deterministik: hash(agent + terminal_id +
  cwd + menit-start). **Registry keyed by (agent, session_id)** — dua agent beda
  di terminal sama tidak pernah bertabrakan.
- **Claude `Stop` = akhir turn**: `done` + notifikasi terjadi per turn (bukan per
  proses). Ini UX yang dimaksud (agent selesai menjawab); tidak ada debounce
  untuk `done`.
- **Terminal linkage**: `terminal_id` dari `CONNEXIO_TERMINAL_ID` di payload.
  Bila kosong (agent dijalankan di luar Connexio), session tampil dengan label
  "external" tanpa tombol lompat.
- **Staleness**: session tanpa event > 30 menit ditandai stale di UI saja (bukan
  transisi status otomatis). Clock: `SystemTime` backend (`now_ms` existing).
- **Dismiss**: menghapus session dari registry (command `agent_sessions_dismiss`).
- Registry in-memory; hilang saat restart app (keputusan #5).

## 5. Adapter & Protokol

### 5.1 Matriks kemampuan per-agent (jujur, hasil verifikasi saat planning)

| Agent | working | waiting_input | done | Mekanisme |
|---|---|---|---|---|
| Claude Code | ✅ | ✅ | ✅ | hooks `SessionStart` / `UserPromptSubmit` / `Notification` / `Stop` di `~/.claude/settings.json` |
| OpenCode | ✅ | ⚠️ best-effort | ✅ | plugin js; `session.idle` sudah ada; event permission/turn diverifikasi saat planning (versi API dicatat di plan) |
| Pi | ✅ | ❌ (API tidak punya) | ✅ | extension ts; event turn start/end; waiting_input tidak tersedia di extension API Pi v1 |

Catatan: keputusan #2 user ("semua status penuh") disesuaikan dengan realitas API
di atas; bila verifikasi planning menemukan event waiting-input di OpenCode/Pi,
adapter memakainya.

### 5.2 Kontrak payload (semua adapter wajib)

```json
{
  "type": "agent_event",
  "agent": "claude | opencode | pi",
  "event": "session_start | working | waiting_input | done | session_end",
  "sessionId": "<id asli agent atau fallback>",
  "terminal": "<CONNEXIO_TERMINAL_ID atau kosong>",
  "cwd": "<working directory>",
  "message": "<opsional: ringkasan utk last_message>"
}
```

### 5.3 Wire protocol TCP (kontrak eksplisit)

- **Framing**: satu payload JSON per koneksi — connect → write (diakhiri `\n`) →
  close. Server memproses saat EOF (perilaku existing dipertahankan &
  didokumentasikan sebagai kontrak).
- **Batas**: ukuran payload maksimum **64KB** per koneksi (lebih → koneksi
  diputus, di-log); read timeout **5 detik** per koneksi (koneksi menganggur
  diputus agar tidak memblokir thread).
- **Routing** (di `process_message`, sebelum fallback JSON→notification yang ada
  sekarang): parse JSON; bila ada field `"type":"agent_event"` → registry agent
  sessions; bila tidak → jalur notifikasi legacy (backward compat penuh; payload
  hook lama tanpa field `type` tetap berfungsi).
- Payload tidak valid di-log & diabaikan, tidak pernah crash.

### 5.4 Detil adapter

- **Claude Code (Windows, ps1)**: installer diperluas menjadi 4 hook events
  (`SessionStart`, `UserPromptSubmit`, `Notification`, `Stop`). Script ps1
  diperbaiki: `ConvertFrom-Json` untuk stdin hook (mengambil `session_id`,
  `hook_event_name`, `cwd`) — regex lama tidak cukup; dispatch per-event (command
  kini hardcode `-Event stop`); membaca `$env:CONNEXIO_TERMINAL_ID`. **Marker
  versi baru: `# connexio-notification-hook-v2`** (deteksi versi hook = ada
  marker v2 ATAU keempat event terpasang).
- **OpenCode**: plugin js existing diperluas sesuai hasil verifikasi API.
- **Pi**: extension ts existing diperluas sesuai hasil verifikasi API.
- **Env injection (pty/manager.rs)**: TIDAK ada var baru. Yang diperbaiki:
  `terminal_create_command` (jalur spawn Tasks/Pinned) saat ini **tidak**
  menyuntik `CONNEXIO_NOTIFICATION_PORT` maupun `CONNEXIO_TERMINAL_ID` tanpa
  context — kedua spawn path lokal harus menyuntik keduanya. SSH path: tidak
  disentuh (keputusan #8).
- **Uninstall hook (PERBAIKAN WAJIB)**: klaim lama salah — kode sekarang menghapus
  SELURUH array `hooks.Stop`/`hooks.Notification` dan akan menghancurkan hook
  milik user begitu diperluas ke 4 event. V2 harus **marker-scoped**: hanya buang
  entry hook yang command-nya mengandung marker connexio; array event dihapus
  hanya bila menjadi kosong setelah filtering. Uninstaller v1 (whole-array)
  dipertahankan hanya untuk membersihkan instalasi v1 lama.
- Provider panel existing (AIIntegrationsSettings) menampilkan status hook versi
  baru (installed / upgrade available, berdasarkan deteksi versi di atas).

## 6. UX

- **Panel "Agents"** — item baru di dock/sidebar, membuka panel daftar session:
  - Kartu per session: icon + nama agent, pill status (working = accent pulse;
    waiting_input = amber; done = hijau; exited = muted), path project + nama
    terminal, durasi berjalan, last activity relatif, `last_message` terpotong.
  - Aksi per kartu: **Open Terminal** (memanggil aksi baru
    `focusTerminalByTerminalId(projectId, terminalId)` — bila session beda
    project, pindah project dulu lalu fokus; disabled untuk session external)
    dan **Dismiss**.
  - Urutan: waiting_input dulu, lalu working (last_event desc), lalu done/exited.
  - Empty state: penjelasan singkat + link ke provider settings utk install hook.
- **Badge tab terminal** — `WorkspaceTab` sudah punya sistem status
  (`active|running|exited` + pill Run/Done). Aturan precedence: **agent status
  menang atas process-status dot** bila ada session aktif (waiting_input = amber
  > working = accent pulse); pill Run/Done existing tidak berubah.
- **Notifikasi**: event `waiting_input` dan `done` menghasilkan entri notification
  center (judul: nama agent + status; klik → lompat ke terminal) mengikuti
  settings sound yang ada. Dedup 3 detik existing (provider|title|body) berlaku —
  sebutkan provider `agent-<nama>` agar tidak saling meniadakan antar agent.

## 7. Testing & Guardrail

- **Cargo tests** (greenfield untuk area ini — extract fungsi pure saat split):
  - state machine: semua transisi event→status, event pertama membuat session,
    idempotensi `done`, `session_end` setelah `done`;
  - parsing protokol TCP baru: JSON `agent_event` dirutekan ke registry; pesan
    non-JSON/legacy tetap jalur lama (backward compat); payload >64KB ditolak;
  - marker-scoped uninstall: hook user non-connexio tidak tersentuh (unit test
    JSON settings.json).
- **Vitest**:
  - store/derivation slice agents (sorting, grouping, staleness display);
  - api-shape test diupdate: judul & assertion 16 domain termasuk `agents`,
    plus sub-key lock untuk `agents` (`list`, `dismiss`, `onUpdate`).
- **Gates**: ratchet max-lines & feature boundary checker berlaku otomatis untuk
  semua file baru; CI workflow tidak berubah.
- **Smoke manual** (checklist ditulis di plan): jalankan `claude` di terminal
  Connexio → session muncul `working`; tinggalkan permission prompt →
  `waiting_input` + notifikasi; selesai → `done`; Open Terminal lompat benar;
  hook terpasang di app packaged (bukan hanya dev).

## 8. Risiko & Guardrail

| Risiko | Mitigasi |
|---|---|
| Format hook API agent berubah / berbeda antar versi | Adapter terisolasi per-agent; payload kontrak divalidasi backend (pesan tak valid di-log & diabaikan, bukan crash); versi API dicatat di plan |
| TCP server kebanjiran event agent (tool-use spam) | Adapter memfilter ke event level-turn; debounce transisi `working`; size cap + timeout per koneksi (§5.3) |
| Hook lama (v1 one-shot) masih terpasang | Server kompatibel payload lama; deteksi versi hook (§5.4) → provider panel menampilkan "upgrade available"; installer v2 menulis marker v2 tanpa merusak hook user |
| Env var tidak terbaca (agent via sudo/launcher) | Session tetap tampil sbg "external"; linkage opsional, bukan syarat fungsi |
| Slice agents melanggar boundary | Checker CI menolak import silang; integrasi badge via event/store, bukan import feature |
| Uninstall merusak hook user | Marker-scoped removal + unit test (§5.4, §7) |
| Install hook gagal di app packaged | `bundle.resources` ditambahkan & diverifikasi di dev + packaged (§3) |

## 9. Non-Goals (v1)

- Git worktrees / orkestrasi paralel (Phase 2.2).
- Diff review & anotasi hasil agent (Phase 2.3).
- Follow-up prompt inline dari dashboard (lompat ke terminal dulu).
- History session persisten lintas restart.
- Session agent via remote access / mobile companion.
- **Terminal SSH** (tidak ada env injection; dikecualikan eksplisit).
- **Hook Claude untuk macOS/Linux** (varian sh/bash — susulan; OpenCode & Pi
  sudah cross-platform karena js/ts).
- Dukungan agent di luar Claude Code, OpenCode, Pi.

## 10. Roadmap Phase 2+ (lanjutan)

1. **Git worktrees** — worktree per task/agen, paralelisasi.
2. **Orchestration** — satu prompt → N agent paralel, bandingkan, merge pemenang.
3. **Diff review & anotasi** — review perubahan agent, komentar per baris.
4. **Session history persisten** + mobile companion upgrade.
5. **CLI** — scripting workflow Connexio.
6. **Settings panel ala Orca** — sidebar grouped + search level row (sudah
   brainstorm terpisah; item kecil, bisa diselipkan antar sub-project).

## 11. Kriteria Sukses

- Agent session Claude Code (Windows) yang berjalan di terminal lokal Connexio
  muncul di panel Agents dengan status live (working / waiting_input / done)
  tanpa konfigurasi manual selain install hook; OpenCode & Pi muncul dengan
  status sesuai matriks §5.1.
- Hook terpasang dan berfungsi juga di **app packaged** (bundle.resources benar).
- Badge tab terminal akurat mengikuti status session di terminal tersebut,
  dengan precedence yang terdefinisi atas status proses existing.
- Notifikasi waiting_input & done masuk notification center dan menghormati
  settings sound.
- Uninstall hook tidak menghapus hook milik user (marker-scoped, teruji).
- Tidak ada regresi: payload hook lama tetap berfungsi; domain `window.connexio`
  lama tidak berubah bentuk (hanya penambahan `agents`).
- Semua gate hijau (typecheck, oxlint, vitest, ratchet, boundaries, cargo
  fmt/clippy/test) + CI hijau; test untuk state machine, protokol, dan
  marker-scoped uninstall ada dan hijau.
- File baru mematuhi ratchet ≤400 baris dan boundary feature slice; baseline
  hanya turun.
