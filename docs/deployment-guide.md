# Connexio - Deployment Guide

> **Building, packaging, and distributing the application**

---

## 📋 Overview

Connexio uses **Tauri** for building cross-platform desktop applications. The build process:
1. Compiles TypeScript/React frontend with Vite
2. Compiles Rust backend with Cargo
3. Bundles everything into a standalone executable
4. Creates Windows installers (MSI and NSIS)

---

## 🎯 Target Platform

| Platform | Status | Notes |
|----------|--------|-------|
| **Windows 10 (1903+)** | ✅ Supported | Primary target |
| **Windows 11** | ✅ Supported | Primary target |
| macOS | ❌ Not targeted | Requires porting |
| Linux | ❌ Not targeted | Requires porting |

---

## 📋 Prerequisites

### Build Environment

| Requirement | Details |
|-------------|---------|
| **OS** | Windows 10/11 |
| **Node.js** | 18+ |
| **Rust** | Latest stable |
| **Visual Studio 2022** | With C++ workload |
| **WebView2** | Runtime or SDK |

### Environment Setup

```cmd
:: Verify installations
node --version
npm --version
rustc --version
cargo --version
```

---

## 🏗️ Build Process

### Quick Build (Recommended)

```cmd
:: Use the provided batch script
build.bat
```

### Manual Build

```cmd
:: Step 1: Install dependencies
npm install

:: Step 2: Build frontend
npm run build

:: Step 3: Build Tauri application
npm run tauri:build
```

### Debug Build

```cmd
:: For development/testing builds
cargo build
```

### Release Build

```cmd
:: Optimized production build
cargo build --release
```

---

## 📦 Build Output

### Output Directory

```
src-tauri/target/release/
├── connexio.exe              # Main executable
├── bundle/
│   ├── msi/
│   │   └── Connexio_0.1.0_x64.msi       # MSI installer
│   └── nsis/
│       └── Connexio_0.1.0_x64-setup.exe # NSIS installer
└── deps/                     # Runtime dependencies
```

### Installer Types

| Type | File | Best For |
|------|------|----------|
| **MSI** | `Connexio_0.1.0_x64.msi` | Enterprise deployment, GPO |
| **NSIS** | `Connexio_0.1.0_x64-setup.exe` | End-user installation |

---

## ⚙️ Build Configuration

### Tauri Configuration (`src-tauri/tauri.conf.json`)

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Connexio",
  "version": "0.1.0",
  "identifier": "com.connexio.app",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "Connexio",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "decorations": false,
        "transparent": false,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": ["msi", "nsis"],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "windows": {
      "wix": {
        "language": "en-US"
      }
    }
  }
}
```

### Key Configuration Options

| Option | Current Value | Description |
|--------|---------------|-------------|
| `productName` | "Connexio" | Display name |
| `version` | "0.1.0" | Application version |
| `identifier` | "com.connexio.app" | Unique app ID |
| `bundle.targets` | ["msi", "nsis"] | Installer types |
| `decorations` | false | Custom title bar |
| `minWidth/minHeight` | 800x600 | Minimum window size |

---

## 🖼️ Application Icons

### Icon Locations

```
src-tauri/icons/
├── icon.ico              # Windows application icon
├── icon.icns             # macOS icon (not used)
├── icon.png              # Source PNG
├── 32x32.png             # Small icon
├── 128x128.png           # Medium icon
├── 128x128@2x.png        # Retina icon
├── Square30x30Logo.png   # Windows Store
├── Square44x44Logo.png   # Windows Store
├── Square71x71Logo.png   # Windows Store
├── Square89x89Logo.png   # Windows Store
├── Square107x107Logo.png # Windows Store
├── Square142x142Logo.png # Windows Store
├── Square150x150Logo.png # Windows Store
├── Square284x284Logo.png # Windows Store
├── Square310x310Logo.png # Windows Store
└── StoreLogo.png         # Windows Store
```

### Updating Icons

1. Create source icon (minimum 512x512 PNG)
2. Generate all required sizes
3. Replace files in `src-tauri/icons/`
4. Rebuild application

---

## 🔐 Code Signing (Production)

### Requirements for Distribution

| Requirement | Purpose |
|-------------|---------|
| **Code Signing Certificate** | Trusted publisher identity |
| **Timestamping** | Validity after cert expiration |
| **EV Certificate** | SmartScreen reputation |

### Signing Configuration

Add to `tauri.conf.json`:

```json
{
  "bundle": {
    "windows": {
      "certificateThumbprint": "YOUR_THUMBPRINT",
      "timestampUrl": "http://timestamp.digicert.com"
    }
  }
}
```

### Environment Variables

```cmd
:: For automated builds
set TAURI_SIGNING_PRIVATE_KEY=path/to/key
set TAURI_SIGNING_PRIVATE_KEY_PASSWORD=password
```

---

## 🚀 Distribution

### Direct Download

1. Build application with `build.bat`
2. Upload MSI/NSIS installer to hosting
3. Provide download link

### Windows Store (Future)

1. Generate MSIX package
2. Submit to Microsoft Partner Center
3. Pass certification

### Auto-Update (Future)

Tauri supports auto-update with:
- GitHub Releases
- Custom update server
- S3-compatible storage

---

## 🧪 Testing Builds

### Manual Testing Checklist

- [ ] Application launches correctly
- [ ] Window title bar functions (drag, buttons)
- [ ] Terminal renders properly
- [ ] PTY connection works
- [ ] Resize handling
- [ ] Multiple tabs (when implemented)
- [ ] Clean uninstall

### Test Environments

| Environment | Purpose |
|-------------|---------|
| Windows 10 VM | Compatibility testing |
| Windows 11 VM | Latest features |
| Clean install VM | Fresh environment |

---

## 📊 Build Optimization

### Frontend Optimization

- Vite tree-shaking enabled
- Production minification
- Asset optimization

### Backend Optimization

```toml
# Cargo.toml - Release profile
[profile.release]
lto = true           # Link-time optimization
opt-level = 3        # Maximum optimization
codegen-units = 1    # Better optimization
strip = true         # Strip symbols
```

### Bundle Size Considerations

| Component | Typical Size |
|-----------|--------------|
| Rust binary | ~5-10 MB |
| Frontend assets | ~1-3 MB |
| WebView2 | Shared/System |
| **Total** | ~6-15 MB |

---

## 🔧 Troubleshooting

### Common Build Errors

| Error | Solution |
|-------|----------|
| "MSVC not found" | Run from VS Developer Command Prompt |
| "WebView2 not found" | Install WebView2 Runtime |
| "Link error" | Check Windows SDK installation |
| "Frontend build failed" | Check npm dependencies |

### Clean Build

```cmd
:: Remove build artifacts
rd /s /q node_modules
rd /s /q dist
rd /s /q src-tauri\target

:: Reinstall and rebuild
npm install
build.bat
```

---

## 📝 Version Management

### Updating Version

1. Update `package.json`:
   ```json
   { "version": "0.2.0" }
   ```

2. Update `src-tauri/Cargo.toml`:
   ```toml
   [package]
   version = "0.2.0"
   ```

3. Update `src-tauri/tauri.conf.json`:
   ```json
   { "version": "0.2.0" }
   ```

4. Rebuild application

---

## 🔗 CI/CD Integration (Future)

### GitHub Actions Example

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - uses: dtolnay/rust-toolchain@stable
      - name: Install dependencies
        run: npm install
      - name: Build
        run: npm run tauri:build
      - uses: actions/upload-artifact@v4
        with:
          name: installers
          path: src-tauri/target/release/bundle/**/*
```

---

## 📚 References

- [Tauri Build Guide](https://tauri.app/v1/guides/building/)
- [Tauri Distribution Guide](https://tauri.app/v1/guides/distribution/)
- [Windows Code Signing](https://tauri.app/v1/guides/distribution/sign-windows)
- [Auto-Updater](https://tauri.app/v1/guides/distribution/updater)

---

*Generated by BMad Master Document Project Workflow v1.2.0*
