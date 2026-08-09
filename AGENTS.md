# Connexio — Agent Guide

Connexio = project-based terminal manager: Tauri v2 + Rust backend, React 18 frontend.
Rulebook for humans and AI agents. UI rules live in `docs/STYLEGUIDE.md`.

## Layout

- `src/renderer/core/` = kernel (api, api-remote, ui, hooks, stores, tauri-shim.ts). `src/renderer/features/<domain>/` = fitur; API publik hanya lewat `index.ts`.
- `src/shared/` = tipe murni frontend↔Rust. Backend: `src-tauri/src/modules/` (ssh/ dan remote/ adalah folder modul).

## Boundaries (dipaksa config/check-feature-imports.mjs)

- Feature dilarang impor internal feature lain — lewat index.ts atau core/.
- `invoke()`/`listen()` hanya di `src/renderer/core/api*/`. Plugin dialog boleh di feature.

## Naming

- Komponen: PascalCase.tsx. Modul: kebab-case.ts (Rust snake_case.rs). Dilarang: utils/helpers/common/misc.
- Nama file menyebut konsep domain (`split-layout-geometry.ts`), bukan peran generik.

## Style

- Komentar singkat, hanya yang non-obvious (WHY, bukan HOW).
- File ≤400 baris (TS frontend maupun Rust); pengecualian yang sedang di-split ada di `config/max-lines-baseline.txt` (ratchet: hanya boleh turun).
- UI baru WAJIB memakai token/kelas desain yang sudah ada — lihat `docs/STYLEGUIDE.md`.

## IPC & cross-platform

- Kontrak command Tauri terpusat di core/api; jangan tambah command ad-hoc dari komponen.
- App berjalan di Windows/macOS/Linux — jangan asumsikan path separator atau shell tertentu.

## Testing

- Test colocated (`foo.test.ts`). Logika murni yang disentuh WAJIB punya test.
- Gate PR: `npm run typecheck`, `lint`, `test`, `check:lines`, `check:boundaries` + `cargo fmt --check`, `cargo clippy`, `cargo test` (di `src-tauri/`).
