import { Bot, Check, Copy, FileText, Play } from "lucide-react";
import { useState } from "react";
import type { AIMessage } from "./ai-types";

// ─── Code Block Component ────────────────────────────────────────────────────

function CodeBlock({
	code,
	lang,
	onRun,
	onInsert,
}: {
	code: string;
	lang: string;
	onRun: (cmd: string) => void;
	onInsert: (code: string) => void;
}) {
	const [copied, setCopied] = useState(false);
	const shell = ["sh", "bash", "zsh", "shell", "powershell", "ps1", "cmd", "bat"].includes(
		lang.toLowerCase(),
	);
	const copy = () =>
		navigator.clipboard
			.writeText(code)
			.then(() => {
				setCopied(true);
				setTimeout(() => setCopied(false), 1200);
			})
			.catch(() => {});
	return (
		<div className="my-2 overflow-hidden rounded-lg bg-connexio-bg shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
			<div className="flex items-center justify-between bg-connexio-bg-tertiary px-2 py-1 shadow-[inset_0_-1px_0_rgba(255,255,255,0.05)]">
				<span className="text-[9px] text-connexio-text-muted uppercase">{lang || "code"}</span>
				<div className="flex items-center gap-1">
					{shell && (
						<button
							onClick={() => onRun(code)}
							className="flex items-center gap-1 px-1.5 py-0.5 dock-button text-[10px] text-green-400"
							type="button"
						>
							<Play size={10} />
							Run
						</button>
					)}
					<button
						onClick={() => onInsert(code)}
						className="flex items-center gap-1 px-1.5 py-0.5 dock-button text-[10px] text-connexio-accent"
						type="button"
					>
						<FileText size={10} />
						Insert
					</button>
					<button
						onClick={copy}
						className="flex items-center gap-1 px-1.5 py-0.5 dock-button text-[10px] text-connexio-text-muted"
						type="button"
					>
						{copied ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}
						{copied ? "Copied" : "Copy"}
					</button>
				</div>
			</div>
			<pre className="text-[11px] p-2 overflow-x-auto text-connexio-text">
				<code>{code}</code>
			</pre>
		</div>
	);
}

// ─── Inline Markdown Parser ──────────────────────────────────────────────────

function inlineMd(text: string) {
	return text.split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g).map((p, i) => {
		if (p.startsWith("`") && p.endsWith("`"))
			return (
				<code
					key={i}
					className="px-1 py-0.5 bg-connexio-bg-tertiary rounded text-connexio-accent text-[11px]"
				>
					{p.slice(1, -1)}
				</code>
			);
		if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
		const link = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
		if (link)
			return (
				<a
					key={i}
					href={link[2]}
					target="_blank"
					rel="noreferrer"
					className="text-connexio-accent hover:underline"
				>
					{link[1]}
				</a>
			);
		return <span key={i}>{p}</span>;
	});
}

// ─── Markdown Renderer ───────────────────────────────────────────────────────

function Markdown({
	content,
	onRun,
	onInsert,
}: {
	content: string;
	onRun: (cmd: string) => void;
	onInsert: (code: string) => void;
}) {
	return (
		<>
			{content.split(/(```[\s\S]*?```)/g).map((part, i) => {
				if (part.startsWith("```") && part.endsWith("```")) {
					const lines = part.slice(3, -3).replace(/^\n/, "").split("\n");
					const first = lines[0]?.trim() || "";
					const hasLang = /^[a-zA-Z0-9_+.-]+$/.test(first) && lines.length > 1;
					return (
						<CodeBlock
							key={i}
							lang={hasLang ? first : ""}
							code={(hasLang ? lines.slice(1) : lines).join("\n")}
							onRun={onRun}
							onInsert={onInsert}
						/>
					);
				}
				return part.split("\n").map((line, j) => {
					if (!line.trim()) return <br key={`${i}-${j}`} />;
					if (line.startsWith("# "))
						return (
							<h1 key={`${i}-${j}`} className="mt-2 text-[15px] font-bold">
								{inlineMd(line.slice(2))}
							</h1>
						);
					if (line.startsWith("## "))
						return (
							<h2 key={`${i}-${j}`} className="mt-2 text-[14px] font-semibold">
								{inlineMd(line.slice(3))}
							</h2>
						);
					if (line.startsWith("### "))
						return (
							<h3 key={`${i}-${j}`} className="mt-2 text-[13px] font-semibold">
								{inlineMd(line.slice(4))}
							</h3>
						);
					if (/^[-*]\s+/.test(line))
						return (
							<div key={`${i}-${j}`} className="pl-3">
								• {inlineMd(line.replace(/^[-*]\s+/, ""))}
							</div>
						);
					return <div key={`${i}-${j}`}>{inlineMd(line)}</div>;
				});
			})}
		</>
	);
}

// ─── Message Bubble ──────────────────────────────────────────────────────────

export function AIMessageBubble({
	message,
	onRun,
	onInsert,
}: {
	message: AIMessage;
	onRun: (cmd: string) => void;
	onInsert: (code: string) => void;
}) {
	const isUser = message.role === "user";
	const [copied, setCopied] = useState(false);
	const copy = () =>
		navigator.clipboard
			.writeText(message.content)
			.then(() => {
				setCopied(true);
				setTimeout(() => setCopied(false), 1200);
			})
			.catch(() => {});
	return (
		<div className={`flex gap-2 px-3 py-2.5 ${isUser ? "" : "bg-connexio-bg-secondary/45"}`}>
			<div className="flex-shrink-0 mt-0.5">
				{isUser ? (
					<div className="flex h-6 w-6 items-center justify-center rounded-lg bg-connexio-accent/15 shadow-[inset_2px_0_0_var(--accent-color)]">
						<span className="text-[9px] font-bold text-connexio-accent">U</span>
					</div>
				) : (
					<div className="flex h-6 w-6 items-center justify-center rounded-lg bg-connexio-accent/10">
						<Bot size={11} className="text-blue-400" />
					</div>
				)}
			</div>
			<div className="flex-1 min-w-0">
				{message.context && (
					<div className="flex gap-1 mb-1 text-[9px] text-connexio-text-muted">
						{message.context.file && <span className="px-1 field-soft">file context</span>}
						{message.context.terminal && <span className="px-1 field-soft">terminal context</span>}
					</div>
				)}
				<div className="text-[12px] text-connexio-text leading-relaxed break-words">
					{message.isStreaming && !message.content ? (
						<span className="text-connexio-text-muted animate-pulse">Thinking...</span>
					) : (
						<Markdown content={message.content} onRun={onRun} onInsert={onInsert} />
					)}
					{message.isStreaming && message.content && (
						<span className="inline-block w-1.5 h-3 ml-0.5 bg-connexio-accent animate-pulse" />
					)}
				</div>
				{message.content && !message.isStreaming && (
					<button
						onClick={copy}
						className="mt-1 flex items-center gap-1 p-0.5 dock-button text-[10px] text-connexio-text-muted"
						type="button"
					>
						{copied ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}
						{copied ? "Copied" : "Copy"}
					</button>
				)}
			</div>
		</div>
	);
}
