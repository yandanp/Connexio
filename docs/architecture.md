# Connexio - Architecture Documentation

> **Desktop Application Architecture - Tauri v2 Hybrid App**

---

## 📋 Architecture Overview

Connexio menggunakan arsitektur **hybrid desktop application** dengan Tauri v2 framework. Arsitektur ini menggabungkan:
- **Frontend berbasis web** (React + TypeScript) yang berjalan di WebView2
- **Backend native** (Rust) yang menangani system-level operations

### Architecture Pattern: **Layered Hybrid Architecture**

```
┌─────────────────────────────────────────────────────────────────┐
│                       PRESENTATION LAYER                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    React + TypeScript                      │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐  │  │
│  │  │  Components │ │   Stores    │ │      Hooks          │  │  │
│  │  │  (UI)       │ │  (Zustand)  │ │ (State/Effects)     │  │  │
│  │  └─────────────┘ └─────────────┘ └─────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              ↕ Tauri IPC                         │
├─────────────────────────────────────────────────────────────────┤
│                       APPLICATION LAYER                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                      Rust Backend                          │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │               Tauri Commands Module                  │  │  │
│  │  │  ┌─────────────┐ ┌──────────────────────────────┐   │  │  │
│  │  │  │ PTY Commands│ │ Session Commands (planned)   │   │  │  │
│  │  │  └─────────────┘ └──────────────────────────────┘   │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                       INFRASTRUCTURE LAYER                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                     PTY Manager                            │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │         portable-pty + Windows ConPTY                │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                       OPERATING SYSTEM                           │
│                    Windows 10/11 (ConPTY API)                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🏗️ Component Architecture

### Frontend Components

```
src/
├── App.tsx                     # Root component
├── main.tsx                    # React DOM entry
└── components/
    ├── layout/                 # Layout Components
    │   ├── MainLayout.tsx      # Main application layout
    │   └── TitleBar.tsx        # Custom frameless title bar
    │
    ├── terminal/               # Terminal Components (planned)
    │   ├── TerminalView.tsx    # xterm.js wrapper
    │   ├── TerminalTabs.tsx    # Tab management
    │   └── TerminalSession.tsx # Session container
    │
    ├── settings/               # Settings Components
    │   └── SettingsDialog.tsx  # Settings modal
    │
    └── ui/                     # Base UI (shadcn pattern)
        ├── button.tsx          # Button component
        ├── dialog.tsx          # Dialog component
        └── dropdown-menu.tsx   # Dropdown menu
```

### Backend Modules

```
src-tauri/src/
├── main.rs                     # Application entry point
├── lib.rs                      # Library exports
│
├── commands/                   # Tauri IPC Commands
│   ├── mod.rs                  # Module exports
│   └── pty_commands.rs         # PTY-related commands
│       ├── create_pty()        # Create new PTY session
│       ├── write_pty()         # Write to PTY
│       ├── read_pty()          # Read from PTY
│       ├── resize_pty()        # Resize terminal
│       └── close_pty()         # Close PTY session
│
└── pty/                        # PTY Management
    ├── mod.rs                  # Module exports
    ├── manager.rs              # PTY session manager
    │   └── PtyManager          # Manages multiple PTY sessions
    └── types.rs                # Type definitions
        ├── PtySession          # Individual session type
        └── PtyConfig           # Configuration type
```

---

## 🔄 Data Flow

### Terminal Input Flow

```
User Keyboard Input
        ↓
    [xterm.js] ← Captures keystrokes
        ↓
    [React Component] ← onData callback
        ↓
    [Tauri invoke()] ← IPC call
        ↓
    [pty_commands::write_pty] ← Rust handler
        ↓
    [PtyManager] ← Routes to session
        ↓
    [portable-pty] ← Write to PTY
        ↓
    [Windows ConPTY] ← OS-level PTY
        ↓
    [Shell Process] ← PowerShell/CMD/etc
```

### Terminal Output Flow

```
Shell Process Output
        ↓
    [Windows ConPTY] ← OS captures output
        ↓
    [portable-pty] ← Read from PTY
        ↓
    [PtyManager] ← Async reader
        ↓
    [Tauri Event] ← Emit to frontend
        ↓
    [React Component] ← Event listener
        ↓
    [xterm.js] ← write() to terminal
        ↓
    Display to User
```

---

## 🗂️ State Management

### Frontend State (Zustand)

```typescript
// Planned store structure
interface TerminalStore {
  sessions: Map<string, TerminalSession>;
  activeSessionId: string | null;
  
  // Actions
  createSession: (shell: ShellType) => Promise<string>;
  closeSession: (id: string) => void;
  setActiveSession: (id: string) => void;
}

interface SettingsStore {
  theme: ThemeName;
  fontSize: number;
  fontFamily: string;
  
  // Actions
  updateTheme: (theme: ThemeName) => void;
  updateFont: (settings: FontSettings) => void;
}
```

### Backend State (Rust)

```rust
// PTY Manager state
pub struct PtyManager {
    sessions: Arc<RwLock<HashMap<Uuid, PtySession>>>,
}

pub struct PtySession {
    id: Uuid,
    master: Box<dyn MasterPty + Send>,
    child: Box<dyn portable_pty::Child + Send>,
    shell_type: ShellType,
    cwd: PathBuf,
}
```

---

## 🔌 IPC Communication

### Tauri Commands (Frontend → Backend)

| Command | Parameters | Return | Description |
|---------|------------|--------|-------------|
| `create_pty` | `shell: String, cwd: String` | `String (session_id)` | Create new PTY |
| `write_pty` | `id: String, data: String` | `()` | Write to PTY |
| `resize_pty` | `id: String, cols: u16, rows: u16` | `()` | Resize terminal |
| `close_pty` | `id: String` | `()` | Close PTY |

### Tauri Events (Backend → Frontend)

| Event | Payload | Description |
|-------|---------|-------------|
| `pty-output-{id}` | `String` | Terminal output data |
| `pty-exit-{id}` | `i32` | Process exit code |
| `pty-error-{id}` | `String` | Error message |

---

## 🎨 UI Architecture

### Design System

- **Component Library:** Radix UI primitives with custom styling
- **Styling:** Tailwind CSS with CSS custom properties for theming
- **Icons:** Lucide React
- **Layout:** Flexbox-based responsive layout

### Theme System

```css
/* CSS Custom Properties for theming */
:root {
  --background: /* hsl value */;
  --foreground: /* hsl value */;
  --primary: /* hsl value */;
  --terminal-bg: /* hsl value */;
  --terminal-fg: /* hsl value */;
}
```

### Window Management

- **Frameless Window:** Custom title bar with drag region
- **Window Controls:** Minimize, Maximize, Close buttons
- **Resizable:** Yes, with minimum size constraints (800x600)

---

## 📦 Build & Distribution

### Build Pipeline

```
Source Files
    ↓
[TypeScript Compiler] → Type checking
    ↓
[Vite] → Bundle frontend assets
    ↓
[Cargo] → Compile Rust backend
    ↓
[Tauri Bundler] → Package application
    ↓
Installers (MSI, NSIS)
```

### Distribution Formats

| Format | Description |
|--------|-------------|
| MSI | Windows Installer package |
| NSIS | Nullsoft Scriptable Install System |

---

## 🔐 Security Considerations

### Tauri Security Model

- **CSP:** Configurable Content Security Policy (currently null for development)
- **Capabilities:** Tauri v2 granular permissions system
- **IPC Security:** Type-safe command invocation

### PTY Security

- **Process Isolation:** Each PTY runs in separate process
- **User Context:** Inherits current user permissions
- **No Elevation:** Does not require admin rights by default

---

## 📈 Performance Considerations

### Frontend Optimization

- **WebGL Renderer:** xterm.js uses WebGL for GPU-accelerated rendering
- **Virtual Scrolling:** Terminal uses efficient virtual scrolling
- **Debounced Resize:** Window resize events are debounced

### Backend Optimization

- **Async I/O:** Tokio for non-blocking PTY operations
- **Connection Pooling:** Reuse PTY sessions across tabs
- **Efficient Mutexes:** parking_lot for faster locking

---

## 🔮 Future Considerations

### Planned Architecture Extensions

1. **Session Persistence Layer**
   - SQLite/JSON storage for session state
   - Auto-save on interval and window close
   - Restore on application start

2. **Plugin System**
   - Dynamic extension loading
   - Custom shell integration
   - Theme marketplace

3. **Multi-Window Support**
   - Detachable tabs
   - Multiple window instances
   - Cross-window session sharing

---

*Generated by BMad Master Document Project Workflow v1.2.0*
