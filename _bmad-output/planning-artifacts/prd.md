---
stepsCompleted: ["step-01-init", "step-02-discovery", "step-03-success", "step-04-journeys", "step-05-domain", "step-06-innovation", "step-07-project-type", "step-08-scoping", "step-09-functional", "step-10-nonfunctional", "step-11-polish", "step-12-complete"]
workflowComplete: true
completedAt: 2026-01-14
inputDocuments:
  - product-brief-Connexio-2026-01-14.md
workflowType: 'prd'
documentCounts:
  briefs: 1
  research: 0
  brainstorming: 0
  projectDocs: 0
date: 2026-01-14
classification:
  projectType: desktop_app
  domain: general
  complexity: low
  projectContext: greenfield
---

# Product Requirements Document - Connexio

**Author:** Bos Yanda
**Date:** 2026-01-14

---

## Success Criteria

### User Success

| Metric                      | Target       | Measurement Method               |
| --------------------------- | ------------ | -------------------------------- |
| Session Restore Rate        | ≥ 99.5%      | Automated testing + user reports |
| Restore Time                | < 2 seconds  | Performance benchmarks           |
| First Productive Moment     | < 30 seconds | Time from install to first use   |
| Command History Persistence | 100%         | No history loss across sessions  |
| Theme Satisfaction          | 3+ options   | "Nyaman di mata" subjective test |

**User Success Indicators:**
- User opens Connexio → immediately productive (no setup ritual)
- User closes app with confidence (knows everything will restore)
- User never loses command history
- User finds at least one theme "nyaman di mata"

### Business Success

| Milestone | Target     | Key Activities                   |
| --------- | ---------- | -------------------------------- |
| Month 1   | 50 stars   | Soft launch, personal network    |
| Month 3   | 150 stars  | Public release, social promotion |
| Month 6   | 300 stars  | Community iteration              |
| Month 12  | 500+ stars | Established project              |

**Additional Business Metrics (12-month targets):**
- Organic social mentions: 10+ posts
- GitHub issues created: 50+
- Contributors: 5+
- Forks: 50+

### Technical Success

| Metric                | Target     | Comparison                         |
| --------------------- | ---------- | ---------------------------------- |
| Cold Startup Time     | < 1.5s     | Faster than Windows Terminal (~2s) |
| Warm Startup Time     | < 0.8s     | Near-instant feel                  |
| Memory Usage (Idle)   | < 100 MB   | 3x lighter than Electron apps      |
| Memory per Tab        | < 30 MB    | Efficient multi-tab usage          |
| Crash Rate            | < 0.1%     | 1 in 1000 sessions                 |
| Scroll Performance    | 60 FPS     | Smooth, no visual lag              |
| Heavy Output Handling | 10k+ lines | No freeze with AI agent output     |

### Measurable Outcomes

**Week 1 Success:**
- [ ] Connexio replaces Windows Terminal for daily use
- [ ] Zero crashes experienced
- [ ] Session restore works every time

**Month 1 Success:**
- [ ] 50 GitHub stars achieved
- [ ] First external user feedback received
- [ ] No critical bugs in production

**Month 3 Success (MVP Complete):**
- [ ] 150 GitHub stars
- [ ] Daily personal use maintained
- [ ] All MVP features stable

---

## Product Scope

### MVP - Minimum Viable Product

**Timeline:** Month 1-3

| Feature                   | Success Criteria                           |
| ------------------------- | ------------------------------------------ |
| Session Persistence       | 99.5% restore rate, < 2s restore time      |
| Tab Management            | Open/close/switch/reorder - responsive     |
| Working Directory Restore | 100% correct path restoration              |
| Command History           | 1000 commands/tab, persist across sessions |
| Built-in Themes (5)       | 3 light + 2 dark, all visually comfortable |
| Stable Terminal Emulator  | < 0.1% crash rate, 60 FPS scroll           |

**MVP Exit Criteria:**
- 14 days consecutive founder use without returning to Windows Terminal
- Session restore reliability ≥ 99%
- Startup time < 1.5 seconds
- Memory usage < 100 MB idle
- Zero crashes in final testing week

### Growth Features (Post-MVP)

**Timeline:** Month 4-8

| Feature             | Business Value          | Priority |
| ------------------- | ----------------------- | -------- |
| Split Panes         | Power user retention    | P1       |
| Custom Theme Editor | Community engagement    | P1       |
| Snippet Library     | Productivity boost      | P2       |
| Keyboard Shortcuts  | Power user satisfaction | P2       |
| Auto-update         | Reduced update friction | P2       |

### Vision (Future)

**Timeline:** Month 9-18+

| Feature          | Long-term Value         | Priority |
| ---------------- | ----------------------- | -------- |
| SSH/SFTP Manager | DevOps market expansion | P3       |
| Plugin System    | Community ecosystem     | P3       |
| Cloud Sync       | Premium tier potential  | P3       |
| Cross-platform   | macOS/Linux market      | P3       |

---

## User Journeys

### Journey 1: First-Time User - From Frustration to Flow

**Persona:** Andi, 24, Junior Developer / Vibe Coder

**Current State:** Frustrated with Windows Terminal - no session persistence, boring UI, frequent crashes, wastes 10+ minutes daily on setup.

**Journey Narrative:**

1. **Discovery** - Finds Connexio on GitHub/social media
2. **Installation** - Downloads, installs in < 30 seconds
3. **First Launch** - Greeted by theme picker, selects "Tokyo Night"
4. **Setup Session** - Opens 3 tabs, navigates to project folders
5. **The Test** - Closes Connexio completely
6. **Magic Moment** - Reopens → ALL tabs restored with correct directories!
7. **Daily Use** - Opens laptop → opens Connexio → immediately productive
8. **New Reality** - Never opens Windows Terminal again

**Success Criteria:**
- Install to first use: < 30 seconds
- Session restore: 100% reliable
- Setup time eliminated: 10+ minutes saved daily

---

### Journey 2: Crash Recovery - Trust Through Reliability

**Persona:** Andi, 2 months into usage

**Scenario:** Unexpected system crash during active coding session

**Journey Narrative:**

1. **Active Session** - 5 tabs open, deep in coding flow
2. **Crisis** - System bluescreen, forced restart
3. **Anxiety** - Worried about lost state and history
4. **Recovery** - Opens Connexio after reboot
5. **Relief** - All tabs, directories, and history restored from auto-save
6. **Trust Established** - Closes laptop without worry, knows Connexio has backup

**Success Criteria:**
- Auto-save interval: Every 30 seconds
- Crash recovery: 99%+ success rate
- Data loss on crash: Maximum 30 seconds of history

---

### Journey 3: Power User - Multi-Project Mastery

**Persona:** Budi, 32, Senior Developer

**Scenario:** Managing 5+ active projects with multiple terminals each

**Journey Narrative:**

1. **Complexity** - Handles 3 client projects + personal projects
2. **Setup Once** - Creates organized tab layout (6+ tabs)
3. **Daily Reality** - Opens Connexio → all projects ready instantly
4. **Efficiency** - Context switches by clicking tabs, not renavigating
5. **History Power** - Uses command history for frequent operations
6. **Advocacy** - Recommends Connexio to team, submits feature requests

**Success Criteria:**
- 10+ tabs: No performance degradation
- Memory per tab: < 30MB
- Command history: 1000+ commands accessible

---

### Journey 4: Customization - Making It Home

**Persona:** Any user, first week

**Scenario:** Personalizing the terminal experience

**Journey Narrative:**

1. **Default Start** - Uses default theme initially
2. **Exploration** - Opens Settings, browses theme options
3. **Preview** - Tests different themes, sees live preview
4. **Selection** - Chooses theme that matches preference
5. **Ownership** - Terminal feels like personal workspace
6. **Loyalty** - Connexio becomes "home" - won't switch to other terminals

**Success Criteria:**
- Theme options: Minimum 5 quality themes
- Preview: Live preview before applying
- Persistence: Settings survive app updates

---

### Journey Requirements Summary

| Capability Area | Requirements from Journeys                              |
| --------------- | ------------------------------------------------------- |
| Session System  | Auto-save (30s), crash recovery, full state restoration |
| Tab Management  | 10+ tabs, reorder, efficient memory                     |
| Theme System    | 5 themes, preview, persist selection                    |
| Settings        | Accessible UI, preferences storage                      |
| Performance     | < 1.5s startup, < 100MB idle, 60 FPS scroll             |
| Reliability     | < 0.1% crash, graceful degradation, backups             |

---

## Domain-Specific Requirements

### Security Requirements

| Requirement           | Priority | Implementation                           |
| --------------------- | -------- | ---------------------------------------- |
| Session Data Storage  | MVP      | Store in %APPDATA%/Connexio              |
| Command History       | MVP      | Plain text storage (user responsibility) |
| No Credential Storage | MVP      | Don't store passwords in history         |
| Future: SSH Keys      | Post-MVP | Use Windows Credential Manager           |

### Platform Requirements (Windows)

| Requirement        | Priority | Notes                         |
| ------------------ | -------- | ----------------------------- |
| PowerShell Support | MVP      | Default shell                 |
| CMD Support        | MVP      | Legacy compatibility          |
| WSL Support        | MVP      | Linux development             |
| Git Bash Support   | MVP      | Git workflows                 |
| Auto-detect Shells | MVP      | Show available shells in UI   |
| PATH Inheritance   | MVP      | Correct environment variables |
| Windows 10/11      | MVP      | Minimum supported OS          |

### Distribution Requirements

| Requirement     | Priority | Notes                                   |
| --------------- | -------- | --------------------------------------- |
| Portable Option | MVP      | ZIP distribution, no install required   |
| Installer       | Growth   | MSI for enterprise adoption             |
| Code Signing    | Growth   | Avoid SmartScreen warnings (~$300/year) |
| Auto-updater    | Growth   | Seamless updates                        |

### Risk Mitigations

| Risk                | Mitigation                                        |
| ------------------- | ------------------------------------------------- |
| SmartScreen Warning | Document workaround, pursue signing for v1.1      |
| Large Output Crash  | Implement virtual scrolling, 100k line buffer max |
| Memory Leaks        | Automated memory testing, session limits          |
| Shell Compatibility | Extensive testing matrix for all supported shells |

---

## Desktop App Specific Requirements

### Project-Type Overview

**Connexio** adalah Windows-native desktop terminal application yang dibangun dengan Tauri framework (Rust backend + WebView frontend). Fokus MVP adalah Windows platform dengan rencana cross-platform expansion di v2.0.

| Attribute        | Value                             |
| ---------------- | --------------------------------- |
| Platform         | Windows 10/11 (MVP)               |
| Framework        | Tauri v2                          |
| Frontend         | React + TypeScript                |
| Backend          | Rust                              |
| Distribution     | GitHub Releases (manual download) |
| Network Required | No (100% offline)                 |

---

### Platform Support

#### MVP (v1.0) - Windows Only

| Requirement      | Specification                                |
| ---------------- | -------------------------------------------- |
| Minimum OS       | Windows 10 (build 1903+)                     |
| Recommended OS   | Windows 11                                   |
| Architecture     | x64 (primary), ARM64 (if feasible)           |
| WebView Runtime  | Microsoft Edge WebView2 (bundled or require) |
| .NET Requirement | None (pure Rust backend)                     |

#### Future (v2.0+) - Cross-Platform

| Platform | Target Version | Notes                  |
| -------- | -------------- | ---------------------- |
| macOS    | v2.0           | Intel + Apple Silicon  |
| Linux    | v2.0           | AppImage / .deb / .rpm |
| Windows  | Maintained     | Continue updates       |

---

### System Integration

#### Default Terminal Registration

| Feature                | Priority | Implementation                         |
| ---------------------- | -------- | -------------------------------------- |
| Set as Default Console | MVP      | Windows Terminal replacement           |
| Handle `wt.exe` calls  | Growth   | Intercept Windows Terminal invocations |
| Terminal Profiles API  | Future   | Windows Settings integration           |

**Implementation Notes:**
- Register as console application handler
- Support command-line launch with directory parameter: `connexio.exe -d "C:\path"`
- Support command execution: `connexio.exe -e "npm run dev"`

#### Windows Explorer Integration

| Feature                         | Priority | Implementation                             |
| ------------------------------- | -------- | ------------------------------------------ |
| "Open in Connexio" Context Menu | MVP      | Registry entry for folder right-click      |
| "Open Connexio Here"            | MVP      | Directory context menu                     |
| Shift+Right-Click Option        | MVP      | Extended context menu                      |
| File Association                | Future   | Associate .sh, .bat, .ps1 files (optional) |

**Registry Keys Required:**
```
HKEY_CLASSES_ROOT\Directory\Background\shell\Connexio
HKEY_CLASSES_ROOT\Directory\shell\Connexio
```

---

### Update Strategy

#### MVP Approach - Manual Updates

| Aspect              | Implementation                          |
| ------------------- | --------------------------------------- |
| Distribution        | GitHub Releases                         |
| Update Notification | In-app check for new version (optional) |
| Download            | User downloads manually from GitHub     |
| Installation        | User runs installer/extracts ZIP        |
| Settings Migration  | Automatic (settings in %APPDATA%)       |

#### Growth Phase - Semi-Automatic Updates

| Feature          | Priority | Implementation                      |
| ---------------- | -------- | ----------------------------------- |
| Version Check    | v1.1     | Check GitHub API for latest release |
| Update Badge     | v1.1     | Show "Update Available" in UI       |
| One-Click Update | v1.2     | Download + install in background    |
| Auto-Update      | v2.0     | Silent updates with user opt-out    |

---

### Offline Capabilities

| Requirement        | Status      | Notes                                       |
| ------------------ | ----------- | ------------------------------------------- |
| Core Functionality | ✅ 100%     | Terminal, tabs, sessions - fully offline    |
| Theme System       | ✅ 100%     | All themes bundled, no download needed      |
| Settings           | ✅ 100%     | Local storage only                          |
| Update Check       | ⚡ Optional | Can be disabled, not required for operation |
| Telemetry          | ❌ None     | No analytics, no phone-home                 |
| Cloud Features     | ❌ None     | No cloud sync in MVP                        |

**Offline-First Principles:**
- App must launch and function with no internet connection
- No features gated behind network availability
- All assets bundled in application package
- User data stored locally only

---

### Technical Architecture Considerations

#### Tauri-Specific Requirements

| Component        | Technology         | Notes                        |
| ---------------- | ------------------ | ---------------------------- |
| Terminal Core    | Rust PTY library   | Windows ConPTY API           |
| UI Framework     | React 18+          | Functional components, hooks |
| State Management | Zustand or Jotai   | Lightweight, persist to disk |
| IPC              | Tauri Commands     | Rust ↔ JS communication      |
| Storage          | File system (JSON) | %APPDATA%/Connexio/          |
| Theming          | CSS Variables      | Runtime theme switching      |

#### Terminal Emulator Requirements

| Requirement       | Specification                       |
| ----------------- | ----------------------------------- |
| PTY Library       | Windows ConPTY via Rust bindings    |
| Terminal Protocol | xterm-compatible                    |
| Unicode Support   | Full UTF-8 + emoji                  |
| Font Rendering    | System fonts + bundled coding fonts |
| Color Support     | True color (24-bit)                 |
| Scrollback Buffer | 10,000 lines default, configurable  |

---

### Implementation Considerations

#### Build & Distribution

| Aspect          | Implementation                     |
| --------------- | ---------------------------------- |
| Build Target    | Windows x64 MSI + Portable ZIP     |
| Installer       | Tauri bundler (WiX-based MSI)      |
| Portable Mode   | ZIP extract, run anywhere          |
| Config Location | %APPDATA%/Connexio (installed)     |
|                 | ./config (portable mode)           |
| Code Signing    | Defer to v1.1 (cost consideration) |

#### Performance Targets

| Metric           | Target   | Measurement           |
| ---------------- | -------- | --------------------- |
| Binary Size      | < 15 MB  | Installer package     |
| Cold Start       | < 1.5s   | First launch          |
| Warm Start       | < 0.8s   | Subsequent launches   |
| Memory (Idle)    | < 100 MB | Base app, no tabs     |
| Memory (10 tabs) | < 200 MB | Active usage scenario |
| Input Latency    | < 16ms   | Keystroke to display  |


---

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Problem-Solving MVP
> Fokus utama: Solve the core pain point (session tidak tersimpan, terminal membosankan) dengan solusi yang works 100%.

**MVP Philosophy:**
- Deliver working session persistence that users can trust
- Beautiful themes that make terminal enjoyable
- Stability over features
- "Do one thing exceptionally well"

**Target Timeline:**

| Phase | Duration    | Deliverable                    |
| ----- | ----------- | ------------------------------ |
| MVP   | Month 1-3   | Core features, personal use    |
| v1.1  | Month 4-5   | Workspaces + community release |
| v1.2  | Month 6-8   | Power user features            |
| v2.0  | Month 9-12+ | Cross-platform + ecosystem     |

**Resource Requirements:**

| Resource        | Requirement                             |
| --------------- | --------------------------------------- |
| Team Size       | Solo developer (founder)                |
| Skills Needed   | Rust basics, React/TypeScript, Tauri    |
| Time Commitment | Part-time (10-15 hrs/week) or Full-time |
| Infrastructure  | GitHub (free), local dev environment    |

---

### MVP Feature Set (Phase 1)

**Timeline:** Month 1-3

**Core User Journeys Supported:**
- ✅ Journey 1: First-Time User (install → magic moment)
- ✅ Journey 2: Crash Recovery (trust through reliability)
- ⚠️ Journey 3: Power User (partial - single workspace only)
- ✅ Journey 4: Customization (themes)

**Must-Have Capabilities:**

| #   | Feature                 | Priority | Success Criteria                 |
| --- | ----------------------- | -------- | -------------------------------- |
| 1   | Session Persistence     | P0       | 99.5% restore rate, < 2s restore |
| 2   | Tab Management          | P0       | Open/close/switch/reorder        |
| 3   | Working Directory Save  | P0       | 100% correct path restoration    |
| 4   | Command History per Tab | P0       | 1000 commands, persist across    |
| 5   | Built-in Themes (5)     | P0       | 3 light + 2 dark, nyaman di mata |
| 6   | Shell Support           | P0       | PowerShell, CMD, WSL, Git Bash   |
| 7   | Stable Terminal Core    | P0       | < 0.1% crash, 60 FPS scroll      |
| 8   | Explorer Integration    | P1       | "Open in Connexio" context menu  |
| 9   | Default Terminal Option | P1       | Register as default console      |

**Explicitly NOT in MVP:**
- ❌ Named Workspaces (v1.1)
- ❌ Split Panes (v1.2)
- ❌ Snippet Library (v1.2)
- ❌ Custom Theme Editor (v1.2)
- ❌ Auto-updater (v1.1)
- ❌ SSH/SFTP (v2.0)

---

### Post-MVP Features

**Phase 2: v1.1 - Workspaces & Polish (Month 4-5)**

| Feature            | Priority | Description                            |
| ------------------ | -------- | -------------------------------------- |
| Named Workspaces   | P1       | Save/switch multiple workspace configs |
| Update Checker     | P1       | Check GitHub for new versions          |
| Workspace Switcher | P1       | UI to manage workspaces                |
| Settings Export    | P2       | Backup/restore settings                |

**Phase 3: v1.2 - Power User Features (Month 6-8)**

| Feature             | Priority | Description                 |
| ------------------- | -------- | --------------------------- |
| Split Panes         | P1       | Horizontal/vertical splits  |
| Custom Theme Editor | P1       | Create/edit themes          |
| Snippet Library     | P2       | Save/run command snippets   |
| Keyboard Shortcuts  | P2       | Customizable hotkeys        |
| Auto-update         | P2       | One-click or silent updates |

**Phase 4: v2.0 - Platform Expansion (Month 9-12+)**

| Feature          | Priority | Description              |
| ---------------- | -------- | ------------------------ |
| macOS Support    | P1       | Cross-platform           |
| Linux Support    | P1       | Cross-platform           |
| SSH/SFTP Manager | P2       | Remote connections       |
| Plugin System    | P3       | Community extensions     |
| Cloud Sync       | P3       | Optional sync (premium?) |

---

### Risk Mitigation Strategy

**Technical Risks:**

| Risk                            | Likelihood | Impact | Mitigation                                  |
| ------------------------------- | ---------- | ------ | ------------------------------------------- |
| Rust/Tauri Learning Curve       | Medium     | Medium | Start with tutorials, simple features first |
| ConPTY Integration Issues       | Medium     | High   | Research existing Rust PTY libraries early  |
| Performance Not Meeting Targets | Low        | High   | Profile early, optimize critical paths      |
| WebView2 Compatibility          | Low        | Medium | Test on multiple Windows versions           |

**Market Risks:**

| Risk                      | Likelihood | Impact | Mitigation                                     |
| ------------------------- | ---------- | ------ | ---------------------------------------------- |
| Competition (Tabby/Hyper) | Medium     | Medium | Focus on session persistence as differentiator |
| Low Adoption              | Medium     | Low    | Build in public, engage community early        |
| Feature Creep             | High       | Medium | Strict MVP scope, defer to roadmap             |

**Resource Risks:**

| Risk             | Likelihood | Impact | Mitigation                                 |
| ---------------- | ---------- | ------ | ------------------------------------------ |
| Time Constraints | High       | Medium | Realistic timeline, cut features if needed |
| Burnout          | Medium     | High   | Sustainable pace, celebrate milestones     |
| Scope Creep      | High       | Medium | Reference this PRD, say "no" to extras     |

**Contingency Plans:**

| If This Happens...    | Then Do This...                        |
| --------------------- | -------------------------------------- |
| MVP taking > 3 months | Cut Explorer integration to v1.1       |
| Rust PTY issues       | Consider Node.js PTY as fallback       |
| Performance issues    | Reduce scrollback buffer, optimize     |
| Low initial adoption  | Focus on personal use, iterate quietly |


---

## Functional Requirements

### Session Management

- FR1: User can have all open tabs automatically saved when closing the application
- FR2: User can have all previously open tabs restored when launching the application
- FR3: User can have working directories restored to their last state for each tab
- FR4: User can have command history preserved for each tab across sessions
- FR5: System can auto-save session state periodically (every 30 seconds)
- FR6: System can recover session state after unexpected system crash

### Tab Management

- FR7: User can open new terminal tabs
- FR8: User can close terminal tabs
- FR9: User can switch between terminal tabs
- FR10: User can reorder tabs via drag-and-drop
- FR11: User can see tab title showing current directory or process
- FR12: User can have multiple tabs open simultaneously (10+)

### Shell Support

- FR13: User can use PowerShell as terminal shell
- FR14: User can use Command Prompt (CMD) as terminal shell
- FR15: User can use Windows Subsystem for Linux (WSL) as terminal shell
- FR16: User can use Git Bash as terminal shell
- FR17: System can auto-detect available shells on the system
- FR18: User can select which shell to use for new tabs
- FR19: User can set a default shell preference

### Terminal Emulator Core

- FR20: User can type commands and see output in terminal
- FR21: User can scroll through terminal output history
- FR22: User can copy text from terminal output
- FR23: User can paste text into terminal input
- FR24: User can see colors in terminal output (true color support)
- FR25: User can see Unicode characters and emoji in terminal output
- FR26: User can use keyboard shortcuts for terminal operations

### Theme System

- FR27: User can select from built-in themes (minimum 5)
- FR28: User can preview theme before applying
- FR29: User can have selected theme persist across sessions
- FR30: User can see visually distinct light and dark theme options

### Settings & Preferences

- FR31: User can access settings through UI
- FR32: User can configure default shell preference
- FR33: User can configure theme preference
- FR34: User can have settings persist across app updates
- FR35: System can store settings in standard Windows location (%APPDATA%)

### Windows Integration

- FR36: User can open Connexio from Windows Explorer context menu ("Open in Connexio")
- FR37: User can set Connexio as default terminal application
- FR38: User can launch Connexio with command-line directory parameter
- FR39: User can launch Connexio with command-line command to execute

### Application Lifecycle

- FR40: User can install application from portable ZIP or installer
- FR41: User can run application without administrator privileges
- FR42: User can use application fully offline (no internet required)
- FR43: System can display application version information


---

## Non-Functional Requirements

### Performance

| NFR ID  | Requirement                          | Target        | Measurement                |
| ------- | ------------------------------------ | ------------- | -------------------------- |
| NFR-P1  | Application cold startup time        | < 1.5 seconds | Timer from launch to ready |
| NFR-P2  | Application warm startup time        | < 0.8 seconds | Timer from launch to ready |
| NFR-P3  | Session restore time                 | < 2.0 seconds | Timer from launch to tabs  |
| NFR-P4  | Terminal scroll performance          | 60 FPS        | Frame rate monitoring      |
| NFR-P5  | Input latency (keystroke to display) | < 16ms        | Latency measurement        |
| NFR-P6  | Memory usage (idle, no tabs)         | < 100 MB      | Windows Task Manager       |
| NFR-P7  | Memory usage per additional tab      | < 30 MB       | Memory profiling           |
| NFR-P8  | Memory usage (10 active tabs)        | < 200 MB      | Memory profiling           |
| NFR-P9  | Large output handling without freeze | 10,000+ lines | Stress testing             |
| NFR-P10 | Binary/installer size                | < 15 MB       | File size check            |

### Reliability

| NFR ID | Requirement                    | Target       | Measurement                 |
| ------ | ------------------------------ | ------------ | --------------------------- |
| NFR-R1 | Application crash rate         | < 0.1%       | Crash reports per session   |
| NFR-R2 | Session data persistence       | 100%         | No data loss on normal exit |
| NFR-R3 | Crash recovery success rate    | > 99%        | Recovery testing            |
| NFR-R4 | Auto-save frequency            | Every 30 sec | Timer verification          |
| NFR-R5 | Data loss on crash             | < 30 seconds | Crash testing               |
| NFR-R6 | Graceful degradation on errors | No data loss | Error scenario testing      |

### Compatibility

| NFR ID | Requirement                | Target           | Measurement              |
| ------ | -------------------------- | ---------------- | ------------------------ |
| NFR-C1 | Minimum Windows version    | Windows 10 1903+ | OS version testing       |
| NFR-C2 | Windows 11 full support    | Yes              | OS compatibility testing |
| NFR-C3 | x64 architecture support   | Required         | Platform testing         |
| NFR-C4 | ARM64 architecture support | Best effort      | Platform testing         |
| NFR-C5 | PowerShell compatibility   | 100%             | Shell testing            |
| NFR-C6 | CMD compatibility          | 100%             | Shell testing            |
| NFR-C7 | WSL compatibility          | 100%             | Shell testing            |
| NFR-C8 | Git Bash compatibility     | 100%             | Shell testing            |

### Security

| NFR ID | Requirement                        | Target          | Measurement         |
| ------ | ---------------------------------- | --------------- | ------------------- |
| NFR-S1 | No credential storage in history   | Enforced        | Code review         |
| NFR-S2 | Local data storage location        | %APPDATA%       | Configuration check |
| NFR-S3 | No telemetry or analytics          | None            | Network monitoring  |
| NFR-S4 | No internet required for operation | 100% offline    | Offline testing     |
| NFR-S5 | No elevated privileges required    | User-level only | UAC testing         |

### Usability

| NFR ID | Requirement                               | Target         | Measurement           |
| ------ | ----------------------------------------- | -------------- | --------------------- |
| NFR-U1 | Time from install to first productive use | < 30 seconds   | User testing          |
| NFR-U2 | Time to change theme                      | < 3 clicks     | UI flow analysis      |
| NFR-U3 | Discoverability of key features           | Intuitive      | User feedback         |
| NFR-U4 | Keyboard navigation support               | Full           | Keyboard-only testing |
| NFR-U5 | Visual comfort (theme options)            | 3+ comfortable | User satisfaction     |

### Accessibility (Basic)

| NFR ID | Requirement                      | Target        | Measurement      |
| ------ | -------------------------------- | ------------- | ---------------- |
| NFR-A1 | Keyboard-only operation support  | Full          | Keyboard testing |
| NFR-A2 | High contrast theme availability | 1+ theme      | Visual review    |
| NFR-A3 | Font size adjustability          | Future (v1.1) | UI review        |

