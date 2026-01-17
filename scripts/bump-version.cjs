#!/usr/bin/env node

/**
 * Bump Version Script for Connexio
 *
 * Updates version in:
 * - package.json
 * - src-tauri/tauri.conf.json
 * - src-tauri/Cargo.toml
 *
 * Usage:
 *   node scripts/bump-version.js <version>
 *   node scripts/bump-version.js patch|minor|major
 *
 * Examples:
 *   node scripts/bump-version.js 0.2.1
 *   node scripts/bump-version.js patch   # 0.2.0 → 0.2.1
 *   node scripts/bump-version.js minor   # 0.2.0 → 0.3.0
 *   node scripts/bump-version.js major   # 0.2.0 → 1.0.0
 */

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");

const FILES = {
  package: path.join(ROOT_DIR, "package.json"),
  tauri: path.join(ROOT_DIR, "src-tauri", "tauri.conf.json"),
  cargo: path.join(ROOT_DIR, "src-tauri", "Cargo.toml"),
};

function getCurrentVersion() {
  const pkg = JSON.parse(fs.readFileSync(FILES.package, "utf8"));
  return pkg.version;
}

function parseVersion(version) {
  const [major, minor, patch] = version.split(".").map(Number);
  return { major, minor, patch };
}

function formatVersion({ major, minor, patch }) {
  return `${major}.${minor}.${patch}`;
}

function bumpVersion(current, type) {
  const v = parseVersion(current);

  switch (type) {
    case "major":
      return formatVersion({ major: v.major + 1, minor: 0, patch: 0 });
    case "minor":
      return formatVersion({ major: v.major, minor: v.minor + 1, patch: 0 });
    case "patch":
      return formatVersion({ major: v.major, minor: v.minor, patch: v.patch + 1 });
    default:
      // Assume it's an explicit version
      if (/^\d+\.\d+\.\d+$/.test(type)) {
        return type;
      }
      throw new Error(`Invalid version or bump type: ${type}`);
  }
}

function updatePackageJson(newVersion) {
  const content = JSON.parse(fs.readFileSync(FILES.package, "utf8"));
  content.version = newVersion;
  fs.writeFileSync(FILES.package, JSON.stringify(content, null, 2) + "\n");
  console.log(`  ✓ package.json → ${newVersion}`);
}

function updateTauriConf(newVersion) {
  const content = JSON.parse(fs.readFileSync(FILES.tauri, "utf8"));
  content.version = newVersion;
  fs.writeFileSync(FILES.tauri, JSON.stringify(content, null, 2) + "\n");
  console.log(`  ✓ src-tauri/tauri.conf.json → ${newVersion}`);
}

function updateCargoToml(newVersion) {
  let content = fs.readFileSync(FILES.cargo, "utf8");
  content = content.replace(/^version\s*=\s*"[^"]+"/m, `version = "${newVersion}"`);
  fs.writeFileSync(FILES.cargo, content);
  console.log(`  ✓ src-tauri/Cargo.toml → ${newVersion}`);
}

function main() {
  const arg = process.argv[2];

  if (!arg) {
    console.log("Usage: node scripts/bump-version.js <version|patch|minor|major>");
    console.log("");
    console.log("Examples:");
    console.log("  node scripts/bump-version.js 0.2.1");
    console.log("  node scripts/bump-version.js patch");
    console.log("  node scripts/bump-version.js minor");
    console.log("  node scripts/bump-version.js major");
    process.exit(1);
  }

  const currentVersion = getCurrentVersion();
  console.log(`\n📦 Current version: ${currentVersion}`);

  try {
    const newVersion = bumpVersion(currentVersion, arg);
    console.log(`🚀 New version: ${newVersion}\n`);
    console.log("Updating files:");

    updatePackageJson(newVersion);
    updateTauriConf(newVersion);
    updateCargoToml(newVersion);

    console.log("\n✅ Version bumped successfully!\n");
    console.log("Next steps:");
    console.log(`  git add .`);
    console.log(`  git commit -m "chore: bump version to ${newVersion}"`);
    console.log(`  git tag v${newVersion}`);
    console.log(`  git push && git push --tags`);
    console.log("");
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();
