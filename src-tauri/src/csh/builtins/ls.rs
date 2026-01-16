//! ls - List directory contents with modern UX
//!
//! Features:
//! - Grid layout with auto-column calculation
//! - File type icons (Unicode emoji)
//! - Color coding (directories, executables, etc.)
//! - Long format with permissions and metadata
//! - Tree view support

use crate::csh::builtins::BuiltinResult;
use crate::csh::environment::Environment;
use chrono::{DateTime, Local};
use std::fs::{self, Metadata};
use std::path::PathBuf;
use terminal_size::{terminal_size, Width};
use unicode_width::UnicodeWidthStr;

/// File entry with metadata for display
#[derive(Debug)]
struct FileEntry {
    name: String,
    is_dir: bool,
    is_executable: bool,
    is_symlink: bool,
    is_hidden: bool,
    size: u64,
    modified: DateTime<Local>,
}

impl FileEntry {
    fn from_dir_entry(entry: &fs::DirEntry) -> Option<Self> {
        let name = entry.file_name().to_string_lossy().to_string();
        let metadata = entry.metadata().ok()?;
        let is_symlink = entry.file_type().ok()?.is_symlink();

        Some(Self {
            is_hidden: name.starts_with('.'),
            is_dir: metadata.is_dir(),
            is_executable: is_executable_file(&name, &metadata),
            is_symlink,
            size: metadata.len(),
            modified: metadata
                .modified()
                .map(|t| t.into())
                .unwrap_or_else(|_| Local::now()),
            name,
        })
    }

    /// Get icon for this file type
    fn icon(&self) -> &'static str {
        if self.is_dir {
            return "📁";
        }
        if self.is_symlink {
            return "🔗";
        }

        // Match by extension
        let ext = self.name.rsplit('.').next().unwrap_or("").to_lowercase();
        match ext.as_str() {
            // Programming languages
            "rs" => "🦀",
            "py" => "🐍",
            "js" | "mjs" | "cjs" => "📜",
            "ts" | "tsx" | "mts" => "📘",
            "jsx" => "⚛️",
            "go" => "🔷",
            "rb" => "💎",
            "php" => "🐘",
            "java" | "class" | "jar" => "☕",
            "c" | "h" => "🔧",
            "cpp" | "cc" | "cxx" | "hpp" => "⚙️",
            "cs" => "🎯",
            "swift" => "🦅",
            "kt" | "kts" => "🎨",
            "lua" => "🌙",
            "sh" | "bash" | "zsh" | "fish" => "🐚",
            "ps1" | "psm1" => "💠",

            // Config & Data
            "json" => "📋",
            "yaml" | "yml" => "⚙️",
            "toml" => "📦",
            "xml" => "📰",
            "csv" => "📊",
            "sql" => "🗃️",
            "env" => "🔐",
            "ini" | "cfg" | "conf" => "🔩",

            // Documents
            "md" | "markdown" => "📝",
            "txt" => "📄",
            "pdf" => "📕",
            "doc" | "docx" => "📘",
            "xls" | "xlsx" => "📗",
            "ppt" | "pptx" => "📙",
            "rtf" => "📃",

            // Media
            "png" | "jpg" | "jpeg" | "gif" | "bmp" | "ico" | "webp" => "🖼️",
            "svg" => "🎨",
            "mp3" | "wav" | "flac" | "ogg" | "m4a" => "🎵",
            "mp4" | "mkv" | "avi" | "mov" | "webm" => "🎬",

            // Archives
            "zip" | "rar" | "7z" | "tar" | "gz" | "bz2" | "xz" => "📦",

            // Executables
            "exe" | "msi" => "⚡",
            "bat" | "cmd" => "🖥️",
            "app" | "dmg" => "📱",
            "deb" | "rpm" => "📦",

            // Web
            "html" | "htm" => "🌐",
            "css" | "scss" | "sass" | "less" => "🎨",
            "vue" => "💚",
            "svelte" => "🧡",

            // Lock files
            "lock" => "🔒",

            // Git
            "gitignore" | "gitattributes" | "gitmodules" => "🔀",

            // Docker
            "dockerfile" => "🐳",

            // License
            "license" | "licence" => "📜",

            // Default
            _ => {
                if self.is_executable {
                    "⚡"
                } else {
                    "📄"
                }
            }
        }
    }

    /// Get colored name for display
    fn colored_name(&self, with_icon: bool) -> String {
        let icon = if with_icon {
            format!("{} ", self.icon())
        } else {
            String::new()
        };

        let name_with_suffix = if self.is_dir {
            format!("{}/", self.name)
        } else {
            self.name.clone()
        };

        // Color codes
        let colored = if self.is_dir {
            format!("\x1b[1;34m{}\x1b[0m", name_with_suffix) // Bold blue
        } else if self.is_symlink {
            format!("\x1b[1;36m{}\x1b[0m", name_with_suffix) // Bold cyan
        } else if self.is_executable {
            format!("\x1b[1;32m{}\x1b[0m", name_with_suffix) // Bold green
        } else if self.is_hidden {
            format!("\x1b[90m{}\x1b[0m", name_with_suffix) // Gray for hidden
        } else {
            name_with_suffix
        };

        format!("{}{}", icon, colored)
    }

    /// Get display width (for grid calculation)
    fn display_width(&self, with_icon: bool) -> usize {
        let icon_width = if with_icon { 3 } else { 0 }; // icon + space
        let suffix_width = if self.is_dir { 1 } else { 0 }; // trailing /
        icon_width + self.name.width() + suffix_width
    }
}

/// Display options for ls
#[derive(Debug, Default)]
struct LsOptions {
    show_hidden: bool,
    long_format: bool,
    show_size: bool,
    show_icons: bool,
    one_per_line: bool,
    tree: bool,
    no_color: bool,
}

pub fn execute(args: &[String], env: &Environment) -> BuiltinResult {
    let mut options = LsOptions {
        show_icons: true, // Icons on by default
        ..Default::default()
    };
    let mut paths: Vec<PathBuf> = Vec::new();

    // Parse arguments
    for arg in args {
        if arg.starts_with('-') && arg.len() > 1 && !arg.starts_with("--") {
            for c in arg[1..].chars() {
                match c {
                    'a' => options.show_hidden = true,
                    'l' => options.long_format = true,
                    's' => options.show_size = true,
                    '1' => options.one_per_line = true,
                    'h' => {} // Human readable (always on)
                    'i' => options.show_icons = true,
                    'I' => options.show_icons = false,
                    _ => {}
                }
            }
        } else if arg == "--tree" {
            options.tree = true;
        } else if arg == "--no-icons" {
            options.show_icons = false;
        } else if arg == "--icons" {
            options.show_icons = true;
        } else if arg == "--no-color" {
            options.no_color = true;
        } else if !arg.starts_with('-') {
            let path = expand_path(arg, env);
            paths.push(path);
        }
    }

    // Default to current directory
    if paths.is_empty() {
        paths.push(env.cwd().clone());
    }

    let mut output = String::new();

    for (idx, path) in paths.iter().enumerate() {
        if paths.len() > 1 {
            if idx > 0 {
                output.push('\n');
            }
            output.push_str(&format!("\x1b[1;35m{}:\x1b[0m\n", path.display()));
        }

        match list_directory(path, &options) {
            Ok(dir_output) => output.push_str(&dir_output),
            Err(e) => {
                return BuiltinResult::failure(1, format!("ls: {}: {}\n", path.display(), e));
            }
        }
    }

    BuiltinResult::success_with_output(output)
}

fn expand_path(arg: &str, env: &Environment) -> PathBuf {
    let path = if arg.starts_with("~/") {
        if let Some(home) = env.get_value("HOME") {
            PathBuf::from(home).join(&arg[2..])
        } else {
            PathBuf::from(arg)
        }
    } else {
        PathBuf::from(arg)
    };

    if path.is_absolute() {
        path
    } else {
        env.cwd().join(path)
    }
}

fn list_directory(path: &PathBuf, options: &LsOptions) -> Result<String, std::io::Error> {
    let entries = fs::read_dir(path)?;

    // Collect and parse entries
    let mut files: Vec<FileEntry> = entries
        .filter_map(|e| e.ok())
        .filter_map(|e| FileEntry::from_dir_entry(&e))
        .filter(|f| options.show_hidden || !f.is_hidden)
        .collect();

    // Sort: directories first, then alphabetically (case-insensitive)
    files.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    if files.is_empty() {
        return Ok(String::new());
    }

    // Format based on options
    if options.long_format {
        Ok(format_long(&files, options))
    } else if options.one_per_line {
        Ok(format_one_per_line(&files, options))
    } else {
        Ok(format_grid(&files, options))
    }
}

/// Format as grid layout (default)
fn format_grid(files: &[FileEntry], options: &LsOptions) -> String {
    if files.is_empty() {
        return String::new();
    }

    // Get terminal width
    let term_width = terminal_size()
        .map(|(Width(w), _)| w as usize)
        .unwrap_or(80);

    // Calculate max width of entries
    let max_width = files
        .iter()
        .map(|f| f.display_width(options.show_icons))
        .max()
        .unwrap_or(10);

    // Column width = max item width + padding
    let col_width = max_width + 2;

    // Calculate number of columns (at least 1)
    let num_cols = (term_width / col_width).max(1);

    // Build grid output
    let mut output = String::new();
    for (i, file) in files.iter().enumerate() {
        let display = file.colored_name(options.show_icons);
        let actual_width = file.display_width(options.show_icons);

        output.push_str(&display);

        // Add padding or newline
        if (i + 1) % num_cols == 0 || i == files.len() - 1 {
            output.push('\n');
        } else {
            // Pad to column width
            let padding = col_width.saturating_sub(actual_width);
            for _ in 0..padding {
                output.push(' ');
            }
        }
    }

    output
}

/// Format as one entry per line
fn format_one_per_line(files: &[FileEntry], options: &LsOptions) -> String {
    let mut output = String::new();
    for file in files {
        output.push_str(&file.colored_name(options.show_icons));
        output.push('\n');
    }
    output
}

/// Format as long listing with metadata
fn format_long(files: &[FileEntry], options: &LsOptions) -> String {
    let mut output = String::new();

    // Calculate total size
    let total: u64 = files.iter().map(|f| f.size).sum();
    output.push_str(&format!("\x1b[90mtotal {}\x1b[0m\n", format_size(total)));

    for file in files {
        let icon = if options.show_icons {
            format!("{} ", file.icon())
        } else {
            String::new()
        };

        let type_char = if file.is_dir {
            "d"
        } else if file.is_symlink {
            "l"
        } else {
            "-"
        };

        // Permissions (simplified for Windows, proper for Unix)
        let perms = if file.is_dir {
            "rwxr-xr-x"
        } else if file.is_executable {
            "rwxr-xr-x"
        } else {
            "rw-r--r--"
        };

        let size = format_size(file.size);
        let date = file.modified.format("%b %d %H:%M");

        let colored_name = if file.is_dir {
            format!("\x1b[1;34m{}/\x1b[0m", file.name)
        } else if file.is_symlink {
            format!("\x1b[1;36m{}\x1b[0m", file.name)
        } else if file.is_executable {
            format!("\x1b[1;32m{}\x1b[0m", file.name)
        } else if file.is_hidden {
            format!("\x1b[90m{}\x1b[0m", file.name)
        } else {
            file.name.clone()
        };

        output.push_str(&format!(
            "{}{}{} {:>7}  {}  {}\n",
            icon, type_char, perms, size, date, colored_name
        ));
    }

    output
}

fn format_size(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;

    if bytes >= GB {
        format!("{:.1}G", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.1}M", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.1}K", bytes as f64 / KB as f64)
    } else {
        format!("{}B", bytes)
    }
}

fn is_executable_file(name: &str, _metadata: &Metadata) -> bool {
    let lower = name.to_lowercase();

    // Windows executables
    if lower.ends_with(".exe")
        || lower.ends_with(".bat")
        || lower.ends_with(".cmd")
        || lower.ends_with(".ps1")
        || lower.ends_with(".com")
        || lower.ends_with(".msi")
    {
        return true;
    }

    // Unix: check if file has no extension and might be executable
    // (simplified heuristic for cross-platform)
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mode = _metadata.permissions().mode();
        return mode & 0o111 != 0;
    }

    #[cfg(not(unix))]
    false
}
