---
stepsCompleted: ["step-01-validate-prerequisites", "step-02-design-epics", "step-03-create-stories", "step-04-final-validation"]
workflowComplete: true
completedAt: 2026-01-14
inputDocuments:
  - prd.md
  - architecture.md
  - ux-design-specification.md
---

# Connexio - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Connexio, decomposing the requirements from the PRD, UX Design, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

**Session Management (6 FRs)**
- FR1: User can have all open tabs automatically saved when closing the application
- FR2: User can have all previously open tabs restored when launching the application
- FR3: User can have working directories restored to their last state for each tab
- FR4: User can have command history preserved for each tab across sessions
- FR5: System can auto-save session state periodically (every 30 seconds)
- FR6: System can recover session state after unexpected system crash

**Tab Management (6 FRs)**
- FR7: User can open new terminal tabs
- FR8: User can close terminal tabs
- FR9: User can switch between terminal tabs
- FR10: User can reorder tabs via drag-and-drop
- FR11: User can see tab title showing current directory or process
- FR12: User can have multiple tabs open simultaneously (10+)

**Shell Support (7 FRs)**
- FR13: User can use PowerShell as terminal shell
- FR14: User can use Command Prompt (CMD) as terminal shell
- FR15: User can use Windows Subsystem for Linux (WSL) as terminal shell
- FR16: User can use Git Bash as terminal shell
- FR17: System can auto-detect available shells on the system
- FR18: User can select which shell to use for new tabs
- FR19: User can set a default shell preference

**Terminal Emulator Core (7 FRs)**
- FR20: User can type commands and see output in terminal
- FR21: User can scroll through terminal output history
- FR22: User can copy text from terminal output
- FR23: User can paste text into terminal input
- FR24: User can see colors in terminal output (true color support)
- FR25: User can see Unicode characters and emoji in terminal output
- FR26: User can use keyboard shortcuts for terminal operations

**Theme System (4 FRs)**
- FR27: User can select from built-in themes (minimum 5)
- FR28: User can preview theme before applying
- FR29: User can have selected theme persist across sessions
- FR30: User can see visually distinct light and dark theme options

**Settings & Preferences (5 FRs)**
- FR31: User can access settings through UI
- FR32: User can configure default shell preference
- FR33: User can configure theme preference
- FR34: User can have settings persist across app updates
- FR35: System can store settings in standard Windows location (%APPDATA%)

**Windows Integration (4 FRs)**
- FR36: User can open Connexio from Windows Explorer context menu ("Open in Connexio")
- FR37: User can set Connexio as default terminal application
- FR38: User can launch Connexio with command-line directory parameter
- FR39: User can launch Connexio with command-line command to execute

**Application Lifecycle (4 FRs)**
- FR40: User can install application from portable ZIP or installer
- FR41: User can run application without administrator privileges
- FR42: User can use application fully offline (no internet required)
- FR43: System can display application version information

### NonFunctional Requirements

**Performance (10 NFRs)**
- NFR-P1: Application cold startup time < 1.5 seconds
- NFR-P2: Application warm startup time < 0.8 seconds
- NFR-P3: Session restore time < 2.0 seconds
- NFR-P4: Terminal scroll performance 60 FPS
- NFR-P5: Input latency (keystroke to display) < 16ms
- NFR-P6: Memory usage (idle, no tabs) < 100 MB
- NFR-P7: Memory usage per additional tab < 30 MB
- NFR-P8: Memory usage (10 active tabs) < 200 MB
- NFR-P9: Large output handling without freeze 10,000+ lines
- NFR-P10: Binary/installer size < 15 MB

**Reliability (6 NFRs)**
- NFR-R1: Application crash rate < 0.1%
- NFR-R2: Session data persistence 100%
- NFR-R3: Crash recovery success rate > 99%
- NFR-R4: Auto-save frequency every 30 seconds
- NFR-R5: Data loss on crash < 30 seconds
- NFR-R6: Graceful degradation on errors (no data loss)

**Compatibility (8 NFRs)**
- NFR-C1: Minimum Windows version Windows 10 1903+
- NFR-C2: Windows 11 full support
- NFR-C3: x64 architecture support (required)
- NFR-C4: ARM64 architecture support (best effort)
- NFR-C5: PowerShell compatibility 100%
- NFR-C6: CMD compatibility 100%
- NFR-C7: WSL compatibility 100%
- NFR-C8: Git Bash compatibility 100%

**Security (5 NFRs)**
- NFR-S1: No credential storage in history
- NFR-S2: Local data storage location %APPDATA%
- NFR-S3: No telemetry or analytics
- NFR-S4: No internet required for operation (100% offline)
- NFR-S5: No elevated privileges required (user-level only)

**Usability (5 NFRs)**
- NFR-U1: Time from install to first productive use < 30 seconds
- NFR-U2: Time to change theme < 3 clicks
- NFR-U3: Discoverability of key features (intuitive)
- NFR-U4: Keyboard navigation support (full)
- NFR-U5: Visual comfort (3+ comfortable theme options)

**Accessibility (3 NFRs)**
- NFR-A1: Keyboard-only operation support (full)
- NFR-A2: High contrast theme availability (1+ theme)
- NFR-A3: Font size adjustability (future v1.1)

### Additional Requirements

**From Architecture Document:**

- **Starter Template**: Use official Tauri + React template: `npm create tauri-app@latest connexio -- --template react-ts`
- **Post-Init Dependencies**: Tailwind CSS, shadcn/ui, xterm.js with WebGL addon, Zustand, lucide-react
- **Technology Stack**: Tauri v2, React 18, TypeScript 5.x, Rust stable
- **Terminal Component**: xterm.js with WebGL addon for performance
- **State Management**: Zustand with persist middleware
- **Session Storage**: JSON files in %APPDATA%/Connexio/
- **IPC Pattern**: Tauri Commands (invoke/listen) with snake_case naming
- **Build Output**: MSI installer + Portable ZIP
- **PTY Integration**: Windows ConPTY API via Rust

**From UX Design Document:**

- **First-Time Experience**: User must "get it" in 30 seconds - install → theme → productive
- **Session Trust Design**: Visual feedback that session is always saved (quiet confidence)
- **Theme Experience**: Evocative naming (Tokyo Night, Dracula, Nord, etc.), live preview
- **Zero-Config Philosophy**: Everything works out of the box
- **Keyboard-First Design**: All features accessible via keyboard shortcuts
- **No Confirmation Dialogs**: Close app without "Are you sure?" prompts
- **Loading States**: No visible loading if < 200ms
- **Micro-interactions**: Smooth animations for restore, tab switches

### FR Coverage Map

**Session Management:**
- FR1 → Epic 4 (auto-save on close)
- FR2 → Epic 4 (restore tabs on launch)
- FR3 → Epic 4 (restore working directories)
- FR4 → Epic 4 (preserve command history)
- FR5 → Epic 4 (auto-save every 30s)
- FR6 → Epic 4 (crash recovery)

**Tab Management:**
- FR7 → Epic 3 (open new tabs)
- FR8 → Epic 3 (close tabs)
- FR9 → Epic 3 (switch tabs)
- FR10 → Epic 3 (reorder via drag-drop)
- FR11 → Epic 3 (tab titles)
- FR12 → Epic 3 (10+ tabs support)

**Shell Support:**
- FR13 → Epic 2 (PowerShell)
- FR14 → Epic 2 (CMD)
- FR15 → Epic 2 (WSL)
- FR16 → Epic 2 (Git Bash)
- FR17 → Epic 2 (auto-detect shells)
- FR18 → Epic 2 (select shell for new tab)
- FR19 → Epic 2 (default shell preference)

**Terminal Emulator Core:**
- FR20 → Epic 1 (type commands, see output)
- FR21 → Epic 1 (scroll history)
- FR22 → Epic 1 (copy text)
- FR23 → Epic 1 (paste text)
- FR24 → Epic 1 (true color support)
- FR25 → Epic 1 (Unicode/emoji)
- FR26 → Epic 1 (keyboard shortcuts)

**Theme System:**
- FR27 → Epic 5 (5 built-in themes)
- FR28 → Epic 5 (preview before apply)
- FR29 → Epic 5 (theme persistence)
- FR30 → Epic 5 (light/dark options)

**Settings & Preferences:**
- FR31 → Epic 5 (settings UI)
- FR32 → Epic 5 (default shell config)
- FR33 → Epic 5 (theme preference)
- FR34 → Epic 5 (persist across updates)
- FR35 → Epic 5 (%APPDATA% storage)

**Windows Integration:**
- FR36 → Epic 6 (Explorer context menu)
- FR37 → Epic 6 (default terminal)
- FR38 → Epic 6 (CLI directory param)
- FR39 → Epic 6 (CLI command param)

**Application Lifecycle:**
- FR40 → Epic 1 (install from ZIP/installer)
- FR41 → Epic 1 (no admin required)
- FR42 → Epic 1 (fully offline)
- FR43 → Epic 1 (version info)

## Epic List

### Epic 1: Project Foundation & Basic Terminal
Developer dapat membuka Connexio dan menggunakan terminal dasar dengan satu shell yang functional.

**FRs covered:** FR20, FR21, FR22, FR23, FR24, FR25, FR26, FR40, FR41, FR42, FR43

**User Value:** 
- Basic terminal functionality with full input/output
- Copy/paste, scroll, colors, Unicode support
- Application installable and runs offline

**Implementation Notes:**
- Initialize project with Tauri + React template
- Integrate xterm.js with WebGL addon
- Setup Rust PTY layer with ConPTY
- Basic window chrome with custom title bar

---

### Epic 2: Multi-Shell Support
Developer dapat memilih dan menggunakan berbagai shell (PowerShell, CMD, WSL, Git Bash).

**FRs covered:** FR13, FR14, FR15, FR16, FR17, FR18, FR19

**User Value:**
- Support for all common Windows shells
- Auto-detection of available shells
- User can set preferred default shell

**Implementation Notes:**
- Shell detection logic in Rust
- Shell selector UI component
- Store default shell preference in settings

---

### Epic 3: Tab Management
Developer dapat bekerja dengan multiple terminal tabs secara efisien.

**FRs covered:** FR7, FR8, FR9, FR10, FR11, FR12

**User Value:**
- Multi-tab workflow for multiple projects
- Intuitive tab switching and management
- Drag-and-drop reordering
- Support 10+ simultaneous tabs

**Implementation Notes:**
- TabBar component with dnd-kit for drag-drop
- Tab state management in Zustand
- Dynamic tab titles from shell/directory

---

### Epic 4: Session Persistence (KILLER FEATURE)
Developer dapat menutup Connexio dan membukanya kembali dengan semua tabs, directories, dan history ter-restore secara otomatis.

**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6

**User Value:**
- **CORE DIFFERENTIATOR** - auto-save everything
- Zero setup on reopen - instant productivity
- Crash recovery with minimal data loss
- Trust that nothing is ever lost

**Implementation Notes:**
- Session state JSON persistence
- Auto-save every 30 seconds
- Crash recovery from last good state
- Working directory tracking per tab
- Command history storage per tab

---

### Epic 5: Theme System & Settings
Developer dapat mempersonalisasi tampilan terminal dan mengkonfigurasi preferences melalui UI yang intuitif.

**FRs covered:** FR27, FR28, FR29, FR30, FR31, FR32, FR33, FR34, FR35

**User Value:**
- 5 beautiful built-in themes
- Live preview before applying
- Settings persist across updates
- Personalized terminal experience

**Implementation Notes:**
- CSS variables for theming
- Theme picker with live preview
- Settings panel UI
- %APPDATA% storage for settings
- Zustand persist for preferences

---

### Epic 6: Windows Integration & Distribution
Developer dapat mengintegrasikan Connexio dengan Windows Explorer dan menginstall aplikasi dengan mudah.

**FRs covered:** FR36, FR37, FR38, FR39

**User Value:**
- Right-click "Open in Connexio" from Explorer
- Set as default terminal application
- Command-line launch with parameters
- Professional installation experience

**Implementation Notes:**
- Windows Registry entries for context menu
- CLI argument parsing
- MSI installer configuration
- Portable ZIP build script

---

## Epic Dependency Flow

```
Epic 1: Foundation ──┐
                     │
Epic 2: Shells ──────┼──► Epic 4: Session (KILLER FEATURE)
                     │
Epic 3: Tabs ────────┘
                           │
                           ▼
                    Epic 5: Themes & Settings
                           │
                           ▼
                    Epic 6: Windows Integration
```

---

## Epic 1: Project Foundation & Basic Terminal

Developer dapat membuka Connexio dan menggunakan terminal dasar dengan satu shell yang functional.

**FRs covered:** FR20, FR21, FR22, FR23, FR24, FR25, FR26, FR40, FR41, FR42, FR43

### Story 1.1: Initialize Tauri Project with React Template

As a **developer**,
I want **to have a properly initialized Tauri + React project with all dependencies**,
So that **I have a solid foundation to build the terminal application**.

**Acceptance Criteria:**

**Given** the developer runs the initialization command
**When** `npm create tauri-app@latest connexio -- --template react-ts` completes
**Then** a new project folder with Tauri + React structure is created
**And** Tailwind CSS, shadcn/ui, xterm.js, Zustand, and lucide-react are installed
**And** the app launches successfully with `npm run tauri dev`
**And** a basic window with custom title bar is displayed

---

### Story 1.2: Integrate PTY Backend with ConPTY

As a **developer**,
I want **the Rust backend to spawn and manage terminal processes using Windows ConPTY**,
So that **the terminal can execute real shell commands**.

**Acceptance Criteria:**

**Given** the Tauri app is running
**When** the PTY spawn command is invoked
**Then** a new PowerShell process is created using ConPTY API
**And** the PTY can receive input from the frontend
**And** the PTY output is streamed back to the frontend via Tauri events
**And** the PTY can be resized when the terminal viewport changes

---

### Story 1.3: Implement Basic Terminal UI with xterm.js

As a **developer**,
I want **a terminal viewport using xterm.js with WebGL rendering**,
So that **I can type commands and see output with smooth performance**.

**Acceptance Criteria:**

**Given** the app is open with a PTY session active
**When** the user types commands in the terminal
**Then** keystrokes are sent to the PTY backend
**And** output from the PTY is displayed in the terminal viewport
**And** the terminal renders at 60 FPS with WebGL addon
**And** input latency is less than 16ms (FR20, NFR-P5)

---

### Story 1.4: Enable Terminal Scrollback and History

As a **developer**,
I want **to scroll through terminal output history**,
So that **I can review previous command outputs**.

**Acceptance Criteria:**

**Given** the terminal has produced output
**When** the user scrolls up using mouse wheel or keyboard
**Then** previous output is visible in the viewport
**And** scrollback buffer supports at least 10,000 lines (NFR-P9)
**And** scrolling performance maintains 60 FPS (FR21, NFR-P4)

---

### Story 1.5: Implement Copy and Paste Operations

As a **developer**,
I want **to copy text from terminal output and paste text into the terminal**,
So that **I can efficiently work with commands and output**.

**Acceptance Criteria:**

**Given** the terminal has text output
**When** the user selects text and presses Ctrl+C (or right-click → Copy)
**Then** selected text is copied to clipboard
**And** when user presses Ctrl+V (or right-click → Paste)
**Then** clipboard content is sent to the PTY input (FR22, FR23)

---

### Story 1.6: Enable True Color and Unicode Support

As a **developer**,
I want **the terminal to display true colors, Unicode characters, and emoji**,
So that **I have a modern terminal experience with full character support**.

**Acceptance Criteria:**

**Given** the terminal is displaying output
**When** a command produces colored output (e.g., `ls --color`)
**Then** true color (24-bit) is rendered correctly
**And** Unicode characters (including CJK) display properly
**And** emoji characters are rendered correctly (FR24, FR25)

---

### Story 1.7: Implement Basic Keyboard Shortcuts

As a **developer**,
I want **standard keyboard shortcuts for terminal operations**,
So that **I can work efficiently without using the mouse**.

**Acceptance Criteria:**

**Given** the terminal is active
**When** the user presses Ctrl+C
**Then** SIGINT is sent to the running process (if not selecting text)
**And** Ctrl+V pastes from clipboard
**And** Ctrl+L clears the screen
**And** shortcuts do not conflict with shell operations (FR26)

---

### Story 1.8: Display Application Version Information

As a **user**,
I want **to see the application version**,
So that **I know which version I'm running**.

**Acceptance Criteria:**

**Given** the application is running
**When** the user opens the About dialog or runs `--version` flag
**Then** the application version number is displayed
**And** version matches the package.json and Cargo.toml versions (FR43)

---

## Epic 2: Multi-Shell Support

Developer dapat memilih dan menggunakan berbagai shell (PowerShell, CMD, WSL, Git Bash).

**FRs covered:** FR13, FR14, FR15, FR16, FR17, FR18, FR19

### Story 2.1: Implement Shell Detection System

As a **developer**,
I want **the system to automatically detect available shells on my computer**,
So that **I only see shells that are actually installed**.

**Acceptance Criteria:**

**Given** the application starts
**When** the shell detection runs
**Then** PowerShell is detected if available (check standard paths)
**And** CMD is always available (Windows built-in)
**And** WSL is detected if installed (check `wsl --list`)
**And** Git Bash is detected if installed (check common paths)
**And** detection results are cached for performance (FR17)

---

### Story 2.2: Add PowerShell Shell Support

As a **developer**,
I want **to use PowerShell as my terminal shell**,
So that **I can run PowerShell commands and scripts**.

**Acceptance Criteria:**

**Given** PowerShell is detected on the system
**When** a new terminal is opened with PowerShell
**Then** PowerShell launches with correct environment
**And** PowerShell prompt is displayed
**And** PowerShell commands execute correctly
**And** colors and formatting work properly (FR13, NFR-C5)

---

### Story 2.3: Add CMD Shell Support

As a **developer**,
I want **to use Command Prompt (CMD) as my terminal shell**,
So that **I can run legacy batch scripts and commands**.

**Acceptance Criteria:**

**Given** CMD is available (always on Windows)
**When** a new terminal is opened with CMD
**Then** CMD launches with correct environment
**And** CMD prompt is displayed
**And** batch commands execute correctly
**And** PATH and environment variables are inherited (FR14, NFR-C6)

---

### Story 2.4: Add WSL Shell Support

As a **developer**,
I want **to use Windows Subsystem for Linux (WSL) as my terminal shell**,
So that **I can run Linux commands on Windows**.

**Acceptance Criteria:**

**Given** WSL is installed and detected
**When** a new terminal is opened with WSL
**Then** the default WSL distribution launches
**And** Linux shell prompt is displayed
**And** Linux commands execute correctly
**And** file path translation works (/mnt/c/ etc.) (FR15, NFR-C7)

---

### Story 2.5: Add Git Bash Shell Support

As a **developer**,
I want **to use Git Bash as my terminal shell**,
So that **I can use Git and Unix-like commands on Windows**.

**Acceptance Criteria:**

**Given** Git Bash is installed and detected
**When** a new terminal is opened with Git Bash
**Then** Git Bash launches from detected installation path
**And** Bash prompt is displayed
**And** Git and Unix commands execute correctly
**And** MINGW environment is properly loaded (FR16, NFR-C8)

---

### Story 2.6: Implement Shell Selector UI

As a **developer**,
I want **to select which shell to use when opening a new terminal**,
So that **I can choose the right shell for my task**.

**Acceptance Criteria:**

**Given** the user wants to open a new terminal
**When** the user clicks the new tab dropdown or uses keyboard shortcut
**Then** a list of detected shells is displayed
**And** each shell shows an icon and name
**And** clicking a shell opens a new terminal with that shell
**And** keyboard navigation works for shell selection (FR18)

---

### Story 2.7: Configure Default Shell Preference

As a **developer**,
I want **to set my preferred default shell**,
So that **new terminals open with my favorite shell automatically**.

**Acceptance Criteria:**

**Given** multiple shells are available
**When** the user sets a default shell in settings
**Then** the preference is saved
**And** new terminals (Ctrl+T) use the default shell
**And** the shell selector shows the default with a checkmark
**And** preference persists across app restarts (FR19)

---

## Epic 3: Tab Management

Developer dapat bekerja dengan multiple terminal tabs secara efisien.

**FRs covered:** FR7, FR8, FR9, FR10, FR11, FR12

### Story 3.1: Implement Tab Bar UI Component

As a **developer**,
I want **a tab bar that displays all open terminal tabs**,
So that **I can see and manage my multiple terminals**.

**Acceptance Criteria:**

**Given** the application is open
**When** the tab bar is rendered
**Then** all open tabs are displayed horizontally
**And** each tab shows its title
**And** the active tab is visually highlighted
**And** the tab bar is responsive and doesn't overflow awkwardly
**And** a "new tab" button is visible at the end of the tab bar

---

### Story 3.2: Open New Terminal Tabs

As a **developer**,
I want **to open new terminal tabs**,
So that **I can work on multiple tasks simultaneously**.

**Acceptance Criteria:**

**Given** the application is running
**When** the user clicks the "+" button or presses Ctrl+T
**Then** a new tab is created with the default shell
**And** the new tab becomes the active tab
**And** the terminal is ready for input immediately
**And** the tab bar updates to show the new tab (FR7)

---

### Story 3.3: Close Terminal Tabs

As a **developer**,
I want **to close terminal tabs I no longer need**,
So that **I can keep my workspace clean**.

**Acceptance Criteria:**

**Given** multiple tabs are open
**When** the user clicks the X button on a tab or presses Ctrl+W
**Then** the tab is closed
**And** the PTY session is terminated
**And** the next tab becomes active (or previous if closing last)
**And** if it's the last tab, app behavior follows settings (close or new tab) (FR8)

---

### Story 3.4: Switch Between Terminal Tabs

As a **developer**,
I want **to switch between terminal tabs quickly**,
So that **I can move between tasks efficiently**.

**Acceptance Criteria:**

**Given** multiple tabs are open
**When** the user clicks on a tab
**Then** that tab becomes active and its terminal is displayed
**And** Ctrl+Tab switches to next tab
**And** Ctrl+Shift+Tab switches to previous tab
**And** Ctrl+1-9 switches to tab by position
**And** tab switching is instant with no visible delay (FR9)

---

### Story 3.5: Reorder Tabs via Drag and Drop

As a **developer**,
I want **to reorder tabs by dragging them**,
So that **I can organize my terminals logically**.

**Acceptance Criteria:**

**Given** multiple tabs are open
**When** the user drags a tab to a new position
**Then** the tab moves to the new position
**And** other tabs shift to accommodate
**And** a visual indicator shows the drop position
**And** the tab order persists in session state (FR10)

---

### Story 3.6: Display Dynamic Tab Titles

As a **developer**,
I want **tabs to show the current directory or running process**,
So that **I can identify each terminal at a glance**.

**Acceptance Criteria:**

**Given** a terminal tab is active
**When** the working directory changes (via `cd` command)
**Then** the tab title updates to show the directory name
**And** when a command is running, the title shows the command name
**And** long titles are truncated with ellipsis
**And** tooltip shows full path on hover (FR11)

---

### Story 3.7: Support Many Simultaneous Tabs

As a **power user**,
I want **to have 10+ tabs open without performance degradation**,
So that **I can manage multiple projects at once**.

**Acceptance Criteria:**

**Given** the user opens many tabs
**When** 10 or more tabs are open
**Then** all tabs remain functional
**And** memory usage stays within limits (<30MB per tab, NFR-P7)
**And** tab switching remains instant
**And** scrolling the tab bar works if tabs overflow (FR12, NFR-P8)

---

## Epic 4: Session Persistence (KILLER FEATURE)

Developer dapat menutup Connexio dan membukanya kembali dengan semua tabs, directories, dan history ter-restore secara otomatis.

**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6

**🚀 INI ADALAH CORE DIFFERENTIATOR CONNEXIO!**

### Story 4.1: Define Session State Schema

As a **developer**,
I want **a well-defined session state structure**,
So that **all session data can be reliably saved and restored**.

**Acceptance Criteria:**

**Given** the session state needs to be persisted
**When** the schema is defined
**Then** it includes: tabs array, activeTabId, and settings
**And** each tab includes: id, shellType, workingDirectory, title, commandHistory
**And** schema version is included for future migrations
**And** TypeScript types match Rust structs for serialization

---

### Story 4.2: Implement Session Auto-Save

As a **developer**,
I want **my session state to be automatically saved periodically**,
So that **I never lose my work even if I forget to save**.

**Acceptance Criteria:**

**Given** the application is running with open tabs
**When** 30 seconds pass since last save (or state changes)
**Then** session state is saved to JSON file in %APPDATA%/Connexio/
**And** save operation is non-blocking (async)
**And** save failure is logged but doesn't interrupt user
**And** no "session saved" notification is shown (quiet confidence) (FR5, NFR-R4)

---

### Story 4.3: Save Session on Application Close

As a **developer**,
I want **my session to be saved when I close the application**,
So that **I can reopen exactly where I left off**.

**Acceptance Criteria:**

**Given** the user closes the application
**When** the close event is triggered
**Then** current session state is immediately saved
**And** all tab states are captured (shell, directory, history)
**And** no confirmation dialog is shown
**And** application closes quickly after save completes (FR1)

---

### Story 4.4: Restore Tabs on Application Launch

As a **developer**,
I want **all my previously open tabs restored when I launch the app**,
So that **I can immediately continue my work**.

**Acceptance Criteria:**

**Given** a saved session exists
**When** the application launches
**Then** all tabs from the saved session are restored
**And** tabs appear in the same order as before
**And** the previously active tab is active again
**And** restore happens in less than 2 seconds (FR2, NFR-P3)

---

### Story 4.5: Restore Working Directories

As a **developer**,
I want **each tab to restore to its last working directory**,
So that **I don't have to navigate to my projects again**.

**Acceptance Criteria:**

**Given** tabs are being restored from session
**When** each terminal spawns
**Then** it starts in the saved working directory
**And** the directory is validated to exist (fallback to home if not)
**And** tab title reflects the restored directory
**And** 100% of valid directories are correctly restored (FR3)

---

### Story 4.6: Preserve Command History Per Tab

As a **developer**,
I want **command history preserved for each tab across sessions**,
So that **I can recall previous commands without retyping**.

**Acceptance Criteria:**

**Given** a tab has command history
**When** the session is saved and restored
**Then** up to 1000 commands per tab are preserved
**And** arrow-up recalls previous commands in order
**And** history is specific to each tab (not shared)
**And** no credentials or sensitive data in history (NFR-S1) (FR4)

---

### Story 4.7: Implement Crash Recovery

As a **developer**,
I want **my session recovered after an unexpected crash**,
So that **I don't lose my work due to system issues**.

**Acceptance Criteria:**

**Given** the application crashes or system restarts unexpectedly
**When** the application is relaunched
**Then** session is restored from last auto-save
**And** maximum data loss is 30 seconds (last auto-save interval)
**And** crash recovery success rate is >99%
**And** user is notified only if recovery had issues (FR6, NFR-R3, NFR-R5)

---

## Epic 5: Theme System & Settings

Developer dapat mempersonalisasi tampilan terminal dan mengkonfigurasi preferences melalui UI yang intuitif.

**FRs covered:** FR27, FR28, FR29, FR30, FR31, FR32, FR33, FR34, FR35

### Story 5.1: Create Theme CSS Architecture

As a **developer**,
I want **a CSS variable-based theming system**,
So that **themes can be switched instantly without reload**.

**Acceptance Criteria:**

**Given** the theming system is implemented
**When** CSS variables are defined
**Then** all UI components use theme variables for colors
**And** terminal colors use theme variables
**And** theme switching is instant with no flicker
**And** variables cover: background, foreground, accent, terminal colors

---

### Story 5.2: Implement 5 Built-in Themes

As a **developer**,
I want **5 beautiful built-in themes to choose from**,
So that **I can find a theme that suits my preference**.

**Acceptance Criteria:**

**Given** the theme system is ready
**When** themes are implemented
**Then** 5 themes are available: Dark (default), Light, Nord, Dracula, Tokyo Night
**And** each theme has complete color definitions
**And** themes are visually distinct and professionally designed
**And** at least 3 light and 2 dark options exist (FR27, FR30)

---

### Story 5.3: Build Theme Picker with Live Preview

As a **developer**,
I want **to preview themes before applying them**,
So that **I can see how they look without committing**.

**Acceptance Criteria:**

**Given** the user opens theme settings
**When** the user hovers over or selects a theme option
**Then** the UI immediately previews that theme
**And** terminal colors update in real-time
**And** theme names are displayed with visual swatches
**And** preview reverts if user cancels (FR28)

---

### Story 5.4: Persist Theme Selection

As a **developer**,
I want **my theme choice to persist across sessions**,
So that **I don't have to reselect it every time**.

**Acceptance Criteria:**

**Given** the user selects a theme
**When** the theme is applied
**Then** the selection is saved to settings file
**And** on next app launch, the selected theme is applied
**And** theme persists across app updates (FR29, FR34)

---

### Story 5.5: Build Settings Panel UI

As a **developer**,
I want **an accessible settings panel**,
So that **I can configure my preferences easily**.

**Acceptance Criteria:**

**Given** the application is running
**When** the user clicks settings icon or presses Ctrl+,
**Then** a settings panel/dialog opens
**And** settings are organized into logical sections
**And** keyboard navigation works throughout
**And** changes take effect immediately (no save button needed) (FR31)

---

### Story 5.6: Implement Shell Settings

As a **developer**,
I want **to configure my default shell in settings**,
So that **new tabs always use my preferred shell**.

**Acceptance Criteria:**

**Given** the settings panel is open
**When** the user views shell settings
**Then** available shells are listed
**And** current default shell is indicated
**And** user can select a new default
**And** change takes effect for new tabs immediately (FR32)

---

### Story 5.7: Implement Theme Settings

As a **developer**,
I want **to change themes from settings**,
So that **I have a central place for all preferences**.

**Acceptance Criteria:**

**Given** the settings panel is open
**When** the user views appearance/theme settings
**Then** all 5 themes are displayed with previews
**And** current theme is indicated
**And** selecting a theme applies it with live preview
**And** theme picker is also accessible from quick menu (FR33)

---

### Story 5.8: Store Settings in %APPDATA%

As a **developer**,
I want **settings stored in the standard Windows location**,
So that **my preferences are safe and backed up with my profile**.

**Acceptance Criteria:**

**Given** settings need to be persisted
**When** settings are saved
**Then** they are stored in %APPDATA%/Connexio/settings.json
**And** settings survive app reinstallation
**And** portable mode stores in ./config/ instead
**And** settings are human-readable JSON (FR35, NFR-S2)

---

## Epic 6: Windows Integration & Distribution

Developer dapat mengintegrasikan Connexio dengan Windows Explorer dan menginstall aplikasi dengan mudah.

**FRs covered:** FR36, FR37, FR38, FR39

### Story 6.1: Add Explorer Context Menu Integration

As a **developer**,
I want **to right-click a folder and open it in Connexio**,
So that **I can quickly start a terminal in any directory**.

**Acceptance Criteria:**

**Given** Connexio is installed
**When** the user right-clicks a folder in Windows Explorer
**Then** "Open in Connexio" option appears in context menu
**And** clicking it opens Connexio with a new tab in that directory
**And** context menu works for folder background (inside folder) too
**And** registry entries are created during installation (FR36)

---

### Story 6.2: Support Command-Line Directory Parameter

As a **developer**,
I want **to launch Connexio with a specific directory**,
So that **scripts and shortcuts can open terminals in specific locations**.

**Acceptance Criteria:**

**Given** Connexio executable exists
**When** user runs `connexio.exe -d "C:\Projects\MyApp"`
**Then** Connexio opens with a new tab in that directory
**And** `-d` or `--directory` parameter is accepted
**And** invalid paths fall back to home directory with warning
**And** parameter works from cmd, PowerShell, and shortcuts (FR38)

---

### Story 6.3: Support Command-Line Command Execution

As a **developer**,
I want **to launch Connexio and execute a command**,
So that **I can create shortcuts for common tasks**.

**Acceptance Criteria:**

**Given** Connexio executable exists
**When** user runs `connexio.exe -e "npm run dev"`
**Then** Connexio opens and executes the command in a new tab
**And** `-e` or `--execute` parameter is accepted
**And** can combine with `-d` for directory + command
**And** terminal remains open after command completes (FR39)

---

### Story 6.4: Register as Default Terminal Application

As a **developer**,
I want **to set Connexio as my default terminal**,
So that **it opens instead of Windows Terminal for system operations**.

**Acceptance Criteria:**

**Given** Connexio is installed
**When** user enables "Set as Default Terminal" in settings
**Then** appropriate Windows registry entries are created
**And** opening "Terminal" from Start menu opens Connexio
**And** developer console operations use Connexio
**And** user can revert to Windows Terminal if desired (FR37)

---

### Story 6.5: Build MSI Installer Package

As a **user**,
I want **a professional MSI installer**,
So that **I can install Connexio like any other Windows application**.

**Acceptance Criteria:**

**Given** the build process runs
**When** MSI installer is generated
**Then** installer is less than 15MB (NFR-P10)
**And** installation creates Start Menu shortcut
**And** installation registers context menu entries
**And** uninstaller cleanly removes all files and registry entries
**And** installation doesn't require admin rights (user install) (FR40, NFR-S5)

---

### Story 6.6: Build Portable ZIP Distribution

As a **user**,
I want **a portable version of Connexio**,
So that **I can run it without installation or on shared computers**.

**Acceptance Criteria:**

**Given** the build process runs
**When** portable ZIP is generated
**Then** ZIP contains executable and all dependencies
**And** config is stored in ./config/ relative to executable
**And** no registry entries are created
**And** application runs by simply extracting and double-clicking (FR40)
