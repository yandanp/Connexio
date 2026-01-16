# Connexio Marketing Website

Marketing website for Connexio - A modern terminal application built with Tauri and React.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript 5.8
- **UI Library:** React 19 + shadcn/ui
- **Styling:** Tailwind CSS 4.x
- **Animations:** Framer Motion
- **Icons:** Lucide React

## Project Structure

```
connexio-marketing/
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Root layout with metadata
│   │   ├── page.tsx           # Homepage
│   │   ├── globals.css        # Global styles
│   │   ├── demo/              # Demo page
│   │   ├── guide/             # Getting started guide
│   │   └── download/          # Download page
│   ├── components/
│   │   ├── ui/                # shadcn/ui components
│   │   └── landing/           # Landing page components
│   └── lib/
│       └── utils.ts           # Utility functions
├── public/
│   └── images/
│       └── screenshots/       # Screenshot placeholders
├── next.config.ts
├── tailwind.config.ts
├── components.json
└── package.json
```

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Run development server:

   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Adding Screenshots

The website currently uses placeholder SVG images for screenshots. To add real screenshots:

1. Take screenshots of the Connexio application
2. Save them as PNG files in `public/images/screenshots/`:
   - `screenshot-main.png` - Main terminal interface
   - `screenshot-sidebar.png` - Workspace sidebar
   - `screenshot-settings.png` - Settings page
   - `screenshot-themes.png` - Themes showcase
   - `screenshot-features.png` - Features showcase

3. Recommended screenshot size: 1920x1080 (Full HD)
4. Use transparent or dark backgrounds for best results

## Deployment

The site can be deployed to:

- **Vercel:** Native Next.js support
- **Netlify:** Easy setup with automatic builds
- **Cloudflare Pages:** Edge caching for fast global delivery

## Pages

1. **Home** (`/`) - Landing page with hero, features, testimonials, and CTA
2. **Demo** (`/demo`) - Interactive demo with feature walkthroughs
3. **Guide** (`/guide`) - Getting started guide with installation steps
4. **Download** (`/download`) - Download buttons and release notes

## Customization

### Colors

Edit `src/app/globals.css` to customize the color theme.

### Content

Edit the page files in `src/app/` to customize content.

### Images

Replace placeholder images in `public/images/` with your own.

## License

MIT
