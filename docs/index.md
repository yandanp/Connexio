# Connexio - Project Documentation Index

> **Modern Windows Terminal with Session Persistence**

*Documentation generated: 2026-01-14*  
*Scan Level: Quick Scan (pattern-based analysis)*

---

## 📋 Project Overview

| Aspect | Details |
|--------|---------|
| **Project Name** | Connexio |
| **Version** | 0.1.0 |
| **Type** | Desktop Application (Monolith) |
| **Primary Language** | TypeScript + Rust |
| **Architecture** | Tauri v2 (Hybrid Desktop App) |

### Quick Reference

- **Frontend Stack:** React 19.1.0 + TypeScript 5.8.3 + Tailwind CSS 4.1.18
- **Backend Stack:** Rust 2021 Edition + Tauri v2
- **Terminal:** xterm.js 6.0.0 with WebGL acceleration
- **State Management:** Zustand 5.0.10
- **Build Targets:** Windows (MSI, NSIS)
- **Entry Points:** 
  - Frontend: `src/main.tsx`
  - Backend: `src-tauri/src/main.rs`

---

## 📚 Generated Documentation

### Core Documentation
- [Project Overview](./project-overview.md)
- [Architecture](./architecture.md)
- [Source Tree Analysis](./source-tree-analysis.md)
- [Development Guide](./development-guide.md)

### Component Documentation
- [UI Component Inventory](./component-inventory.md)
- [State Management Patterns](./state-management.md) _(To be generated)_

### Build & Deployment
- [Deployment Guide](./deployment-guide.md)

---

## 📁 Existing Documentation

### Project Root
- [README.md](../README.md) - Project overview, setup, and usage instructions
- [COMPETITIVE_RESEARCH.md](../COMPETITIVE_RESEARCH.md) - Market and competitor analysis

### Planning Artifacts (`_bmad-output/planning-artifacts/`)
- [Product Requirements Document](../_bmad-output/planning-artifacts/prd.md) - Detailed product requirements
- [Architecture Document](../_bmad-output/planning-artifacts/architecture.md) - System architecture design
- [Epic Breakdown](../_bmad-output/planning-artifacts/epics.md) - Feature epics and user stories
- [UX Design Specification](../_bmad-output/planning-artifacts/ux-design-specification.md) - UI/UX design guidelines
- [Product Brief](../_bmad-output/planning-artifacts/product-brief-Connexio-2026-01-14.md) - Product vision and goals
- [Project Notes](../_bmad-output/planning-artifacts/connexio-notes.md) - Additional notes and decisions

### Implementation Artifacts (`_bmad-output/implementation-artifacts/`)
- [Task 1-1: Initialize Tauri Project](../_bmad-output/implementation-artifacts/1-1-initialize-tauri-project-with-react-template.md) - Initial setup documentation

---

## 🚀 Getting Started

### Prerequisites
1. **Windows 10 (1903+) or Windows 11**
2. **Node.js 18+** - [Download](https://nodejs.org/)
3. **Rust (via rustup)** - [Download](https://rustup.rs/)
4. **Visual Studio 2022** with "Desktop development with C++" workload
5. **WebView2 Runtime** (usually pre-installed on Windows 10/11)

### Quick Start
```bash
# Install dependencies
npm install

# Run development server (use Windows Command Prompt, not PowerShell/Git Bash)
dev.bat

# Or build for production
build.bat
```

### Development Commands
| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Build TypeScript and Vite |
| `npm run tauri:dev` | Start Tauri development |
| `npm run tauri:build` | Build production installer |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |

---

## 🏗️ Architecture Summary

Connexio is a **hybrid desktop application** built with Tauri v2:

```
┌─────────────────────────────────────────────────────────────┐
│                    Connexio Application                      │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  Frontend (WebView2)                  │   │
│  │  ┌─────────────────────────────────────────────────┐ │   │
│  │  │           React 19 + TypeScript                  │ │   │
│  │  │  ┌─────────┐  ┌─────────┐  ┌─────────────────┐  │ │   │
│  │  │  │ xterm.js│  │ Zustand │  │ Radix UI + TW   │  │ │   │
│  │  │  │Terminal │  │ State   │  │ Components      │  │ │   │
│  │  │  └─────────┘  └─────────┘  └─────────────────┘  │ │   │
│  │  └─────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ↕ IPC (Tauri Commands)             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  Backend (Rust)                       │   │
│  │  ┌─────────────────────────────────────────────────┐ │   │
│  │  │              Tauri v2 Framework                  │ │   │
│  │  │  ┌──────────────┐  ┌─────────────────────────┐  │ │   │
│  │  │  │ PTY Manager  │  │ Tauri Commands          │  │ │   │
│  │  │  │ (ConPTY)     │  │ (pty_commands)          │  │ │   │
│  │  │  └──────────────┘  └─────────────────────────┘  │ │   │
│  │  └─────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                    Windows OS (ConPTY API)                   │
└─────────────────────────────────────────────────────────────┘
```

### Key Integration Points
- **Frontend ↔ Backend:** Tauri IPC Commands
- **Backend ↔ OS:** Windows ConPTY via `portable-pty` crate
- **UI ↔ Terminal:** xterm.js rendering with WebGL acceleration

---

## 📊 Project Statistics

| Category | Count |
|----------|-------|
| Frontend Source Files | ~20+ files |
| Backend Source Files | 6 files |
| UI Components | 4 component directories |
| Dependencies (npm) | 17 runtime, 14 dev |
| Dependencies (Cargo) | 12 crates |

---

## 📞 Support

- **IDE Setup:** VS Code with Tauri + rust-analyzer extensions
- **Development Notes:** Use `dev.bat` from Windows Command Prompt
- **Build Output:** `src-tauri/target/release/bundle/`

---

*Generated by BMad Master Document Project Workflow v1.2.0*
