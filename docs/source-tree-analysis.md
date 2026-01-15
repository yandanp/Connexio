# Connexio - Source Tree Analysis

> **Annotated directory structure with purpose and integration points**

---

## 📁 Complete Source Tree

```
connexio/                              # Project root
│
├── 📄 Configuration Files
│   ├── package.json                   # npm configuration, scripts, dependencies
│   ├── package-lock.json              # npm lock file
│   ├── tsconfig.json                  # TypeScript compiler options
│   ├── tsconfig.node.json             # TypeScript config for Node.js tooling
│   ├── vite.config.ts                 # Vite build configuration
│   ├── tailwind.config.js             # Tailwind CSS configuration
│   ├── postcss.config.js              # PostCSS plugins configuration
│   ├── .eslintrc.cjs                  # ESLint rules
│   ├── .prettierrc                    # Prettier formatting rules
│   ├── components.json                # shadcn/ui component configuration
│   └── .gitignore                     # Git ignore patterns
│
├── 📜 Scripts
│   ├── dev.bat                        # ⭐ Development script (Windows CMD)
│   └── build.bat                      # ⭐ Production build script (Windows CMD)
│
├── 📚 Documentation
│   ├── README.md                      # Project readme and setup guide
│   ├── COMPETITIVE_RESEARCH.md        # Market research document
│   └── docs/                          # 📁 Generated documentation (this folder)
│       ├── index.md                   # Documentation index
│       ├── project-overview.md        # Project overview
│       ├── architecture.md            # Architecture documentation
│       ├── source-tree-analysis.md    # This file
│       ├── development-guide.md       # Development guide
│       ├── component-inventory.md     # UI component catalog
│       ├── deployment-guide.md        # Build & deployment guide
│       └── project-scan-report.json   # Scan state file
│
├── 🌐 Frontend (src/)                 # React + TypeScript frontend
│   │
│   ├── main.tsx                       # ⭐ React entry point
│   ├── App.tsx                        # Root application component
│   ├── App.css                        # Root component styles
│   ├── vite-env.d.ts                  # Vite type declarations
│   │
│   ├── components/                    # 📁 UI Components
│   │   │
│   │   ├── layout/                    # Layout components
│   │   │   ├── index.ts               # Barrel exports
│   │   │   ├── MainLayout.tsx         # ⭐ Main app layout structure
│   │   │   └── TitleBar.tsx           # Custom window title bar
│   │   │
│   │   ├── terminal/                  # Terminal components (planned)
│   │   │   └── (future files)         # TerminalView, TerminalTabs, etc.
│   │   │
│   │   ├── settings/                  # Settings components
│   │   │   └── (future files)         # SettingsDialog, ThemeSelector, etc.
│   │   │
│   │   └── ui/                        # Base UI components (shadcn pattern)
│   │       ├── index.ts               # Barrel exports
│   │       ├── button.tsx             # Button component (CVA + Radix)
│   │       ├── dialog.tsx             # Dialog/Modal component
│   │       └── dropdown-menu.tsx      # Dropdown menu component
│   │
│   ├── hooks/                         # 📁 Custom React hooks
│   │   └── (future files)             # useTerminal, useSession, etc.
│   │
│   ├── stores/                        # 📁 Zustand state stores (planned)
│   │   └── (future files)             # terminalStore, settingsStore, etc.
│   │
│   ├── lib/                           # 📁 Utility functions
│   │   ├── tauri.ts                   # Tauri API wrappers
│   │   └── utils.ts                   # General utilities (cn, etc.)
│   │
│   ├── types/                         # 📁 TypeScript type definitions
│   │   └── (future files)             # Terminal types, Settings types, etc.
│   │
│   ├── styles/                        # 📁 CSS stylesheets
│   │   └── (global styles)            # Global CSS, theme variables
│   │
│   └── assets/                        # 📁 Static assets
│       └── (images, fonts)            # Logo, icons, etc.
│
├── 🦀 Backend (src-tauri/)            # Rust + Tauri backend
│   │
│   ├── Cargo.toml                     # ⭐ Rust dependencies and metadata
│   ├── Cargo.lock                     # Cargo lock file
│   ├── build.rs                       # Build script (Tauri build hooks)
│   ├── tauri.conf.json                # ⭐ Tauri application configuration
│   ├── .gitignore                     # Rust-specific gitignore
│   │
│   ├── src/                           # 📁 Rust source code
│   │   │
│   │   ├── main.rs                    # ⭐ Application entry point
│   │   ├── lib.rs                     # Library crate entry
│   │   │
│   │   ├── commands/                  # 📁 Tauri IPC commands
│   │   │   ├── mod.rs                 # Module exports
│   │   │   └── pty_commands.rs        # ⭐ PTY command handlers
│   │   │                              #    - create_pty()
│   │   │                              #    - write_pty()
│   │   │                              #    - resize_pty()
│   │   │                              #    - close_pty()
│   │   │
│   │   └── pty/                       # 📁 PTY management
│   │       ├── mod.rs                 # Module exports
│   │       ├── manager.rs             # ⭐ PtyManager - session handling
│   │       └── types.rs               # PTY type definitions
│   │
│   ├── capabilities/                  # 📁 Tauri v2 capabilities
│   │   └── default.json               # Default capability permissions
│   │
│   ├── icons/                         # 📁 Application icons
│   │   ├── icon.ico                   # Windows icon
│   │   ├── icon.icns                  # macOS icon
│   │   ├── icon.png                   # PNG source
│   │   ├── 32x32.png                  # Small icon
│   │   ├── 128x128.png                # Medium icon
│   │   ├── 128x128@2x.png             # Retina icon
│   │   └── Square*.png                # Windows Store icons
│   │
│   ├── target/                        # 📁 Build output (gitignored)
│   │   ├── debug/                     # Debug builds
│   │   └── release/                   # Release builds
│   │       └── bundle/                # ⭐ Installer output
│   │
│   └── .cargo/                        # 📁 Cargo configuration
│       └── config.toml                # Cargo build settings
│
├── 🌐 Static Files
│   ├── index.html                     # ⭐ HTML entry point
│   └── public/                        # 📁 Public static assets
│       └── (favicon, manifest, etc.)
│
├── 📦 Dependencies
│   ├── node_modules/                  # 📁 npm packages (gitignored)
│   └── dist/                          # 📁 Vite build output (gitignored)
│
├── 🔧 IDE Configuration
│   └── .vscode/                       # 📁 VS Code settings
│       └── (settings, extensions)
│
└── 📋 BMAD Artifacts
    ├── _bmad/                         # 📁 BMAD framework files
    │   ├── core/                      # Core BMAD components
    │   └── bmm/                       # BMM module components
    │
    └── _bmad-output/                  # 📁 BMAD generated artifacts
        ├── planning-artifacts/        # Planning documents
        │   ├── prd.md                 # Product Requirements Document
        │   ├── architecture.md        # Architecture design
        │   ├── epics.md               # Epic breakdown
        │   ├── ux-design-specification.md
        │   ├── product-brief-*.md
        │   └── bmm-workflow-status.yaml
        │
        └── implementation-artifacts/  # Implementation docs
            └── 1-1-*.md               # Task implementation notes
```

---

## 🔑 Key Entry Points

| File | Purpose | Called By |
|------|---------|-----------|
| `index.html` | HTML shell for React app | WebView2 |
| `src/main.tsx` | React DOM render entry | index.html |
| `src/App.tsx` | Root React component | main.tsx |
| `src-tauri/src/main.rs` | Rust application entry | Tauri runtime |
| `src-tauri/src/lib.rs` | Library exports | main.rs |

---

## 🔗 Critical Integration Points

### Frontend ↔ Backend (Tauri IPC)

| Frontend Location | Backend Handler | Purpose |
|-------------------|-----------------|---------|
| `src/lib/tauri.ts` | `src/commands/*.rs` | All Tauri command invocations |
| Event listeners | `emit()` calls | PTY output streaming |

### Frontend ↔ Terminal (xterm.js)

| Component | xterm.js API | Purpose |
|-----------|--------------|---------|
| `TerminalView` (planned) | `Terminal.write()` | Display output |
| `TerminalView` (planned) | `Terminal.onData()` | Capture input |
| `TerminalView` (planned) | `FitAddon.fit()` | Auto-resize |

### Backend ↔ OS (ConPTY)

| Rust Module | OS API | Purpose |
|-------------|--------|---------|
| `pty/manager.rs` | `portable-pty` → ConPTY | Create/manage PTY |
| `commands/pty_commands.rs` | PTY read/write | I/O operations |

---

## 📊 File Statistics

| Category | Count | Notes |
|----------|-------|-------|
| TypeScript/TSX Files | ~10 | Frontend source |
| Rust Files | 6 | Backend source |
| Configuration Files | 10+ | Various configs |
| Documentation Files | 10+ | Including BMAD artifacts |

---

## 🏷️ Directory Purposes

| Directory | Purpose | Key Files |
|-----------|---------|-----------|
| `src/components/layout` | App layout & chrome | MainLayout, TitleBar |
| `src/components/ui` | Base UI primitives | button, dialog |
| `src/lib` | Shared utilities | tauri.ts, utils.ts |
| `src-tauri/src/commands` | IPC command handlers | pty_commands.rs |
| `src-tauri/src/pty` | PTY session management | manager.rs, types.rs |
| `src-tauri/icons` | App icons | All icon formats |
| `docs` | Generated documentation | All *.md files |
| `_bmad-output` | Planning artifacts | prd.md, architecture.md |

---

*Generated by BMad Master Document Project Workflow v1.2.0*
