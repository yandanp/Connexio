import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const NEW_FILE_CAP = 400;
const baselinePath = fileURLToPath(new URL("./max-lines-baseline.txt", import.meta.url));

const baseline = new Map();
if (existsSync(baselinePath)) {
	for (const raw of readFileSync(baselinePath, "utf8").split("\n")) {
		const line = raw.trim();
		if (!line || line.startsWith("#")) continue;
		const [p, limit] = line.split("\t");
		baseline.set(p, Number(limit));
	}
}

const files = execSync('git ls-files -- "*.ts" "*.tsx" "*.rs"', { encoding: "utf8" })
	.trim()
	.split("\n")
	.filter((f) => f.startsWith("src/") || f.startsWith("src-tauri/src/"));

let failed = false;
for (const f of files) {
	const lines = readFileSync(f, "utf8").split("\n").length;
	const limit = baseline.get(f) ?? NEW_FILE_CAP;
	if (lines > limit) {
		console.error(`max-lines FAIL: ${f} has ${lines} lines (limit ${limit})`);
		failed = true;
	}
}
for (const [p] of baseline) {
	if (!existsSync(p)) {
		console.error(`max-lines FAIL: baseline entry for deleted file ${p} — remove it`);
		failed = true;
	}
}
if (failed) process.exit(1);
console.log("max-lines ratchet: OK");
