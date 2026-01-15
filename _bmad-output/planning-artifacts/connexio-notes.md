# Connexio - Project Discovery Notes

**Date:** 2026-01-14  
**Status:** Pre-Product Brief  
**Next Step:** Create Product Brief with analyst agent

---

## Project Vision

**Connexio** adalah desktop terminal application dengan custom themes, terinspirasi dari **Termius**.

### Target Platform
- **Desktop** (Windows focused initially)
- Personal use dulu → Go Public setelah mature

---

## Fitur yang Direncanakan

### Core Features (MVP)
| # | Fitur | Deskripsi |
|---|-------|-----------|
| 1 | **Multiple Tabs/Panes** | Banyak terminal dalam satu window, split view |
| 2 | **SSH/SFTP Support** | Connect ke remote server, file transfer |
| 3 | **Snippet/Commands Library** | Simpan perintah favorit untuk reuse |
| 4 | **Session Management** | Simpan & restore sessions, connection profiles |
| 7 | **Custom Fonts & Colors** | Theme customization, font ligatures, color schemes |

### Future Features
| # | Fitur | Deskripsi |
|---|-------|-----------|
| 5 | **Sync Across Devices** | Cloud sync untuk settings, themes, snippets |

### Not Planned (for now)
- AI Assistant (tidak dipilih)

---

## Tech Stack Options (Belum Diputuskan)

| Option | Stack | Notes |
|--------|-------|-------|
| A | **Electron + React/Vue** | Familiar web tech, xterm.js ecosystem, agak berat |
| B | **Tauri + React/Vue** | Ringan, Rust backend, modern - **RECOMMENDED** |
| C | **WinUI 3 / WPF (.NET)** | Native Windows, best performance, Windows only |
| D | **Flutter Desktop** | Cross-platform, terminal library terbatas |

**Rekomendasi:** Tauri + React (ringan & modern) atau Electron + React (ecosystem matang)

---

## Competitive Reference

### Termius
- Modern SSH client
- Beautiful UI dengan custom themes
- Cross-platform
- Cloud sync
- Session management

### Lainnya untuk research:
- Windows Terminal (Microsoft)
- Hyper (Electron-based)
- Warp (Rust-based, macOS)
- Tabby (formerly Terminus)

---

## Next Actions

1. **Decide tech stack** (A/B/C/D)
2. **Run Product Brief workflow:**
   ```
   Load: analyst agent
   Command: /bmad:bmm:workflows:create-product-brief
   ```

---

## Resume Instructions

Untuk melanjutkan session:

```bash
# Cek workflow status
/bmad:bmm:workflows:workflow-status

# Atau langsung ke Product Brief
# 1. Load analyst agent
# 2. Run: /bmad:bmm:workflows:create-product-brief
```

---

*Notes saved by BMad Master - 2026-01-14*
