import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const files = execSync('git ls-files -- "src/renderer/*.ts" "src/renderer/*.tsx"', {
	encoding: "utf8",
})
	.trim()
	.split("\n");

let failed = false;
const rel = (from, spec) => {
	const dir = from.split("/").slice(0, -1).join("/");
	const parts = [...dir.split("/"), ...spec.split("/")];
	const out = [];
	for (const p of parts) {
		if (p === "..") out.pop();
		else if (p !== ".") out.push(p);
	}
	return out.join("/");
};
const featureOf = (p) => {
	const m = p.match(/^src\/renderer\/features\/([^/]+)\//);
	return m ? m[1] : null;
};

// Allowlist sementara (fase migrasi): entri lainnya dihapus saat Tasks 6-13
// memigrasikan call site invoke/listen ke core/api*.
const LEGACY = [
	// Existing invoke() call sites (pre-Task 2):
	"src/renderer/components/SearchPanel.tsx",
	"src/renderer/components/Terminal.tsx",
	"src/renderer/components/WebPreview.tsx",
	"src/renderer/components/editor/CodeEditor.tsx",
	"src/renderer/components/explorer/FileExplorer.tsx",
];

for (const f of files) {
	if (LEGACY.includes(f)) continue;
	const src = readFileSync(f, "utf8");
	const myFeature = featureOf(f);
	for (const m of src.matchAll(/from\s+["']([^"']+)["']/g)) {
		const spec = m[1];
		// Rule B: invoke/listen hanya di core/api*
		const inCoreApi = /^src\/renderer\/core\/api(-remote)?\//.test(f);
		if (!inCoreApi && (spec === "@tauri-apps/api/core" || spec === "@tauri-apps/api/event")) {
			console.error(`boundary FAIL: ${f} imports ${spec} (only core/api* may)`);
			failed = true;
		}
		// Rule A: feature tidak boleh impor internal feature lain
		if (spec.startsWith(".")) {
			const target = rel(f, spec);
			const theirFeature = featureOf(target) ?? featureOf(target + "/index.ts");
			if (
				myFeature &&
				theirFeature &&
				theirFeature !== myFeature &&
				!/features\/[^/]+$/.test(target)
			) {
				console.error(
					`boundary FAIL: ${f} imports internal of features/${theirFeature} (use its index)`,
				);
				failed = true;
			}
		}
	}
}
if (failed) process.exit(1);
console.log("feature boundaries: OK");
