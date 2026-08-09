# Agent Sessions — Phase 2.1: Deteksi & Status Agent CLI ala Orca

- **Tanggal:** 2026-08-09
- **Status:** Disetujui (hasil brainstorming)
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
|---|---|---|
| 1 | Bentuk UX v1 | **Session dashboard** (panel daftar session) + **badge status di tab terminal** |
| 2 | Linkage agent ↔ terminal | **Env var** `CONNEXIO_SESSION_ID` disuntik saat spawn terminal; hook membacanya |
| 3 | Kedalaman dukungan agent | **Semua agent status penuh** (Claude Code, OpenCode, Pi) via adapter per-agent |
| 4 | Arsitektur | **Backend-owned session state** (`modules/agent_sessions.rs`) + protokol hook ternormalisasi + slice frontend baru `features/agents/` |
| 5 | Persistensi | **In-memory dulu** untuk v1; history persisten = phase berikutnya |
| 6 | API publik | Domain baru `window.connexio.agents` — test api-shape diupdate 15 → 16 key (perubahan bentuk yang disengaja untuk fitur baru) |

## 3. Arsitektur

```
Claude Code / OpenCode / Pi   (berjalan di terminal Connexio)
  │  adapter per-agent:
  │   - Claude  : hooks SessionStart / UserPromptSubmit / Notification / Stop
  │               (~/.claude/settings.json + connexio-claude-hook.ps1)
  │   - OpenCode: plugin js (event turn/message/permission)
  │   - Pi      : extension ts (event turn start/end)
  │  payload JSON seragam:
  │   {"type":"agent_event","agent":"claude","event":"working|waiting_input|
  │     done|session_start|session_end","sessionId":"...","message":"..."}
  │  + env CONNEXIO_SESSION_ID (dibaca adapter, ikut di payload sbg "terminal")
  ▼
TCP notification server (existing, diperluas: pesan JSON ber-"type":"agent_event"
  dirutekan ke agent_sessions; pesan lama tetap behavior lama — backward compat)
  ▼
modules/agent_sessions.rs (BARU)
  - AgentSessionRegistry: HashMap<session_id, AgentSession>
  - AgentSession { id, agent, terminal_id, cwd, status, started_at,
                   last_event_at, last_message }
  - state machine transisi (lihat §4)
  - commands: agent_sessions_list, agent_sessions_dismiss
  - emit tauri event "agent-session:update" (payload: session lengkap)
  ▼
core/api/agent-sessions.ts (BARU)
  - list(), dismiss(id), onUpdate(cb) via listen
  - diekspor sebagai connexioApi.agents (api-shape: 16 domain)
  ▼
features/agents/ (slice BARU, mematuhi boundary checker)
  - components/: AgentsPanel, AgentSessionCard, SessionStatusPill
  - stores/: agentSessionsStore
  - integrasi: item dock/sidebar "Agents"; badge di tab terminal (workspace slice
    mengonsumsi event via store, bukan import silang feature)
```

Aturan arsitektur Phase 1 tetap berlaku: file ≤400 baris di luar baseline, slice
tidak import silang, `@tauri-apps/*` hanya dari `core/api*`.

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
  `session_id` di stdin hook); fallback deterministik: hash(terminal_id + cwd +
  menit-start) — adapter Claude menyertakan ID asli; OpenCode/Pi memakai session
  context API mereka, fallback bila tak tersedia.
- **Terminal linkage**: `terminal_id` diambil dari `CONNEXIO_SESSION_ID` di
  payload. Bila kosong (agent dijalankan di luar Connexio), session tetap tampil
  dengan label "external" tanpa tombol lompat.
- **Staleness**: session tanpa event > 30 menit ditandai stale di UI saja (bukan
  transisi status otomatis).
- **Dismiss**: menghapus session dari registry (command `agent_sessions_dismiss`).
- Registry in-memory; hilang saat restart app (keputusan #5).

## 5. Adapter per-Agent

Kontrak payload tunggal (semua adapter wajib):

```json
{
  "type": "agent_event",
  "agent": "claude | opencode | pi",
  "event": "session_start | working | waiting_input | done | session_end",
  "sessionId": "<id asli agent atau fallback>",
  "terminal": "<CONNEXIO_SESSION_ID atau kosong>",
  "cwd": "<working directory>",
  "message": "<opsional: ringkasan utk last_message>"
}
```

- **Claude Code**: installer hook diperluas dari hanya `Stop` menjadi
  `SessionStart`, `UserPromptSubmit`, `Notification`, `Stop`. Script ps1 membaca
  stdin hook (JSON berisi session_id, event context) + `$env:CONNEXIO_SESSION_ID`,
  memetakan event Claude → event kontrak, POST ke TCP server. Uninstaller tetap
  membersihkan entry ber-marker `# connexio-notification-hook`.
- **OpenCode**: plugin js existing diperluas — event turn/message/permission API
  OpenCode dipetakan ke kontrak; `process.env.CONNEXIO_SESSION_ID`.
- **Pi**: extension ts existing diperluas — event turn start/end Pi API;
  `process.env.CONNEXIO_SESSION_ID`.
- **Env injection**: `pty/manager.rs` menambahkan `CONNEXIO_SESSION_ID=<terminal
  id>` ke environment spawn terminal (semua platform).
- Provider panel existing (AIIntegrationsSettings) menampilkan status hook versi
  baru; install/uninstall flow tidak berubah bentuknya.

## 6. UX

- **Panel "Agents"** — item baru di dock/sidebar, membuka panel daftar session:
  - Kartu per session: icon + nama agent, pill status (working = accent pulse;
    waiting_input = amber; done = hijau; exited = muted), path project + nama
    terminal, durasi berjalan, last activity relatif, `last_message` terpotong.
  - Aksi per kartu: **Open Terminal** (fokus terminal asal; disabled utk external),
    **Dismiss**.
  - Urutan: waiting_input dulu, lalu working (last_event desc), lalu done/exited.
  - Empty state: penjelasan singkat + link ke provider settings utk install hook.
- **Badge tab terminal**: dot amber (waiting_input) / dot accent pulse (working)
  pada tab terminal yang memiliki session aktif.
- **Notifikasi**: event `waiting_input` dan `done` menghasilkan entri notification
  center (judul: nama agent + status; klik → lompat ke terminal) mengikuti
  settings sound yang ada.

## 7. Testing & Guardrail

- **Cargo tests** (characterization + unit):
  - state machine: semua transisi event→status, termasuk event pertama membuat
    session, idempotensi `done`, `session_end` setelah `done`;
  - parsing protokol TCP baru: JSON `agent_event` dirutekan ke registry, pesan
    non-JSON/legacy tetap path lama (backward compat);
  - env injection: konfigurasi spawn menyertakan `CONNEXIO_SESSION_ID`.
- **Vitest**:
  - store/derivation slice agents (sorting, grouping, staleness display);
  - api-shape test diupdate: 16 domain termasuk `agents` dengan key yang
    dikunci (`list`, `dismiss`, `onUpdate`).
- **Gates**: ratchet max-lines & feature boundary checker berlaku otomatis utk
  semua file baru; CI workflow tidak berubah.
- **Smoke manual** (checklist ditulis di plan): jalankan `claude` di terminal
  Connexio → session muncul `working`; tinggalkan permission prompt →
  `waiting_input` + notifikasi; selesai → `done`; Open Terminal lompat benar.

## 8. Risiko & Guardrail

| Risiko | Mitigasi |
|---|---|
| Format hook API agent berubah / berbeda antar versi | Adapter terisolasi per-agent; payload kontrak divalidasi backend (pesan tak valid di-log & diabaikan, bukan crash) |
| TCP server kebanjiran event agent (tool-use spam) | Backend hanya peduli event level-turn (adapter yang memfilter); debounce transisi `working` |
| Hook lama (versi one-shot) masih terpasang | Server tetap kompatibel pesan lama; installer menawarkan "upgrade hook" |
| Env var tidak terbaca (agent via sudo/launcher) | Session tetap tampil sbg "external"; linkage opsional, bukan syarat fungsi |
| Slice agents melanggar boundary | Checker CI menolak import silang; integrasi badge via event/store, bukan import feature |

## 9. Non-Goals (v1)

- Git worktrees / orkestrasi paralel (Phase 2.2).
- Diff review & anotasi hasil agent (Phase 2.3).
- Follow-up prompt inline dari dashboard (lompat ke terminal dulu).
- History session persisten lintas restart.
- Session agent via remote access / mobile companion.
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

- Agent session Claude Code / OpenCode / Pi yang berjalan di terminal Connexio
  muncul di panel Agents dengan status live (working / waiting_input / done)
  tanpa konfigurasi manual selain install hook.
- Badge tab terminal akurat mengikuti status session di terminal tersebut.
- Notifikasi waiting_input & done masuk notification center dan menghormati
  settings sound.
- Tidak ada regresi: pesan hook lama tetap berfungsi; `window.connexio` domain
  lama tidak berubah bentuk (hanya penambahan `agents`).
- Semua gate hijau (typecheck, oxlint, vitest, ratchet, boundaries, cargo
  fmt/clippy/test) + CI hijau; test characterization untuk state machine &
  protokol ada dan hijau.
- File baru mematuhi ratchet ≤400 baris dan boundary feature slice.
