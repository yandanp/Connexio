# Connexio - Development Guide

> **Setup, development workflow, and common tasks**

---

## 📋 Prerequisites

### Required Software

| Software | Version | Purpose | Installation |
|----------|---------|---------|--------------|
| **Windows** | 10 (1903+) / 11 | Operating System | N/A |
| **Node.js** | 18+ | JavaScript runtime | [nodejs.org](https://nodejs.org/) |
| **Rust** | Latest stable | System language | [rustup.rs](https://rustup.rs/) |
| **Visual Studio 2022** | Latest | C++ Build Tools | [visualstudio.com](https://visualstudio.com/) |
| **WebView2 Runtime** | Latest | Web rendering engine | [microsoft.com](https://developer.microsoft.com/microsoft-edge/webview2/) |

### Visual Studio 2022 Setup

1. Download Visual Studio 2022 Installer
2. Select **"Desktop development with C++"** workload
3. Ensure **"Windows 10/11 SDK"** is included
4. Complete installation

### Verify Installation

```cmd
# Check Node.js
node --version
# Expected: v18.x.x or higher

# Check npm
npm --version
# Expected: 9.x.x or higher

# Check Rust
rustc --version
# Expected: rustc 1.x.x

# Check Cargo
cargo --version
# Expected: cargo 1.x.x
```

---

## 🚀 Getting Started

### 1. Clone Repository

```bash
git clone <repository-url>
cd connexio
```

### 2. Install Dependencies

```bash
# Install npm packages
npm install
```

> **Note:** Cargo dependencies are automatically installed during Tauri build.

### 3. Start Development Server

⚠️ **IMPORTANT:** Use Windows Command Prompt (cmd.exe), NOT PowerShell or Git Bash!

```cmd
# From project root
dev.bat
```

Or using npm directly (requires VS2022 environment):

```cmd
npm run tauri:dev
```

### 4. Access Application

The Tauri development server will:
1. Start Vite dev server on `http://localhost:1420`
2. Compile Rust backend
3. Launch the desktop application

---

## 📁 Project Structure Overview

```
connexio/
├── src/                    # React frontend
├── src-tauri/              # Rust backend
├── docs/                   # Documentation
├── dev.bat                 # Development script
├── build.bat               # Build script
└── package.json            # npm configuration
```

See [Source Tree Analysis](./source-tree-analysis.md) for detailed structure.

---

## 🛠️ Development Workflow

### Frontend Development

```bash
# Start Vite dev server only (no Tauri)
npm run dev

# Type checking
npx tsc --noEmit

# Linting
npm run lint

# Auto-fix lint issues
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check
```

### Backend Development

```bash
# Check Rust code
cd src-tauri
cargo check

# Run clippy linter
cargo clippy

# Format Rust code
cargo fmt

# Build release
cargo build --release
```

### Full Stack Development

```cmd
# Start complete development environment
dev.bat

# OR with VS Developer Command Prompt
npm run tauri:dev
```

---

## 📜 Available NPM Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `vite` | Start Vite dev server |
| `build` | `tsc && vite build` | Build frontend |
| `preview` | `vite preview` | Preview production build |
| `tauri` | `tauri` | Run Tauri CLI |
| `tauri:dev` | `tauri dev` | Start Tauri development |
| `tauri:build` | `tauri build` | Build production app |
| `lint` | `eslint .` | Run ESLint |
| `lint:fix` | `eslint . --fix` | Fix lint issues |
| `format` | `prettier --write` | Format code |
| `format:check` | `prettier --check` | Check formatting |

---

## 🏗️ Building for Production

### Using Build Script (Recommended)

```cmd
# From project root
build.bat
```

### Using npm

```cmd
# Requires VS2022 environment
npm run tauri:build
```

### Build Output

Installers are generated in:
```
src-tauri/target/release/bundle/
├── msi/           # MSI installer
│   └── Connexio_0.1.0_x64.msi
└── nsis/          # NSIS installer
    └── Connexio_0.1.0_x64-setup.exe
```

---

## 🧪 Testing

### Frontend Testing

```bash
# Run tests (when configured)
npm test

# Run tests in watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Backend Testing

```bash
cd src-tauri

# Run Rust tests
cargo test

# Run tests with output
cargo test -- --nocapture
```

---

## 🔧 Configuration Files

### TypeScript (`tsconfig.json`)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "jsx": "react-jsx",
    "strict": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Vite (`vite.config.ts`)

- Path aliases: `@/` → `./src/`
- Port: `1420` (fixed for Tauri)
- HMR: Enabled
- Watch: Excludes `src-tauri/`

### Tailwind (`tailwind.config.js`)

- Content: `./index.html`, `./src/**/*.{js,ts,jsx,tsx}`
- Custom colors: CSS variables (theming support)
- Terminal-specific colors: `terminal-bg`, `terminal-fg`

### Tauri (`src-tauri/tauri.conf.json`)

```json
{
  "productName": "Connexio",
  "version": "0.1.0",
  "identifier": "com.connexio.app",
  "build": {
    "devUrl": "http://localhost:1420",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [{
      "title": "Connexio",
      "width": 1200,
      "height": 800,
      "decorations": false,
      "resizable": true
    }]
  }
}
```

---

## 📝 Code Style Guidelines

### TypeScript/React

- Use functional components with hooks
- Use TypeScript strict mode
- Follow ESLint rules
- Use Prettier for formatting
- Prefer `@/` path aliases

### Rust

- Follow Rust naming conventions
- Use `clippy` for linting
- Use `cargo fmt` for formatting
- Document public APIs
- Handle all `Result` and `Option` types

### CSS/Tailwind

- Use Tailwind utility classes
- Use CSS custom properties for theming
- Avoid custom CSS when possible
- Follow component-first organization

---

## 🐛 Debugging

### Frontend Debugging

1. Open DevTools in Tauri window (right-click → Inspect)
2. Use React Developer Tools extension
3. Check console for errors
4. Use breakpoints in source panel

### Backend Debugging

```bash
# Enable Rust logging
set RUST_LOG=debug
npm run tauri:dev

# View logs in terminal output
```

### Common Issues

| Issue | Solution |
|-------|----------|
| "MSVC not found" | Run from VS Developer Command Prompt |
| "WebView2 not found" | Install WebView2 Runtime |
| Port 1420 in use | Kill process using port |
| Rust compilation fails | Check VS2022 C++ tools installed |

---

## 🔄 Hot Module Replacement (HMR)

- **Frontend:** Vite HMR enabled by default
- **Backend:** Requires restart for Rust changes
- **Tauri Commands:** Restart Tauri dev server

---

## 📦 Adding Dependencies

### npm Packages

```bash
# Add runtime dependency
npm install <package-name>

# Add dev dependency
npm install -D <package-name>
```

### Rust Crates

```bash
cd src-tauri

# Add dependency
cargo add <crate-name>

# Add dev dependency
cargo add <crate-name> --dev
```

---

## 🔗 Useful Resources

- [Tauri Documentation](https://tauri.app/v1/guides/)
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [xterm.js Documentation](https://xtermjs.org/)
- [Rust Book](https://doc.rust-lang.org/book/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

---

*Generated by BMad Master Document Project Workflow v1.2.0*
