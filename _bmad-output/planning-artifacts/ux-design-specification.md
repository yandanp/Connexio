---
stepsCompleted: ["step-01-init", "step-02-discovery", "step-03-core-experience", "step-04-emotional-response", "step-05-inspiration", "step-06-design-system", "step-07-defining-experience", "step-08-visual-foundation", "step-09-design-directions", "step-10-user-journeys", "step-11-component-strategy", "step-12-ux-patterns", "step-13-responsive-accessibility", "step-14-complete"]
workflowComplete: true
completedAt: 2026-01-14
inputDocuments:
  - product-brief-Connexio-2026-01-14.md
  - prd.md
date: 2026-01-14
author: Bos Yanda
project_name: Connexio
---

# UX Design Specification Connexio

**Author:** Bos Yanda
**Date:** 2026-01-14

---

## Executive Summary

### Project Vision

**Connexio** adalah terminal modern untuk Windows yang mengatasi frustrasi developer dengan terminal bawaan yang membosankan dan tidak praktis. Fokus utama pada dua pilar:

1. **Session Persistence** (Killer Feature) - Auto-save dan restore seluruh workspace terminal termasuk tabs, working directories, dan command history
2. **Beautiful Themes** - Tampilan visual yang nyaman di mata dengan pilihan tema modern

Dibangun dengan **Tauri (Rust backend + React frontend)** untuk performa native yang ringan dan stabil - bukan Electron yang lambat.

**Vision Statement:** *"The Warp for Windows"* - terminal yang menjadi standar baru untuk developer Windows dengan komunitas aktif.

### Target Users

#### Primary Persona: Andi - The Vibe Coder

| Attribute | Detail |
|-----------|--------|
| **Profile** | Junior Developer, 24 tahun, coding dengan AI assistance |
| **Environment** | Windows, coding setiap hari, multiple AI tools |
| **Pain Points** | Harus reopen terminal setiap hari, ribet navigasi ke direktori project, Windows Terminal sering crash saat pakai AI tools |
| **Success Vision** | Buka Connexio → semua tabs langsung restore dengan direktori yang benar, terminal enak dilihat |
| **Quote** | *"Saya cuma mau buka terminal dan langsung kerja, bukan habiskan 10 menit setup dulu."* |

#### Secondary Persona: Budi - The Power User

| Attribute | Detail |
|-----------|--------|
| **Profile** | Senior Developer, 32 tahun, heavy terminal usage |
| **Environment** | Windows, multiple projects, berbagai CLI tools |
| **Pain Points** | Manage banyak terminal untuk project berbeda, kehilangan command history saat crash |
| **Success Vision** | Workspace tersimpan per project, command history tidak hilang, terminal ringan tapi powerful |
| **Quote** | *"Terminal adalah rumah kedua saya, harus nyaman dan efisien."* |

### Key Design Challenges

| Challenge | Description | Priority |
|-----------|-------------|----------|
| **First-Time Experience** | User harus langsung "get it" dalam 30 detik - install → pilih theme → productive | Critical |
| **Session Trust** | User harus PERCAYA bahwa session akan ter-restore 100% - butuh visual feedback yang jelas dan konsisten | Critical |
| **Tab Management Scale** | Support 10+ tabs tanpa clutter atau confusion - power users punya banyak project aktif | High |
| **Theme Selection UX** | Theme picker harus intuitive dengan live preview - ini adalah "Aha moment" pertama user | Medium |
| **Settings Discoverability** | Settings harus accessible tapi tidak mengganggu workflow - power users butuh control | Medium |

### Design Opportunities

| Opportunity | Description | Competitive Advantage |
|-------------|-------------|----------------------|
| **"Magic Moment" Design** | Design restore experience yang feels like magic - instant, reliable, dengan visual feedback | Key differentiator dari Windows Terminal |
| **Emotional Theme Experience** | Themes bukan cuma colors, tapi "vibe" - naming yang evocative (Tokyo Night, Dracula, etc) | Creates personal connection |
| **Zero-Config Philosophy** | Everything works out of the box, no setup ritual required | Appeals strongly to Vibe Coders |
| **Confidence Indicators** | Visual cues bahwa "your session is safe" - subtle but reassuring feedback | Builds long-term trust |
| **Native Performance Feel** | UI yang responsive dan snappy - feels faster than competitors | Reinforces Tauri advantage |

---

## Core User Experience

### Defining Experience

**Core Action:** "Buka Connexio → Langsung produktif dengan semua tabs dan directories ter-restore"

Ini adalah defining experience Connexio. Session restore yang reliable dan instant adalah fondasi dari seluruh product value. Jika ini gagal, semua fitur lain tidak berarti.

**User Mental Model:**
- "Connexio remembers everything for me"
- "I can close anytime without worry"
- "My terminal is always ready"

### Platform Strategy

| Aspect | Decision |
|--------|----------|
| Platform | Windows Desktop (MVP), Cross-platform (v2.0) |
| Input Model | Keyboard-first, mouse-supported |
| Framework | Tauri (Rust backend + React frontend) |
| Offline | 100% offline capable, no telemetry |
| Performance | Native speed (<1.5s startup, <16ms input latency) |

### Effortless Interactions

| Interaction | Design Goal |
|-------------|-------------|
| Session Restore | Automatic, instant, invisible - no user action required |
| Theme Selection | Live preview, one-click apply, no restart |
| New Tab | Ctrl+T → ready instantly with correct shell |
| Tab Switching | Ctrl+Tab atau click → instant response |
| Directory Memory | Each tab remembers its last directory |
| App Close | Just close - everything auto-saved, no confirmation |

### Critical Success Moments

| Moment | User Experience | Success Indicator |
|--------|-----------------|-------------------|
| First Restore | Close app → reopen → all tabs back | "Wow, it actually works!" |
| First Theme | Pick theme → instant preview → apply | "This feels like mine" |
| Trust Established | Close laptop without thinking | User doesn't even consider saving |
| Speed Recognition | App launches instantly | "This is faster than Windows Terminal" |
| Crash Recovery | System crash → everything recovered | "I can trust this completely" |

### Experience Principles

1. **"Session is Sacred"** - Every tab, directory, and command history belongs to the user. It must NEVER be lost.

2. **"Zero Setup, Instant Productive"** - User opens app → immediately works. No wizards, no config, no blocking "getting started".

3. **"Keyboard-First, Mouse-Friendly"** - Everything achievable via keyboard for power users, but mouse is intuitive for casual users.

4. **"Quiet Confidence"** - App doesn't announce "session saved". User knows because it always works. Trust through reliability.

5. **"Native Speed Feels Right"** - Every interaction must be responsive (<16ms latency). Lag = broken experience.

---

## Desired Emotional Response

### Primary Emotional Goals

| Moment | Desired Emotion | Design Implication |
|--------|-----------------|-------------------|
| Opening App | Relief + Readiness | Instant productive, no setup required |
| Session Restore | Surprise → Trust | First time "wow", then silent reliability |
| Daily Use | Flow + Comfort | Terminal feels like "home" |
| Theme Selection | Ownership + Pride | Personal expression through aesthetics |
| Closing App | Confidence | Zero anxiety about data loss |

### Emotional Journey Mapping

| Stage | Target Emotion | Avoid |
|-------|----------------|-------|
| Discovery | Curiosity, Intrigue | Confusion, Skepticism |
| First Open | Anticipation, Pleasant Surprise | Overwhelm, Intimidation |
| Aha Moment | Delight, Relief, Wonder | Disappointment, Doubt |
| Daily Use | Comfort, Efficiency, Flow | Frustration, Boredom |
| Long-term | Trust, Loyalty, Advocacy | Regret, Desire to switch |

### Micro-Emotions

| Micro-Emotion | Target | Design Approach |
|---------------|--------|-----------------|
| Confidence vs Confusion | High Confidence | Clear visual hierarchy, obvious affordances |
| Trust vs Skepticism | Deep Trust | Consistent behavior, reliable saves |
| Calm vs Anxiety | Calm | No confirmation dialogs, quiet auto-save |
| Control vs Helplessness | In Control | Keyboard shortcuts, predictable behavior |
| Belonging vs Alienation | Belonging | Themes that resonate personally |

### Design Implications

**Positive Emotion Triggers:**
- Smooth animations for session restore (delight)
- Silent auto-save without notifications (trust)
- Instant keyboard response (control)
- Beautiful, evocative theme names (belonging)
- Consistent, predictable behavior (comfort)

**Negative Emotion Prevention:**
- No "Are you sure?" confirmation dialogs (prevents anxiety)
- No visible loading states if < 200ms (prevents frustration)
- Sensible defaults without setup wizards (prevents overwhelm)
- 99.5% session restore reliability (prevents disappointment)

### Emotional Design Principles

1. **"Trust Through Silence"** - Don't announce reliability. Demonstrate it. No "session saved" toasts.

2. **"Delight Once, Deliver Always"** - First restore is "wow", subsequent restores are invisible reliability.

3. **"Calm by Default"** - No popups, no confirmations, no interruptions. Just works.

4. **"Ownership Through Beauty"** - Themes aren't just colors. They're identity. Make selection feel significant.

5. **"Speed Equals Respect"** - Lag disrespects user's time. Native performance shows we care.


---

## UX Pattern Analysis & Inspiration

### Inspiring Products Analysis

#### Warp (macOS Terminal)
**What They Do Well:**
- Modern, clean visual design that feels like an IDE
- Built with Rust for native performance
- Instant start with beautiful defaults
- Innovation in command output (block-based)

**Transferable Insight:** Modern visual language for terminals is accepted by users. Terminals don't have to look "ugly".

#### VS Code
**What They Do Well:**
- Session restore that reopens exactly same files/tabs (trust established)
- Clean tab management with drag-to-reorder
- Theme system with live preview and huge variety
- Search-first settings with sensible defaults

**Transferable Insight:** Reliable session restore is EXPECTED behavior for modern apps. VS Code set this standard.

#### iTerm2 (macOS Terminal)
**What They Do Well:**
- Session persistence with profiles and arrangements
- Intuitive split panes with easy navigation
- Deep customization with sensible defaults
- Rock-solid reliability

**Transferable Insight:** Power users want BOTH simplicity (defaults) AND depth (customization). Progressive disclosure works.

#### Windows Terminal (Competitor - Anti-Patterns)
**What They Do Wrong:**
- No session persistence (biggest pain point)
- Crashes with heavy output from AI tools
- Confusing JSON-based settings
- Poor theme discovery
- Slow startup and lag

**Anti-Pattern Learning:** Windows Terminal proves there's a gap in the market.

### Transferable UX Patterns

**Navigation Patterns:**
| Pattern | Application for Connexio |
|---------|-------------------------|
| Tab Bar with Overflow | Overflow menu for 10+ tabs instead of tiny tabs |
| Keyboard-First Navigation | Ctrl+Tab, Ctrl+1-9 for quick tab switch |
| Context Menu on Tab | Right-click → close, close others, duplicate |

**Interaction Patterns:**
| Pattern | Application for Connexio |
|---------|-------------------------|
| Live Preview | Theme picker shows instant preview |
| Quiet Auto-Save | No "save" button, just works silently |
| Drag-to-Reorder | Tabs can be reordered naturally |

**Visual Patterns:**
| Pattern | Application for Connexio |
|---------|-------------------------|
| Semantic Colors | Use color to communicate state |
| Minimal Chrome | Maximum terminal space, minimal UI |
| Evocative Theme Names | "Tokyo Night" not "Dark Theme 1" |
| Subtle Animations | Smooth transitions, not jarring |

### Anti-Patterns to Avoid

| Anti-Pattern | Connexio's Approach |
|--------------|---------------------|
| "Are You Sure?" Dialogs | Auto-save, no confirmation needed |
| Settings as JSON | Visual settings UI |
| Visible Loading Spinners | Only show if >200ms |
| Notification Spam | Silent reliability, no toasts |
| Nested Settings Menus | Flat settings with search |
| Default Ugly Theme | Beautiful default theme |
| Restart Required | Hot-reload themes/settings |

### Design Inspiration Strategy

**Adopt Directly:**
- VS Code's session restore reliability (gold standard)
- Warp's modern visual language (proves terminals can be beautiful)
- Chrome's tab management (familiar, intuitive)
- Google Docs' silent auto-save (trust through invisibility)

**Adapt for Connexio:**
- VS Code's theme marketplace → Curated 5 built-in themes (MVP)
- Warp's AI features → Focus on core first, AI later
- iTerm2's profiles → Simple session restore first

**Avoid Completely:**
- JSON-based settings (intimidates users)
- Infinitely shrinking tabs (unreadable)
- Modal wizards on first launch (blocks productivity)
- Confirmation dialogs everywhere (creates anxiety)


---

## Design System Foundation

### Design System Choice

**Selected:** Tailwind CSS + shadcn/ui

**Stack:**
- Tailwind CSS - Utility-first styling
- shadcn/ui - Component primitives (copy-paste, ownable)
- Radix UI - Accessible primitives (underlying shadcn/ui)
- CSS Variables - Runtime theme switching
- Lucide Icons - Icon library

### Rationale for Selection

| Factor | Decision Rationale |
|--------|-------------------|
| React Compatibility | shadcn/ui built for React, perfect for Tauri frontend |
| Development Speed | Copy-paste components, solo dev can move fast |
| Bundle Size | Tailwind purges unused CSS, lightweight output |
| Theming Support | CSS variables enable runtime theme switching |
| Customization | Own the code, full control over every component |
| Modern Aesthetic | Clean, minimal look perfect for terminal application |
| Community | Large ecosystem, extensive examples and documentation |

### Implementation Approach

**Component Strategy:**
| Component | Implementation |
|-----------|----------------|
| Tab Bar | Custom build (Chrome/VS Code inspired) |
| Terminal Display | xterm.js or similar terminal emulator |
| Settings Panel | shadcn/ui dialog + form components |
| Theme Picker | shadcn/ui select with live preview |
| Context Menus | shadcn/ui dropdown menu |
| Buttons/Icons | shadcn/ui button + lucide icons |

**Custom Components Needed:**
- Tab bar with overflow handling
- Terminal viewport with scroll management
- Session restore animation
- Theme preview cards

### Customization Strategy

**Design Tokens:**
| Token Category | Approach |
|----------------|----------|
| Colors | CSS variables for 5 built-in themes |
| Typography | Monospace (terminal), Sans-serif (UI) |
| Spacing | Tailwind default scale (4px base) |
| Animations | Subtle, fast (150-200ms duration) |
| Border Radius | Minimal (4px) for modern look |
| Shadows | Minimal, used sparingly |

**Theme Architecture:**
- Each theme defines CSS variable values
- Theme class on root element triggers variable swap
- Hot-reload without restart
- Dark/light mode handled per theme


---

## Defining Core Experience

### The Defining Experience

**Connexio's Core Promise:**
> "Close app → Open app → Everything is exactly where you left it"

This is the one-sentence description users will share:
*"I use Connexio - close my laptop, open it again, all my terminals are exactly as I left them. No setup needed."*

If we nail this ONE interaction perfectly, everything else follows.

### User Mental Model

**Current Pain Points:**
| Current Approach | User Frustration |
|------------------|------------------|
| Windows Terminal | Reopen all terminals every day |
| Manual Bookmarks | Tedious, often forget to update |
| Shell History | Only commands, not full context |
| Never Close Apps | RAM exhausted, slow laptop |

**Expectations Users Bring:**
- "Apps remember me" (Chrome tabs, VS Code workspaces)
- "No save button needed" (Google Docs, Figma)
- "Instant ready" (modern apps)
- "Just works" (Apple-like experience)

**Key Insight:** Users already EXPECT session persistence. Windows Terminal is the frustrating anomaly.

### Success Criteria

| Criteria | Target | User Perception |
|----------|--------|-----------------|
| Restore Speed | <2 seconds | Feels instant |
| Restore Accuracy | 100% tabs, 100% directories | Everything the same |
| Zero User Action | No "restore?" dialog | Automatic |
| Crash Recovery | >99% recovery | Trust established |
| History Preserved | All commands intact | Ctrl+Up works |

**When Users Feel Successful:**
- First restore: "Wow, this actually works!"
- Week 1: "I don't even think about it"
- After crash: "Holy shit, everything's still here"

### Novel UX Patterns

**Pattern Analysis:**
| Aspect | Type | Approach |
|--------|------|----------|
| Session Restore | Established | VS Code, Chrome already do this |
| Tab Management | Established | Chrome tabs pattern |
| Auto-Save | Established | Google Docs pioneered |
| Theme Hot-Reload | Established | VS Code themes |

**Conclusion:** No novel patterns needed. Execute established patterns exceptionally well in the underserved Windows terminal context.

Innovation is in **reliability and execution**, not in inventing new patterns.

### Experience Mechanics

**Session Restore Flow:**
1. **Initiation:** User launches Connexio
2. **Restore:** Automatic, <2 seconds
   - Read session state from disk
   - Create tabs in saved order
   - Set working directory per tab
   - Load command history per tab
   - Focus last active tab
3. **Feedback:** Tabs appear with subtle animation, cursor blinks (ready)
   - NO toast, NO popup, NO "session restored" message
4. **Completion:** User immediately productive

**Session Save Flow:**
- **Continuous:** Auto-save every 30 seconds (silent)
- **On Change:** Immediate save on tab/directory changes
- **On Close:** Final save before exit (no confirmation)
- **Feedback:** NONE - user never sees saving indicators


---

## Visual Design Foundation

### Color System

**Theme Architecture:**
5 built-in themes using CSS variables for runtime switching:

| Theme Name | Type | Vibe |
|------------|------|------|
| Tokyo Night | Dark | Cool, calm, night-coding |
| Dracula | Dark | Classic, rich, purple-accent |
| Nord | Dark | Muted, arctic, professional |
| One Light | Light | Clean, minimal, easy on eyes |
| GitHub Light | Light | Familiar, professional |

**Default Theme:** Tokyo Night

**Semantic Color Tokens:**
| Token Category | Tokens |
|----------------|--------|
| Surface | --background, --surface, --surface-hover, --border |
| Text | --foreground, --foreground-muted, --foreground-faint |
| Accent | --primary, --primary-hover, --accent |
| Semantic | --success, --warning, --error, --info |
| Terminal | --terminal-bg, --terminal-fg, --terminal-cursor, --terminal-selection |

### Typography System

**Font Strategy:**
| Purpose | Font Family | Rationale |
|---------|-------------|-----------|
| Terminal | JetBrains Mono, monospace | Best coding font, ligatures |
| UI | Inter, system-ui | Clean, readable, professional |

**Type Scale:**
| Level | Size | Weight | Usage |
|-------|------|--------|-------|
| H1 | 24px | 600 | Settings page title |
| H2 | 18px | 600 | Section headers |
| Body | 14px | 400 | General UI text |
| Small | 12px | 400 | Secondary info |
| Caption | 11px | 400 | Labels, status |

**Terminal Typography:**
- Font: JetBrains Mono, 14px default
- Line height: 1.4
- Adjustable in settings (Future)

### Spacing & Layout Foundation

**Spacing Scale (4px base):**
| Token | Value | Usage |
|-------|-------|-------|
| --space-1 | 4px | Tight spacing |
| --space-2 | 8px | Default element spacing |
| --space-3 | 12px | Section padding |
| --space-4 | 16px | Card padding |
| --space-6 | 24px | Large section gaps |

**Layout Structure:**
- Title Bar: 32px (drag area, window controls)
- Tab Bar: 36px (tabs, new tab, settings)
- Terminal: Fills remaining space
- Total UI overhead: 68px

**Layout Principles:**
1. Maximum terminal space - minimal UI chrome
2. Fixed heights for predictable layout
3. No sidebar in MVP
4. Responsive from 800px to 4K

### Accessibility Considerations

| Requirement | Target | Implementation |
|-------------|--------|----------------|
| Color Contrast | WCAG AA (4.5:1) | All themes tested |
| Keyboard Navigation | Full support | Tab order, focus rings |
| Focus Indicators | 2px outline | Visible on all elements |
| High Contrast | 1 theme option | Included in 5 themes |
| Font Size | Adjustable (v1.1) | Settings option |
| Screen Reader | Basic ARIA | Labels on UI elements |


---

## Design Direction Decision

### Design Directions Explored

Four distinct visual directions were explored:

1. **Minimal Chrome** - Maximum terminal, minimum UI overhead
2. **Soft Modern** - Rounded corners, friendly aesthetic
3. **VS Code Familiar** - Activity bar, developer-familiar
4. **Warp Inspired** - Command blocks, innovative

### Chosen Direction

**Selected: Direction 1 - "Minimal Chrome"**

Key characteristics:
- Simple text tabs with active indicator
- Native Windows controls integrated
- Single gear icon for settings
- Maximum terminal viewport
- Clean, professional, developer-focused

**Visual Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│ ─ □ ✕ │  Connexio                                              │
├─────────────────────────────────────────────────────────────────┤
│ ● project-1  │  api-server  │  frontend  │  +  │           ⚙  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ~/projects/connexio $  npm run dev                             │
│                                                                 │
│ ~/projects/connexio $  █                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Design Rationale

| Factor | Rationale |
|--------|-----------|
| Maximum Terminal Space | Users want terminal, not UI chrome |
| Implementation Simplicity | Solo developer can build quickly |
| Familiar Pattern | Chrome-like tabs = zero learning curve |
| Execution Focus | Differentiate by reliability, not flashy UI |
| Future Extensibility | Can add features without major redesign |

### Implementation Approach

**MVP Implementation:**
- Tab bar: Simple horizontal tabs with overflow menu
- Settings: Single gear icon opens modal/panel
- Terminal: Full-width, fills remaining viewport
- Window: Native Tauri window controls

**Future Enhancements:**
- v1.1: Optional command blocks
- v1.2: Activity bar for workspace switching
- v2.0: Consider more innovative directions based on user feedback


---

## User Journey Flows

### Journey 1: First-Time User

**Goal:** Install → Theme Selection → Magic Moment

**Flow:**
1. Download and install (<30 seconds)
2. First launch shows theme picker
3. User browses themes with live preview
4. Select theme, applied instantly
5. Work with terminal, open tabs
6. Close app (auto-saved silently)
7. Reopen → **ALL TABS RESTORED** ✨

**Success Criteria:**
- Install to first use: <30 seconds
- Theme picker to apply: <3 clicks
- First restore: "Wow!" reaction

### Journey 2: Crash Recovery

**Goal:** System crash → Full recovery

**Flow:**
1. Active session with multiple tabs
2. System crash/BSOD occurs
3. Auto-save already on disk (every 30s)
4. User reboots, opens Connexio
5. All tabs, directories, history restored
6. User continues working seamlessly

**Success Criteria:**
- Data loss: <30 seconds max
- Recovery rate: >99%
- Trust established after first recovery

### Journey 3: Power User Multi-Project

**Goal:** Efficient multi-project management

**Flow:**
1. Open Connexio → 6 tabs restored
2. Switch tabs via Ctrl+1-6 or click
3. New project: Ctrl+T → select shell
4. Navigate to project directory
5. Use per-tab command history
6. Close app → all saved for tomorrow

**Success Criteria:**
- Tab switch: <16ms
- Tabs supported: 10+ without lag
- Memory per tab: <30MB

### Journey 4: Theme Customization

**Goal:** Personalize terminal appearance

**Flow:**
1. Click gear icon or Ctrl+,
2. Settings panel opens
3. Browse 5 theme options
4. Hover for live preview
5. Click to select → instant apply
6. Close settings → theme persists

**Success Criteria:**
- Time to change: <10 seconds
- Clicks required: 3 max
- Preview: Live, instant

### Journey Patterns

| Pattern | Description |
|---------|-------------|
| Silent Save | Auto-save without notifications |
| Instant Feedback | Actions complete <16ms |
| No Confirmation | No "Are you sure?" dialogs |
| Live Preview | See changes before committing |
| Keyboard-First | All actions via keyboard |

### Flow Optimization Principles

1. **Minimize Steps to Value** - First restore happens automatically on second launch
2. **Reduce Cognitive Load** - Sensible defaults, no decisions required
3. **Provide Clear Feedback** - Cursor blinks when ready, tabs show directory
4. **Create Delight Moments** - First restore is the "wow" moment
5. **Handle Errors Gracefully** - Crash recovery transparent to user


---

## Component Strategy

### Design System Components

**Using shadcn/ui:**
| Component | Usage |
|-----------|-------|
| Button | Actions, confirmations |
| Dialog | Settings panel, modals |
| DropdownMenu | Context menus, selectors |
| Select | Shell picker, options |
| Tooltip | Icon hints |
| ScrollArea | Scrollable content |

### Custom Components

#### Tab Bar
- **Purpose:** Navigate between terminal tabs
- **States:** Default, Active (with dot), Hover, Dragging
- **Features:** Click switch, drag reorder, context menu, overflow handling
- **Keyboard:** Ctrl+Tab (next), Ctrl+1-9 (direct)
- **Accessibility:** role="tablist", aria-selected

#### Terminal Viewport
- **Purpose:** Display terminal I/O
- **Technology:** xterm.js with WebGL renderer
- **Performance:** 60 FPS scroll, <16ms input latency
- **Features:** True color (24-bit), 10k line scrollback, selection, copy/paste
- **Theming:** Uses --terminal-bg, --terminal-fg, --terminal-cursor tokens

#### Theme Picker
- **Purpose:** Select and preview themes
- **Trigger:** First launch modal, Settings panel
- **Layout:** Grid of theme cards (3 per row)
- **Features:** Live preview on hover, instant apply on click
- **Accessibility:** role="radiogroup", keyboard navigation

#### Title Bar
- **Purpose:** Window controls and drag area
- **Height:** 32px fixed
- **Features:** Minimize, Maximize/Restore, Close buttons
- **Behavior:** Double-click to maximize, drag to move window

#### Settings Panel
- **Purpose:** Configure app preferences
- **Trigger:** Gear icon or Ctrl+,
- **Sections:** Appearance, Terminal, About
- **Behavior:** Slide-in panel, changes auto-saved (no Save button)
- **Components:** Composed from shadcn/ui Dialog, Select, Switch

#### Shell Selector
- **Purpose:** Choose shell for new tab
- **Trigger:** Click + (new tab) button
- **Features:** Auto-detect available shells, remember last used
- **Options:** PowerShell, CMD, WSL, Git Bash

### Component Implementation Strategy

**Foundation Components (shadcn/ui):**
- Use design system tokens for colors, spacing, typography
- Extend with Tailwind utilities as needed
- Maintain accessibility standards

**Custom Components:**
- Build with React functional components
- Use CSS variables for theming
- Integrate xterm.js for terminal emulation
- Use Tauri APIs for window management

### Implementation Roadmap

**Phase 1 - Core (Week 1-2):**
- TitleBar - window controls
- TabBar - basic tabs, click to switch
- TerminalViewport - xterm.js integration
- ShellSelector - new tab with shell choice

**Phase 2 - Experience (Week 3):**
- ThemePicker - first-time modal
- SettingsPanel - theme + shell settings
- Tab context menu - close, close others

**Phase 3 - Polish (Week 4):**
- Tab drag-to-reorder
- Tab overflow menu (>8 tabs)
- Keyboard shortcuts
- Subtle animations (150-200ms)


---

## UX Consistency Patterns

### Button Hierarchy

| Level | Style | Usage |
|-------|-------|-------|
| Primary | Solid, --primary | Main actions |
| Secondary | Outline, --border | Alternative actions |
| Ghost | No border | Toolbar actions |
| Destructive | --error color | Dangerous actions |
| Icon-only | Ghost with icon | Space-constrained |

### Feedback Patterns

**Core Principle: "Quiet Confidence"**
- Silent when successful (no "saved!" toasts)
- Clear when there's a problem (error states visible)

| Scenario | Feedback |
|----------|----------|
| Session Saved | None - silent |
| Theme Changed | Instant visual change |
| Tab Closed | No confirmation, immediate |
| Error Occurred | Clear message with icon |
| Loading (>200ms) | Show indicator only if >200ms |

### Navigation Patterns

**Tab Navigation:**
| Action | Mouse | Keyboard |
|--------|-------|----------|
| Switch Tab | Click tab | Ctrl+Tab, Ctrl+1-9 |
| New Tab | Click + | Ctrl+T |
| Close Tab | Click X | Ctrl+W |
| Reorder | Drag and drop | Future |

**Keyboard Shortcuts:**
- Tabs: Ctrl+T (new), Ctrl+W (close), Ctrl+Tab (next)
- Settings: Ctrl+, (open)
- Direct tab: Ctrl+1-9

### Modal Patterns

| Type | Dismissal |
|------|-----------|
| Theme Picker | Select, click outside, Esc |
| Settings | X button, Esc, click outside |
| Shell Selector | Select, click outside |
| Confirmation | AVOID - we don't use confirmations |

**Modal Behavior:**
- Animation: Fade in 150ms, out 100ms
- Focus trap: Tab cycles within modal
- Escape: Always closes

### Loading & Empty States

**First Launch:** Theme picker modal, no tutorial wizard
**App Launch:** Window immediate, tabs restore progressively
**Loading Rule:** Only show spinner if operation >200ms

### Accessibility Patterns

| Pattern | Implementation |
|---------|----------------|
| Focus Visible | 2px outline on interactive elements |
| ARIA Labels | All icon buttons labeled |
| Keyboard Nav | All actions via keyboard |
| Color Contrast | WCAG AA (4.5:1) |
| Reduced Motion | Respect prefers-reduced-motion |


---

## Responsive Design & Accessibility

### Responsive Strategy

**Platform:** Windows Desktop application (not web/mobile)

**Window Size Adaptation:**
| Window Size | Behavior |
|-------------|----------|
| Minimum | 800 × 500 px (UI usable) |
| Small (800-1024px) | Tab overflow at 4 tabs |
| Normal (1024-1440px) | Tab overflow at 6 tabs |
| Wide (1440-1920px) | Tab overflow at 8 tabs |
| Ultra-wide (1920px+) | Tab overflow at 10+ tabs |

**Layout Behavior:**
- Terminal always fills remaining viewport
- Tab bar adapts with overflow menu
- High DPI scaling handled by Tauri/OS

### Breakpoint Strategy

**Desktop-Only Thresholds:**
| Threshold | Width | Tab Overflow |
|-----------|-------|--------------|
| Minimum | 800px | 4 tabs |
| Normal | 1024px | 6 tabs |
| Wide | 1440px | 8 tabs |
| Ultra-wide | 1920px+ | 10+ tabs |

### Accessibility Strategy

**Target Compliance:** WCAG 2.1 Level AA

**Visual Accessibility:**
| Requirement | Implementation |
|-------------|----------------|
| Color Contrast | 4.5:1 minimum (AA) |
| Focus Indicators | 2px outline visible |
| High Contrast | 1 theme included |
| Scalable Text | Future (v1.1) |

**Motor Accessibility:**
| Requirement | Implementation |
|-------------|----------------|
| Keyboard Navigation | Full support |
| Click Targets | 24px+ minimum |
| Shortcuts | Ctrl+T, Ctrl+W, Ctrl+1-9 |

**Screen Reader:**
- ARIA labels on all icon buttons
- Tab switches announced
- Terminal content: limited support (complex)

### Testing Strategy

**Responsive Testing:**
- Window resize at all sizes (800px to 4K)
- High DPI scaling (150%, 200%)
- Tab overflow behavior (10+ tabs)

**Accessibility Testing:**
- Keyboard-only navigation
- Screen reader (NVDA, Narrator)
- Color contrast verification
- Focus indicator visibility

### Implementation Guidelines

**Responsive Development:**
- Minimum window size: 800 × 500 px
- Use CSS flexbox for layout adaptation
- Tab overflow calculated dynamically
- High DPI handled by Tauri WebView

**Accessibility Development:**
- Semantic HTML structure
- ARIA labels on all icon buttons
- Focus management for modals
- Keyboard event handlers for all actions
- Respect prefers-reduced-motion

