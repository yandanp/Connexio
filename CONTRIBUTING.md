# Contributing to Connexio

Thanks for your interest in contributing to Connexio! This guide will help you get started.

## 📋 Table of Contents

- [Development Setup](#development-setup)
- [Project Architecture](#project-architecture)
- [Workflow](#workflow)
- [Commit Convention](#commit-convention)
- [Code Guidelines](#code-guidelines)
- [Submitting a Pull Request](#submitting-a-pull-request)

## 🛠️ Development Setup

### Prerequisites

| Tool          | Version       | Install                           |
| ------------- | ------------- | --------------------------------- |
| **Node.js**   | 18+           | [nodejs.org](https://nodejs.org/) |
| **Rust**      | Latest stable | [rustup.rs](https://rustup.rs/)   |
| **Tauri CLI** | 2.x           | Included in devDependencies       |

### Platform-specific Dependencies

**Windows:**

- [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (pre-installed on Windows 10/11)
- Visual Studio C++ Build Tools

**macOS:**

```bash
xcode-select --install
```

**Linux (Debian/Ubuntu):**

```bash
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

### Getting Started

```bash
# 1. Fork the repo on GitHub, then clone your fork
git clone https://github.com/<your-username>/Connexio.git
cd Connexio

# 2. Add upstream remote
git remote add upstream https://github.com/yandanp/Connexio.git

# 3. Install frontend dependencies
npm install

# 4. Start development mode (frontend + Rust backend with hot-reload)
npm run dev
```

> **Note:** The first `npm run dev` will compile the Rust backend which may take a few minutes. Subsequent runs are much faster due to incremental compilation.

### Useful Commands

| Command                | Description                                               |
| ---------------------- | --------------------------------------------------------- |
| `npm run dev`          | Start Tauri dev mode (hot-reload frontend + Rust backend) |
| `npm run dev:renderer` | Start Vite dev server only (frontend)                     |
| `npm run build`        | Build frontend for production                             |
| `npm run build:tauri`  | Build full Tauri app (installer)                          |
| `npm run typecheck`    | Type-check all TypeScript                                 |

## 🏗️ Project Architecture

```
Connexio/
├── src/renderer/        # React frontend (TypeScript)
│   ├── components/      # UI components
│   ├── stores/          # Zustand state management
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utility functions
│   └── types/           # TypeScript declarations
├── src/shared/          # Shared types (frontend ↔ backend)
├── src-tauri/           # Rust backend
│   ├── src/
│   │   ├── main.rs      # App entry point
│   │   ├── lib.rs       # Plugin & command registration
│   │   └── modules/     # Feature modules (pty, git, ssh, etc.)
│   └── Cargo.toml       # Rust dependencies
└── .github/workflows/   # CI/CD
```

**Key technologies:**

- **Frontend:** React 18, TypeScript, Tailwind CSS, Zustand, xterm.js, CodeMirror 6
- **Backend:** Rust, Tauri v2, portable-pty
- **Build:** Vite, Tauri CLI

## 🔄 Workflow

1. **Sync with upstream** before starting work:

   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```

2. **Create a feature branch:**

   ```bash
   git checkout -b feat/your-feature-name
   # or
   git checkout -b fix/issue-description
   ```

3. **Make your changes** — keep commits focused and atomic.

4. **Test your changes:**
   - Run `npm run typecheck` to ensure no type errors
   - Run `npm run dev` and manually verify the feature works
   - Test on your platform (Windows/macOS/Linux)

5. **Push and open a PR** against `main`.

## 📝 Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix      | Usage                                 |
| ----------- | ------------------------------------- |
| `feat:`     | New feature                           |
| `fix:`      | Bug fix                               |
| `refactor:` | Code refactoring (no behavior change) |
| `docs:`     | Documentation only                    |
| `style:`    | Formatting, missing semicolons, etc.  |
| `perf:`     | Performance improvement               |
| `test:`     | Adding or updating tests              |
| `ci:`       | CI/CD changes                         |
| `chore:`    | Maintenance, dependency updates       |

**Examples:**

```
feat: add split terminal support
fix: terminal not resizing on window resize
refactor: extract shell detection into separate module
docs: update contributing guide
```

## 💻 Code Guidelines

### TypeScript (Frontend)

- Use functional components with hooks
- Use TypeScript strict mode — avoid `any`
- State management via Zustand stores (see `src/renderer/stores/`)
- Use Tailwind CSS for styling — avoid inline styles
- Keep components focused and reasonably sized

### Rust (Backend)

- Follow standard Rust conventions (`cargo fmt`, `cargo clippy`)
- Each feature module lives in `src-tauri/src/modules/`
- Use `tauri::command` for IPC between frontend and backend
- Handle errors properly — avoid `.unwrap()` in production code
- Use `serde` for serialization between Rust and TypeScript

### General

- No unused imports or dead code
- Keep PRs focused — one feature or fix per PR
- Add comments for complex logic
- Update documentation if your change affects the public API or user-facing behavior

## 🚀 Submitting a Pull Request

1. Ensure your branch is up to date with `main`
2. Run `npm run typecheck` — fix any errors
3. Fill out the PR template completely
4. Link any related issues (e.g., `Closes #42`)
5. Add screenshots/recordings for UI changes
6. Be responsive to review feedback

### PR Size Guidelines

- **Small** (preferred): < 200 lines changed
- **Medium**: 200–500 lines — provide clear description
- **Large**: 500+ lines — consider splitting into smaller PRs

## 🐛 Reporting Bugs

Use the [Bug Report](https://github.com/yandanp/Connexio/issues/new?template=bug_report.md) issue template. Include:

- Steps to reproduce
- Expected vs actual behavior
- Platform and version info
- Screenshots if applicable

## 💡 Requesting Features

Use the [Feature Request](https://github.com/yandanp/Connexio/issues/new?template=feature_request.md) issue template. Describe:

- The problem you're trying to solve
- Your proposed solution
- Any alternatives you've considered

## ❓ Questions?

Open a [Discussion](https://github.com/yandanp/Connexio/discussions) or reach out via issues.

---

Thank you for contributing to Connexio! 🎉
