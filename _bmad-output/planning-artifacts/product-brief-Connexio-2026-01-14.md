---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments:
  - connexio-notes.md
  - quick-research-competitive-analysis
date: 2026-01-14
author: Bos Yanda
project_name: Connexio
---

# Product Brief: Connexio

## Executive Summary

**Connexio** adalah aplikasi desktop terminal modern untuk Windows yang mengatasi frustrasi pengguna dengan terminal bawaan yang membosankan dan tidak praktis. Dengan fokus utama pada **session persistence** dan **beautiful themes**, Connexio memungkinkan pengguna menyimpan seluruh workspace terminal mereka - termasuk tabs yang terbuka dan command history - sehingga dapat di-restore dengan satu klik. Dibangun dengan Tauri (Rust backend) untuk performa native dan stabilitas tinggi, Connexio adalah solusi terminal yang developer-friendly untuk produktivitas maksimal.

---

## Core Vision

### Problem Statement

Pengguna Windows menghadapi frustrasi sehari-hari dengan terminal yang:
- **Membosankan dan tidak customizable** - Tidak ada themes, tampilan monoton
- **Tidak menyimpan session** - Setiap kali aplikasi ditutup, semua terminal harus dibuka ulang satu per satu
- **Tidak stabil** - Crash saat menangani output berat, masalah scrolling
- **Menghambat produktivitas** - Waktu terbuang untuk setup ulang workspace

### Problem Impact

- **Waktu terbuang** setiap hari untuk membuka ulang terminal dan navigate ke working directory yang sama
- **Context switching** yang mengganggu flow kerja
- **Frustrasi** dengan tampilan yang membosankan dan tidak personal
- **Kehilangan command history** yang penting saat terminal crash atau ditutup

### Why Existing Solutions Fall Short

| Solution             | Limitation                                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| **Windows Terminal** | Sering crash, masalah scroll dengan tools seperti opencode, tidak ada session persistence yang proper |
| **Termius**          | Mahal ($8.33/bulan), fokus SSH bukan local terminal                                                   |
| **Hyper**            | Lambat (Electron), kurang stabil                                                                      |
| **Warp**             | Tidak tersedia di Windows                                                                             |
| **Tabby**            | UI kurang polish, session management terbatas                                                         |

### Proposed Solution

**Connexio** - Terminal modern untuk Windows dengan:

1. **Session Persistence** (Killer Feature)
   - Auto-save semua tabs yang terbuka saat close aplikasi
   - Simpan command history per tab
   - One-click restore seluruh workspace

2. **Beautiful Themes & Customization**
   - Tema modern out-of-the-box
   - Custom fonts, colors, dan tampilan

3. **Native Performance & Stability**
   - Dibangun dengan Tauri (Rust backend) - bukan Electron
   - Smooth scrolling, handle output berat tanpa crash
   - Ringan dan cepat

4. **Developer-Friendly Features**
   - Multiple tabs dan split panes
   - Snippet/command library
   - SSH/SFTP support (nice-to-have)

### Key Differentiators

| Differentiator                | Advantage                                                  |
| ----------------------------- | ---------------------------------------------------------- |
| **Session Persistence First** | Fitur utama yang tidak ada di kompetitor gratis            |
| **Windows-First Development** | Target market yang underserved (Warp tidak ada di Windows) |
| **Tauri/Rust Backend**        | Performa native, bukan Electron yang lambat                |
| **Free & Open**               | Alternatif gratis untuk Termius                            |
| **Personal-First Design**     | Didesain dari pain point nyata pengguna                    |

---

## Target Users

### Primary Users

#### Persona 1: Andi - The Vibe Coder

| Attribute          | Detail                                                   |
| ------------------ | -------------------------------------------------------- |
| **Profil**         | Developer/hobbyist yang suka coding dengan AI assistance |
| **Skill Level**    | Beginner to Intermediate                                 |
| **Environment**    | Windows, coding setiap hari                              |
| **Tools**          | AI agents (OpenCode, Cursor, dll), multiple terminals    |
| **Daily Activity** | Prompting dengan AI, running scripts, local development  |

**Pain Points:**
- Harus reopen terminal setiap kali buka laptop
- Ribet navigasi ke direktori project yang berbeda-beda
- Windows Terminal sering crash saat pakai AI tools
- Tampilan terminal membosankan, tidak inspiring

**Success Vision:**
- Buka Connexio → semua tabs langsung restore dengan direktori yang benar
- Terminal yang enak dilihat dengan tema yang nyaman di mata
- Tidak perlu setup ulang workspace setiap hari

**Quote:** *"Saya cuma mau buka terminal dan langsung kerja, bukan habiskan 10 menit setup dulu."*

---

#### Persona 2: Budi - The Power User

| Attribute          | Detail                                    |
| ------------------ | ----------------------------------------- |
| **Profil**         | Experienced developer / tech enthusiast   |
| **Skill Level**    | Advanced to Expert                        |
| **Environment**    | Windows, heavy terminal usage             |
| **Tools**          | Multiple projects, berbagai CLI tools     |
| **Daily Activity** | Development, scripting, server management |

**Pain Points:**
- Manage banyak terminal untuk project berbeda
- Kehilangan command history saat terminal crash
- Ingin terminal yang performant dan tidak lambat
- Butuh customization untuk workflow optimal

**Success Vision:**
- Workspace tersimpan per project
- Command history tidak hilang
- Terminal ringan tapi powerful
- Full control atas tampilan dan behavior

**Quote:** *"Terminal adalah rumah kedua saya, harus nyaman dan efisien."*

---

### Secondary Users

#### DevOps Engineers
- **Needs:** SSH connections ke multiple servers, session management
- **Value:** Simpan connection profiles, quick access ke servers
- **Priority:** Nice-to-have, bukan focus MVP

#### Backend Developers
- **Needs:** Multiple terminals untuk services berbeda (API, DB, logs)
- **Value:** Split panes, organized workspace per project
- **Priority:** Akan tercover oleh fitur primary users

---

### User Journey

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  DISCOVERY  │───▶│  ONBOARDING │───▶│  AHA MOMENT │───▶│  DAILY USE  │───▶│  LONG-TERM  │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
      │                  │                  │                  │                  │
      ▼                  ▼                  ▼                  ▼                  ▼
   GitHub            Install &          Restore             Session           Ringan &
   Social           Pick Theme         Session!            Persistence       Nyaman di
   Media            (< 2 min)          + Beautiful         Just Works         Mata
                                        Theme
```

| Stage               | Experience                                                                |
| ------------------- | ------------------------------------------------------------------------- |
| **Discovery**       | Menemukan Connexio via GitHub atau social media creator                   |
| **Onboarding**      | Download, install, pilih theme favorit - under 2 menit                    |
| **Aha! Moment**     | Tutup app, buka lagi → semua tabs + direktori ter-restore! + Theme cantik |
| **Daily Use**       | Buka Connexio setiap hari, langsung produktif tanpa setup                 |
| **Long-term Value** | Terminal ringan, nyaman di mata, jadi "rumah" untuk coding                |

---

## Success Metrics

### User Success Metrics

| Metric                          | Target                         | Measurement                        |
| ------------------------------- | ------------------------------ | ---------------------------------- |
| **Session Restore Reliability** | 100% success rate              | Semua tabs + direktori ter-restore |
| **Zero Setup Time**             | 0 menit setup setelah open app | User langsung produktif            |
| **History Persistence**         | 100% command history tersimpan | Tidak ada data hilang saat close   |
| **Productivity Improvement**    | Hemat 10+ menit/hari           | Waktu setup yang dieliminasi       |

**User Success Indicators:**
- ✅ User membuka Connexio → langsung kerja (tanpa navigasi manual)
- ✅ User menutup app dengan confidence (tau semua akan tersimpan)
- ✅ User tidak pernah kehilangan command history
- ✅ User merasa terminal "nyaman" dan "ringan"

---

### Business Objectives

| Timeframe    | Objective                         | Success Criteria                       |
| ------------ | --------------------------------- | -------------------------------------- |
| **3 Bulan**  | MVP Working + Personal Use Stable | Fitur core berfungsi, dipakai daily    |
| **6 Bulan**  | Public Release Ready              | GitHub repo public, documentation done |
| **12 Bulan** | Community Adoption                | GitHub stars growth, active users      |

**Business Model:** Full Open Source (Free forever)

**Strategic Focus:**
- Community-driven development
- Build in public
- Grow through quality dan word-of-mouth

---

### Key Performance Indicators

| KPI                        | Target (12 bulan) | Priority     |
| -------------------------- | ----------------- | ------------ |
| **GitHub Stars** ⭐        | 500+ stars        | 🔴 Primary   |
| **Daily Personal Use**     | 100% days         | 🔴 Primary   |
| **Community Contributors** | 5+ contributors   | 🟡 Secondary |
| **GitHub Forks**           | 50+ forks         | 🟡 Secondary |
| **Issue Resolution Time**  | < 1 week          | 🟢 Tertiary  |

**North Star Metric:** GitHub Stars
> *"Jika orang-orang memberi star, berarti Connexio memberikan value yang nyata"*

---

### Success Validation

**Personal Success (Founder's Lens):**
- [ ] Saya pakai Connexio setiap hari sebagai terminal utama
- [ ] Session restore selalu bekerja tanpa fail
- [ ] Tidak pernah kembali ke Windows Terminal

**Community Success (User's Lens):**
- [ ] Users memberikan positive feedback
- [ ] GitHub stars terus bertumbuh organically
- [ ] Ada kontributor yang submit PR

---

## MVP Scope

### Core Features (Must Have)

| Feature                       | Description                                        | Success Criteria              |
| ----------------------------- | -------------------------------------------------- | ----------------------------- |
| **Session Persistence**       | Auto-save semua tabs saat close, restore saat open | 100% restore reliability      |
| **Tab Management**            | Buka, close, switch, reorder tabs                  | Smooth, responsive            |
| **Working Directory Restore** | Setiap tab restore ke direktori terakhir           | Correct path setiap waktu     |
| **Command History per Tab**   | History tersimpan per tab, persist across sessions | Tidak ada history yang hilang |
| **Built-in Themes (3-5)**     | Modern themes yang nyaman di mata                  | User puas dengan pilihan      |
| **Stable Terminal Emulator**  | No crash, smooth scrolling, handle heavy output    | 0 crashes dalam daily use     |

### Out of Scope for MVP

| Feature             | Reason                                  | Target Version |
| ------------------- | --------------------------------------- | -------------- |
| Split Panes         | Nice-to-have, tidak blocking core value | v1.1           |
| Snippet Library     | User bisa pakai shell alias sementara   | v1.2           |
| SSH/SFTP Manager    | Bukan prioritas use case                | v2.0           |
| Cloud Sync          | Butuh backend, kompleksitas tinggi      | v2.0           |
| Plugin System       | Premature, fokus core stability dulu    | v2.0           |
| Custom Theme Editor | Built-in themes cukup untuk MVP         | v1.1           |
| AI Integration      | Tidak dalam core vision                 | TBD            |

### MVP Success Criteria

| Criteria                 | Target             | Validation Method           |
| ------------------------ | ------------------ | --------------------------- |
| Session Restore Rate     | 100%               | Daily use testing           |
| Personal Daily Use       | 7 consecutive days | Founder usage log           |
| Crash Rate               | 0 in 1 week        | Error tracking              |
| Theme Satisfaction       | "Nyaman di mata"   | Subjective founder approval |
| Replace Windows Terminal | Tidak buka WT lagi | Behavior observation        |

**Go/No-Go for Public Release:**
- [ ] 2 minggu personal use tanpa critical issues
- [ ] Session restore 100% reliable
- [ ] Minimal 3 themes yang satisfying
- [ ] README dan basic documentation ready

### Future Vision

**Short-term (6-12 bulan):**
- Split panes untuk multi-tasking
- Snippet/command library
- Custom theme editor
- Keyboard shortcut customization

**Medium-term (1-2 tahun):**
- SSH/SFTP connection manager
- Plugin system untuk community extensions
- Cloud sync (optional)
- Cross-platform (macOS, Linux)

**Long-term Vision (2-3 tahun):**
> "Connexio menjadi 'The Warp for Windows' - terminal modern yang menjadi standar baru untuk developer Windows, dengan komunitas aktif dan ekosistem plugin yang berkembang."

**Growth Strategy:**
- Build in public (GitHub, social media)
- Community-first development
- Quality over features
- Organic growth through word-of-mouth

