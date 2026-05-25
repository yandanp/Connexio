use serde::Serialize;
use std::fs;
use std::path::Path;
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize)]
pub struct TaskScript {
    pub name: String,
    pub command: String,
    pub source: String,
}

#[tauri::command]
pub fn tasks_detect(_app: AppHandle, project_path: String) -> Vec<TaskScript> {
    let mut tasks = Vec::new();
    let base = Path::new(&project_path);

    // package.json
    let pkg_json = base.join("package.json");
    if pkg_json.exists() {
        if let Ok(content) = fs::read_to_string(&pkg_json) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(scripts) = json.get("scripts").and_then(|s| s.as_object()) {
                    for (name, cmd) in scripts {
                        if let Some(cmd_str) = cmd.as_str() {
                            tasks.push(TaskScript {
                                name: name.clone(),
                                command: cmd_str.to_string(),
                                source: "package.json".to_string(),
                            });
                        }
                    }
                }
            }
        }
    }

    // Cargo.toml — detect common cargo commands
    let cargo_toml = base.join("Cargo.toml");
    if cargo_toml.exists() {
        let cargo_tasks = [
            ("build", "cargo build"),
            ("run", "cargo run"),
            ("test", "cargo test"),
            ("check", "cargo check"),
            ("clippy", "cargo clippy"),
        ];
        for (name, cmd) in &cargo_tasks {
            tasks.push(TaskScript {
                name: name.to_string(),
                command: cmd.to_string(),
                source: "Cargo.toml".to_string(),
            });
        }
    }

    // Makefile
    let makefile = base.join("Makefile");
    if makefile.exists() {
        if let Ok(content) = fs::read_to_string(&makefile) {
            for line in content.lines() {
                if let Some(target) = line.strip_suffix(':') {
                    let target = target.trim();
                    if !target.is_empty()
                        && !target.starts_with('.')
                        && !target.contains(' ')
                        && !target.starts_with('#')
                    {
                        tasks.push(TaskScript {
                            name: target.to_string(),
                            command: format!("make {}", target),
                            source: "Makefile".to_string(),
                        });
                    }
                }
            }
        }
    }

    // pyproject.toml — detect [project.scripts]
    let pyproject = base.join("pyproject.toml");
    if pyproject.exists() {
        if let Ok(content) = fs::read_to_string(&pyproject) {
            let mut in_scripts = false;
            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed == "[project.scripts]" || trimmed == "[tool.poetry.scripts]" {
                    in_scripts = true;
                    continue;
                }
                if trimmed.starts_with('[') {
                    in_scripts = false;
                    continue;
                }
                if in_scripts {
                    if let Some((name, _)) = trimmed.split_once('=') {
                        let name = name.trim().trim_matches('"');
                        tasks.push(TaskScript {
                            name: name.to_string(),
                            command: name.to_string(),
                            source: "pyproject.toml".to_string(),
                        });
                    }
                }
            }
        }
    }

    tasks
}
