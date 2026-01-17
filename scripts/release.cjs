#!/usr/bin/env node

/**
 * Connexio Release Helper
 *
 * Automates the release process:
 * 1. Bump version (optional)
 * 2. Build with signing
 * 3. Update latest.json
 * 4. Create GitHub release
 *
 * Usage:
 *   node scripts/release.cjs patch|minor|major   # Bump and release
 *   node scripts/release.cjs                      # Release current version (no bump)
 *   node scripts/release.cjs --build-only         # Build only, no GitHub release
 *   node scripts/release.cjs 1.0.0               # Set specific version and release
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
      console.error(`\n❌ Command failed: ${cmd}`);
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

function getLatestTag() {
  return runSilent("git describe --tags --abbrev=0 2>nul") || "";
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

function showHelp() {
  console.log(`
Connexio Release Helper

Usage:
  node scripts/release.cjs <patch|minor|major|version>  # Bump version and release
  node scripts/release.cjs                              # Release current version (no bump)
  node scripts/release.cjs --build-only                 # Build only, no GitHub release
  node scripts/release.cjs --help                       # Show this help

Examples:
  node scripts/release.cjs patch       # Bug fix release (0.3.0 → 0.3.1)
  node scripts/release.cjs minor       # Feature release (0.3.0 → 0.4.0)
  node scripts/release.cjs major       # Breaking change (0.3.0 → 1.0.0)
  node scripts/release.cjs 1.0.0       # Set specific version
  node scripts/release.cjs             # Release current version without bumping

Steps performed:
  1. Bump version in all files (if specified)
  2. Commit and push (if bumped)
  3. Build with signing
  4. Update latest.json
  5. Create GitHub release
  6. Commit and push latest.json
`);
}

function main() {
  const args = process.argv.slice(2);
  const arg = args[0];

  // Check for help flag
  if (arg === "--help" || arg === "-h") {
    showHelp();
    process.exit(0);
  }

  // Check for build-only flag
  const buildOnly = args.includes("--build-only");
  const bumpArg = args.find(a => !a.startsWith("--"));

  console.log("\n🚀 Connexio Release Helper\n");
  console.log("=".repeat(50));

  const currentVersion = getVersion();
  const latestTag = getLatestTag();
  let version = currentVersion;
  let needsBump = false;

  // Determine if we need to bump version
  if (bumpArg && ["patch", "minor", "major"].includes(bumpArg)) {
    needsBump = true;
    console.log(`\n📦 Will bump version: ${bumpArg}`);
  } else if (bumpArg && /^\d+\.\d+\.\d+/.test(bumpArg)) {
    needsBump = currentVersion !== bumpArg;
    console.log(`\n📦 Will set version to: ${bumpArg}`);
  } else {
    // No bump argument - release current version
    console.log(`\n📦 Releasing current version: ${currentVersion}`);
    
    // Check if this version already has a release
    if (latestTag === `v${currentVersion}`) {
      console.log(`\n⚠️  Warning: Tag v${currentVersion} already exists.`);
      console.log("   This will rebuild and update the existing release.");
    }
  }

  // Step 1: Bump version (if needed)
  if (needsBump && bumpArg) {
    console.log("\n📦 Step 1: Bumping version...");
    run(`node scripts/bump-version.cjs ${bumpArg}`);
    version = getVersion();
    console.log(`\n📌 New version: ${version}`);

    // Commit and push version bump
    console.log("\n📤 Committing version bump...");
    run("git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock");
    run(`git commit -m "chore: bump version to ${version}"`, { ignoreError: true });
    run("git push");
  } else {
    console.log("\n📦 Step 1: Skipping version bump (already at target version)");
    version = currentVersion;
  }

  console.log(`\n📌 Version: ${version}`);

  // Step 2: Build with signing
  console.log("\n🔨 Step 2: Building installer with signing...");
  console.log("   This may take several minutes...\n");
  
  // Use build-installer.ps1 script
  run("powershell -ExecutionPolicy Bypass -File scripts/build-installer.ps1");

  // Check if build artifacts exist
  const nsisExe = path.join(ROOT_DIR, `src-tauri/target/release/bundle/nsis/Connexio_${version}_x64-setup.exe`);
  const msiExe = path.join(ROOT_DIR, `src-tauri/target/release/bundle/msi/Connexio_${version}_x64_en-US.msi`);
  
  if (!fs.existsSync(nsisExe)) {
    console.error(`\n❌ Build artifact not found: ${nsisExe}`);
    console.error("   Build may have failed.");
    process.exit(1);
  }
  
  console.log(`\n✅ Build artifacts found:`);
  console.log(`   - ${path.basename(nsisExe)}`);
  if (fs.existsSync(msiExe)) {
    console.log(`   - ${path.basename(msiExe)}`);
  }

  // If build-only, stop here
  if (buildOnly) {
    console.log("\n" + "=".repeat(50));
    console.log("\n✅ Build completed (--build-only mode)\n");
    console.log(`📦 Artifacts in: src-tauri/target/release/bundle/`);
    process.exit(0);
  }

  // Step 3: Update latest.json
  console.log("\n📝 Step 3: Updating latest.json...");
  
  const nsisSigPath = `${nsisExe}.sig`;
  let signature = null;
  
  if (fs.existsSync(nsisSigPath)) {
    signature = fs.readFileSync(nsisSigPath, "utf8").trim();
    console.log("   ✅ Signature file found");
  } else {
    console.log("   ⚠️  No signature file found (updater won't work without signing)");
    // Create a placeholder - user needs to sign manually
    signature = "UNSIGNED";
  }
  
  updateLatestJson(version, signature);

  // Step 4: Create GitHub release
  console.log("\n🎉 Step 4: Creating GitHub release...");

  // Prepare file list
  const releaseFiles = [`"${nsisExe}"`];
  
  if (fs.existsSync(nsisSigPath)) {
    releaseFiles.push(`"${nsisSigPath}"`);
  }
  
  if (fs.existsSync(msiExe)) {
    releaseFiles.push(`"${msiExe}"`);
    const msiSigPath = `${msiExe}.sig`;
    if (fs.existsSync(msiSigPath)) {
      releaseFiles.push(`"${msiSigPath}"`);
    }
  }
  
  releaseFiles.push(`"${path.join(ROOT_DIR, 'latest.json')}"`);

  // Create release notes
  const releaseNotes = `## What's New in v${version}

See [CHANGELOG.md](https://github.com/yandanp/Connexio/blob/main/CHANGELOG.md) for detailed changes.

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

  // Check if release already exists
  const existingRelease = runSilent(`gh release view v${version} --json tagName 2>nul`);
  
  if (existingRelease) {
    console.log(`\n   Tag v${version} already exists. Updating release...`);
    // Delete existing release and recreate
    run(`gh release delete v${version} --yes`, { ignoreError: true });
  }

  // Create release
  const filesArg = releaseFiles.join(" ");
  run(
    `gh release create v${version} ${filesArg} --title "Connexio v${version}" --notes-file "${releaseNotesPath}"`
  );

  // Clean up temp file
  fs.unlinkSync(releaseNotesPath);

  // Step 5: Commit latest.json
  console.log("\n📤 Step 5: Committing latest.json...");
  run("git add latest.json");
  run(`git commit -m "chore: update latest.json for v${version}"`, { ignoreError: true });
  run("git push");

  // Done!
  console.log("\n" + "=".repeat(50));
  console.log(`\n🎉 Release v${version} completed successfully!\n`);
  console.log(`📦 GitHub Release: https://github.com/yandanp/Connexio/releases/tag/v${version}`);
  console.log("\n");
}

main();
