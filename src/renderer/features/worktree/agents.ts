/**
 * CLI agents offered when creating a worktree (Orca-style agent selector).
 *
 * The chosen agent is launched in the worktree's terminal right after the
 * worktree opens — one click from name to running agent.
 */

export interface AgentOption {
	id: string;
	label: string;
	/** Command run in the worktree terminal; must exist on the user's PATH. */
	command: string;
	hint: string;
}

export const AGENT_OPTIONS: AgentOption[] = [
	{ id: "none", label: "None (terminal only)", command: "", hint: "Just a shell" },
	{ id: "claude", label: "Claude Code", command: "claude", hint: "Anthropic CLI" },
	{ id: "codex", label: "Codex CLI", command: "codex", hint: "OpenAI CLI" },
	{ id: "gemini", label: "Gemini CLI", command: "gemini", hint: "Google CLI" },
	{ id: "aider", label: "Aider", command: "aider", hint: "Pair programming in the terminal" },
];
