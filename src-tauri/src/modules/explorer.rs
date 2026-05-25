use serde::Serialize;
use std::fs;
use std::path::Path;
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_hidden: bool,
    pub extension: Option<String>,
    pub size: Option<u64>,
    pub children: Option<Vec<FileEntry>>,
}

/// Common directories/files to ignore
const IGNORED: &[&str] = &[
    "node_modules", ".git", "target", "dist", "build", ".next",
    "__pycache__", ".venv", "venv", ".tox", ".mypy_cache",
    ".DS_Store", "Thumbs.db", ".idea", ".vscode",
];

fn should_ignore(name: &str) -> bool {
    IGNORED.contains(&name)
}

fn is_hidden(name: &str) -> bool {
    name.starts_with('.')
}

/// Read directory entries (one level deep)
#[tauri::command]
pub fn explorer_list_dir(_app: AppHandle, dir_path: String) -> Result<Vec<FileEntry>, String> {
    let path = Path::new(&dir_path);
    if !path.is_dir() {
        return Err(format!("Not a directory: {}", dir_path));
    }

    let mut entries = Vec::new();
    let read_dir = fs::read_dir(path).map_err(|e| format!("Failed to read dir: {}", e))?;

    for entry in read_dir.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip ignored directories
        if should_ignore(&name) {
            continue;
        }

        let entry_path = entry.path();
        let metadata = entry.metadata().ok();
        let is_dir = metadata.as_ref().map(|m| m.is_dir()).unwrap_or(false);
        let size = if !is_dir {
            metadata.as_ref().map(|m| m.len())
        } else {
            None
        };

        let extension = if !is_dir {
            entry_path
                .extension()
                .map(|e| e.to_string_lossy().to_string())
        } else {
            None
        };

        entries.push(FileEntry {
            name: name.clone(),
            path: entry_path.to_string_lossy().to_string(),
            is_dir,
            is_hidden: is_hidden(&name),
            extension,
            size,
            children: None,
        });
    }

    // Sort: directories first, then alphabetical
    entries.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(entries)
}

/// Read full tree (limited depth for performance)
#[tauri::command]
pub fn explorer_read_tree(_app: AppHandle, dir_path: String, max_depth: Option<u32>) -> Result<Vec<FileEntry>, String> {
    let depth = max_depth.unwrap_or(1);
    read_tree_recursive(&dir_path, depth)
}

fn read_tree_recursive(dir_path: &str, depth: u32) -> Result<Vec<FileEntry>, String> {
    if depth == 0 {
        return Ok(vec![]);
    }

    let path = Path::new(dir_path);
    if !path.is_dir() {
        return Ok(vec![]);
    }

    let mut entries = Vec::new();
    let read_dir = fs::read_dir(path).map_err(|e| format!("Failed to read dir: {}", e))?;

    for entry in read_dir.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if should_ignore(&name) {
            continue;
        }

        let entry_path = entry.path();
        let metadata = entry.metadata().ok();
        let is_dir = metadata.as_ref().map(|m| m.is_dir()).unwrap_or(false);
        let size = if !is_dir {
            metadata.as_ref().map(|m| m.len())
        } else {
            None
        };

        let extension = if !is_dir {
            entry_path.extension().map(|e| e.to_string_lossy().to_string())
        } else {
            None
        };

        let children = if is_dir && depth > 1 {
            read_tree_recursive(&entry_path.to_string_lossy(), depth - 1).ok()
        } else {
            None
        };

        entries.push(FileEntry {
            name: name.clone(),
            path: entry_path.to_string_lossy().to_string(),
            is_dir,
            is_hidden: is_hidden(&name),
            extension,
            size,
            children,
        });
    }

    entries.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(entries)
}

/// Read file content as string
#[tauri::command]
pub fn explorer_read_file(_app: AppHandle, file_path: String) -> Result<String, String> {
    let path = Path::new(&file_path);
    if !path.is_file() {
        return Err(format!("Not a file: {}", file_path));
    }
    // Check file size (limit to 5MB)
    let metadata = fs::metadata(path).map_err(|e| format!("Cannot read metadata: {}", e))?;
    if metadata.len() > 5 * 1024 * 1024 {
        return Err("File too large (>5MB)".to_string());
    }
    fs::read_to_string(path).map_err(|e| format!("Failed to read file: {}", e))
}

/// Write content to a file
#[tauri::command]
pub fn explorer_write_file(_app: AppHandle, file_path: String, content: String) -> Result<(), String> {
    fs::write(&file_path, &content).map_err(|e| format!("Failed to write file: {}", e))
}

/// Rename a file or directory
#[tauri::command]
pub fn explorer_rename(_app: AppHandle, old_path: String, new_path: String) -> Result<(), String> {
    fs::rename(&old_path, &new_path).map_err(|e| format!("Failed to rename: {}", e))
}

/// Delete a file or directory
#[tauri::command]
pub fn explorer_delete(_app: AppHandle, target_path: String) -> Result<(), String> {
    let path = Path::new(&target_path);
    if path.is_dir() {
        fs::remove_dir_all(path).map_err(|e| format!("Failed to delete directory: {}", e))
    } else {
        fs::remove_file(path).map_err(|e| format!("Failed to delete file: {}", e))
    }
}

/// Create a new file
#[tauri::command]
pub fn explorer_new_file(_app: AppHandle, file_path: String) -> Result<(), String> {
    let path = Path::new(&file_path);
    if path.exists() {
        return Err("File already exists".to_string());
    }
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    fs::write(path, "").map_err(|e| format!("Failed to create file: {}", e))
}

/// Create a new directory
#[tauri::command]
pub fn explorer_new_folder(_app: AppHandle, dir_path: String) -> Result<(), String> {
    let path = Path::new(&dir_path);
    if path.exists() {
        return Err("Directory already exists".to_string());
    }
    fs::create_dir_all(path).map_err(|e| format!("Failed to create directory: {}", e))
}

/// Open a path with the operating system default application
#[tauri::command]
pub fn explorer_open_path(_app: AppHandle, target_path: String) -> Result<(), String> {
    opener::open(&target_path).map_err(|e| format!("Failed to open path: {}", e))
}

/// Search for text in files within a directory (grep-like)
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub file_path: String,
    pub line_number: usize,
    pub line_content: String,
}

#[tauri::command]
pub fn explorer_search_in_files(
    _app: AppHandle,
    project_path: String,
    query: String,
    case_sensitive: Option<bool>,
    max_results: Option<usize>,
) -> Result<Vec<SearchResult>, String> {
    let case_sensitive = case_sensitive.unwrap_or(false);
    let max_results = max_results.unwrap_or(200);
    let mut results = Vec::new();
    let query_lower = if !case_sensitive { query.to_lowercase() } else { String::new() };

    search_dir(
        Path::new(&project_path),
        &query,
        &query_lower,
        case_sensitive,
        max_results,
        &mut results,
    );

    Ok(results)
}

/// Binary file extensions to skip
const BINARY_EXTENSIONS: &[&str] = &[
    "png", "jpg", "jpeg", "gif", "bmp", "ico", "svg", "webp",
    "mp3", "mp4", "wav", "avi", "mkv", "mov",
    "zip", "tar", "gz", "rar", "7z",
    "exe", "dll", "so", "dylib", "bin",
    "pdf", "doc", "docx", "xls", "xlsx",
    "woff", "woff2", "ttf", "otf", "eot",
    "lock", "map",
];

fn is_binary_file(name: &str) -> bool {
    if let Some(ext) = name.rsplit('.').next() {
        BINARY_EXTENSIONS.contains(&ext.to_lowercase().as_str())
    } else {
        false
    }
}

fn search_dir(
    dir: &Path,
    query: &str,
    query_lower: &str,
    case_sensitive: bool,
    max_results: usize,
    results: &mut Vec<SearchResult>,
) {
    if results.len() >= max_results {
        return;
    }

    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        if results.len() >= max_results {
            return;
        }

        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        if should_ignore(&name) || is_hidden(&name) {
            continue;
        }

        if path.is_dir() {
            search_dir(&path, query, query_lower, case_sensitive, max_results, results);
        } else if path.is_file() && !is_binary_file(&name) {
            // Read file and search line by line
            if let Ok(content) = fs::read_to_string(&path) {
                for (idx, line) in content.lines().enumerate() {
                    if results.len() >= max_results {
                        return;
                    }
                    let matches = if case_sensitive {
                        line.contains(query)
                    } else {
                        line.to_lowercase().contains(query_lower)
                    };
                    if matches {
                        results.push(SearchResult {
                            file_path: path.to_string_lossy().to_string(),
                            line_number: idx + 1,
                            line_content: line.chars().take(300).collect(),
                        });
                    }
                }
            }
        }
    }
}
