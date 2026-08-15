import { expect, it } from "vitest";
import { filterFiles, getFileName, groupFiles } from "./git-file-grouping";
import type { GitChangedFile } from "@shared/types";

// Characterization fixture (adapted from the task brief, see task-11-report.md):
// - GitChangedFile's worktree field is spelled `workTreeStatus` (capital T).
// - groupFiles only treats a file as untracked when BOTH index and worktree report "?".
// - A worktree-only change uses indexStatus " " (e.g. " ", "M" → modified).
const f = (path: string, indexStatus: string, workTreeStatus = " "): GitChangedFile =>
	({ path, indexStatus, workTreeStatus }) as GitChangedFile;

it("groups by git status", () => {
	const files = [f("a.ts", "M"), f("new.ts", "?", "?"), f("s.ts", " ", "M"), f("c.ts", "U")];
	const g = groupFiles(files);
	expect(g.untracked.map((x) => x.path)).toEqual(["new.ts"]);
	expect(g.conflicted.map((x) => x.path)).toEqual(["c.ts"]);
	expect(g.staged.length + g.modified.length).toBe(2);
});

it("filterFiles matches path substring case-insensitively", () => {
	const files = [f("src/App.tsx", "M"), f("README.md", "M")];
	expect(filterFiles(files, "app", "modified").map((x) => x.path)).toEqual(["src/App.tsx"]);
	expect(filterFiles(files, "", "modified")).toHaveLength(2);
});

it("getFileName returns last segment", () => {
	expect(getFileName("src/deep/file.ts")).toBe("file.ts");
});

// Characterization: actual groupFiles puts a file with index "M" and worktree "M"
// into BOTH staged and modified (the brief's fixture assumed a single group).
it("a staged-then-modified file appears in both staged and modified", () => {
	const g = groupFiles([f("s.ts", "M", "M")]);
	expect(g.staged.map((x) => x.path)).toEqual(["s.ts"]);
	expect(g.modified.map((x) => x.path)).toEqual(["s.ts"]);
});
