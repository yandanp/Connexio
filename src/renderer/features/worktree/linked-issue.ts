/**
 * Linked-issue URL parsing for the worktree dialog.
 *
 * Orca-style: paste a tracker URL into the name field and the dialog
 * recognizes it, offers the issue as the worktree identity, and can fetch
 * the title (best-effort, no auth) to prefill the name.
 */

export interface ParsedLinkedIssue {
	kind: "github-pr" | "github-issue";
	repo: string;
	number: number;
	/** Filled in asynchronously when the title can be fetched. */
	title: null;
}

export function parseLinkedIssueUrl(input: string): ParsedLinkedIssue | null {
	const trimmed = input.trim();

	// GitHub PR/issue: https://github.com/<owner>/<repo>/(pull|issues)/<n>
	const gh = trimmed.match(/^https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/(pull|issues)\/(\d+)\/?$/);
	if (gh) {
		return {
			kind: gh[2] === "pull" ? "github-pr" : "github-issue",
			repo: gh[1],
			number: Number(gh[3]),
			title: null,
		};
	}

	return null;
}

/**
 * Fetch a GitHub PR/issue title (best-effort, unauthenticated).
 * Returns null on any failure — the dialog just skips the prefill.
 */
export async function fetchGithubTitle(parsed: ParsedLinkedIssue): Promise<string | null> {
	const endpoint =
		parsed.kind === "github-pr"
			? `https://api.github.com/repos/${parsed.repo}/pulls/${parsed.number}`
			: `https://api.github.com/repos/${parsed.repo}/issues/${parsed.number}`;
	try {
		const res = await fetch(endpoint, {
			headers: { Accept: "application/vnd.github+json" },
		});
		if (!res.ok) return null;
		const data = (await res.json()) as { title?: string };
		return data.title ?? null;
	} catch {
		return null;
	}
}
