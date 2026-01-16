# Connexio Release Guide

Panduan lengkap untuk merilis versi baru Connexio.

## 📋 Daftar Isi

- [Versioning Strategy](#versioning-strategy)
- [Pre-Release Checklist](#pre-release-checklist)
- [Release Process](#release-process)
- [Quick Release Commands](#quick-release-commands)
- [Troubleshooting](#troubleshooting)

---

## Versioning Strategy

Connexio menggunakan [Semantic Versioning](https://semver.org/):

```
MAJOR.MINOR.PATCH
  │     │     └── Bug fixes, small improvements
  │     └──────── New features (backward compatible)
  └────────────── Breaking changes
```

### Kapan Bump Version?

| Perubahan                        | Bump    | Contoh        |
| -------------------------------- | ------- | ------------- |
| Bug fix kecil                    | `patch` | 0.2.3 → 0.2.4 |
| Fitur baru (backward compatible) | `minor` | 0.2.3 → 0.3.0 |
| Breaking changes                 | `major` | 0.2.3 → 1.0.0 |
| Hotfix critical                  | `patch` | 0.2.3 → 0.2.4 |

### Version Files

Version di-update di 3 file sekaligus menggunakan script:

- `package.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`

---

## Pre-Release Checklist

Sebelum release, pastikan:

### Code Quality

- [ ] Semua fitur baru sudah di-test
- [ ] Tidak ada bug critical yang diketahui
- [ ] Code sudah di-review (jika ada tim)

### Testing

- [ ] App berjalan normal di development (`npm run tauri:dev`)
- [ ] Tidak ada error di console
- [ ] Fitur utama berfungsi:
  - [ ] Terminal bisa dibuka
  - [ ] Multi-tab berfungsi
  - [ ] Session persistence bekerja
  - [ ] Themes bisa diganti
  - [ ] Settings bisa disimpan

### Git Status

- [ ] Semua perubahan sudah di-commit
- [ ] Branch sudah up-to-date dengan remote
- [ ] Tidak ada conflict

### Documentation

- [ ] README.md sudah di-update (jika perlu)
- [ ] CHANGELOG sudah di-update (jika ada)

---

## Release Process

### Step 1: Bump Version

```bash
# Untuk bug fix
npm run version:patch

# Untuk fitur baru
npm run version:minor

# Untuk breaking changes
npm run version:major

# Atau set versi spesifik
npm run release 1.0.0
```

Output:

```
📦 Current version: 0.2.3
🚀 New version: 0.2.4

Updating files:
  ✓ package.json → 0.2.4
  ✓ src-tauri/tauri.conf.json → 0.2.4
  ✓ src-tauri/Cargo.toml → 0.2.4

✅ Version bumped successfully!
```

### Step 2: Commit Version Bump

```bash
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml
git commit -m "chore: bump version to 0.2.4"
git push
```

### Step 3: Build dengan Signing

```bash
# Windows PowerShell
powershell -ExecutionPolicy Bypass -File build-signed.ps1
```

Build akan menghasilkan:

```
src-tauri/target/release/bundle/
├── nsis/
│   ├── Connexio_0.2.4_x64-setup.exe      # Installer
│   └── Connexio_0.2.4_x64-setup.exe.sig  # Signature
└── msi/
    ├── Connexio_0.2.4_x64_en-US.msi      # MSI Installer
    └── Connexio_0.2.4_x64_en-US.msi.sig  # Signature
```

### Step 4: Update latest.json

Edit `latest.json` dengan informasi baru:

```json
{
  "version": "0.2.4",
  "notes": "Version 0.2.4 - Deskripsi singkat perubahan",
  "pub_date": "2026-01-16T12:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "<isi dari file .sig>",
      "url": "https://github.com/yandanp/Connexio/releases/download/v0.2.4/Connexio_0.2.4_x64-setup.exe"
    }
  }
}
```

**Cara mendapatkan signature:**

```bash
cat src-tauri/target/release/bundle/nsis/Connexio_0.2.4_x64-setup.exe.sig
```

### Step 5: Upload ke GitHub Release

```bash
gh release create v0.2.4 \
  "src-tauri/target/release/bundle/nsis/Connexio_0.2.4_x64-setup.exe" \
  "src-tauri/target/release/bundle/nsis/Connexio_0.2.4_x64-setup.exe.sig" \
  "src-tauri/target/release/bundle/msi/Connexio_0.2.4_x64_en-US.msi" \
  "src-tauri/target/release/bundle/msi/Connexio_0.2.4_x64_en-US.msi.sig" \
  "latest.json" \
  --title "Connexio v0.2.4" \
  --notes "## What's New

- Deskripsi perubahan 1
- Deskripsi perubahan 2

## Downloads

| Platform | File |
|----------|------|
| Windows (Installer) | Connexio_0.2.4_x64-setup.exe |
| Windows (MSI) | Connexio_0.2.4_x64_en-US.msi |

## Auto-Update

Existing users will receive this update automatically!"
```

### Step 6: Commit latest.json

```bash
git add latest.json
git commit -m "chore: update latest.json for v0.2.4"
git push
```

### Step 7: Verifikasi

1. **Cek GitHub Release:** https://github.com/yandanp/Connexio/releases
2. **Test download:** Download dan install dari release page
3. **Test auto-updater:** Buka versi lama, cek apakah muncul notifikasi update

---

## Quick Release Commands

### One-liner untuk Release Cepat

```bash
# 1. Bump, commit, push
npm run version:patch && git add . && git commit -m "chore: bump version to $(node -p "require('./package.json').version")" && git push

# 2. Build
powershell -ExecutionPolicy Bypass -File build-signed.ps1

# 3. Upload (ganti VERSION)
VERSION=0.2.4 && gh release create v$VERSION \
  "src-tauri/target/release/bundle/nsis/Connexio_${VERSION}_x64-setup.exe" \
  "src-tauri/target/release/bundle/nsis/Connexio_${VERSION}_x64-setup.exe.sig" \
  "src-tauri/target/release/bundle/msi/Connexio_${VERSION}_x64_en-US.msi" \
  "src-tauri/target/release/bundle/msi/Connexio_${VERSION}_x64_en-US.msi.sig" \
  "latest.json" \
  --title "Connexio v$VERSION"
```

### NPM Scripts Available

| Command                 | Deskripsi           |
| ----------------------- | ------------------- |
| `npm run version:patch` | 0.2.3 → 0.2.4       |
| `npm run version:minor` | 0.2.3 → 0.3.0       |
| `npm run version:major` | 0.2.3 → 1.0.0       |
| `npm run release 1.0.0` | Set versi spesifik  |
| `npm run tauri:build`   | Build tanpa signing |

---

## Troubleshooting

### Build Gagal: "A public key has been found, but no private key"

**Penyebab:** Environment variable `TAURI_SIGNING_PRIVATE_KEY` tidak di-set.

**Solusi:** Gunakan script `build-signed.ps1`:

```bash
powershell -ExecutionPolicy Bypass -File build-signed.ps1
```

### Signature File Tidak Ada

**Penyebab:** Build tidak menggunakan signing key.

**Solusi:** Rebuild dengan `build-signed.ps1`.

### Auto-Updater Tidak Bekerja

**Cek:**

1. `latest.json` sudah di-upload ke release?
2. Signature di `latest.json` sama dengan file `.sig`?
3. URL download sudah benar?
4. `pub_date` format sudah benar (ISO 8601)?

**Format pub_date yang benar:**

```
2026-01-16T12:00:00Z
```

### GitHub Release Gagal Upload

**Penyebab:** File terlalu besar atau koneksi timeout.

**Solusi:**

```bash
# Upload satu per satu
gh release upload v0.2.4 "src-tauri/target/release/bundle/nsis/Connexio_0.2.4_x64-setup.exe"
gh release upload v0.2.4 "src-tauri/target/release/bundle/msi/Connexio_0.2.4_x64_en-US.msi"
```

### Perlu Hapus Release

```bash
# Hapus release (tag tetap ada)
gh release delete v0.2.4 --yes

# Hapus tag juga
git tag -d v0.2.4
git push origin :refs/tags/v0.2.4
```

---

## File Penting

| File                       | Fungsi                                     |
| -------------------------- | ------------------------------------------ |
| `.tauri-key`               | Private key untuk signing (JANGAN COMMIT!) |
| `.tauri-key.pub`           | Public key (ada di tauri.conf.json)        |
| `latest.json`              | Manifest untuk auto-updater                |
| `scripts/bump-version.cjs` | Script bump version                        |
| `build-signed.ps1`         | Script build dengan signing                |

---

## Tips

1. **Test di VM dulu** - Sebelum release major, test install di VM bersih
2. **Backup private key** - Simpan `.tauri-key` di tempat aman
3. **Jangan skip signing** - Tanpa signature, auto-updater tidak bekerja
4. **Update release notes** - Tulis changelog yang jelas untuk user
5. **Verifikasi setelah release** - Download dan test installer dari release page

---

## Support

Jika ada masalah saat release:

1. Cek [Tauri Documentation](https://tauri.app/v2/guides/distribute/updater/)
2. Buka issue di [GitHub](https://github.com/yandanp/Connexio/issues)
