use super::*;

fn setup_dir(label: &str) -> std::path::PathBuf {
    let root =
        std::env::temp_dir().join(format!("connexio-search-{}-{}", label, std::process::id()));
    let _ = fs::remove_dir_all(&root);
    fs::create_dir_all(&root).unwrap();
    root
}

fn run(root: &Path, query: &str) -> Vec<SearchResult> {
    let mut results = Vec::new();
    let query_lower = query.to_lowercase();
    search_dir(root, query, &query_lower, false, 200, &mut results);
    results
}

#[test]
fn finds_matching_lines_with_line_numbers() {
    let root = setup_dir("match");
    fs::write(root.join("a.txt"), "alpha\nbeta\nneedle here\n").unwrap();
    let results = run(&root, "needle");
    let _ = fs::remove_dir_all(&root);
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].line_number, 3);
    assert!(results[0].line_content.contains("needle"));
}

#[test]
fn ignores_node_modules_and_hidden_entries() {
    let root = setup_dir("ignore");
    fs::create_dir_all(root.join("node_modules")).unwrap();
    fs::write(root.join("node_modules/x.js"), "needle").unwrap();
    fs::write(root.join("src.txt"), "needle").unwrap();
    let results = run(&root, "needle");
    let _ = fs::remove_dir_all(&root);
    assert_eq!(results.len(), 1);
    assert!(results[0].file_path.ends_with("src.txt"));
}

#[test]
fn skips_files_larger_than_the_search_cap() {
    let root = setup_dir("cap");
    let filler = "x".repeat(MAX_SEARCH_FILE_SIZE as usize);
    fs::write(root.join("big.txt"), format!("{filler}\nneedle\n")).unwrap();
    fs::write(root.join("small.txt"), "needle\n").unwrap();
    let results = run(&root, "needle");
    let _ = fs::remove_dir_all(&root);
    assert_eq!(results.len(), 1);
    assert!(results[0].file_path.ends_with("small.txt"));
}

#[test]
fn stops_early_at_max_results() {
    let root = setup_dir("max");
    fs::write(root.join("a.txt"), "needle\n".repeat(50)).unwrap();
    let mut results = Vec::new();
    search_dir(&root, "needle", "needle", true, 10, &mut results);
    let _ = fs::remove_dir_all(&root);
    assert_eq!(results.len(), 10);
}

#[cfg(unix)]
#[test]
fn does_not_follow_directory_symlinks() {
    use std::os::unix::fs::symlink;
    let root = setup_dir("link");
    let inner = root.join("inner");
    fs::create_dir_all(&inner).unwrap();
    fs::write(inner.join("a.txt"), "needle").unwrap();
    // Cyclic symlink: root/loop -> root; following it would hang the search
    symlink(&root, root.join("loop")).unwrap();
    let results = run(&root, "needle"); // must terminate
    let _ = fs::remove_dir_all(&root);
    assert_eq!(results.len(), 1);
}
