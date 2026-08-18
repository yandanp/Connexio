use serde::Serialize;
use std::path::Path;
use std::path::PathBuf;

/// A single git worktree registered for a project.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeEntry {
    pub id: String,
    pub name: String,
    pub branch: String,
    pub base_ref: String,
    pub path: String,
    pub created_at: u64,
    pub is_dirty: bool,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
pub(crate) fn run_git(cwd: &str, args: &[&str]) -> Result<String, String> {
    let output = std::process::Command::new("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

/// Summary of a worktree's divergence from its base ref.
#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeDiffSummary {
    pub changed_files: u32,
    pub ahead: u32,
    pub behind: u32,
}

/// Result of a worktree deletion: the directory is always removed; the
/// branch is preserved when it holds unmerged commits.
#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeDeleteResult {
    pub preserved_branch: Option<String>,
}

/// Run git on a blocking thread; heavy worktree operations must never run on
async fn run_git_async(cwd: String, args: Vec<String>) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let args_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
        run_git(&cwd, &args_refs)
    })
    .await
    .map_err(|e| format!("Git task failed: {}", e))?
}

fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

/// Derive a stable id from the worktree path: <hash of path>-<basename>.
fn worktree_id(path: &str) -> String {
    use std::hash::{Hash, Hasher};
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    path.hash(&mut hasher);
    let basename = Path::new(path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    format!("{:x}-{}", hasher.finish(), basename)
}

/// Where a project's worktrees live on disk.
///
/// - `None` (default): `<project>/.worktrees` — inside the repo.
/// - `Some(dir)`: `<dir>/<repo-name>` — a central workspace dir like Orca's,
///   keeping the original repo untouched.
pub fn resolve_worktree_dir(project_path: &str, central_dir: Option<&str>) -> PathBuf {
    let repo_name = Path::new(project_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_lowercase())
        .map(|n| slugify(&n))
        .unwrap_or_else(|| "repo".to_string());
    match central_dir {
        Some(dir) => Path::new(dir).join(repo_name),
        None => Path::new(project_path).join(".worktrees"),
    }
}
/// Normalize a workspace name into a filesystem/git-safe branch slug.
pub fn slugify(name: &str) -> String {
    let mut slug: String = name
        .trim()
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect();
    while slug.contains("--") {
        slug = slug.replace("--", "-");
    }
    let trimmed = slug.trim_matches('-').to_string();
    if trimmed.is_empty() {
        "worktree".to_string()
    } else {
        trimmed
    }
}

/// Parse `git worktree list --porcelain` output into entries, skipping the
/// main checkout. Each record is a sequence of key=value lines separated by
/// a blank line.
pub fn parse_worktree_list(porcelain: &str, base_ref: &str) -> Vec<WorktreeEntry> {
    let mut entries = Vec::new();
    let mut first = true;
    for record in porcelain.split("\n\n") {
        let mut path = String::new();
        let mut branch = String::new();
        for line in record.lines() {
            if let Some(p) = line.strip_prefix("worktree ") {
                path = p.to_string();
            } else if let Some(b) = line.strip_prefix("branch ") {
                branch = b.trim_start_matches("refs/heads/").to_string();
            }
        }
        if path.is_empty() {
            continue;
        }
        // Skip the main checkout — it is the project itself, not a worktree.
        if first {
            first = false;
            continue;
        }
        // Detached HEAD worktrees have no branch; they carry no branch to
        // manage, so they are excluded from the list.
        if branch.is_empty() {
            continue;
        }
        // git prints forward slashes on every platform; normalize to the
        // platform separator so ids and paths compare equal across commands.
        let path = path.replace('/', std::path::MAIN_SEPARATOR_STR);
        let name = branch.split('/').next_back().unwrap_or(&branch).to_string();
        entries.push(WorktreeEntry {
            id: worktree_id(&path),
            name: name.clone(),
            branch,
            base_ref: base_ref.to_string(),
            path,
            created_at: 0,
            is_dirty: false,
        });
    }
    entries
}

/// A trimmed worktree dir that falls back to the default home workspace.
fn default_if_empty(dir: &str) -> String {
    if dir.is_empty() {
        super::settings::default_worktree_dir()
    } else {
        dir.to_string()
    }
}

// ─── Commands ────────────────────────────────────────────────────────────────
#[tauri::command]
pub async fn worktree_create(
    app: tauri::AppHandle,
    project_path: String,
    name: String,
    from_ref: Option<String>,
    branch_override: Option<String>,
) -> Result<WorktreeEntry, String> {
    // Read workflow settings on a blocking thread.
    let (central, prefix, base_default) = tokio::task::spawn_blocking(move || {
        let s = super::settings::settings_get(app);
        let dir = default_if_empty(s.worktree_dir.trim());
        (
            Some(dir),
            if s.branch_prefix.trim().is_empty() {
                "connexio".to_string()
            } else {
                s.branch_prefix.trim().to_string()
            },
            if s.default_base_ref.trim().is_empty() {
                "HEAD".to_string()
            } else {
                s.default_base_ref.trim().to_string()
            },
        )
    })
    .await
    .map_err(|e| format!("Settings task failed: {}", e))?;
    worktree_create_in(
        project_path,
        name,
        from_ref,
        branch_override,
        central,
        prefix,
        base_default,
    )
    .await
}

pub async fn worktree_create_in(
    project_path: String,
    name: String,
    from_ref: Option<String>,
    branch_override: Option<String>,
    central_dir: Option<String>,
    branch_prefix: String,
    default_base_ref: String,
) -> Result<WorktreeEntry, String> {
    let branch = branch_override.unwrap_or_else(|| format!("{}/{}", branch_prefix, slugify(&name)));
    let base = from_ref.unwrap_or(default_base_ref);
    let parent = resolve_worktree_dir(&project_path, central_dir.as_deref());
    if central_dir.is_some() {
        // The central workspace dir may not exist yet — create it up front.
        let _ = std::fs::create_dir_all(&parent);
    }
    let dir = parent.join(slugify(&name));

    if dir.exists() {
        return Err(format!(
            "A worktree already exists at {}",
            dir.to_string_lossy()
        ));
    }

    run_git_async(
        project_path,
        vec![
            "worktree".into(),
            "add".into(),
            "-b".into(),
            branch.clone(),
            dir.to_string_lossy().into_owned(),
            base.clone(),
        ],
    )
    .await?;

    Ok(WorktreeEntry {
        id: worktree_id(&dir.to_string_lossy()),
        name,
        branch,
        base_ref: base,
        path: dir.to_string_lossy().into_owned(),
        created_at: now_secs(),
        is_dirty: false,
    })
}

#[tauri::command]
pub async fn worktree_list(project_path: String) -> Result<Vec<WorktreeEntry>, String> {
    let porcelain = run_git_async(
        project_path,
        vec!["worktree".into(), "list".into(), "--porcelain".into()],
    )
    .await?;
    Ok(parse_worktree_list(&porcelain, "origin/main"))
}

#[tauri::command]
pub async fn worktree_delete(
    project_path: String,
    worktree_path: String,
    confirm_branch: String,
) -> Result<WorktreeDeleteResult, String> {
    // Resolve the branch currently checked out in the worktree to guard
    // against deleting the wrong tree.
    let checked = run_git_async(
        worktree_path.clone(),
        vec!["rev-parse".into(), "--abbrev-ref".into(), "HEAD".into()],
    )
    .await?;

    if checked != confirm_branch {
        return Err(format!(
            "Branch mismatch: worktree is on '{}', confirmed '{}'",
            checked, confirm_branch
        ));
    }

    // Retry removing the worktree directory with exponential backoff to handle
    // Windows file locks from lingering PTY terminals.
    let mut attempts = 0;
    const MAX_ATTEMPTS: u8 = 3;
    loop {
        match run_git_async(
            project_path.clone(),
            vec![
                "worktree".into(),
                "remove".into(),
                "--force".into(),
                worktree_path.clone(),
            ],
        )
        .await
        {
            Ok(_) => break,
            // The registration is already gone (a previous delete removed it
            // but the folder survived a Windows lock). Prune and clean up the
            // leftover directory manually, then proceed to the branch delete.
            Err(e) if e.contains("is not a working tree") => {
                let _ = run_git_async(
                    project_path.clone(),
                    vec!["worktree".into(), "prune".into()],
                )
                .await;
                let path = worktree_path.clone();
                tokio::task::spawn_blocking(move || {
                    std::fs::remove_dir_all(&path).map_err(|e| e.to_string())
                })
                .await
                .map_err(|e| format!("Cleanup task failed: {}", e))??;
                break;
            }
            Err(e) if e.contains("Directory not found") || e.contains("not a valid") => {
                return Err(format!("Worktree path invalid: {}", e));
            }
            Err(ref err) if attempts < MAX_ATTEMPTS - 1 => {
                attempts += 1;
                let wait = 500 * (attempts as u64);
                tokio::time::sleep(tokio::time::Duration::from_millis(wait)).await;
                continue;
            }
            Err(e) => return Err(format!("Failed to remove worktree: {}", e)),
        }
    }

    // Orca-style semantics: always remove the directory; keep the branch
    // when git refuses a safe delete (it holds unmerged commits).
    let preserved = if run_git_async(
        project_path,
        vec!["branch".into(), "-d".into(), checked.clone()],
    )
    .await
    .is_err()
    {
        Some(checked)
    } else {
        None
    };

    Ok(WorktreeDeleteResult {
        preserved_branch: preserved,
    })
}

/// Preview how a worktree's branch diverges from a base ref: changed file
/// count plus ahead/behind commit counts.
#[tauri::command]
pub async fn worktree_preview_diff(
    project_path: String,
    worktree_path: String,
    base_ref: String,
) -> Result<WorktreeDiffSummary, String> {
    let branch = run_git_async(
        worktree_path.clone(),
        vec!["rev-parse".into(), "--abbrev-ref".into(), "HEAD".into()],
    )
    .await?;

    let diff_output = run_git_async(
        project_path.clone(),
        vec![
            "diff".into(),
            "--name-only".into(),
            base_ref.clone(),
            branch.clone(),
        ],
    )
    .await
    .unwrap_or_default();
    let changed_files = diff_output.lines().filter(|l| !l.is_empty()).count() as u32;

    let counts = run_git_async(
        project_path,
        vec![
            "rev-list".into(),
            "--left-right".into(),
            "--count".into(),
            format!("{base_ref}...{branch}"),
        ],
    )
    .await
    .unwrap_or_else(|_| "0\t0".to_string());
    let mut parts = counts.split_whitespace();
    let behind = parts.next().and_then(|p| p.parse().ok()).unwrap_or(0);
    let ahead = parts.next().and_then(|p| p.parse().ok()).unwrap_or(0);

    Ok(WorktreeDiffSummary {
        changed_files,
        ahead,
        behind,
    })
}

#[cfg(test)]
#[path = "worktree_tests.rs"]
mod worktree_tests;
