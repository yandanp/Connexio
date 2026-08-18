/** Mirror of the backend slugify so the branch preview matches what git gets. */
export function slugify(name: string): string {
	const slug = name
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9-_]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
	return slug || "worktree";
}
