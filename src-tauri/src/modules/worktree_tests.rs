use super::*;

fn setup_repo(label: &str) -> std::path::PathBuf {
    let root = std::env::temp_dir().join(format!("connexio-wt-{}-{}", label, std::process::id()));
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
        None,
    )
    .await
    .unwrap();
    let err = worktree_create(
        root.to_str().unwrap().to_string(),
        "Same Name".to_string(),
        None,
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

#[tokio::test]
async fn worktree_preview_diff_reports_changed_files() {
    let root = setup_repo("diff");
    let created = worktree_create(
        root.to_str().unwrap().to_string(),
        "Diffed".to_string(),
        None,
        None,
        None,
    )
    .await
    .unwrap();
    // Commit a change inside the worktree so its branch diverges.
    std::fs::write(Path::new(&created.path).join("new.txt"), "content\n").unwrap();
    run_git(&created.path, &["add", "."]).unwrap();
    run_git(&created.path, &["commit", "-m", "wt change"]).unwrap();

    let summary = worktree_preview_diff(
        root.to_str().unwrap().to_string(),
        created.path.clone(),
        "main".to_string(),
    )
    .await
    .unwrap();
    assert!(summary.changed_files >= 1, "got {}", summary.changed_files);
    assert!(summary.ahead >= 1, "got {}", summary.ahead);

    let _ = std::fs::remove_dir_all(&root);
}

#[tokio::test]
async fn worktree_delete_reports_preserved_branch_with_unmerged_commits() {
    let root = setup_repo("preserve");
    let created = worktree_create(
        root.to_str().unwrap().to_string(),
        "Unmerged".to_string(),
        None,
        None,
        None,
    )
    .await
    .unwrap();
    std::fs::write(Path::new(&created.path).join("x.txt"), "x\n").unwrap();
    run_git(&created.path, &["add", "."]).unwrap();
    run_git(&created.path, &["commit", "-m", "unmerged work"]).unwrap();

    let result = worktree_delete(
        root.to_str().unwrap().to_string(),
        created.path.clone(),
        "connexio/unmerged".to_string(),
    )
    .await
    .unwrap();
    // Directory removed; branch preserved because it holds unmerged commits.
    assert!(!Path::new(&created.path).exists());
    assert_eq!(
        result.preserved_branch,
        Some("connexio/unmerged".to_string())
    );

    let _ = std::fs::remove_dir_all(&root);
}
