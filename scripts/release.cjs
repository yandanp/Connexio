#!/usr/bin/env node

/**
 * Connexio Release Helper
 *
 * Automates the release process:
 * 1. Bump version
 * 2. Build with signing
 * 3. Update latest.json
 * 4. Create GitHub release
 *
 * Usage:
 *   node scripts/release.cjs patch|minor|major
 *   node scripts/release.cjs 1.0.0
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..");

function run(cmd, options = {}) {
  console.log(`\n> ${cmd}\n`);
  try {
    return execSync(cmd, {
      cwd: ROOT_DIR,
      stdio: "inherit",
      ...options,
    });
  } catch (error) {
    if (!options.ignoreError) {
      process.exit(1);
    }
  }
}

function runSilent(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT_DIR, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function getVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, "package.json"), "utf8"));
  return pkg.version;
}

function getSignature(version) {
  const sigPath = path.join(
    ROOT_DIR,
    `src-tauri/target/release/bundle/nsis/Connexio_${version}_x64-setup.exe.sig`
  );
  if (fs.existsSync(sigPath)) {
    return fs.readFileSync(sigPath, "utf8").trim();
  }
  return null;
}

function updateLatestJson(version, signature) {
  const latestPath = path.join(ROOT_DIR, "latest.json");
  const latest = {
    version: version,
    notes: `Version ${version}`,
    pub_date: new Date().toISOString(),
    platforms: {
      "windows-x86_64": {
        signature: signature,
        url: `https://github.com/yandanp/Connexio/releases/download/v${version}/Connexio_${version}_x64-setup.exe`,
      },
    },
  };
  fs.writeFileSync(latestPath, JSON.stringify(latest, null, 2) + "\n");
  console.log(`\n✅ Updated latest.json for v${version}`);
}

function main() {
  const arg = process.argv[2];

  if (!arg) {
    console.log(`
Connexio Release Helper

Usage:
  node scripts/release.cjs <patch|minor|major|version>

Examples:
  node scripts/release.cjs patch   # Bug fix release
  node scripts/release.cjs minor   # Feature release
  node scripts/release.cjs major   # Breaking change
  node scripts/release.cjs 1.0.0   # Specific version

Steps performed:
  1. Bump version in all files
  2. Commit and push
  3. Build with signing
  4. Update latest.json
  5. Create GitHub release
  6. Commit and push latest.json
`);
    process.exit(0);
  }

  console.log("\n🚀 Connexio Release Helper\n");
  console.log("=".repeat(50));

  // Step 1: Bump version
  console.log("\n📦 Step 1: Bumping version...");
  run(`node scripts/bump-version.cjs ${arg}`);

  const version = getVersion();
  console.log(`\n📌 New version: ${version}`);

  // Step 2: Commit and push
  console.log("\n📤 Step 2: Committing and pushing...");
  run("git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml");
  run(`git commit -m "chore: bump version to ${version}"`);
  run("git push");

  // Step 3: Build with signing
  console.log("\n🔨 Step 3: Building with signing...");
  console.log("This may take a few minutes...\n");
  run("powershell -ExecutionPolicy Bypass -File build-signed.ps1");

  // Step 4: Update latest.json
  console.log("\n📝 Step 4: Updating latest.json...");
  const signature = getSignature(version);
  if (!signature) {
    console.error("❌ Signature file not found! Build may have failed.");
    process.exit(1);
  }
  updateLatestJson(version, signature);

  // Step 5: Create GitHub release
  console.log("\n🎉 Step 5: Creating GitHub release...");

  const nsisExe = `src-tauri/target/release/bundle/nsis/Connexio_${version}_x64-setup.exe`;
  const nsisSig = `src-tauri/target/release/bundle/nsis/Connexio_${version}_x64-setup.exe.sig`;
  const msiExe = `src-tauri/target/release/bundle/msi/Connexio_${version}_x64_en-US.msi`;
  const msiSig = `src-tauri/target/release/bundle/msi/Connexio_${version}_x64_en-US.msi.sig`;

  // Create release notes file to avoid shell escaping issues
  const releaseNotes = `## What's New in v${version}

See commit history for detailed changes.

## Downloads

| Package | Description |
|---------|-------------|
| Connexio_${version}_x64-setup.exe | **NSIS Installer** (Recommended) |
| Connexio_${version}_x64_en-US.msi | **MSI Installer** - For enterprise deployment |

## Auto-Update

Existing users will receive this update automatically!
`;

  const releaseNotesPath = path.join(ROOT_DIR, "RELEASE_NOTES.tmp.md");
  fs.writeFileSync(releaseNotesPath, releaseNotes);

  run(
    `gh release create v${version} "${nsisExe}" "${nsisSig}" "${msiExe}" "${msiSig}" "latest.json" --title "Connexio v${version}" --notes-file "${releaseNotesPath}"`
  );

  // Clean up temp file
  fs.unlinkSync(releaseNotesPath);

  // Step 6: Commit latest.json
  console.log("\n📤 Step 6: Committing latest.json...");
  run("git add latest.json");
  run(`git commit -m "chore: update latest.json for v${version}"`);
  run("git push");

  // Done!
  console.log("\n" + "=".repeat(50));
  console.log(`\n🎉 Release v${version} completed successfully!\n`);
  console.log(`📦 GitHub Release: https://github.com/yandanp/Connexio/releases/tag/v${version}`);
  console.log("\n");
}

main();
