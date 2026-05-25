use serde::Serialize;
use std::fs;
use std::path::Path;
use std::process::Command;
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct GitStatus {
    pub is_repo: bool,
    pub branch: String,
    pub ahead: u32,
    pub behind: u32,
    pub modified: u32,
    pub staged: u32,
    pub untracked: u32,
    pub conflicted: u32,
    pub stashes: u32,
    pub last_commit: String,
    pub last_commit_time: String,
    pub remote_url: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitChangedFile {
    pub path: String,
    pub old_path: Option<String>,
    pub index_status: String,
    pub work_tree_status: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitDiffHunk {
    pub header: String,
    pub lines: Vec<GitDiffLine>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitDiffLine {
    #[serde(rename = "type")]
    pub line_type: String,
    pub content: String,
    pub old_line_no: Option<u32>,
    pub new_line_no: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitDiffResult {
    pub file: String,
    pub hunks: Vec<GitDiffHunk>,
    pub is_binary: bool,
    pub language: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitActionResult {
    pub success: bool,
    pub message: String,
    pub output: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitCommitEntry {
    pub short_hash: String,
    pub hash: String,
    pub author: String,
    pub relative_time: String,
    pub subject: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitBranchEntry {
    pub name: String,
    pub current: bool,
    pub remote: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStashEntry {
    pub index: u32,
    pub message: String,
}

fn run_git(cwd: &str, args: &[&str]) -> Option<String> {
    Command::new("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
}

fn run_git_raw(cwd: &str, args: &[&str]) -> Option<String> {
    Command::new("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).to_string())
}

fn make_action_result(cwd: &str, args: &[&str]) -> GitActionResult {
    match Command::new("git").args(args).current_dir(cwd).output() {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            if output.status.success() {
                GitActionResult {
                    success: true,
                    message: stdout.trim().to_string(),
                    output: Some(stdout),
                }
            } else {
                GitActionResult {
                    success: false,
                    message: stderr.trim().to_string(),
                    output: Some(stderr),
                }
            }
        }
        Err(e) => GitActionResult {
            success: false,
            message: format!("Failed to run git: {}", e),
            output: None,
        },
    }
}

// ─── Status ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn git_status(_app: AppHandle, project_path: String) -> GitStatus {
    if !Path::new(&project_path).join(".git").exists() {
        return GitStatus::default();
    }

    let branch = run_git(&project_path, &["rev-parse", "--abbrev-ref", "HEAD"])
        .unwrap_or_default();

    let (ahead, behind) = run_git(&project_path, &["rev-list", "--left-right", "--count", "HEAD...@{upstream}"])
        .map(|s| {
            let parts: Vec<&str> = s.split_whitespace().collect();
            let a = parts.first().and_then(|v| v.parse().ok()).unwrap_or(0);
            let b = parts.get(1).and_then(|v| v.parse().ok()).unwrap_or(0);
            (a, b)
        })
        .unwrap_or((0, 0));

    let status_output = run_git(&project_path, &["status", "--porcelain=v1"]).unwrap_or_default();
    let mut modified = 0u32;
    let mut staged = 0u32;
    let mut untracked = 0u32;
    let mut conflicted = 0u32;

    for line in status_output.lines() {
        if line.len() < 2 { continue; }
        let x = line.chars().nth(0).unwrap_or(' ');
        let y = line.chars().nth(1).unwrap_or(' ');

        if x == 'U' || y == 'U' || (x == 'A' && y == 'A') || (x == 'D' && y == 'D') {
            conflicted += 1;
        } else if x == '?' && y == '?' {
            untracked += 1;
        } else {
            if x != ' ' && x != '?' { staged += 1; }
            if y != ' ' && y != '?' { modified += 1; }
        }
    }

    let stashes = run_git(&project_path, &["stash", "list"])
        .map(|s| if s.is_empty() { 0 } else { s.lines().count() as u32 })
        .unwrap_or(0);

    let last_commit = run_git(&project_path, &["log", "-1", "--format=%s"]).unwrap_or_default();
    let last_commit_time = run_git(&project_path, &["log", "-1", "--format=%cr"]).unwrap_or_default();
    let remote_url = run_git(&project_path, &["remote", "get-url", "origin"]).unwrap_or_default();

    GitStatus {
        is_repo: true, branch, ahead, behind, modified, staged,
        untracked, conflicted, stashes, last_commit, last_commit_time, remote_url,
    }
}

// ─── Changed Files ───────────────────────────────────────────────────────────

#[tauri::command]
pub fn git_changed_files(_app: AppHandle, project_path: String) -> Vec<GitChangedFile> {
    let output = run_git(&project_path, &["status", "--porcelain=v1"]).unwrap_or_default();
    let mut files = Vec::new();

    for line in output.lines() {
        if line.len() < 4 { continue; }
        let x = &line[0..1];
        let y = &line[1..2];
        let path_part = &line[3..];

        let (path, old_path) = if path_part.contains(" -> ") {
            let parts: Vec<&str> = path_part.splitn(2, " -> ").collect();
            (parts[1].to_string(), Some(parts[0].to_string()))
        } else {
            (path_part.to_string(), None)
        };

        files.push(GitChangedFile {
            path,
            old_path,
            index_status: x.to_string(),
            work_tree_status: y.to_string(),
        });
    }
    files
}

// ─── Diff ────────────────────────────────────────────────────────────────────

fn parse_diff(raw: &str, file: &str) -> GitDiffResult {
    let mut hunks = Vec::new();
    let mut current_hunk: Option<GitDiffHunk> = None;
    let mut old_line: u32 = 0;
    let mut new_line: u32 = 0;

    for line in raw.lines() {
        if line.starts_with("@@") {
            if let Some(hunk) = current_hunk.take() {
                hunks.push(hunk);
            }
            // Parse @@ -a,b +c,d @@
            let parts: Vec<&str> = line.splitn(4, ' ').collect();
            if parts.len() >= 3 {
                let new_part = parts[2].trim_start_matches('+');
                let nums: Vec<&str> = new_part.split(',').collect();
                new_line = nums[0].parse().unwrap_or(1);
                let old_part = parts[1].trim_start_matches('-');
                let old_nums: Vec<&str> = old_part.split(',').collect();
                old_line = old_nums[0].parse().unwrap_or(1);
            }
            current_hunk = Some(GitDiffHunk {
                header: line.to_string(),
                lines: Vec::new(),
            });
        } else if let Some(ref mut hunk) = current_hunk {
            if line.starts_with('+') {
                hunk.lines.push(GitDiffLine {
                    line_type: "add".to_string(),
                    content: line[1..].to_string(),
                    old_line_no: None,
                    new_line_no: Some(new_line),
                });
                new_line += 1;
            } else if line.starts_with('-') {
                hunk.lines.push(GitDiffLine {
                    line_type: "remove".to_string(),
                    content: line[1..].to_string(),
                    old_line_no: Some(old_line),
                    new_line_no: None,
                });
                old_line += 1;
            } else if line.starts_with(' ') || line.is_empty() {
                let content = if line.is_empty() { "" } else { &line[1..] };
                hunk.lines.push(GitDiffLine {
                    line_type: "context".to_string(),
                    content: content.to_string(),
                    old_line_no: Some(old_line),
                    new_line_no: Some(new_line),
                });
                old_line += 1;
                new_line += 1;
            }
        }
    }
    if let Some(hunk) = current_hunk {
        hunks.push(hunk);
    }

    let is_binary = raw.contains("Binary files") || raw.contains("GIT binary patch");
    let language = detect_language(file);

    GitDiffResult { file: file.to_string(), hunks, is_binary, language }
}

fn detect_language(file: &str) -> Option<String> {
    let ext = file.rsplit('.').next()?;
    let lang = match ext {
        "ts" | "tsx" => "typescript",
        "js" | "jsx" => "javascript",
        "rs" => "rust",
        "py" => "python",
        "go" => "go",
        "java" => "java",
        "css" => "css",
        "html" => "html",
        "json" => "json",
        "md" => "markdown",
        "toml" => "toml",
        "yaml" | "yml" => "yaml",
        "sh" | "bash" => "bash",
        "sql" => "sql",
        "php" => "php",
        _ => return None,
    };
    Some(lang.to_string())
}

#[tauri::command]
pub fn git_diff(_app: AppHandle, project_path: String, file_path: String, staged: bool) -> GitDiffResult {
    let args = if staged {
        vec!["diff", "--cached", "--", &file_path]
    } else {
        vec!["diff", "--", &file_path]
    };
    let raw = run_git_raw(&project_path, &args.iter().map(|s| *s).collect::<Vec<&str>>())
        .unwrap_or_default();
    parse_diff(&raw, &file_path)
}

#[tauri::command]
pub fn git_diff_untracked(_app: AppHandle, project_path: String, file_path: String) -> GitDiffResult {
    // For untracked files, show the entire file as "added"
    let full_path = Path::new(&project_path).join(&file_path);
    let content = fs::read_to_string(&full_path).unwrap_or_default();

    let mut lines = Vec::new();
    for (i, line) in content.lines().enumerate() {
        lines.push(GitDiffLine {
            line_type: "add".to_string(),
            content: line.to_string(),
            old_line_no: None,
            new_line_no: Some(i as u32 + 1),
        });
    }

    let language = detect_language(&file_path);
    GitDiffResult {
        file: file_path,
        hunks: vec![GitDiffHunk {
            header: "@@ -0,0 +1,{} @@".replace("{}", &content.lines().count().to_string()),
            lines,
        }],
        is_binary: false,
        language,
    }
}

// ─── Stage / Unstage / Discard ───────────────────────────────────────────────

#[tauri::command]
pub fn git_stage(_app: AppHandle, project_path: String, file_path: String) -> Result<(), String> {
    run_git(&project_path, &["add", &file_path])
        .map(|_| ())
        .ok_or_else(|| "Failed to stage file".to_string())
}

#[tauri::command]
pub fn git_stage_all(_app: AppHandle, project_path: String) -> Result<(), String> {
    run_git(&project_path, &["add", "-A"])
        .map(|_| ())
        .ok_or_else(|| "Failed to stage all".to_string())
}

#[tauri::command]
pub fn git_unstage(_app: AppHandle, project_path: String, file_path: String) -> Result<(), String> {
    run_git(&project_path, &["restore", "--staged", &file_path])
        .map(|_| ())
        .ok_or_else(|| "Failed to unstage file".to_string())
}

#[tauri::command]
pub fn git_unstage_all(_app: AppHandle, project_path: String) -> Result<(), String> {
    run_git(&project_path, &["reset", "HEAD"])
        .map(|_| ())
        .ok_or_else(|| "Failed to unstage all".to_string())
}

#[tauri::command]
pub fn git_discard(_app: AppHandle, project_path: String, file_path: String) -> Result<(), String> {
    run_git(&project_path, &["checkout", "--", &file_path])
        .map(|_| ())
        .ok_or_else(|| "Failed to discard changes".to_string())
}

#[tauri::command]
pub fn git_open_file(_app: AppHandle, project_path: String, file_path: String) -> Result<(), String> {
    let full_path = Path::new(&project_path).join(&file_path);
    opener::open(full_path.to_string_lossy().as_ref())
        .map_err(|e| format!("Failed to open file: {}", e))
}

// ─── Commit / Push / Pull / Fetch ────────────────────────────────────────────

#[tauri::command]
pub fn git_commit(_app: AppHandle, project_path: String, message: String) -> GitActionResult {
    make_action_result(&project_path, &["commit", "-m", &message])
}

#[tauri::command]
pub fn git_push(_app: AppHandle, project_path: String) -> GitActionResult {
    make_action_result(&project_path, &["push"])
}

#[tauri::command]
pub fn git_pull(_app: AppHandle, project_path: String) -> GitActionResult {
    make_action_result(&project_path, &["pull"])
}

#[tauri::command]
pub fn git_fetch(_app: AppHandle, project_path: String) -> GitActionResult {
    make_action_result(&project_path, &["fetch"])
}

// ─── History ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn git_history(_app: AppHandle, project_path: String, limit: Option<u32>) -> Vec<GitCommitEntry> {
    let limit_str = format!("-{}", limit.unwrap_or(50));
    let output = run_git(&project_path, &["log", &limit_str, "--format=%h|%H|%an|%cr|%s"])
        .unwrap_or_default();

    output.lines().filter_map(|line| {
        let parts: Vec<&str> = line.splitn(5, '|').collect();
        if parts.len() == 5 {
            Some(GitCommitEntry {
                short_hash: parts[0].to_string(),
                hash: parts[1].to_string(),
                author: parts[2].to_string(),
                relative_time: parts[3].to_string(),
                subject: parts[4].to_string(),
            })
        } else {
            None
        }
    }).collect()
}

// ─── Branches ────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn git_branches(_app: AppHandle, project_path: String) -> Vec<GitBranchEntry> {
    let output = run_git(&project_path, &["branch", "-a", "--format=%(HEAD)|%(refname:short)|%(refname:rstrip=-3)"])
        .unwrap_or_default();

    output.lines().filter_map(|line| {
        let parts: Vec<&str> = line.splitn(3, '|').collect();
        if parts.len() >= 2 {
            let current = parts[0] == "*";
            let name = parts[1].to_string();
            let remote = name.starts_with("remotes/") || name.starts_with("origin/");
            Some(GitBranchEntry { name, current, remote })
        } else {
            None
        }
    }).collect()
}

#[tauri::command]
pub fn git_checkout(_app: AppHandle, project_path: String, branch: String) -> GitActionResult {
    make_action_result(&project_path, &["checkout", &branch])
}

#[tauri::command]
pub fn git_create_branch(_app: AppHandle, project_path: String, branch_name: String) -> GitActionResult {
    make_action_result(&project_path, &["checkout", "-b", &branch_name])
}

#[tauri::command]
pub fn git_publish_branch(_app: AppHandle, project_path: String) -> GitActionResult {
    let branch = run_git(&project_path, &["rev-parse", "--abbrev-ref", "HEAD"]).unwrap_or_default();
    make_action_result(&project_path, &["push", "-u", "origin", &branch])
}

// ─── Stash ───────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn git_stash_list(_app: AppHandle, project_path: String) -> Vec<GitStashEntry> {
    let output = run_git(&project_path, &["stash", "list", "--format=%gd|%gs"]).unwrap_or_default();
    output.lines().enumerate().filter_map(|(i, line)| {
        let parts: Vec<&str> = line.splitn(2, '|').collect();
        if parts.len() == 2 {
            Some(GitStashEntry {
                index: i as u32,
                message: parts[1].to_string(),
            })
        } else {
            None
        }
    }).collect()
}

#[tauri::command]
pub fn git_stash_save(_app: AppHandle, project_path: String, message: Option<String>) -> GitActionResult {
    let args = if let Some(ref msg) = message {
        vec!["stash", "push", "-m", msg.as_str()]
    } else {
        vec!["stash", "push"]
    };
    make_action_result(&project_path, &args)
}

#[tauri::command]
pub fn git_stash_pop(_app: AppHandle, project_path: String, index: Option<u32>) -> GitActionResult {
    let stash_ref = format!("stash@{{{}}}", index.unwrap_or(0));
    make_action_result(&project_path, &["stash", "pop", &stash_ref])
}

#[tauri::command]
pub fn git_stash_apply(_app: AppHandle, project_path: String, index: Option<u32>) -> GitActionResult {
    let stash_ref = format!("stash@{{{}}}", index.unwrap_or(0));
    make_action_result(&project_path, &["stash", "apply", &stash_ref])
}

#[tauri::command]
pub fn git_stash_drop(_app: AppHandle, project_path: String, index: Option<u32>) -> GitActionResult {
    let stash_ref = format!("stash@{{{}}}", index.unwrap_or(0));
    make_action_result(&project_path, &["stash", "drop", &stash_ref])
}
