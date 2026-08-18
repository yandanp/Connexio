use serde::Serialize;
use std::path::Path;

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

fn run_git(cwd: &str, args: &[&str]) -> Result<String, String> {
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

// ─── Commands ────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn worktree_create(
    project_path: String,
    name: String,
    from_ref: Option<String>,
    branch_override: Option<String>,
) -> Result<WorktreeEntry, String> {
    let branch = branch_override.unwrap_or_else(|| format!("connexio/{}", slugify(&name)));
    let base = from_ref.unwrap_or_else(|| "HEAD".to_string());
    let parent = Path::new(&project_path).join(".worktrees");
    let dir = parent.join(slugify(&name));

    if dir.exists() {
        return Err(format!(
            "A worktree already exists at {}",
            dir.to_string_lossy()
        ));
    }

    run_git_async(
        project_path.clone(),
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
        vec![
            "worktree".into(),
            "list".into(),
            "--porcelain".into(),
            "--".into(),
        ],
    )
    .await?;
    Ok(parse_worktree_list(&porcelain, "origin/main"))
}

#[tauri::command]
pub async fn worktree_delete(
    project_path: String,
    worktree_path: String,
    confirm_branch: String,
) -> Result<(), String> {
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

    run_git_async(
        project_path,
        vec![
            "worktree".into(),
            "remove".into(),
            "--force".into(),
            worktree_path,
        ],
    )
    .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup_repo(label: &str) -> std::path::PathBuf {
        let root =
            std::env::temp_dir().join(format!("connexio-wt-{}-{}", label, std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(&root).unwrap();
        run_git(root.to_str().unwrap(), &["init", "-b", "main"]).unwrap();
        run_git(root.to_str().unwrap(), &["config", "user.email", "t@t"]).unwrap();
        run_git(root.to_str().unwrap(), &["config", "user.name", "t"]).unwrap();
        std::fs::write(root.join("readme.md"), "hello\n").unwrap();
        run_git(root.to_str().unwrap(), &["add", "."]).unwrap();
        run_git(root.to_str().unwrap(), &["commit", "-m", "init"]).unwrap();
        root
    }

    #[test]
    fn parse_worktree_list_skips_main_checkout_and_reads_branches() {
        // git prints forward slashes on every platform; parse normalizes them.
        let porcelain = "worktree /repo\nHEAD abc\nbranch refs/heads/main\n\nworktree /repo/.worktrees/w1\nHEAD def\nbranch refs/heads/connexio/w1\n\n";
        let entries = parse_worktree_list(porcelain, "origin/main");
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].branch, "connexio/w1");
        assert_eq!(entries[0].name, "w1");
        assert_eq!(
            entries[0].path,
            format!(
                "{}repo{}.worktrees{}w1",
                std::path::MAIN_SEPARATOR,
                std::path::MAIN_SEPARATOR,
                std::path::MAIN_SEPARATOR
            )
        );
    }

    #[test]
    fn parse_worktree_list_handles_detached_head_without_branch_line() {
        // Detached HEAD worktrees have no branch line — they are skipped from
        // entries because they carry no branch to manage.
        let porcelain = "worktree /repo\nHEAD abc\nbranch refs/heads/main\n\nworktree /repo/.worktrees/det\nHEAD def\ndetached\n\n";
        let entries = parse_worktree_list(porcelain, "origin/main");
        assert!(entries.is_empty());
    }

    #[tokio::test]
    async fn worktree_create_adds_and_lists_and_deletes() {
        let root = setup_repo("cycle");
        let created = worktree_create(
            root.to_str().unwrap().to_string(),
            "My Feature".to_string(),
            None,
            None,
        )
        .await
        .unwrap();
        assert!(created.path.contains(".worktrees"));
        assert_eq!(created.branch, "connexio/my-feature");

        let listed = worktree_list(root.to_str().unwrap().to_string())
            .await
            .unwrap();
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].branch, "connexio/my-feature");
        assert_eq!(listed[0].path, created.path);

        worktree_delete(
            root.to_str().unwrap().to_string(),
            created.path.clone(),
            "connexio/my-feature".to_string(),
        )
        .await
        .unwrap();
        assert!(!Path::new(&created.path).exists());

        let after = worktree_list(root.to_str().unwrap().to_string())
            .await
            .unwrap();
        assert!(after.is_empty());
        let _ = std::fs::remove_dir_all(&root);
    }

    #[tokio::test]
    async fn worktree_create_rejects_existing_directory() {
        let root = setup_repo("dup");
        let first = worktree_create(
            root.to_str().unwrap().to_string(),
            "Same Name".to_string(),
            None,
            None,
        )
        .await
        .unwrap();
        let err = worktree_create(
            root.to_str().unwrap().to_string(),
            "Same Name".to_string(),
            None,
            None,
        )
        .await
        .unwrap_err();
        assert!(err.contains("already exists"), "got: {err}");
        let _ = std::fs::remove_dir_all(&first.path);
        let _ = std::fs::remove_dir_all(&root);
    }

    #[tokio::test]
    async fn worktree_delete_rejects_wrong_branch_confirmation() {
        let root = setup_repo("guard");
        let created = worktree_create(
            root.to_str().unwrap().to_string(),
            "Guarded".to_string(),
            None,
            None,
        )
        .await
        .unwrap();
        let err = worktree_delete(
            root.to_str().unwrap().to_string(),
            created.path.clone(),
            "wrong-branch".to_string(),
        )
        .await
        .unwrap_err();
        assert!(err.contains("Branch mismatch"), "got: {err}");
        assert!(Path::new(&created.path).exists());
        let _ = std::fs::remove_dir_all(&root);
    }
}
