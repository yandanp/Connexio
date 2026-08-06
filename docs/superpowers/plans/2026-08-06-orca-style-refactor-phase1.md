# Connexio Refactor Phase 1 (Orca-style) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menerapkan konvensi & arsitektur ala Orca pada Connexio: feature slices + core kernel, quality gates CI (lint/format/ratchet/boundaries), dan pembelahan semua monolith — tanpa perubahan behavior.

**Architecture:** Renderer direstruktur menjadi `core/` (api, ui, hooks, stores) + `features/` (satu folder per domain, publik via index.ts). Semua IPC terpusat di `core/api`. Backend Rust tetap Tauri; dua modul terbesar (`ssh.rs`, `remote/server.rs`) di-split jadi submodul.

**Tech Stack:** Tauri v2, Rust, React 18, TypeScript, zustand, xterm.js, CodeMirror, Vite — plus tooling baru: oxlint, oxfmt, husky, lint-staged, vitest.

**Spec:** `docs/superpowers/specs/2026-08-06-orca-style-refactor-phase1-design.md`

## Global Constraints

1. Stack tetap Tauri v2 + Rust + React 18; TIDAK ada dependency runtime baru selain yang disebut di tech stack (tooling dev saja).
2. Bentuk publik `window.connexio` TIDAK berubah — object `connexioApi`/`connexioRemoteApi` harus tetap punya tepat 15 key berurutan: `terminal, project, session, settings, workspace, tasks, pinned, ssh, git, theme, app, updater, notification, discord, remote`.
3. Tidak ada perubahan UI/behavior; tidak ada fitur baru. Regresi visual/fungsional = revert PR.
4. File baru hard-cap ≤400 baris; file yang terdaftar di `config/max-lines-baseline.txt` tidak boleh tumbuh melewati angka baseline-nya.
5. Penamaan: komponen React `PascalCase.tsx`; modul non-komponen `kebab-case.ts` (Rust: `snake_case.rs`). DILARANG nama `utils`, `helpers`, `common`, `misc`.
6. Boundary: feature dilarang mengimpor internal feature lain (hanya via `index.ts` feature tujuan atau via `core/`); `invoke()`/`listen()` dari `@tauri-apps/api/core` / `@tauri-apps/api/event` hanya boleh di `src/renderer/core/api*/`; `src/shared/` hanya tipe & konstanta murni. Pengecualian yang diizinkan: plugin dialog (`@tauri-apps/plugin-dialog`) boleh dipakai di feature (UI-level).
7. Test colocated: `foo.ts` ↔ `foo.test.ts`. Commit mengikuti konvensi repo: `feat:` `fix:` `refactor:` `ci:` `chore:` `docs:`.
8. Setiap task berakhir hijau: `npm run typecheck` + `npm run lint` + `npm run test` + gate scripts; mulai Task 13 juga `cargo fmt --check && cargo clippy -- -D warnings && cargo test` (di `src-tauri/`).
9. Verifikasi manual wajib untuk task yang menyentuh runtime path (disebutkan per task): `npm run dev` → smoke check.

---

## File Structure (hasil akhir)

```
config/
  vitest.config.ts            # vitest + alias @shared
  check-max-lines.mjs         # ratchet checker
  max-lines-baseline.txt      # baseline file besar (hanya turun)
  check-feature-imports.mjs   # boundary checker
src/renderer/
  core/api/                   # 16 modul domain + barrel connexioApi
  core/api-remote/            # padanan remote-mode + barrel connexioRemoteApi
  core/ui/                    # primitif & app chrome
  core/hooks/  core/stores/  core/styles/
  features/{terminal,workspace,projects,git,ssh,remote,tasks,
            explorer,editor,ai,settings,notifications}/
src-tauri/src/modules/
  ssh/                        # mod.rs + 7 submodul
  remote/                     # server.rs ramping + 7 file pendukung
AGENTS.md  docs/STYLEGUIDE.md  .github/workflows/ci.yml
```

---

### Task 1: Formatter, linter, dan pre-commit

**Files:**
- Modify: `package.json` (scripts, devDeps, lint-staged)
- Create: `.oxlintrc.json`, `.oxfmtrc.json`, `.husky/pre-commit`

**Interfaces:**
- Produces: `npm run format`, `npm run lint`, pre-commit hook — dipakai semua task berikutnya dan CI (Task 2).

- [ ] **Step 1: Install tooling**

```bash
npm i -D oxlint oxfmt husky lint-staged
```

- [ ] **Step 2: Buat `.oxfmtrc.json`**

Tujuan: pertahankan indentasi TAB yang sudah dipakai seluruh codebase agar diff reformat minimal.

```json
{
	"useTabs": true
}
```

Validasi bahwa key dikenali: `npx oxfmt --help`. Jika `useTabs` ditolak, ganti dengan opsi ekuivalen dari help (jangan lanjut dengan config yang error).

- [ ] **Step 3: Buat `.oxlintrc.json` minimal**

```json
{
	"rules": {}
}
```

- [ ] **Step 4: Tambah scripts + lint-staged di `package.json`**

```json
"scripts": {
	"format": "oxfmt --write .",
	"format:check": "oxfmt --check .",
	"lint": "oxlint src config",
	"prepare": "husky"
},
"lint-staged": {
	"*.{ts,tsx}": ["oxlint", "oxfmt --write"],
	"*.{json,css}": ["oxfmt --write"]
}
```

- [ ] **Step 5: Aktifkan husky**

```bash
npx husky init
printf 'npx lint-staged\n' > .husky/pre-commit
```

- [ ] **Step 6: Format seluruh repo (commit terpisah karena diff besar)**

```bash
npm run format
git add -A && git commit -m "chore: apply oxfmt formatting across repo"
```

- [ ] **Step 7: Triage lint sampai hijau**

```bash
npm run lint
```

Perbaiki issue trivial; jika ada rule yang terlalu bising untuk codebase ini, nonaktifkan rule-nya di `.oxlintrc.json` (bukan inline disable di kode) dan sebutkan alasannya di commit message.

- [ ] **Step 8: Verifikasi pre-commit bekerja**

```bash
echo "// test" >> src/renderer/App.tsx
git add src/renderer/App.tsx && git commit -m "chore: verify pre-commit" 
# hook harus menjalankan lint-staged; kemudian:
git reset --hard HEAD~1
```

- [ ] **Step 9: Commit**

```bash
git add .oxlintrc.json .oxfmtrc.json .husky/pre-commit package.json package-lock.json
git commit -m "chore: add oxfmt + oxlint + husky/lint-staged"
```

---

### Task 2: Vitest, max-lines ratchet, boundary checker, dan CI

**Files:**
- Create: `config/vitest.config.ts`, `config/check-max-lines.mjs`, `config/max-lines-baseline.txt`, `config/check-feature-imports.mjs`, `.github/workflows/ci.yml`
- Modify: `package.json` (devDeps vitest; scripts test/check:lines/check:boundaries)

**Interfaces:**
- Consumes: lint/format dari Task 1.
- Produces: `npm run test`, `npm run check:lines`, `npm run check:boundaries`, workflow CI `ci.yml` — dipakai semua task berikutnya.

- [ ] **Step 1: Install vitest + scripts**

```bash
npm i -D vitest
```

Tambah di `package.json`:

```json
"test": "vitest run --config config/vitest.config.ts",
"check:lines": "node config/check-max-lines.mjs",
"check:boundaries": "node config/check-feature-imports.mjs"
```

- [ ] **Step 2: Buat `config/vitest.config.ts`**

Alias `@shared` harus mirror `vite.config.ts` (cek dulu alias yang ada di sana).

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
	resolve: {
		alias: { "@shared": path.resolve(__dirname, "../src/shared") },
	},
	test: {
		environment: "node",
		include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
	},
});
```

- [ ] **Step 3: Buat `config/check-max-lines.mjs`**

```js
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const NEW_FILE_CAP = 400;
const baselinePath = fileURLToPath(new URL("./max-lines-baseline.txt", import.meta.url));

const baseline = new Map();
if (existsSync(baselinePath)) {
	for (const raw of readFileSync(baselinePath, "utf8").split("\n")) {
		const line = raw.trim();
		if (!line || line.startsWith("#")) continue;
		const [p, limit] = line.split("\t");
		baseline.set(p, Number(limit));
	}
}

const files = execSync("git ls-files -- '*.ts' '*.tsx' '*.rs'", { encoding: "utf8" })
	.trim().split("\n").filter((f) => f.startsWith("src/"));

let failed = false;
for (const f of files) {
	const lines = readFileSync(f, "utf8").split("\n").length;
	const limit = baseline.get(f) ?? NEW_FILE_CAP;
	if (lines > limit) {
		console.error(`max-lines FAIL: ${f} has ${lines} lines (limit ${limit})`);
		failed = true;
	}
}
for (const [p] of baseline) {
	if (!existsSync(p)) {
		console.error(`max-lines FAIL: baseline entry for deleted file ${p} — remove it`);
		failed = true;
	}
}
if (failed) process.exit(1);
console.log("max-lines ratchet: OK");
```

- [ ] **Step 4: Generate baseline awal**

```bash
git ls-files -- '*.ts' '*.tsx' '*.rs' | xargs wc -l | awk '$1 > 400 && $2 != "total" {print $2 "\t" $1}' > config/max-lines-baseline.txt
```

Tambahkan header comment `# path<TAB>max-lines — hanya boleh turun; entri dihapus saat file di-split` di baris pertama.

- [ ] **Step 5: Buat `config/check-feature-imports.mjs`**

```js
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const files = execSync("git ls-files -- 'src/renderer/*.ts' 'src/renderer/*.tsx'", { encoding: "utf8" })
	.trim().split("\n");

let failed = false;
const rel = (from, spec) => {
	const dir = from.split("/").slice(0, -1).join("/");
	const parts = [...dir.split("/"), ...spec.split("/")];
	const out = [];
	for (const p of parts) {
		if (p === "..") out.pop();
		else if (p !== ".") out.push(p);
	}
	return out.join("/");
};
const featureOf = (p) => {
	const m = p.match(/^src\/renderer\/features\/([^/]+)\//);
	return m ? m[1] : null;
};

for (const f of files) {
	const src = readFileSync(f, "utf8");
	const myFeature = featureOf(f);
	for (const m of src.matchAll(/from\s+["']([^"']+)["']/g)) {
		const spec = m[1];
		// Rule B: invoke/listen hanya di core/api*
		const inCoreApi = /^src\/renderer\/core\/api(-remote)?\//.test(f);
		if (!inCoreApi && (spec === "@tauri-apps/api/core" || spec === "@tauri-apps/api/event")) {
			console.error(`boundary FAIL: ${f} imports ${spec} (only core/api* may)`);
			failed = true;
		}
		// Rule A: feature tidak boleh impor internal feature lain
		if (spec.startsWith(".")) {
			const target = rel(f, spec);
			const theirFeature = featureOf(target) ?? featureOf(target + "/index.ts");
			if (myFeature && theirFeature && theirFeature !== myFeature
				&& !/features\/[^/]+$/.test(target)) {
				console.error(`boundary FAIL: ${f} imports internal of features/${theirFeature} (use its index)`);
				failed = true;
			}
		}
	}
}
if (failed) process.exit(1);
console.log("feature boundaries: OK");
```

Catatan: sebelum Task 4–6 dieksekusi, `tauri-api.ts` (di `lib/`) masih mengimpor `@tauri-apps/api/core` — itu lolos karena Rule B hanya melarang di luar `core/api*`... TAPI file `lib/tauri-api.ts` bukan `core/api*`. Solusi sementara: file `src/renderer/lib/*.ts` termasuk fase migrasi; tambahkan allowlist sementara di script: `const LEGACY = ["src/renderer/lib/tauri-api.ts", "src/renderer/lib/remote-api.ts"];` dan skip file di LEGACY. Hapus allowlist ini di Task 5 Step 8.

- [ ] **Step 6: Buat `.github/workflows/ci.yml`**

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]
jobs:
  web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run test
      - run: npm run check:lines
      - run: npm run check:boundaries
  rust:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: src-tauri } }
    steps:
      - uses: actions/checkout@v4
      - run: sudo apt-get update && sudo apt-get install -y libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev libxdo-dev
      - uses: dtolnay/rust-toolchain@stable
        with: { components: rustfmt, clippy }
      - run: cargo fmt --check
      - run: cargo clippy -- -D warnings
      - run: cargo test
```

Jangan sentuh workflow release yang sudah ada di `.github/workflows/`.

- [ ] **Step 7: Uji ratchet — harus FAIL lalu PASS**

```bash
# buat file 450 baris
node -e "require('fs').writeFileSync('src/renderer/tmp-ratchet-probe.ts', Array(450).fill('export const x = 1;').join('\n'))"
git add src/renderer/tmp-ratchet-probe.ts
npm run check:lines   # Expected: FAIL menyebut tmp-ratchet-probe.ts
git rm -f src/renderer/tmp-ratchet-probe.ts
npm run check:lines   # Expected: PASS
```

- [ ] **Step 8: Uji boundary — harus FAIL lalu PASS**

```bash
# tambahkan import terlarang sementara di sebuah komponen
printf '\nimport { invoke } from "@tauri-apps/api/core";\n' >> src/renderer/components/TitleBar.tsx
npm run check:boundaries   # Expected: FAIL menyebut TitleBar.tsx
git checkout -- src/renderer/components/TitleBar.tsx
npm run check:boundaries   # Expected: PASS
```

- [ ] **Step 9: Commit**

```bash
git add config/ .github/workflows/ci.yml package.json package-lock.json
git commit -m "ci: add vitest, max-lines ratchet, boundary checks, and CI workflow"
```

---

### Task 3: AGENTS.md dan STYLEGUIDE.md

**Files:**
- Create: `AGENTS.md`, `docs/STYLEGUIDE.md`

**Interfaces:**
- Produces: acuan review & konvensi untuk semua task dan AI agent selanjutnya.

- [ ] **Step 1: Tulis `AGENTS.md`** dengan isi minimal (ringkas, satu baris per aturan):

```markdown
# Connexio — Agent Guide

## Layout
- `src/renderer/core/` = kernel (api, ui, hooks, stores). `src/renderer/features/<domain>/` = fitur; API publik hanya lewat `index.ts`.
- `src/shared/` = tipe murni frontend↔Rust. Backend: `src-tauri/src/modules/`.

## Boundaries (dipaksa config/check-feature-imports.mjs)
- Feature dilarang impor internal feature lain — lewat index.ts atau core/.
- `invoke()`/`listen()` hanya di `src/renderer/core/api*/`. Plugin dialog boleh di feature.

## Naming
- Komponen: PascalCase.tsx. Modul: kebab-case.ts (Rust snake_case.rs). Dilarang: utils/helpers/common/misc.
- Nama file menyebut konsep domain (`split-layout-geometry.ts`), bukan peran generik.

## Style
- Komentar singkat, hanya yang non-obvious (WHY, bukan HOW).
- File ≤400 baris (lihat config/max-lines-baseline.txt untuk pengecualian yang sedang di-split).

## IPC & cross-platform
- Kontrak command Tauri terpusat di core/api; jangan tambah command ad-hoc dari komponen.
- App berjalan di Windows/macOS/Linux — jangan asumsikan path separator atau shell tertentu.

## Testing
- Test colocated (`foo.test.ts`). Logika murni yang disentuh WAJIB punya test.
- Gate PR: typecheck, lint, test, check:lines, check:boundaries, cargo fmt/clippy/test.
```

- [ ] **Step 2: Tulis `docs/STYLEGUIDE.md`**

Inventarisasi token aktual dulu:

```bash
grep -oE '\-\-[a-z-]+' src/renderer/styles/globals.css | sort -u
grep -oE '(glass-panel|dock-button|field-soft|soft-card|section-label|soft-separator-[a-z]+)' src/renderer/styles/globals.css | sort -u
```

Tulis STYLEGUIDE.md berisi: (a) daftar token CSS `--*` hasil inventarisasi + maknanya, (b) kelas utilitas yang ditemukan (minimal: `glass-panel`, `dock-button`, `field-soft`, `soft-card`, `section-label`, palette `connexio-bg/-secondary/-tertiary`, `connexio-border`, `connexio-text/-muted/-secondary`, `connexio-accent/-hover`), (c) aturan: UI baru WAJIB memakai token/kelas yang sudah ada; nilai warna/spacing/font baru dilarang kecuali token belum mencakup, (d) urutan resolusi bila STYLEGUIDE diam: ikuti komponen terdekat di feature yang sama → core/ui → App.tsx.

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md docs/STYLEGUIDE.md
git commit -m "docs: add AGENTS.md and STYLEGUIDE.md conventions"
```

---

### Task 4: core/api — split `tauri-api.ts`

**Files:**
- Create: `src/renderer/core/api/{terminal-event-bus,terminal,projects,session,settings,workspace,tasks,pinned,ssh,git,theme,app,updater,notification,discord,remote,index}.ts`, `src/renderer/core/api/api-shape.test.ts`
- Modify: `src/renderer/lib/tauri-shim.ts`
- Delete: `src/renderer/lib/tauri-api.ts` (setelah migrasi)

**Interfaces:**
- Consumes: gate Task 2 (ratchet, boundaries — hapus entri allowlist legacy untuk tauri-api di Task 5).
- Produces: `src/renderer/core/api/index.ts` dengan named export `connexioApi` (bentuk IDENTIK 15 key) — dipakai `tauri-shim.ts`; pola yang sama diulang untuk remote-api (Task 5).

- [ ] **Step 1: Tulis test bentuk API dulu (failing karena modul belum ada)**

`src/renderer/core/api/api-shape.test.ts`:

```ts
import { expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(), listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/plugin-updater", () => ({ check: vi.fn() }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: vi.fn() }));

it("connexioApi exposes exactly the 15 public domains", async () => {
	const { connexioApi } = await import("./index");
	expect(Object.keys(connexioApi)).toEqual([
		"terminal", "project", "session", "settings", "workspace",
		"tasks", "pinned", "ssh", "git", "theme", "app", "updater",
		"notification", "discord", "remote",
	]);
});
```

- [ ] **Step 2: Jalankan test — harus FAIL**

```bash
npm run test
# Expected: FAIL — Cannot find module './index'
```

- [ ] **Step 3: Ekstrak per domain dari `src/renderer/lib/tauri-api.ts`**

Pindahkan (cut-paste, logika TIDAK diubah) sesuai blok header `─── X ───` di file asal:

| Baris asal (pendekatan) | File baru | Ekspor |
|---|---|---|
| 32–85 (listener set, buffer, `listen("terminal:data"/…)` global) | `terminal-event-bus.ts` | `onTerminalData`, `onTerminalExit`, `terminalDataBuffer` internals |
| 86–130 (object terminal) | `terminal.ts` | `terminal` |
| 134–155 | `projects.ts` | `project` (nama objek TETAP `project`, bukan `projects`) |
| 157–169 | `session.ts` | `session` |
| 171–182 | `settings.ts` | `settings` |
| 184–191 | `workspace.ts` | `workspace` |
| 193–198 | `tasks.ts` | `tasks` |
| 200–208 | `pinned.ts` | `pinned` |
| 210–288 | `ssh.ts` | `ssh` |
| 290–364 | `git.ts` | `git` |
| 366–376 | `theme.ts` | `theme` |
| 378–393 | `app.ts` | `app` |
| 395–464 (termasuk import plugin-updater/process) | `updater.ts` | `updater` |
| 466–517 (listener notification global) | `notification.ts` | `notification` |
| 519–527 | `discord.ts` | `discord` |
| 529–557 (+ `RemoteClientInfo`, `RemoteStatus`) | `remote.ts` | `remote` + kedua tipe |

Setiap modul mengimpor `invoke`/`listen` dari `@tauri-apps/api/core|event` dan tipe dari `@shared/types` sesuai kebutuhan. Import baris 14–28 di file asal didistribusikan ke modul yang memakai.

- [ ] **Step 4: Buat barrel `index.ts`**

```ts
import { terminal } from "./terminal";
import { project } from "./projects";
import { session } from "./session";
import { settings } from "./settings";
import { workspace } from "./workspace";
import { tasks } from "./tasks";
import { pinned } from "./pinned";
import { ssh } from "./ssh";
import { git } from "./git";
import { theme } from "./theme";
import { app } from "./app";
import { updater } from "./updater";
import { notification } from "./notification";
import { discord } from "./discord";
import { remote } from "./remote";

export const connexioApi = {
	terminal, project, session, settings, workspace,
	tasks, pinned, ssh, git, theme, app, updater,
	notification, discord, remote,
};

export default connexioApi;
```

- [ ] **Step 5: Arahkan shim ke barrel baru**

`src/renderer/lib/tauri-shim.ts`: ganti `await import("./tauri-api")` menjadi `await import("../core/api")`.

- [ ] **Step 6: Jalankan test + typecheck — harus PASS**

```bash
npm run test && npm run typecheck
```

Jika ada import lain yang masih menunjuk `lib/tauri-api` — temukan dengan `git grep "tauri-api"` dan arahkan ke `core/api` (atau lewat `window.connexio`).

- [ ] **Step 7: Hapus file lama, jalankan semua gate**

```bash
git rm src/renderer/lib/tauri-api.ts
npm run typecheck && npm run lint && npm run test && npm run check:lines && npm run check:boundaries
```

- [ ] **Step 8: Smoke manual**

`npm run dev`: buka project → spawn terminal → ketik → git status muncul di footer → buka Settings. Semua harus bekerja seperti sebelumnya.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: split tauri-api into core/api domain modules"
```

---

### Task 5: core/api-remote — split `remote-api.ts`

**Files:**
- Create: `src/renderer/core/api-remote/` (mirror struktur Task 4 + `index.ts`), `src/renderer/core/api-remote/api-remote-shape.test.ts`
- Modify: `src/renderer/lib/tauri-shim.ts`, `config/check-feature-imports.mjs` (hapus allowlist LEGACY)
- Delete: `src/renderer/lib/remote-api.ts`

**Interfaces:**
- Consumes: pola Task 4.
- Produces: named export `connexioRemoteApi` dengan 15 key identik.

- [ ] **Step 1: Tulis shape test (failing)**

Sama seperti Task 4 Step 1, tetapi import `./index` di `core/api-remote/` dan mock `global.fetch` + `WebSocket` jika modul membutuhkannya saat import:

```ts
import { expect, it, vi } from "vitest";

vi.stubGlobal("fetch", vi.fn());
vi.stubGlobal("WebSocket", class { close() {} });

it("connexioRemoteApi exposes exactly the 15 public domains", async () => {
	const { connexioRemoteApi } = await import("./index");
	expect(Object.keys(connexioRemoteApi)).toEqual([
		"terminal", "project", "session", "settings", "workspace",
		"tasks", "pinned", "ssh", "git", "theme", "app", "updater",
		"notification", "discord", "remote",
	]);
});
```

- [ ] **Step 2: Jalankan — harus FAIL** (`npm run test`).

- [ ] **Step 3: Ekstrak per blok header `─── X ───` dari `remote-api.ts`**

Satu modul per domain seperti Task 4 (nama objek sama). Jika `remote-api.ts` mengimpor dari `./tauri-api`, arahkan ke modul `../api/<domain>`. Logika transport (HTTP/WS ke remote server) TIDAK diubah.

- [ ] **Step 4: Barrel `index.ts`** mengekspor `connexioRemoteApi` dengan urutan 15 key identik (lihat kode barrel Task 4 Step 4 — ganti nama konstanta).

- [ ] **Step 5: Update shim** — `await import("./remote-api")` → `await import("../core/api-remote")`.

- [ ] **Step 6: Hapus `lib/remote-api.ts`, hapus konstanta `LEGACY` di `config/check-feature-imports.mjs`**

```bash
git rm src/renderer/lib/remote-api.ts
```

- [ ] **Step 7: Semua gate hijau**

```bash
npm run typecheck && npm run lint && npm run test && npm run check:lines && npm run check:boundaries
```

- [ ] **Step 8: Smoke remote mode** — aktifkan Remote Access di app → buka URL remote di browser → workspace mobile tampil, terminal remote berfungsi.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: split remote-api into core/api-remote domain modules"
```

---

### Task 6: core/ui, core/hooks, core/stores

**Files:**
- Create/move ke `src/renderer/core/ui/`: `ContextMenu.tsx`, `TerminalContextMenu.tsx`, `ConfirmDialog.tsx`, `SidePanelRail.tsx`, `SidePanelHeader.tsx`, `KeyboardShortcutsModal.tsx`, `TitleBar.tsx`, `AppFooter.tsx`, `CommandPalette.tsx`, `WelcomeScreen.tsx`, `UpdateNotification.tsx`
- Move ke `src/renderer/core/hooks/`: `useDiscordPresence.ts`, `use-terminal-resize-v2.ts`, `useGitFileStatus.ts`
- Move ke `src/renderer/core/stores/`: `settingsStore.ts`, `themeStore.ts`, `notificationStore.ts`
- Setelah pindah, `src/renderer/stores/` hanya berisi `projectStore.ts` dan `aiStore.ts` (keduanya dibelah di Task 7–8 dan Task 12; folder dihapus saat entri terakhir pindah). Update semua import.

**Interfaces:**
- Consumes: core/ dari Task 4–5.
- Produces: primitif UI & store global di lokasi final; import path baru dipakai Task 7–12.

- [ ] **Step 1: Pindahkan file dengan `git mv`** (daftar di atas).

- [ ] **Step 2: Perbarui semua import**

```bash
git grep -l 'components/ContextMenu\|components/ConfirmDialog\|components/SidePanel\|stores/settingsStore\|stores/themeStore\|stores/notificationStore\|hooks/use'
```

Untuk tiap hasil, ubah path import ke lokasi baru (relative path disesuaikan). Jalankan:

```bash
npm run typecheck
```

ulang sampai hijau.

- [ ] **Step 3: Gate + smoke**

```bash
npm run lint && npm run test && npm run check:lines && npm run check:boundaries
```

`npm run dev`: buka Settings (theme store), footer (app version), command palette (Ctrl/Cmd+K), toast notifikasi.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: move primitives, hooks, and global stores into core/"
```

---

### Task 7: split-layout — ekstrak logika murni projectStore + tests

**Files:**
- Create: `src/renderer/features/workspace/split-layout.ts`, `split-layout-geometry.ts`, `workspace-persistence.ts` + 3 file test
- Modify: `src/renderer/stores/projectStore.ts` (hapus bagian yang pindah, re-export sementara)

**Interfaces:**
- Produces:
  - `split-layout.ts`: `type SplitDirection`, `interface SplitLeaf {type:"leaf";id;kind;terminalId;filePath?}`, `interface SplitBranch {type:"branch";id;direction;children;ratios?}`, `type SplitNode`, `interface SplitLayout {root;activePaneId}`, `findNode(node,id)`, `findParent(root,targetId)`, `replaceNode(root,targetId,replacement)`, `removeNode(root,targetId): SplitNode|null`, `collectLeaves(node)`, `collectTerminalIds(node)`
  - `split-layout-geometry.ts`: `interface PaneBounds {paneId;kind;terminalId;filePath?;top;left;width;height}`, `interface ResizeHandleBounds {branchId;dividerIndex;direction;top;left;branchTop;branchLeft;branchWidth;branchHeight}`, `computePaneBounds(node,bounds?)`, `computeResizeHandleBounds(node,bounds?)`
  - `workspace-persistence.ts`: `serializeNode(node,tabShell?)`, `deserializeNode(persisted)`, `createTerminalsForTree(node,projectPath,projectId,projectName,tabLabel,shell?)`

- [ ] **Step 1: Tulis test (failing)**

`split-layout.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { collectLeaves, collectTerminalIds, findNode, removeNode, replaceNode } from "./split-layout";
import type { SplitBranch, SplitLeaf, SplitNode } from "./split-layout";

const leaf = (id: string, terminalId: string | null = null): SplitLeaf =>
	({ type: "leaf", id, kind: "terminal", terminalId });
const branch = (id: string, children: SplitNode[], ratios?: number[]): SplitBranch =>
	({ type: "branch", id, direction: "horizontal", children, ratios });

const tree = branch("b1", [leaf("l1", "t1"), branch("b2", [leaf("l2", "t2"), leaf("l3", "t3")])]);

describe("split-layout tree ops", () => {
	it("findNode locates by id, null when absent", () => {
		expect(findNode(tree, "l3")?.id).toBe("l3");
		expect(findNode(tree, "b2")?.type).toBe("branch");
		expect(findNode(tree, "nope")).toBeNull();
	});

	it("collectLeaves preserves order", () => {
		expect(collectLeaves(tree).map((l) => l.id)).toEqual(["l1", "l2", "l3"]);
	});

	it("collectTerminalIds skips null terminals", () => {
		expect(collectTerminalIds(branch("b", [leaf("a", "t1"), leaf("b")]))).toEqual(["t1"]);
	});

	it("replaceNode swaps target without mutating original", () => {
		const next = replaceNode(tree, "l2", leaf("l9", "t9"));
		expect(findNode(next, "l9")?.terminalId).toBe("t9");
		expect(findNode(tree, "l2")?.id).toBe("l2");
	});

	it("removeNode drops target; null when tree empties", () => {
		const two = branch("b", [leaf("a"), leaf("c")]);
		const after = removeNode(two, "a");
		expect(after && collectLeaves(after).map((l) => l.id)).toEqual(["c"]);
		expect(removeNode(leaf("solo"), "solo")).toBeNull();
	});
});
```

`split-layout-geometry.test.ts`:

```ts
import { expect, it } from "vitest";
import { computePaneBounds, computeResizeHandleBounds } from "./split-layout-geometry";
import type { SplitBranch, SplitLeaf } from "./split-layout";

const leaf = (id: string): SplitLeaf => ({ type: "leaf", id, kind: "terminal", terminalId: null });

it("two-way horizontal split yields left/right halves", () => {
	const b: SplitBranch = { type: "branch", id: "b", direction: "horizontal", children: [leaf("l"), leaf("r")] };
	const bounds = computePaneBounds(b);
	expect(bounds).toHaveLength(2);
	const byId = Object.fromEntries(bounds.map((p) => [p.paneId, p]));
	expect(byId["l"].left).toBeCloseTo(0);
	expect(byId["l"].width).toBeCloseTo(0.5);
	expect(byId["r"].left).toBeCloseTo(0.5);
	expect(byId["l"].height).toBeCloseTo(1);
});

it("ratios override equal split", () => {
	const b: SplitBranch = { type: "branch", id: "b", direction: "vertical", children: [leaf("t"), leaf("d")], ratios: [0.25, 0.75] };
	const byId = Object.fromEntries(computePaneBounds(b).map((p) => [p.paneId, p]));
	expect(byId["t"].height).toBeCloseTo(0.25);
	expect(byId["d"].top).toBeCloseTo(0.25);
});

it("one resize handle per divider", () => {
	const b: SplitBranch = { type: "branch", id: "b", direction: "horizontal", children: [leaf("l"), leaf("m"), leaf("r")] };
	const handles = computeResizeHandleBounds(b);
	expect(handles).toHaveLength(2);
	expect(handles[0].branchId).toBe("b");
	expect(handles.map((h) => h.dividerIndex)).toEqual([0, 1]);
});
```

`workspace-persistence.test.ts`:

```ts
import { expect, it } from "vitest";
import { deserializeNode, serializeNode } from "./workspace-persistence";
import type { SplitBranch } from "./split-layout";

it("serialize/deserialize round-trips tree shape", () => {
	const tree: SplitBranch = {
		type: "branch", id: "b1", direction: "vertical", ratios: [0.4, 0.6],
		children: [
			{ type: "leaf", id: "l1", kind: "terminal", terminalId: "t1" },
			{ type: "leaf", id: "l2", kind: "editor", terminalId: null, filePath: "/a/b.ts" },
		],
	};
	const restored = deserializeNode(serializeNode(tree, "pwsh"));
	expect(restored).toMatchObject({
		type: "branch", id: "b1", direction: "vertical", ratios: [0.4, 0.6],
		children: [
			{ type: "leaf", id: "l1", kind: "terminal", terminalId: null },
			{ type: "leaf", id: "l2", kind: "editor", filePath: "/a/b.ts" },
		],
	});
});
```

Ini characterization test: bila hasil run pertama berbeda dari ekspektasi karena perilaku aktual (mis. `removeNode` tidak meng-collapse branch), sesuaikan assertion dengan perilaku SEBENARNYA (itu tujuan characterization) — jangan ubah implementasi.

- [ ] **Step 2: Jalankan — harus FAIL** (`npm run test` — modul belum ada).

- [ ] **Step 3: Pindahkan kode dari `projectStore.ts`**

- Baris ~13–110 (types Split* + tree helpers) → `split-layout.ts`; buat `findNode` dkk. `export`-ed.
- Baris ~112–234 (PaneBounds, ResizeHandleBounds, computePaneBounds, computeResizeHandleBounds) → `split-layout-geometry.ts` (impor tipe dari `./split-layout`).
- Baris ~236–300 (PersistedNode, serializeNode, deserializeNode, createTerminalsForTree) → `workspace-persistence.ts`.
- Di `projectStore.ts`: ganti definisi dengan `import` dari ketiga modul; tambahkan re-export sementara `export * from "../features/workspace/split-layout";` (dst.) agar konsumen lama (mis. `TerminalLayer.tsx` yang memakai `computePaneBounds`) tetap compile.

- [ ] **Step 4: Jalankan test + typecheck — harus PASS**

```bash
npm run test && npm run typecheck
```

- [ ] **Step 5: Gate + commit**

```bash
npm run lint && npm run check:lines && npm run check:boundaries
git add -A
git commit -m "refactor: extract split-layout pure modules from projectStore"
```

---

### Task 8: Belah store — projects-store + workspace-store

**Files:**
- Create: `src/renderer/features/projects/projects-store.ts`, `src/renderer/features/projects/index.ts`, `src/renderer/features/workspace/workspace-store.ts`, `src/renderer/features/workspace/index.ts`
- Modify: semua konsumen `useProjectStore` (temukan dengan `git grep -l "useProjectStore"`)
- Delete: `src/renderer/stores/projectStore.ts`

**Interfaces:**
- Consumes: modul Task 7.
- Produces:
  - `useProjectsStore` — state: `projects, activeProjectId, searchQuery, sidebarCollapsed`; actions: `loadProjects, addProject, deleteProject, renameProject, setActiveProject, setSearchQuery, toggleSidebar, updateProjectLastOpened, reorderProjects, moveProjectToGroup, renameProjectGroup`
  - `useWorkspaceStore` — state: `workspaceTabs, activeTabIds, isRestoring`; actions: `openTerminalTab, openCommandTerminalTab, openSshTerminalTab, openEditorTab, openRemoteEditorTab, openPreviewTab, openSSHManagerTab, openSftpTab, closeTerminalTab, setActiveTerminalTab, markTerminalExited, renameTerminalTab, updatePreviewTabUrl, reorderTabs, splitTerminal, splitTerminalFromEditor, openEditorInSplit, closeSplitPane, setActiveSplitPane, resizeSplitPane, resizeSplitBranch, restoreWorkspace, persistWorkspace, flushPersistWorkspace`
  - Akses lintas-feature: workspace-store membaca data project via `import { useProjectsStore } from "../projects"` (index publik — sesuai boundary rule).

- [ ] **Step 1: Buat `projects-store.ts`**

Pindahkan state + 11 action project/group dari `create<ProjectStore>` (baris ~388–1207; identifikasi lewat daftar di Interfaces) ke `create<ProjectsStore>`. Logika TIDAK diubah. Export `useProjectsStore`. Sertakan `_workspaceRestored` guard & `debouncedSave` di modul yang membutuhkannya (persistence → workspace-store).

- [ ] **Step 2: Buat `workspace-store.ts`**

Pindahkan state tab/terminal/split + 23 action workspace. Setiap tempat yang sebelumnya memakai `get().projects` / `get().activeProjectId` diganti `useProjectsStore.getState().projects` / `.activeProjectId`. Import helper dari `./split-layout`, `./split-layout-geometry`, `./workspace-persistence`. Export `useWorkspaceStore`.

- [ ] **Step 3: Buat index publik**

`features/projects/index.ts`: `export { useProjectsStore } from "./projects-store"; export type { ProjectsStore } from "./projects-store";`
`features/workspace/index.ts`: `export { useWorkspaceStore } from "./workspace-store";` + re-export tipe split-layout yang menjadi API publik workspace.

- [ ] **Step 4: Migrasi semua konsumen**

```bash
git grep -l "useProjectStore"
```

Untuk tiap file: ganti dengan `useProjectsStore` dan/atau `useWorkspaceStore` sesuai field yang dipakai (file yang memakai keduanya mengimpor keduanya). Hapus re-export sementara dari Task 7 Step 3; arahkan import `computePaneBounds` dkk. langsung ke `features/workspace` (via index) atau ke modulnya bagi code di `core/`.

- [ ] **Step 5: Hapus file lama + semua gate**

```bash
git rm src/renderer/stores/projectStore.ts
npm run typecheck && npm run lint && npm run test && npm run check:lines && npm run check:boundaries
```

`check:lines` untuk `workspace-store.ts`: jika masih >400 baris setelah split, daftarkan di `config/max-lines-baseline.txt` dengan angka saat ini (target penurunan di Task 15) — jangan memaksa split ekstra di task ini.

- [ ] **Step 6: Smoke menyeluruh**

`npm run dev`: tambah/hapus/rename project, drag reorder, buka/tutup/rename tab, split horizontal+vertical, resize divider, editor split, restart app → restore workspace & tab. Semua harus identik dengan sebelumnya.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: split projectStore into projects-store and workspace-store"
```

---

### Task 9: Slice settings

**Files:**
- Create/move ke `src/renderer/features/settings/`: `SettingsModal.tsx` (shell), `GeneralSettings.tsx`, `TerminalSettings.tsx`, `AppearanceSettings.tsx`, `NotificationsSettings.tsx`, `AboutSettings.tsx`, `index.ts`
- Move ke `src/renderer/features/remote/`: `RemoteAccessSettings.tsx` + `features/remote/index.ts`
- Create `src/renderer/core/ui/SettingsCard.tsx`, `src/renderer/core/ui/ToggleSwitch.tsx`
- Delete: `src/renderer/components/SettingsModal.tsx`, `RemoteAccessSettings.tsx`

**Interfaces:**
- Consumes: core/stores (Task 6).
- Produces: `features/settings/index.ts` → `export { default as SettingsModal } from "./SettingsModal"`.

- [ ] **Step 1: Ekstrak primitif ke core/ui**

Dari `SettingsModal.tsx`: potong `function SettingsCard` (~baris 194–212) → `core/ui/SettingsCard.tsx`; potong `ToggleSwitch` (cari `function ToggleSwitch`) → `core/ui/ToggleSwitch.tsx`. Keduanya default export.

- [ ] **Step 2: Ekstrak tiap tab menjadi file sendiri**

Potong berdasarkan anchor komentar `// === X Settings ===`: `GeneralSettings` (~215–288), `TerminalSettings` (~291–400), lalu Appearance, Notifications, About, dan helper lain hingga baris ~945 (termasuk `DiscordPresenceToggle` dan blok updater di `AboutSettings`). Setiap file: default export + props interface yang sama persis dengan signature lama.

- [ ] **Step 3: Pindahkan `RemoteAccessSettings.tsx`** ke `features/remote/`; buat `features/remote/index.ts` yang mengekspornya.

- [ ] **Step 4: Bentuk shell `features/settings/SettingsModal.tsx`**

Isi: state tab + local settings + save/close logic (baris 47–192 file lama) + render yang mengimpor komponen tab. Buat `index.ts` (lihat Interfaces).

- [ ] **Step 5: Update konsumen** (`git grep -l "SettingsModal"`) ke import dari `features/settings`; hapus file lama.

- [ ] **Step 6: Gate + smoke**

Gate lengkap + `npm run dev`: buka Settings → klik semua 6 tab → ubah fontSize → Save → restart app → nilai bertahan.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: split SettingsModal into features/settings slice"
```

---

### Task 10: Slice ssh

**Files:**
- Create/move ke `src/renderer/features/ssh/`: `SSHManagerPanel.tsx` (shell), `SSHHostsView.tsx`, `SSHIdentitiesView.tsx`, `SSHKnownHostsView.tsx`, `SSHConnectPrompt.tsx`, `SSHEditForm.tsx`, `SFTPBrowser.tsx`, `use-ssh-connections.ts`, `SSHPanel.tsx`, `index.ts`
- Delete: `src/renderer/components/SSHManagerPanel.tsx`, `SSHPanel.tsx`

**Interfaces:**
- Consumes: core/ui (ContextMenu, ConfirmDialog).
- Produces: `features/ssh/index.ts` → `SSHManagerPanel`, `SSHPanel`, `SFTPBrowser` (Workspace mengimpor `{ SFTPBrowser }`).
- Hook `use-ssh-connections.ts`: `useSshConnections(projectId)` → `{ connections, globalConnections, saveProjectConnections, saveGlobal, matchesSearch, filteredProjectConnections, filteredGlobalConnections }` — state & handler yang sekarang di baris 33–72 & 149–160 `SSHManagerPanel.tsx`.

- [ ] **Step 1: Ekstrak `SFTPBrowser`** (export terpisah di file lama, ±baris 750+) → `SFTPBrowser.tsx`. Typecheck.

- [ ] **Step 2: Ekstrak `SSHEditForm`** (cari `function SSHEditForm`, termasuk `SSHEditSection` state & sub-form basic/auth/advanced, handler test-connection/trust ~baris 518–610) → `SSHEditForm.tsx`. Typecheck.

- [ ] **Step 3: Ekstrak `SSHConnectPrompt`** — JSX inline baris ~228–268 menjadi komponen dengan props `{ connection, onConfirm(password, remember), onCancel, status }`. Typecheck.

- [ ] **Step 4: Buat hook `use-ssh-connections.ts`** sesuai Interfaces; pakai di shell.

- [ ] **Step 5: Ekstrak tiga view** — potong blok render `{activeView === "hosts" && …}` (~269–318) → `SSHHostsView.tsx`; blok identities & knownHosts (setelah ~318) → `SSHIdentitiesView.tsx`, `SSHKnownHostsView.tsx`. Props: data + callback handler dari shell.

- [ ] **Step 6: Shell ramping + `SSHPanel.tsx`** — `SSHManagerPanel.tsx` tersisa: state view/search/editing + switcher 3 view + orkestrasi connect/delete. Pindahkan juga `SSHPanel.tsx` kecil apa adanya. Buat `index.ts`.

- [ ] **Step 7: Update konsumen** — `Workspace.tsx` (import `SSHManagerPanel`, `SFTPBrowser`) dan file lain (`git grep -l "SSHManagerPanel\|SSHPanel"`). Hapus file lama.

- [ ] **Step 8: Gate + smoke SSH** — `npm run dev`: buka SSH Manager → tambah host (form basic/auth/advanced) → test connection → connect dengan password → SFTP browser (list, read file) → known hosts trust/forget. Bandingkan perilaku dengan sebelum refactor.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: split SSHManagerPanel into features/ssh slice"
```

---

### Task 11: Slice git/source

**Files:**
- Create/move ke `src/renderer/features/git/`: `SourcePanel.tsx` (ramping), `git-diff-cache.ts`, `git-file-grouping.ts`, `git-file-status-icon.tsx`, `ChangedFileItem.tsx`, `SkeletonList.tsx`, `GitStatusBar.tsx`, `DiffViewer.tsx`, `DiffModal.tsx`, `use-git-file-status.ts`, `index.ts` + pindahan `components/git/{BranchPicker,CommitBox,GitHistoryPanel}.tsx`
- Test: `git-file-grouping.test.ts`
- Delete: `src/renderer/components/SourcePanel.tsx` dkk.

**Interfaces:**
- Consumes: core/api via `window.connexio`.
- Produces: `features/git/index.ts` → `SourcePanel`, `GitStatusBar`, `DiffViewer`, `DiffModal`, `BranchPicker`, `CommitBox`, `GitHistoryPanel`.
- `git-diff-cache.ts`: konstanta & Map module-level (baris ~50–113 SourcePanel): `filesCache, lastFetchTime, diffCache, inflightFetches, FETCH_COOLDOWN_MS, cacheKey, invalidateDiffCache, evictOldProjectsIfNeeded, trimDiffCache` + limit `MAX_CACHED_PROJECTS/MAX_CACHED_DIFFS/INITIAL_VISIBLE_FILES_PER_GROUP/LOAD_MORE_FILES_STEP`.
- `git-file-grouping.ts` (murni): `groupFiles(files: GitChangedFile[]): GroupedFiles`, `getStatusLabel(status)`, `getFileName(path)`, `getFileDir(path)`, `filterFiles(files, query, group)`, dan export `type FileGroup`, `interface GroupedFiles {staged;modified;untracked;conflicted}`.

- [ ] **Step 1: Tulis test grouping (failing)**

`git-file-grouping.test.ts`:

```ts
import { expect, it } from "vitest";
import { filterFiles, getFileName, groupFiles } from "./git-file-grouping";
import type { GitChangedFile } from "@shared/types";

const f = (path: string, indexStatus: string, worktreeStatus = " "): GitChangedFile =>
	({ path, indexStatus, worktreeStatus } as GitChangedFile);

it("groups by git status", () => {
	const files = [f("a.ts", "M"), f("new.ts", "?"), f("s.ts", "M", "M"), f("c.ts", "U")];
	const g = groupFiles(files);
	expect(g.untracked.map((x) => x.path)).toEqual(["new.ts"]);
	expect(g.conflicted.map((x) => x.path)).toEqual(["c.ts"]);
	expect(g.staged.length + g.modified.length).toBe(2);
});

it("filterFiles matches path substring case-insensitively", () => {
	const files = [f("src/App.tsx", "M"), f("README.md", "M")];
	expect(filterFiles(files, "app", "modified").map((x) => x.path)).toEqual(["src/App.tsx"]);
	expect(filterFiles(files, "", "modified")).toHaveLength(2);
});

it("getFileName returns last segment", () => {
	expect(getFileName("src/deep/file.ts")).toBe("file.ts");
});
```

Catatan: mapping status→group mengikuti tubuh `groupFiles` (baris ~119–150) — baca dulu; bila mapping aktual berbeda (mis. `U` masuk conflicted lewat kombinasi index/worktree), sesuaikan fixture (characterization).

- [ ] **Step 2: Jalankan — FAIL** (`npm run test`).

- [ ] **Step 3: Ekstrak cache & grouping** sesuai Interfaces → `git-diff-cache.ts`, `git-file-grouping.ts`, `git-file-status-icon.tsx` (isi `getStatusIcon` ~148–188). Test + typecheck harus PASS.

- [ ] **Step 4: Ekstrak `ChangedFileItem.tsx`** (memo component ~250–520) dan `SkeletonList.tsx` (~522–541).

- [ ] **Step 5: Pindahkan sisa komponen git** — `SourcePanel.tsx` (yang kini ramping) + `GitStatusBar.tsx`, `DiffViewer.tsx`, `DiffModal.tsx`, folder `components/git/*`, dan `core/hooks/useGitFileStatus.ts` → `features/git/use-git-file-status.ts`. Buat `index.ts`.

- [ ] **Step 6: Update konsumen** (`git grep -l "SourcePanel\|GitStatusBar\|DiffModal\|DiffViewer\|BranchPicker\|CommitBox\|GitHistoryPanel"`). Hapus file lama.

- [ ] **Step 7: Gate + smoke git** — buat perubahan file di repo dummy: status bar update, group staged/modified/untracked benar, stage/unstage/discard per-file & all, diff modal terbuka, commit+push, history tampil.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: split SourcePanel into features/git slice"
```

---

### Task 12: Slice ai

**Files:**
- Create/move ke `src/renderer/features/ai/`: `ai-types.ts`, `ai-providers.ts`, `ai-client.ts`, `ai-storage.ts`, `ai-store.ts`, `AIChatPanel.tsx`, `AIIntegrationsSettings.tsx`, `index.ts`
- Test: `ai-client.test.ts`
- Delete: `src/renderer/stores/aiStore.ts`, `src/renderer/components/ai/`

**Interfaces:**
- Produces:
  - `ai-types.ts`: `AIProviderType, AIProviderConfig, AIMessage, AIConfig, ChatSession` (baris 5–45 aiStore lama)
  - `ai-providers.ts`: `DEFAULT_PROVIDERS` (~79–146), `DEFAULT_CONFIG` (~147–155), `getBaseUrl(provider)` (~740–750)
  - `ai-client.ts` (murni, tanpa zustand): `fetchAIResponse(provider, model, messages): Promise<string>`, `fetchAIResponseStreaming(provider, model, messages, signal, onChunk): Promise<void>`, `readSSEStream(response, signal, onData): Promise<void>` (baris ~479–783)
  - `ai-storage.ts`: `loadConfigFromStorage, saveConfigToStorage, loadChatSessions, saveChatSessions` (~157–208)
  - `ai-store.ts`: `useAIStore` (~216–477) + `currentAbortController`

- [ ] **Step 1: Tulis test client (failing)**

`ai-client.test.ts`:

```ts
import { expect, it, vi } from "vitest";
import { readSSEStream } from "./ai-client";

it("readSSEStream emits each data frame", async () => {
	const res = new Response("data: hello\n\ndata: world\n\n");
	const onData = vi.fn();
	await readSSEStream(res, new AbortController().signal, onData);
	expect(onData.mock.calls.map((c) => c[0])).toEqual(["hello", "world"]);
});
```

Jika signature/semantik aktual `readSSEStream` berbeda (baca tubuh ~752–783), sesuaikan test ke perilaku aktual — characterization.

- [ ] **Step 2: Jalankan — FAIL.**

- [ ] **Step 3: Ekstrak 5 modul** sesuai Interfaces (potong dari `aiStore.ts`). `ai-store.ts` mengimpor dari keempat modul lain. Test + typecheck PASS.

- [ ] **Step 4: Pindahkan `AIChatPanel.tsx` & `AIIntegrationsSettings.tsx`** ke feature; buat `index.ts` (`export { default as AIChatPanel } …; export { useAIStore } …`).

- [ ] **Step 5: Update konsumen** (`git grep -l "aiStore\|AIChatPanel\|AIIntegrationsSettings"` — termasuk `Workspace.tsx` dan `SettingsModal`). Hapus file lama.

- [ ] **Step 6: Gate + smoke AI** — buka AI panel → pilih provider → kirim pesan (streaming jalan) → stop di tengah → sesi tersimpan setelah restart.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: split aiStore into features/ai slice"
```

---

### Task 13: Slice workspace + terminal (komposisi akhir renderer)

**Files:**
- Move ke `src/renderer/features/terminal/`: `Terminal.tsx`, `TerminalLayer.tsx`, `ShellPicker.tsx`, `SearchPanel.tsx`
- Move ke `src/renderer/features/workspace/`: `Workspace.tsx` (ramping), `WorkspaceTab.tsx`, `WorkspaceTabBar.tsx` (baru), `SidePanelHost.tsx` (baru), `WebPreview.tsx`
- Move ke `src/renderer/features/editor/`: `CodeEditor.tsx` (+ index), `RemoteEditorWrapper.tsx` (potong dari Workspace.tsx ~720–768)
- Move ke `src/renderer/features/explorer/`: `FileExplorer.tsx`, `ExplorerContextMenu.tsx`, `index.ts`
- Move ke `src/renderer/features/tasks/`: `TaskPanel.tsx`, `index.ts`
- Move ke `src/renderer/features/projects/`: `Sidebar.tsx`, `AddProjectModal.tsx`
- Move ke `src/renderer/features/remote/`: `RemoteLoginGate.tsx`, `RemoteMobileShell.tsx`, `RemoteConnectionBadge.tsx`, `RemotePowerControls.tsx`
- Move ke `src/renderer/features/notifications/`: `NotificationBell.tsx`, `NotificationToast.tsx`, `index.ts`
- Modify: `src/renderer/App.tsx` (composition root), `Workspace.tsx`

**Interfaces:**
- Consumes: semua feature sebelumnya.
- Produces: struktur final renderer §3 spec; setiap feature punya `index.ts`.

- [ ] **Step 1: `git mv` semua file di atas** ke folder feature masing-masing.

- [ ] **Step 2: Ekstrak dari `Workspace.tsx`**
- `RemoteEditorWrapper` (~720–768) → `features/editor/RemoteEditorWrapper.tsx`.
- Tab bar (render daftar `WorkspaceTab` + tombol add/split) → `WorkspaceTabBar.tsx` (props: tabs, activeTabId, callbacks).
- Side panel rail + header + switching konten (`SidePanelTab` union) → `SidePanelHost.tsx` (props: activePanel, project, callbacks; memakai `SidePanelRail`/`SidePanelHeader` dari core/ui).
- `Workspace.tsx` tersisa komposisi ramping. Jika masih >400 baris, daftarkan baseline (turunkan di Task 15 bila memungkinkan).

- [ ] **Step 3: Buat `index.ts` untuk setiap feature** yang belum punya; `App.tsx` hanya mengimpor dari `features/*/` dan `core/*`.

- [ ] **Step 4: Perbarui semua import** — `npm run typecheck` sampai hijau; lalu gate lengkap.

- [ ] **Step 5: Smoke penuh** — seluruh alur: project → tab terminal → split → editor → explorer → tasks → preview → SSH → AI → settings → remote mode. Bandingkan dengan checklist smoke task-task sebelumnya.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: finalize feature slices and slim Workspace composition"
```

---

### Task 14: Rust — split `ssh.rs` + cargo test + fmt/clippy gate

**Files:**
- Convert: `src-tauri/src/modules/ssh.rs` → `src-tauri/src/modules/ssh/`
  - `mod.rs` (re-export publik), `types.rs`, `storage.rs`, `command_builder.rs`, `trust.rs`, `connection.rs`, `sftp.rs`, `secrets.rs`
- Modify: `config/max-lines-baseline.txt` (hapus entri ssh.rs)

**Interfaces:**
- Produces: path publik TIDAK berubah — `modules::ssh::ssh_list` dkk. tetap resolve via re-export `mod.rs`, sehingga `lib.rs` (invoke_handler) tidak perlu diubah.

- [ ] **Step 1: Tulis test characterization dulu** — tambah di calon `command_builder.rs` (test inline `#[cfg(test)]`):

```rust
#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn build_command_args_includes_port_and_target() {
		let conn = SSHConnection {
			id: "x".into(), name: "x".into(), host: "example.com".into(), port: 2222,
			username: "user".into(), authMethod: SSHAuthMethod::Password,
			privateKeyPath: None, passphraseSecretRef: None, passwordSecretRef: None,
			folder: None, tags: None, startupCommand: None, tunnel: None,
		};
		let args = ssh_build_command_args(conn);
		assert!(args.iter().any(|a| a == "-p"));
		assert!(args.iter().any(|a| a == "2222"));
		assert!(args.iter().any(|a| a.contains("user@example.com")));
	}

	#[test]
	fn shell_quote_wraps_spaces() {
		assert_eq!(shell_quote("a b".into()), "'a b'");
	}
}
```

Field struct sesuaikan definisi aktual `SSHConnection` (baris ~30–59 ssh.rs) — isi semua field yang wajib. Ekspektasi `shell_quote` verifikasi dari tubuh fungsi (~213–230); sesuaikan bila quoting aktual berbeda (characterization).

- [ ] **Step 2: Jalankan — FAIL** (modul belum ada).

```bash
cd src-tauri && cargo test ssh
```

- [ ] **Step 3: Konversi `ssh.rs` → folder modul**

```bash
mkdir src-tauri/src/modules/ssh && git mv src-tauri/src/modules/ssh.rs src-tauri/src/modules/ssh/mod.rs
```

Pindahkan berdasarkan tanggung jawab (baris pendekatan):
- `types.rs`: struct/enum baris ~30–167
- `storage.rs`: path helpers ~12–26 + `ssh_list/ssh_save/ssh_list_global/ssh_save_global` ~169–211 + load/save known-hosts ~307–316
- `command_builder.rs`: `shell_quote` + `ssh_build_command` + `ssh_build_command_args` ~213–291
- `trust.rs`: fingerprint/trust status + `ssh_known_hosts_list/ssh_trust_host/ssh_forget_host` + timestamp ~293–360, `ssh_forget_openssh_host` ~724–745
- `connection.rs`: `ssh_test_connection` + `ssh_connect_session` ~362–575
- `sftp.rs`: semua `ssh_sftp_*` ~577–691
- `secrets.rs`: `ssh_secret_*` + `ssh_key_exists` ~693–750

`mod.rs` berisi `pub mod …;` + `pub use` semua item yang sebelumnya publik.

- [ ] **Step 4: Hijaukan**

```bash
cd src-tauri && cargo fmt && cargo clippy -- -D warnings && cargo test
npm run typecheck   # frontend tidak terpengaruh — verifikasi
```

- [ ] **Step 5: Update baseline** — hapus baris `ssh.rs` dari `config/max-lines-baseline.txt`; `npm run check:lines`.

- [ ] **Step 6: Smoke SSH end-to-end** — connect host, SFTP, trust/forget, secret keychain.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: split ssh.rs into focused submodules with tests"
```

---

### Task 15: Rust — split `remote/server.rs` + cargo test

**Files:**
- Modify: `src-tauri/src/modules/remote/server.rs` (ramping), `src-tauri/src/modules/remote/mod.rs`
- Create di `src-tauri/src/modules/remote/`: `state.rs`, `commands.rs`, `http.rs`, `websocket.rs`, `pty_bridge.rs`, `wol.rs`, `power.rs`, `tailscale.rs`
- Modify: `config/max-lines-baseline.txt`

**Interfaces:**
- Produces: `RemoteAccessState` & tauri commands tetap resolve dari `modules::remote` (re-export via `mod.rs` — lib.rs tidak berubah).

- [ ] **Step 1: Tulis test dulu (failing)** — di `wol.rs`:

```rust
#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn parses_valid_mac() {
		assert_eq!(parse_mac("aa:bb:cc:dd:ee:ff").unwrap(), [0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff]);
	}

	#[test]
	fn rejects_invalid_mac() {
		assert!(parse_mac("not-a-mac").is_err());
		assert!(parse_mac("aa:bb:cc:dd:ee").is_err());
	}
}
```

Dan di `state.rs`:

```rust
#[test]
fn generated_pin_has_expected_length_and_digits() {
	let pin = generate_pin();
	assert_eq!(pin.len(), PIN_LENGTH);
	assert!(pin.chars().all(|c| c.is_ascii_digit()));
}
```

- [ ] **Step 2: Jalankan — FAIL** (`cargo test remote`).

- [ ] **Step 3: Pindahkan kode** dari `server.rs`:
- `state.rs`: konstanta ~24–29, `ClientSender`, `RemoteClientInfo`, `RemoteState`, `RemoteAccessState`, `generate_pin`, `now_secs`
- `commands.rs`: semua `#[tauri::command]` remote_* ~114–308
- `http.rs`: `AuthRequest`, `WsQueryParams`, `handle_auth`, `ws_upgrade`, `serve_fallback`, `resolve_frontend_dir`
- `websocket.rs`: `handle_ws_client`, `handle_client_message`, `send_to_client`, `gather_init_state`
- `pty_bridge.rs`: `write_session`, `resize_session`
- `wol.rs`: `send_magic_packet`, `parse_mac`
- `power.rs`: `run_power_action` + `lock_host`/`sleep_host` per-platform
- `tailscale.rs`: semua `detect_tailscale_ip*` + `is_tailscale_ipv4`

`server.rs` menjadi orkestrator tipis (router axum + start/stop internals) ATAU ikut pindah ke `commands.rs` bila lebih rapi — pilih yang menghasilkan file ≤400 baris. `mod.rs`: `pub mod server; pub mod protocol; pub mod state; …` + `pub use state::RemoteAccessState;` dst.

- [ ] **Step 4: Hijaukan**

```bash
cd src-tauri && cargo fmt && cargo clippy -- -D warnings && cargo test
```

- [ ] **Step 5: Update baseline** (hapus entri `remote/server.rs`) + `npm run check:lines`.

- [ ] **Step 6: Smoke remote penuh** — start remote → login PIN/trusted token → mobile shell → lock/sleep control → WOL → Tailscale URL → restart app → reconnect.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: split remote server.rs into focused submodules with tests"
```

---

### Task 16: Perketat ratchet, bersihkan legacy, finalisasi docs

**Files:**
- Modify: `config/max-lines-baseline.txt`, `README.md` (bagian Project Structure), `AGENTS.md` (final pass)
- Verify: semua kriteria sukses spec §11

**Interfaces:**
- Consumes: hasil Task 1–15.
- Produces: keadaan final Phase 1 yang releasable.

- [ ] **Step 1: Audit baseline** — untuk setiap entri tersisa di `max-lines-baseline.txt`, coba turunkan dengan split ringan bila jelas (≤30 menit per file); sisanya tetap sebagai utang terdokumentasi. File yang sudah di-split TAPI masih terdaftar → hapus entrinya (checker akan FAIL jika file terhapus masih terdaftar — lihat Task 2 Step 3).

- [ ] **Step 2: Jalankan seluruh gate dari nol**

```bash
npm run typecheck && npm run lint && npm run test && npm run check:lines && npm run check:boundaries
cd src-tauri && cargo fmt --check && cargo clippy -- -D warnings && cargo test
```

- [ ] **Step 3: Verifikasi kriteria sukses spec §11 satu per satu** (tulis checklist di PR description):
  - [ ] Tidak ada file >400 baris di luar baseline
  - [ ] Semua target §4 spec ter-split
  - [ ] CI workflow hijau di PR
  - [ ] Test characterization + cargo test hijau
  - [ ] AGENTS.md & STYLEGUIDE.md ter-commit
  - [ ] Bentuk `window.connexio` tidak berubah (test api-shape hijau)

- [ ] **Step 4: Update `README.md` bagian "Project Structure"** agar mencerminkan layout `core/` + `features/` yang baru.

- [ ] **Step 5: Commit + buat PR**

```bash
git add -A
git commit -m "chore: tighten max-lines baseline and finalize refactor docs"
```

Smoke final menyeluruh (desktop + remote mode) sebelum merge.

---

## Urutan & Dependensi

```
T1 → T2 → T3 (paralel setelah T2)
T2 → T4 → T5 → T6 → T7 → T8 → {T9, T10, T11, T12, T13} (boleh paralel, hati-hati overlap Workspace.tsx) → T14, T15 (paralel) → T16
```

Catatan overlap: T10, T12, T13 sama-sama menyentuh `Workspace.tsx` — bila diparalelkan, gabungkan kembali lewat merge/rebase dan jalankan ulang semua gate.
