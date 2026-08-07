# Connexio — Style Guide

Acuan visual tunggal untuk semua UI Connexio. Semua nilai di bawah diinventarisasi dari kode aktual
(`src/renderer/styles/globals.css` + `tailwind.config.js`). Jangan mengarang token/kelas baru.

- Sumber token: `src/renderer/styles/globals.css` (blok `:root`)
- Sumber palette Tailwind: `tailwind.config.js` (`theme.extend.colors.connexio`)
- Tema: dark-only. Tidak ada light mode.

## 1. Token CSS (`--*`) — 18 token

Warna latar & teks membentuk "ramp" gelap→terang. Pakai token, jangan hardcode hex.

### Latar (bg)

| Token | Nilai | Makna |
| --- | --- | --- |
| `--bg-primary` | `#090d14` | Latar dasar app (paling gelap) |
| `--bg-secondary` | `#101622` | Latar panel/permukaan utama |
| `--bg-tertiary` | `#172033` | Latar card/input (naik satu tingkat) |
| `--bg-elevated` | `#1b2638` | Latar hover/elevasi (paling terang) |

### Border

| Token | Nilai | Makna |
| --- | --- | --- |
| `--border-color` | `#263348` | Border default |
| `--border-subtle` | `rgba(148,163,184,0.12)` | Border sangat tipis |

### Aksen

| Token | Nilai | Makna |
| --- | --- | --- |
| `--accent-color` | `#38bdf8` | Aksen utama (fokus, selection, CTA) |
| `--accent-hover` | `#0ea5e9` | Aksen saat hover |
| `--accent-secondary` | `#8b5cf6` | Aksen sekunder (ungu) |

### Status

| Token | Nilai | Makna |
| --- | --- | --- |
| `--success-color` | `#34d399` | Sukses / terhubung |
| `--warning-color` | `#fbbf24` | Peringatan |
| `--danger-color` | `#fb7185` | Error / bahaya |

### Teks

| Token | Nilai | Makna |
| --- | --- | --- |
| `--text-primary` | `#e5eefb` | Teks utama |
| `--text-secondary` | `#9fb1ca` | Teks pendukung |
| `--text-muted` | `#65758d` | Teks redup / label |

### Shadow & skala

| Token | Nilai | Makna |
| --- | --- | --- |
| `--shadow-soft` | `0 18px 50px rgba(0,0,0,0.34)` | Drop shadow panel melayang |
| `--shadow-inset` | `inset 0 1px 0 rgba(255,255,255,0.035)` | Highlight tepi atas (kesan kaca) |
| `--ui-font-size` | `13px` (default) | Basis ukuran font UI |

`--ui-font-size` di-scalar via atribut `data-ui-size`: `small`=11px, `default`=13px, `large`=15px.
Jangan set font-size manual untuk teks yang harus mengikuti skala ini.

## 2. Palette Tailwind (`connexio-*`) — 12 kunci

Dipetakan 1:1 ke token di atas (lihat `tailwind.config.js`). Pakai sebagai utility Tailwind:
`bg-connexio-*`, `text-connexio-*`, `border-connexio-*`, dll.

| Kunci palette | Token | Contoh pakai |
| --- | --- | --- |
| `connexio-bg` | `--bg-primary` | `bg-connexio-bg` |
| `connexio-bg-secondary` | `--bg-secondary` | `bg-connexio-bg-secondary` |
| `connexio-bg-tertiary` | `--bg-tertiary` | `bg-connexio-bg-tertiary` |
| `connexio-bg-elevated` | `--bg-elevated` | `bg-connexio-bg-elevated` |
| `connexio-border` | `--border-color` | `border-connexio-border` |
| `connexio-border-subtle` | `--border-subtle` | `border-connexio-border-subtle` |
| `connexio-accent` | `--accent-color` | `text-connexio-accent` |
| `connexio-accent-hover` | `--accent-hover` | `bg-connexio-accent-hover` |
| `connexio-accent-secondary` | `--accent-secondary` | `text-connexio-accent-secondary` |
| `connexio-text` | `--text-primary` | `text-connexio-text` |
| `connexio-text-secondary` | `--text-secondary` | `text-connexio-text-secondary` |
| `connexio-text-muted` | `--text-muted` | `text-connexio-text-muted` |

## 3. Kelas utilitas — 9 kelas inti (+ varian)

Didefinisikan di `globals.css`. Kapan dipakai:

| Kelas | Kapan dipakai |
| --- | --- |
| `glass-panel` | Permukaan/panel melayang (popup, overlay). Sudah blur + tinted bg. |
| `dock-button` | Tombol ikon navigasi di dock/sidebar. |
| `dock-button-active` | State aktif dari `dock-button` (item terpilih). |
| `field-soft` | Input/textarea/select; beri ring aksen otomatis saat fokus. |
| `soft-card` | Card konten statis dengan sudut membulat. |
| `soft-card-hover` | Card interaktif yang perlu feedback hover. |
| `section-label` | Label bagian kecil uppercase (heading grup di panel). |
| `soft-separator-top` / `-right` / `-bottom` / `-left` | Garis pemisah 1px antar blok (pilih sisi sesuai arah). |

Varian pendukung lain yang sah (juga dari `globals.css`):
`app-surface` (bg root app), `connexio-pill` (badge/pill), `titlebar-drag` / `titlebar-no-drag`
(region drag jendela), `interaction-lift` (lift saat hover), `resize-rail-active` (handle resize aktif),
`animate-slide-up` / `animate-fade-scale` / `animate-panel-in` (animasi masuk), `line-clamp-2`.

## 4. Aturan

- UI baru WAJIB memakai token/kelas yang sudah ada di dokumen ini.
- DILARANG menambah nilai warna / spacing / font baru bila token sudah mencakup.
- Butuh nilai baru yang benar-benar belum tercover? Tambah sebagai token di `:root`
  (atau palette `connexio`), lalu rujuk token itu — jangan hardcode hex/px di komponen.
- Jangan re-implement efek `glass`/`soft` dengan CSS inline; pakai kelas utilitas yang ada.
- Ukuran teks yang harus mengikuti preferensi user wajib lewat `--ui-font-size`.

## 5. Urutan resolusi bila STYLEGUIDE diam

Jika dokumen ini tidak mengatur suatu kasus, ikuti preseden terdekat dengan urutan:

1. Komponen terdekat di **feature yang sama** (`src/renderer/features/<domain>/`)
2. Komponen di **core/ui** (`src/renderer/core/ui/`)
3. **`App.tsx`** (`src/renderer/App.tsx`)

Jika tetap ambigu, tanyakan sebelum menambahkan pola/token baru.
