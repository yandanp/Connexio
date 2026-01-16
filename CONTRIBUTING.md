# Contributing to Connexio

First off, thank you for considering contributing to Connexio! It's people like you that make Connexio such a great tool.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally
3. Set up the development environment (see below)
4. Create a branch for your changes
5. Make your changes
6. Push to your fork and submit a pull request

## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [Rust](https://www.rust-lang.org/tools/install) (latest stable)
- [pnpm](https://pnpm.io/) (recommended) or npm

### Installation

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/Connexio.git
cd Connexio

# Install dependencies
pnpm install

# Run in development mode
pnpm tauri:dev
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start Vite dev server (web only) |
| `pnpm tauri:dev` | Start Tauri development mode |
| `pnpm build` | Build for production |
| `pnpm tauri:build` | Build Tauri application |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Run TypeScript type checking |

## Making Changes

### Branch Naming

Use descriptive branch names:

- `feat/split-pane-support` - New features
- `fix/terminal-flickering` - Bug fixes
- `docs/update-readme` - Documentation
- `refactor/session-store` - Code refactoring

### Code Style

- Use TypeScript for all new code
- Follow existing code patterns and conventions
- Use meaningful variable and function names
- Add comments for complex logic
- Keep components small and focused

## Commit Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Code style (formatting, semicolons, etc.) |
| `refactor` | Code refactoring |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `chore` | Maintenance tasks |

### Examples

```bash
feat(terminal): add split pane support
fix(webgl): resolve flickering on app open
docs(readme): update installation instructions
refactor(store): simplify session management
```

## Pull Request Process

1. **Update your branch** with the latest main:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Ensure your code works**:
   ```bash
   pnpm typecheck
   pnpm lint
   pnpm build
   ```

3. **Write a clear PR description**:
   - What changes were made
   - Why the changes were made
   - Any breaking changes
   - Screenshots for UI changes

4. **Wait for review** - maintainers will review your PR and may request changes

5. **Address feedback** - make requested changes and push to your branch

### PR Checklist

- [ ] Code follows the project's style guidelines
- [ ] Self-reviewed the code
- [ ] Added comments for complex code
- [ ] Updated documentation if needed
- [ ] No new warnings or errors
- [ ] Tested the changes locally

## Reporting Bugs

Before creating a bug report, please check if the issue already exists.

### Bug Report Should Include

- **Clear title** describing the issue
- **Steps to reproduce** the behavior
- **Expected behavior** - what should happen
- **Actual behavior** - what actually happens
- **Screenshots** if applicable
- **Environment info**:
  - OS and version
  - Connexio version
  - Any relevant configuration

## Suggesting Features

We love feature suggestions! Please include:

- **Clear description** of the feature
- **Use case** - why is this feature needed?
- **Possible implementation** (optional)
- **Alternatives considered** (optional)

---

## Questions?

Feel free to open an issue with the "question" label if you have any questions about contributing.

Thank you for contributing! 🎉
