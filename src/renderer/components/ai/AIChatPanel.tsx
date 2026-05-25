import { Bot, Check, Copy, FileText, History, Play, Plus, Save, Send, Settings, Square, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAIStore, type AIMessage, type AIProviderConfig, type AIProviderType } from "../../stores/aiStore";
import { useProjectStore } from "../../stores/projectStore";

function CodeBlock({ code, lang, onRun, onInsert }: { code: string; lang: string; onRun: (cmd: string) => void; onInsert: (code: string) => void }) {
	const [copied, setCopied] = useState(false);
	const shell = ["sh", "bash", "zsh", "shell", "powershell", "ps1", "cmd", "bat"].includes(lang.toLowerCase());
	const copy = () => navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); }).catch(() => {});
	return <div className="my-2 rounded-md overflow-hidden border border-connexio-border bg-connexio-bg">
		<div className="flex items-center justify-between px-2 py-1 bg-connexio-bg-tertiary border-b border-connexio-border">
			<span className="text-[9px] text-connexio-text-muted uppercase">{lang || "code"}</span>
			<div className="flex items-center gap-1">
				{shell && <button onClick={() => onRun(code)} className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-connexio-bg-secondary text-[10px] text-green-400" type="button"><Play size={10} />Run</button>}
				<button onClick={() => onInsert(code)} className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-connexio-bg-secondary text-[10px] text-connexio-accent" type="button"><FileText size={10} />Insert</button>
				<button onClick={copy} className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-connexio-bg-secondary text-[10px] text-connexio-text-muted" type="button">{copied ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}{copied ? "Copied" : "Copy"}</button>
			</div>
		</div>
		<pre className="text-[11px] p-2 overflow-x-auto text-connexio-text"><code>{code}</code></pre>
	</div>;
}

function inlineMd(text: string) {
	return text.split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g).map((p, i) => {
		if (p.startsWith("`") && p.endsWith("`")) return <code key={i} className="px-1 py-0.5 bg-connexio-bg-tertiary rounded text-connexio-accent text-[11px]">{p.slice(1, -1)}</code>;
		if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
		const link = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
		if (link) return <a key={i} href={link[2]} target="_blank" rel="noreferrer" className="text-connexio-accent hover:underline">{link[1]}</a>;
		return <span key={i}>{p}</span>;
	});
}

function Markdown({ content, onRun, onInsert }: { content: string; onRun: (cmd: string) => void; onInsert: (code: string) => void }) {
	return <>{content.split(/(```[\s\S]*?```)/g).map((part, i) => {
		if (part.startsWith("```") && part.endsWith("```")) {
			const lines = part.slice(3, -3).replace(/^\n/, "").split("\n");
			const first = lines[0]?.trim() || "";
			const hasLang = /^[a-zA-Z0-9_+.-]+$/.test(first) && lines.length > 1;
			return <CodeBlock key={i} lang={hasLang ? first : ""} code={(hasLang ? lines.slice(1) : lines).join("\n")} onRun={onRun} onInsert={onInsert} />;
		}
		return part.split("\n").map((line, j) => {
			if (!line.trim()) return <br key={`${i}-${j}`} />;
			if (line.startsWith("# ")) return <h1 key={`${i}-${j}`} className="mt-2 text-[15px] font-bold">{inlineMd(line.slice(2))}</h1>;
			if (line.startsWith("## ")) return <h2 key={`${i}-${j}`} className="mt-2 text-[14px] font-semibold">{inlineMd(line.slice(3))}</h2>;
			if (line.startsWith("### ")) return <h3 key={`${i}-${j}`} className="mt-2 text-[13px] font-semibold">{inlineMd(line.slice(4))}</h3>;
			if (/^[-*]\s+/.test(line)) return <div key={`${i}-${j}`} className="pl-3">• {inlineMd(line.replace(/^[-*]\s+/, ""))}</div>;
			return <div key={`${i}-${j}`}>{inlineMd(line)}</div>;
		});
	})}</>;
}

function MessageBubble({ message, onRun, onInsert }: { message: AIMessage; onRun: (cmd: string) => void; onInsert: (code: string) => void }) {
	const isUser = message.role === "user";
	const [copied, setCopied] = useState(false);
	const copy = () => navigator.clipboard.writeText(message.content).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); }).catch(() => {});
	return <div className={`flex gap-2 px-3 py-2 ${isUser ? "" : "bg-connexio-bg-secondary/50"}`}>
		<div className="flex-shrink-0 mt-0.5">{isUser ? <div className="w-5 h-5 rounded bg-connexio-accent/20 flex items-center justify-center"><span className="text-[9px] font-bold text-connexio-accent">U</span></div> : <div className="w-5 h-5 rounded bg-blue-500/20 flex items-center justify-center"><Bot size={11} className="text-blue-400" /></div>}</div>
		<div className="flex-1 min-w-0">
			{message.context && <div className="flex gap-1 mb-1 text-[9px] text-connexio-text-muted">{message.context.file && <span className="px-1 rounded bg-connexio-bg-tertiary">file context</span>}{message.context.terminal && <span className="px-1 rounded bg-connexio-bg-tertiary">terminal context</span>}</div>}
			<div className="text-[12px] text-connexio-text leading-relaxed break-words">{message.isStreaming && !message.content ? <span className="text-connexio-text-muted animate-pulse">Thinking...</span> : <Markdown content={message.content} onRun={onRun} onInsert={onInsert} />}{message.isStreaming && message.content && <span className="inline-block w-1.5 h-3 ml-0.5 bg-connexio-accent animate-pulse" />}</div>
			{message.content && !message.isStreaming && <button onClick={copy} className="mt-1 flex items-center gap-1 p-0.5 rounded hover:bg-connexio-bg-tertiary text-[10px] text-connexio-text-muted" type="button">{copied ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}{copied ? "Copied" : "Copy"}</button>}
		</div>
	</div>;
}

function findActiveFilePath(): string | null {
	const { activeProjectId, workspaceTabs, activeTabIds } = useProjectStore.getState();
	if (!activeProjectId) return null;
	const tab = (workspaceTabs[activeProjectId] || []).find((t) => t.id === activeTabIds[activeProjectId]);
	if (!tab) return null;
	if (tab.type === "editor" && tab.filePath) return tab.filePath;
	if (tab.splitLayout) {
		const walk = (n: any): any => n.id === tab.splitLayout?.activePaneId ? n : n.children?.map(walk).find(Boolean);
		const pane = walk(tab.splitLayout.root);
		if (pane?.kind === "editor") return pane.filePath;
	}
	return null;
}

function findActiveTerminalId(): string | null {
	const { activeProjectId, workspaceTabs, activeTabIds } = useProjectStore.getState();
	if (!activeProjectId) return null;
	const tab = (workspaceTabs[activeProjectId] || []).find((t: any) => t.id === activeTabIds[activeProjectId]);
	if (tab?.terminalId) return tab.terminalId;
	return null;
}

export default function AIChatPanel() {
	const { messages, isLoading, sendMessage, stopStreaming, clearMessages, config, setActiveProvider, saveChatSession, loadChatSession, deleteChatSession, getChatSessionsForProject, newChat } = useAIStore();
	const { activeProjectId } = useProjectStore();
	const [input, setInput] = useState("");
	const [showSettings, setShowSettings] = useState(false);
	const [showHistory, setShowHistory] = useState(false);
	const [includeFile, setIncludeFile] = useState(true);
	const [includeTerminal, setIncludeTerminal] = useState(false);
	const endRef = useRef<HTMLDivElement>(null);
	const activeProvider = config.providers.find((p) => p.id === config.activeProviderId);
	const sessions = activeProjectId ? getChatSessionsForProject(activeProjectId) : [];

	useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
	useEffect(() => { if (activeProjectId && messages.length > 0 && !isLoading) saveChatSession(activeProjectId); }, [activeProjectId, messages.length, isLoading, saveChatSession]);

	const send = async () => {
		const trimmed = input.trim();
		if (!trimmed || isLoading) return;
		setInput("");
		const context: { file?: string; terminal?: string } = {};
		if (includeFile) {
			const filePath = findActiveFilePath();
			if (filePath) {
				try { context.file = `${filePath}\n\n${(await invoke<string>("explorer_read_file", { filePath })).slice(0, 12000)}`; } catch {}
			}
		}
		if (includeTerminal) {
			const terminalId = findActiveTerminalId();
			if (terminalId) context.terminal = `Active terminal id: ${terminalId}`;
		}
		sendMessage(trimmed, context);
	};

	const runCommand = (cmd: string) => { const terminalId = findActiveTerminalId(); if (terminalId) window.connexio.terminal.write(terminalId, `${cmd.trim()}\r`); };
	const insertCode = (code: string) => window.dispatchEvent(new CustomEvent("connexio:editor-insert-text", { detail: { filePath: findActiveFilePath(), text: code } }));

	if (showSettings) return <AISettingsPanel onBack={() => setShowSettings(false)} />;

	return <div className="flex flex-col h-full">
		<div className="flex items-center justify-between px-3 py-2 border-b border-connexio-border">
			<div className="flex items-center gap-1.5 min-w-0"><Bot size={12} className="text-connexio-accent flex-shrink-0" /><span className="text-[10px] font-semibold uppercase tracking-wider text-connexio-text-muted">AI Chat</span><select value={config.activeProviderId} onChange={(e) => setActiveProvider(e.target.value)} className="max-w-[90px] text-[9px] px-1 py-0.5 bg-connexio-bg-tertiary border border-connexio-border rounded text-connexio-text outline-none">{config.providers.filter((p) => p.enabled).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select><select value={config.activeModel} onChange={(e) => setActiveProvider(config.activeProviderId, e.target.value)} className="max-w-[110px] text-[9px] px-1 py-0.5 bg-connexio-bg-tertiary border border-connexio-border rounded text-connexio-text outline-none">{(activeProvider?.models || [config.activeModel]).map((m) => <option key={m} value={m}>{m.split("/").pop()}</option>)}</select></div>
			<div className="flex items-center gap-0.5"><button onClick={() => setShowHistory(!showHistory)} className="p-1 rounded hover:bg-connexio-bg-tertiary" title="History" type="button"><History size={11} className="text-connexio-text-muted" /></button><button onClick={newChat} className="p-1 rounded hover:bg-connexio-bg-tertiary" title="New chat" type="button"><Plus size={11} className="text-connexio-text-muted" /></button><button onClick={clearMessages} className="p-1 rounded hover:bg-connexio-bg-tertiary" title="Clear" type="button"><Trash2 size={11} className="text-connexio-text-muted" /></button><button onClick={() => setShowSettings(true)} className="p-1 rounded hover:bg-connexio-bg-tertiary" title="Settings" type="button"><Settings size={11} className="text-connexio-text-muted" /></button></div>
		</div>
		{showHistory && <div className="border-b border-connexio-border max-h-36 overflow-y-auto bg-connexio-bg-secondary/70">{sessions.length === 0 ? <div className="px-3 py-2 text-[11px] text-connexio-text-muted">No saved chats</div> : sessions.slice().reverse().map((s) => <div key={s.id} className="flex items-center gap-1 px-2 py-1 hover:bg-connexio-bg-tertiary"><button onClick={() => { loadChatSession(s.id); setShowHistory(false); }} className="flex-1 text-left text-[11px] text-connexio-text truncate" type="button">{s.title}</button><button onClick={() => deleteChatSession(s.id)} className="p-0.5 rounded hover:bg-red-500/10" type="button"><X size={10} className="text-red-400" /></button></div>)}</div>}
		<div className="flex-1 overflow-y-auto">{messages.length === 0 ? <div className="flex flex-col items-center justify-center h-full text-center px-4"><Bot size={24} className="text-connexio-text-muted mb-2" /><p className="text-[11px] text-connexio-text-muted">Ask about your project, active file, terminal commands, or debugging issues.</p></div> : <>{messages.map((msg) => <MessageBubble key={msg.id} message={msg} onRun={runCommand} onInsert={insertCode} />)}<div ref={endRef} /></>}</div>
		<div className="border-t border-connexio-border p-2"><div className="flex items-center gap-2 mb-1.5 text-[10px] text-connexio-text-muted"><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={includeFile} onChange={(e) => setIncludeFile(e.target.checked)} className="w-3 h-3" />Active file</label><label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={includeTerminal} onChange={(e) => setIncludeTerminal(e.target.checked)} className="w-3 h-3" />Terminal</label></div><div className="flex items-end gap-1.5 bg-connexio-bg-tertiary rounded-lg px-2 py-1.5"><textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Ask AI..." rows={1} className="flex-1 bg-transparent text-[12px] text-connexio-text placeholder:text-connexio-text-muted outline-none resize-none max-h-[100px]" />{isLoading ? <button onClick={stopStreaming} className="p-1 rounded hover:bg-red-500/20" type="button"><Square size={12} className="text-red-400" /></button> : <button onClick={send} disabled={!input.trim()} className="p-1 rounded hover:bg-connexio-accent/20 disabled:opacity-30" type="button"><Send size={12} className="text-connexio-accent" /></button>}</div></div>
	</div>;
}

function AISettingsPanel({ onBack }: { onBack: () => void }) {
	const { config, setConfig, updateProvider, addProvider, removeProvider, setActiveProvider } = useAIStore();
	const [selectedId, setSelectedId] = useState(config.activeProviderId);
	const selected = config.providers.find((p) => p.id === selectedId) || config.providers[0];
	const [modelInput, setModelInput] = useState("");
	const providerTypes: AIProviderType[] = ["openai", "anthropic", "google", "groq", "deepseek", "openrouter", "local"];
	const addCustom = () => { const id = `custom-${Date.now()}`; addProvider({ id, type: "local", name: "Custom Provider", apiKey: "", baseUrl: "http://localhost:1234/v1", models: ["default"], defaultModel: "default", enabled: true }); setSelectedId(id); };
	const update = (updates: Partial<AIProviderConfig>) => updateProvider(selected.id, updates);
	return <div className="flex flex-col h-full"><div className="flex items-center gap-2 px-3 py-2 border-b border-connexio-border"><button onClick={onBack} className="text-[11px] text-connexio-accent hover:underline" type="button">← Back</button><span className="text-[10px] font-semibold uppercase tracking-wider text-connexio-text-muted">AI Settings</span></div><div className="flex-1 overflow-y-auto p-3 space-y-4">
		<div><div className="flex items-center justify-between mb-1"><label className="text-[10px] font-medium text-connexio-text-secondary">Providers</label><button onClick={addCustom} className="flex items-center gap-1 text-[10px] text-connexio-accent hover:underline" type="button"><Plus size={10} />Add</button></div><select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="w-full text-[11px] px-2 py-1.5 bg-connexio-bg-tertiary border border-connexio-border rounded text-connexio-text outline-none">{config.providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
		{selected && <div className="space-y-3 rounded border border-connexio-border p-2 bg-connexio-bg-secondary/40"><div><label className="text-[10px] text-connexio-text-secondary">Name</label><input value={selected.name} onChange={(e) => update({ name: e.target.value })} className="w-full mt-1 text-[11px] px-2 py-1.5 bg-connexio-bg-tertiary border border-connexio-border rounded text-connexio-text outline-none" /></div><div><label className="text-[10px] text-connexio-text-secondary">Type</label><select value={selected.type} onChange={(e) => update({ type: e.target.value as AIProviderType })} className="w-full mt-1 text-[11px] px-2 py-1.5 bg-connexio-bg-tertiary border border-connexio-border rounded text-connexio-text outline-none">{providerTypes.map((t) => <option key={t} value={t}>{t}</option>)}</select></div><div><label className="text-[10px] text-connexio-text-secondary">API Key</label><input type="password" value={selected.apiKey} onChange={(e) => update({ apiKey: e.target.value })} placeholder="sk-..." className="w-full mt-1 text-[11px] px-2 py-1.5 bg-connexio-bg-tertiary border border-connexio-border rounded text-connexio-text outline-none" /></div><div><label className="text-[10px] text-connexio-text-secondary">Base URL</label><input value={selected.baseUrl || ""} onChange={(e) => update({ baseUrl: e.target.value })} placeholder="Optional / local endpoint" className="w-full mt-1 text-[11px] px-2 py-1.5 bg-connexio-bg-tertiary border border-connexio-border rounded text-connexio-text outline-none" /></div><div><label className="text-[10px] text-connexio-text-secondary">Models</label><div className="mt-1 space-y-1">{selected.models.map((m) => <div key={m} className="flex items-center gap-1"><button onClick={() => { update({ defaultModel: m }); if (config.activeProviderId === selected.id) setActiveProvider(selected.id, m); }} className={`flex-1 text-left text-[11px] px-2 py-1 rounded ${selected.defaultModel === m ? "bg-connexio-accent/10 text-connexio-accent" : "bg-connexio-bg-tertiary text-connexio-text"}`} type="button">{m}</button><button onClick={() => update({ models: selected.models.filter((x) => x !== m) })} type="button"><X size={10} className="text-red-400" /></button></div>)}</div><div className="flex gap-1 mt-1"><input value={modelInput} onChange={(e) => setModelInput(e.target.value)} placeholder="model-name" className="flex-1 text-[11px] px-2 py-1 bg-connexio-bg-tertiary border border-connexio-border rounded text-connexio-text outline-none" /><button onClick={() => { if (modelInput.trim()) { update({ models: [...selected.models, modelInput.trim()], defaultModel: selected.defaultModel || modelInput.trim() }); setModelInput(""); } }} className="px-2 text-[10px] rounded bg-connexio-accent/10 text-connexio-accent" type="button">Add</button></div></div><label className="flex items-center gap-2 text-[11px] text-connexio-text-secondary"><input type="checkbox" checked={selected.enabled} onChange={(e) => update({ enabled: e.target.checked })} />Enabled</label><button onClick={() => { setActiveProvider(selected.id); onBack(); }} className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] rounded bg-connexio-accent/10 text-connexio-accent hover:bg-connexio-accent/20" type="button"><Save size={10} />Use This Provider</button>{selected.id.startsWith("custom-") && <button onClick={() => { removeProvider(selected.id); setSelectedId(config.providers[0]?.id || ""); }} className="w-full px-2 py-1 text-[11px] rounded text-red-400 hover:bg-red-500/10" type="button">Delete Provider</button>}</div>}
		<div><label className="text-[10px] font-medium text-connexio-text-secondary mb-1 block">System Prompt</label><textarea value={config.systemPrompt} onChange={(e) => setConfig({ systemPrompt: e.target.value })} rows={5} className="w-full text-[11px] px-2 py-1.5 bg-connexio-bg-tertiary border border-connexio-border rounded text-connexio-text outline-none resize-none" /></div><label className="flex items-center gap-2 text-[11px] text-connexio-text-secondary"><input type="checkbox" checked={config.streamingEnabled} onChange={(e) => setConfig({ streamingEnabled: e.target.checked })} />Enable streaming response</label>
	</div></div>;
}
