# Connexio - Project Overview

> **Modern Windows Terminal with Session Persistence**

---

## 📌 Executive Summary

**Connexio** adalah terminal emulator modern untuk Windows yang dirancang untuk mengatasi masalah hilangnya session terminal saat restart atau crash. Aplikasi ini menyediakan fitur auto-save dan restore untuk tabs, working directories, dan command history.

### Key Value Propositions
1. **Session Persistence** - Tidak pernah kehilangan setup terminal lagi
2. **Multi-Tab Support** - Bekerja dengan multiple terminals secara bersamaan
3. **Multi-Shell Support** - PowerShell, CMD, WSL, Git Bash
4. **Theme System** - 5 tema bawaan dengan live preview
5. **Windows Integration** - Explorer context menu, CLI parameters
6. **Zero Configuration** - Works out of the box

---

## 🛠️ Technology Stack

### Frontend Layer

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.1.0 | UI Framework |
| TypeScript | 5.8.3 | Type-safe JavaScript |
| Vite | 7.0.4 | Build tool & dev server |
| Tailwind CSS | 4.1.18 | Utility-first CSS framework |
| Zustand | 5.0.10 | Lightweight state management |
| xterm.js | 6.0.0 | Terminal emulator for web |
| Radix UI | Various | Accessible UI primitives |
| Lucide React | 0.562.0 | Icon library |

### Backend Layer

| Technology | Version | Purpose |
|------------|---------|---------|
| Rust | 2021 Edition | System programming language |
| Tauri | v2.x | Desktop app framework |
| portable-pty | 0.8 | Cross-platform PTY support |
| tokio | 1.x | Async runtime |
| serde | 1.x | Serialization framework |
| parking_lot | 0.12 | High-performance synchronization |

### Build & Deployment

| Technology | Purpose |
|------------|---------|
| Vite | Frontend bundling |
| Cargo | Rust compilation |
| Tauri CLI | App bundling |
| MSI/NSIS | Windows installers |

---

## 📁 Project Structure

```
connexio/
├── src/                          # React Frontend
│   ├── App.tsx                   # Main application component
│   ├── main.tsx                  # React entry point
│   ├── components/               # UI Components
│   │   ├── layout/               # Layout components
│   │   │   ├── MainLayout.tsx    # Main app layout
│   │   │   └── TitleBar.tsx      # Custom window title bar
│   │   ├── terminal/             # Terminal components (planned)
│   │   ├── settings/             # Settings components
│   │   └── ui/                   # Base UI components (shadcn pattern)
│   │       ├── button.tsx
│   │       ├── dialog.tsx
│   │       └── dropdown-menu.tsx
│   ├── hooks/                    # Custom React hooks
│   ├── stores/                   # Zustand stores (planned)
│   ├── lib/                      # Utilities
│   │   ├── tauri.ts              # Tauri API wrappers
│   │   └── utils.ts              # Helper functions
│   ├── types/                    # TypeScript type definitions
│   ├── styles/                   # CSS styles
│   └── assets/                   # Static assets
│
├── src-tauri/                    # Rust Backend
│   ├── src/
│   │   ├── main.rs               # Application entry point
│   │   ├── lib.rs                # Library exports
│   │   ├── commands/             # Tauri IPC commands
│   │   │   ├── mod.rs            # Commands module
│   │   │   └── pty_commands.rs   # PTY-related commands
│   │   └── pty/                  # PTY management
│   │       ├── mod.rs            # PTY module
│   │       ├── manager.rs        # PTY session manager
│   │       └── types.rs          # PTY type definitions
│   ├── Cargo.toml                # Rust dependencies
│   ├── tauri.conf.json           # Tauri configuration
│   ├── capabilities/             # Tauri v2 capabilities
│   └── icons/                    # Application icons
│
├── public/                       # Static public assets
├── dist/                         # Build output (frontend)
│
├── Configuration Files
│   ├── package.json              # npm configuration
│   ├── tsconfig.json             # TypeScript config
│   ├── vite.config.ts            # Vite config
│   ├── tailwind.config.js        # Tailwind config
│   ├── postcss.config.js         # PostCSS config
│   ├── .eslintrc.cjs             # ESLint config
│   └── .prettierrc               # Prettier config
│
├── Scripts
│   ├── dev.bat                   # Development script (Windows)
│   └── build.bat                 # Build script (Windows)
│
└── Documentation
    ├── README.md                 # Project readme
    ├── COMPETITIVE_RESEARCH.md   # Market research
    ├── docs/                     # Generated documentation
    └── _bmad-output/             # BMAD planning artifacts
```

---

## 🎯 Target Platform

- **Operating System:** Windows 10 (1903+) / Windows 11
- **Runtime:** WebView2 (Microsoft Edge Chromium-based)
- **Architecture:** x64

---

## 🔗 Key Dependencies

### Frontend (npm)
```json
{
  "@tauri-apps/api": "^2",
  "@xterm/xterm": "^6.0.0",
  "@xterm/addon-fit": "^0.11.0",
  "@xterm/addon-webgl": "^0.19.0",
  "react": "^19.1.0",
  "zustand": "^5.0.10",
  "@radix-ui/react-dialog": "^1.1.15",
  "@radix-ui/react-dropdown-menu": "^2.1.16"
}
```

### Backend (Cargo)
```toml
[dependencies]
tauri = { version = "2", features = [] }
portable-pty = "0.8"
tokio = { version = "1", features = ["sync", "rt-multi-thread", "time"] }
serde = { version = "1", features = ["derive"] }
uuid = { version = "1", features = ["v4"] }
parking_lot = "0.12"
```

---

## 📊 Project Status

| Aspect | Status |
|--------|--------|
| Project Initialization | ✅ Complete |
| Basic UI Layout | ✅ Complete |
| PTY Backend Setup | ✅ Complete |
| Terminal Integration | 🔄 In Progress |
| Session Persistence | 📋 Planned |
| Theme System | 📋 Planned |
| Multi-Shell Support | 📋 Planned |

---

*Generated by BMad Master Document Project Workflow v1.2.0*
