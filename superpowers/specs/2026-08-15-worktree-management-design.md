# Worktree Management Design — Connexio

**Date:** 2026-08-15  
**Author:** AI Assistant (Connexio Refactor)  
**Status:** Draft → Review → Approved  
**References:** Orca Worktrees Model (https://www.onorca.dev/docs/model/worktrees), Connexio `src-tauri/src/modules/git.rs`, `shared/types.ts`

---

## Executive Summary

This document specifies a **worktree management system** for Connexio, modeled after Orca's worktree-native workflow: each feature/bug/task gets its own isolated Git worktree with dedicated terminals, editor tabs, and side-panel state. This enables **parallel agent sessions**, **task isolation without repo clutter**, and **safe deletion** of completed features.

### Goals ✅

| # | Goal | Acceptance Criteria |
|---|------|---------------------|
| G1 | Isolated parallel workflows | Each worktree has own branch + filesystem; agents can run concurrently |
| G2 | Discoverability | Worktrees listed under project in sidebar/project picker |
| G3 | Safety | Deletion prompts with preview diff against base ref; symlink loop protection |
| G4 | Performance | Async Rust commands; skip oversized files; no blocking main thread |
| G5 | Integration | Terminals, explorer, git panel all scoped to worktree path |

### Non-goals ❌

- Multi-repo project groups (Orca feature) — not in scope v1
- Remote server orchestration — not in scope v1
- Shared directory/materialized paths from `.worktreeinclude` — defer to v2 (requires materialize service)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                         Connexio                              │
├──────────────────────────────────────────────────────────────┤
│  UI Layer                                                       │
│  ├─ Project Picker → new "Worktrees" column in sidebar         │
│  ├─ Git Panel → worktree list + create/delete modal            │
│  └─ Terminal Layer → per-worktree tab pool                     │
│                                                                │
│  API Layer                                                      │
│  ├─ connexio.worktrees.create { projectPath, name, fromRef }   │
│  ├─ connexio.worktrees.list { projectPath }                    │
│  ├─ connexio.worktrees.delete { projectPath, worktreeName }    │
│  └─ connexio.worktrees.previewDiff { worktreeId }              │
│                                                                │
│  Rust Core (`modules/worktree.rs`)                              │
│  ├─ run_git_async (spawn_blocking helper)                      │
│  ├─ worktree_add(project, branch, path)                        │
│  ├─ worktree_list(project)                                     │
│  ├─ worktree_delete(worktree_path, branch_name)                │
│  └─ preview_diff(branch, base_ref)                             │
│                                                                │
│  Data Models                                                    │
│  ├─ Project extends: worktrees[]                               │
│  └─ WorktreeEntry: id, name, branch, baseRef, path, createdAt │
└──────────────────────────────────────────────────────────────┘
```

### Key Decisions

| Decision | Rationale |
|----------|-----------|
| **Separate module `worktree.rs`** | Keep git.rs focused; worktree is a cross-cutting concern |
| **Async commands via `spawn_blocking`** | Avoid freeze when scanning/deleting large repos |
| **Worktrees as first-class projects** | Reuse project-terminal pattern; avoid custom navigation |
| **Base ref = `origin/main` by default** | Follows Orca model; user overrides during creation |
| **Symlink guard at metadata level** | Prevent infinite loops before walk starts |

---

## Technical Specifications

### A. Rust Commands (`modules/worktree.rs`)

#### Data Types

```rust
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeEntry {
    pub id: String,          // unique identifier: <hash>-<basename>
    pub name: String,        // display name (derived from branch or user input)
    pub branch: String,      // git branch name for this worktree
    pub base_ref: String,    // what it branched from (e.g., origin/main)
    pub path: String,        // absolute worktree path on disk
    pub created_at: u64,     // UNIX timestamp
    pub is_dirty: bool,      // true if local changes exist
}
```

#### Command Signatures

| Function | Signature | Description |
|----------|-----------|-------------|
| `worktree_create` | `async fn worktree_create(project_path: String, name: String, from_ref: Option<String>, branch_override: Option<String>) -> Result<WorktreeEntry, String>` | Create new worktree. Returns full entry including disk path. |
| `worktree_list` | `fn worktree_list(project_path: String) -> Result<Vec<WorktreeEntry>, String>` | List all worktrees for a given project repo. Includes parent checkout if still tracked. |
| `worktree_delete` | `async fn worktree_delete(project_path: String, worktree_id: String, confirm_branch: String) -> Result<(), String>` | Delete worktree + branch. Requires explicit branch confirmation to prevent accidental deletions. |
| `worktree_preview_diff` | `async fn worktree_preview_diff(project_path: String, worktree_id: String, base_ref: Option<String>) -> Result<Vec<GitChangedFile>, String>` | Preview uncommitted changes before deletion. |

#### Implementation Notes

```rust
// Helper: run git command asynchronously
fn run_git_cwd_sync(cwd: &str, args: &[&str]) -> Result<Option<String>, String> {
    tokio::task::spawn_blocking(move || {
        let output = std::process::Command::new("git")
            .args(args)
            .current_dir(cwd)
            .output()
            .map_err(|e| format!("Failed to execute git: {}", e))?;
        Ok(if output.status.success() {
            Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
        } else {
            Err(format!("{}", String::from_utf8_lossy(&output.stderr)))?
        })
    })
    .await
    .map_err(|e| format!("Spawn failed: {}", e))?
}

// worktree_add: git worktree add -b <branch> <path> <start-point>
// Guard: verify path doesn't exist, ensure target dir is clean
// Return: (path, branch) tuple
```

#### Error Handling

| Error Condition | User Message | Recovery Action |
|-----------------|--------------|-----------------|
| Path already exists | "A worktree already exists at this location." | Show existing worktree details; offer to merge or cancel |
| Branch exists | "Branch 'feature/x' already exists." | Auto-suffix name or ask user to override |
| Parent not a repo | "Not a git repository." | Point to valid repo path |
| Symlink detected | "Cannot follow symlinked directories." | Skip symlink entry; log warning |

---

### B. Frontend API (`renderer/core/api-remote/index.ts` pattern)

```typescript
// Add to shared/ipc.ts
export const WORKTREES_CHANNEL = "worktrees";

// Add remote adapter methods
export const worktrees = {
  create: async (projectPath: string, name: string, options?: { fromRef?: string; branchOverride?: string }): Promise<WorktreeEntry> => {
    return sendCommand({ ch: "worktrees_create", projectPath, name, ...options });
  },
  list: async (projectPath: string): Promise<WorktreeEntry[]> => {
    return sendCommand({ ch: "worktrees_list", projectPath });
  },
  delete: async (projectPath: string, worktreeId: string, confirmBranch: string): Promise<void> => {
    return sendCommand({ ch: "worktrees_delete", projectPath, worktreeId, confirmBranch });
  },
  previewDiff: async (worktreeId: string): Promise<GitChangedFile[]> => {
    return sendCommand({ ch: "worktrees_previewDiff", worktreeId });
  },
};
```

---

### C. UI Wireframes

#### 1. Sidebar Project Row Extension

```
┌────────────────────────────────────────────────────────────┐
│ ☰ Project: my-cool-app                                    │
│   ├── src/                                                 │
│   ├── package.json                                         │
│   └── 🔧 Worktrees                                           │
│       ├── 📄 feature/login-flow                            │ ← click opens new terminal row
│       ├── 📄 bugfix/header-spacer                          │
│       └── [+] Create Worktree...                           │
└────────────────────────────────────────────────────────────┘
```

#### 2. Create Worktree Dialog

```
┌────────────────────────────────────────────────────────────┐
│ Create Worktree                                             │
├────────────────────────────────────────────────────────────┤
│ Name:           [feature/my-new-feature___]                │
│ Start From:     [origin/main ▼]                            │
│ Branch Name:    [feature-my-new-feature_________]          │
│                                                            │
│ Advanced ▼                                               │
│   Linked Issue:                                            │
│     GitHub PR / Linear Jira / GitLab MR                   │
│                                                             │
│ [Cancel]              [Create Worktree]                    │
└────────────────────────────────────────────────────────────┘
```

#### 3. Git Panel Extension (under branch picker)

```
┌────────────────────────────────────────────────────────────┐
│ Source Control                                              │
├────────────────────────────────────────────────────────────┤
│ 🔀 main                                                     │
│ 🏷️ Changes                                                  │
│                                                            │
│ ─── Worktrees ───                                          │
│ │  Feature/Login Flow                                       │
│ │  Bugfix/Header Spacing                                     │
│ │                                                         │
│ │ [+ Add Worktree...]                                      │
│ ──────────────────────────────────────────────────────────│
```

---

### D. Data Model Updates

#### `shared/types.ts`

```typescript
// Extend Project interface
export interface Project {
  id: string;
  name: string;
  path: string;
  worktrees?: WorktreeEntry[];  // optional array of worktrees
}

// New type definition
export interface WorktreeEntry {
  id: string;           // unique ID: hash-<slug>
  name: string;         // display name
  branch: string;       // git branch name
  baseRef: string;      // start-from ref (e.g., origin/main)
  path: string;         // full disk path
  createdAt: number;    // UNIX timestamp
  isDirty?: boolean;    // true if local changes exist
}
```

---

## Security & Edge Cases

### Protection Against Infinite Loops

- Before recursing into subdirectories, check `file_type.is_symlink()` via `metadata.follow_links(false)`
- If symlink detected, log warning and skip traversal (same as symlink protection in search command)
- On Windows, use `fs::read_link` to detect junction points

### Safe Deletion Pattern

1. User clicks "Delete" → open confirmation modal
2. Modal shows:
   - Worktree name and branch
   - Diff summary against base ref (N modified, M untracked)
   - Checkbox: "I understand this will delete all local changes permanently"
3. On confirmation: `worktree_delete` called with explicit `confirm_branch` parameter
4. If deletion fails (unmerged commits): present toast with button "Review N branches" → list branches for manual review/deletion

---

## Testing Strategy

### Rust Unit Tests (`modules/worktree.rs`)

```rust
#[cfg(test)]
mod tests {
    #[test]
    fn creates_worktree_with_correct_structure() {
        // Setup temp repo, create worktree, assert path + branch match
    }

    #[test]
    fn lists_existing_worktrees() {
        // Create two worktrees, assert count + entry fields
    }

    #[test]
    fn skips_symlink_directories() {
        // Create symlink to parent dir, verify no infinite recursion
    }

    #[test]
    fn rejects_deletion_without_confirmation() {
        // Attempt delete without confirming branch, assert error message
    }
}
```

### Frontend Component Tests

```typescript
it("creates worktree via dialog", async () => {
  render(<CreateWorktreeDialog />);
  await userEvent.type(screen.getByLabelText(/name/i), "feature/test");
  await userEvent.click(screen.getByRole("button", { name: /create/i }));
  expect(api.worktrees.create).toHaveBeenCalledWith(
    "/path/to/repo",
    "feature/test",
    expect.anything()
  );
});
```

---

## Rollout Plan

| Phase | Scope | Effort | Deliverable |
|-------|-------|--------|-------------|
| **P1: MVP** | Rust commands (`create/list/delete`), basic UI (sidebar expansion + create dialog) | ~6 hours | Worktrees appear in project picker, can create/list |
| **P2: Git integration** | Git panel extension, diff preview, deletion safety | ~4 hours | Full lifecycle: create → work → delete |
| **P3: Polish** | Emoji naming, linked issues (Linear/GitHub), progress indicators, cleanup tests | ~2 hours | Production-ready UX |
| **Total** | | **~12 hours** | |

---

## Next Steps

1. ✅ Read docs → approved design above  
2. ⏸️ Review with product/engineering  
3. ⏸️ Implement P1 MVP (TDD)  
4. ⏸️ Test locally → merge  
