# Connexio - UI Component Inventory

> **Catalog of UI components and design patterns**

---

## 📋 Component Overview

Connexio uses a component library built on:
- **Radix UI** - Accessible, unstyled primitives
- **shadcn/ui pattern** - Copy-paste component approach
- **Tailwind CSS** - Utility-first styling
- **class-variance-authority (CVA)** - Variant management

---

## 📁 Component Structure

```
src/components/
├── layout/                 # Layout Components
│   ├── index.ts            # Barrel exports
│   ├── MainLayout.tsx      # Main app layout
│   └── TitleBar.tsx        # Window title bar
│
├── terminal/               # Terminal Components (planned)
│   └── (future components)
│
├── settings/               # Settings Components (planned)
│   └── (future components)
│
└── ui/                     # Base UI Components
    ├── index.ts            # Barrel exports
    ├── button.tsx          # Button component
    ├── dialog.tsx          # Dialog/Modal component
    └── dropdown-menu.tsx   # Dropdown menu component
```

---

## 🎨 Base UI Components

### Button (`ui/button.tsx`)

Reusable button component with variants.

**Dependencies:**
- `@radix-ui/react-slot`
- `class-variance-authority`

**Variants:**

| Variant | Description |
|---------|-------------|
| `default` | Primary action button |
| `destructive` | Dangerous action (red) |
| `outline` | Bordered button |
| `secondary` | Secondary action |
| `ghost` | Minimal/invisible button |
| `link` | Text link style |

**Sizes:**

| Size | Description |
|------|-------------|
| `default` | Standard size |
| `sm` | Small button |
| `lg` | Large button |
| `icon` | Square icon button |

**Usage:**
```tsx
import { Button } from "@/components/ui/button";

<Button variant="default" size="default">Click me</Button>
<Button variant="ghost" size="icon"><Icon /></Button>
```

---

### Dialog (`ui/dialog.tsx`)

Modal dialog component for overlays.

**Dependencies:**
- `@radix-ui/react-dialog`

**Sub-components:**

| Component | Description |
|-----------|-------------|
| `Dialog` | Root container |
| `DialogTrigger` | Trigger element |
| `DialogContent` | Modal content |
| `DialogHeader` | Header section |
| `DialogFooter` | Footer section |
| `DialogTitle` | Dialog title |
| `DialogDescription` | Description text |
| `DialogClose` | Close button |

**Usage:**
```tsx
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

<Dialog>
  <DialogTrigger asChild>
    <Button>Open Dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
    </DialogHeader>
    {/* Content */}
  </DialogContent>
</Dialog>
```

---

### Dropdown Menu (`ui/dropdown-menu.tsx`)

Contextual menu component.

**Dependencies:**
- `@radix-ui/react-dropdown-menu`

**Sub-components:**

| Component | Description |
|-----------|-------------|
| `DropdownMenu` | Root container |
| `DropdownMenuTrigger` | Trigger element |
| `DropdownMenuContent` | Menu content |
| `DropdownMenuItem` | Menu item |
| `DropdownMenuSeparator` | Visual separator |
| `DropdownMenuLabel` | Section label |
| `DropdownMenuGroup` | Item grouping |
| `DropdownMenuSub` | Submenu support |
| `DropdownMenuCheckboxItem` | Checkbox item |
| `DropdownMenuRadioGroup` | Radio group |
| `DropdownMenuRadioItem` | Radio item |
| `DropdownMenuShortcut` | Keyboard shortcut display |

**Usage:**
```tsx
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button>Menu</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem>Item 1</DropdownMenuItem>
    <DropdownMenuItem>Item 2</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

---

## 🏗️ Layout Components

### MainLayout (`layout/MainLayout.tsx`)

Primary application layout wrapper.

**Purpose:**
- Provides consistent layout structure
- Manages overall app chrome
- Contains title bar and content area

**Structure:**
```tsx
<div className="main-layout">
  <TitleBar />
  <main className="content-area">
    {children}
  </main>
</div>
```

---

### TitleBar (`layout/TitleBar.tsx`)

Custom window title bar for frameless window.

**Purpose:**
- Custom window chrome (decorations: false)
- Draggable region for window movement
- Window control buttons (minimize, maximize, close)

**Features:**
- Drag region implementation
- Window state management
- Integration with Tauri window API

**Structure:**
```tsx
<header className="title-bar" data-tauri-drag-region>
  <div className="app-title">Connexio</div>
  <div className="window-controls">
    <button onClick={minimize}>─</button>
    <button onClick={maximize}>□</button>
    <button onClick={close}>×</button>
  </div>
</header>
```

---

## 🖥️ Terminal Components (Planned)

### TerminalView

xterm.js wrapper component.

**Purpose:**
- Render terminal output
- Handle keyboard input
- Manage terminal state

**Dependencies:**
- `@xterm/xterm`
- `@xterm/addon-fit`
- `@xterm/addon-webgl`

**Planned Features:**
- WebGL accelerated rendering
- Auto-fit to container
- Input event handling
- Output streaming

---

### TerminalTabs

Tab bar for multiple terminal sessions.

**Purpose:**
- Display active sessions
- Tab switching
- New tab creation
- Tab closing

**Planned Features:**
- Drag-and-drop reordering
- Tab overflow handling
- Context menu per tab

---

### TerminalSession

Container for individual terminal session.

**Purpose:**
- Combine TerminalView with session state
- Handle session lifecycle
- Connect to PTY backend

---

## ⚙️ Settings Components (Planned)

### SettingsDialog

Settings modal dialog.

**Planned Sections:**
- Appearance (theme, font)
- Terminal (shell, scrollback)
- Keyboard shortcuts
- Advanced settings

---

### ThemeSelector

Theme picker component.

**Planned Themes:**
- Dark (default)
- Light
- Dracula
- Nord
- Monokai

---

## 🎨 Design Tokens

### Colors (CSS Custom Properties)

```css
:root {
  --background: /* Background color */;
  --foreground: /* Text color */;
  --primary: /* Primary brand color */;
  --primary-foreground: /* Text on primary */;
  --secondary: /* Secondary color */;
  --secondary-foreground: /* Text on secondary */;
  --accent: /* Accent color */;
  --muted: /* Muted/subtle color */;
  --muted-foreground: /* Muted text */;
  --border: /* Border color */;
  --terminal-bg: /* Terminal background */;
  --terminal-fg: /* Terminal text */;
}
```

### Typography

- **Font Family:** System fonts (Tailwind default)
- **Monospace:** For terminal (`font-mono`)

### Spacing

Using Tailwind default spacing scale (4px base unit).

---

## 📦 Adding New Components

### Using shadcn/ui Pattern

1. Create component file in `src/components/ui/`
2. Install required Radix primitive
3. Style with Tailwind + CVA
4. Export from index.ts

### Component Template

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

interface ComponentProps {
  children?: React.ReactNode;
  className?: string;
}

const Component = React.forwardRef<HTMLDivElement, ComponentProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("base-styles", className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Component.displayName = "Component";

export { Component };
```

---

## 🔗 Component Dependencies

| Component | Radix Package | Other Dependencies |
|-----------|---------------|-------------------|
| Button | `@radix-ui/react-slot` | CVA |
| Dialog | `@radix-ui/react-dialog` | - |
| DropdownMenu | `@radix-ui/react-dropdown-menu` | - |

---

## 📊 Component Count Summary

| Category | Current | Planned |
|----------|---------|---------|
| Base UI | 3 | 10+ |
| Layout | 2 | 3 |
| Terminal | 0 | 3+ |
| Settings | 0 | 5+ |
| **Total** | **5** | **20+** |

---

*Generated by BMad Master Document Project Workflow v1.2.0*
