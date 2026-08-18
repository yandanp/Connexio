/**
 * CLI agents offered when creating a worktree (Orca-style agent selector).
 *
 * The list marks which binaries are installed on this machine (detected via
 * the backend agent_detect_all command) so the picker only enables agents
 * that can actually launch.
 */

export interface AgentOption {
	id: string;
	label: string;
	/** Binary that must exist on the user's PATH. */
	command: string;
	hint: string;
}

export const AGENT_OPTIONS: AgentOption[] = [
	{ id: "claude", label: "Claude Code", command: "claude", hint: "Anthropic CLI" },
	{ id: "codex", label: "Codex CLI", command: "codex", hint: "OpenAI CLI" },
	{ id: "gemini", label: "Gemini CLI", command: "gemini", hint: "Google CLI" },
	{ id: "aider", label: "Aider", command: "aider", hint: "Pair programming in the terminal" },
	{ id: "cursor-agent", label: "Cursor Agent", command: "cursor-agent", hint: "Cursor CLI" },
	{ id: "opencode", label: "OpenCode", command: "opencode", hint: "Open-source agent CLI" },
	{ id: "gh", label: "GitHub CLI", command: "gh", hint: "Issues and PRs from the terminal" },
];
