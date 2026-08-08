import {
	ExternalLink,
	Globe,
	Monitor,
	RefreshCw,
	RotateCcw,
	Smartphone,
	Tablet,
	X,
} from "lucide-react";
import { explorer } from "../../core/api/explorer";
import { type FormEvent, useEffect, useMemo, useState } from "react";

interface Props {
	onClose: () => void;
	initialUrl?: string;
	projectPath?: string;
	onUrlChange?: (url: string) => void;
}

const DEFAULT_URL = "http://localhost:3000";

const COMMON_PORTS = [
	{ port: 3000, label: "React/Next.js" },
	{ port: 3001, label: "Alt 3001" },
	{ port: 4200, label: "Angular" },
	{ port: 5173, label: "Vite" },
	{ port: 5174, label: "Vite Alt" },
	{ port: 8000, label: "Django/FastAPI" },
	{ port: 8080, label: "Generic" },
	{ port: 8888, label: "Jupyter" },
];

const VIEWPORTS = [
	{ id: "desktop", label: "Desktop", width: "100%", height: "100%", icon: Monitor },
	{ id: "laptop", label: "Laptop", width: "1280px", height: "100%", icon: Monitor },
	{ id: "tablet", label: "Tablet", width: "820px", height: "1180px", icon: Tablet },
	{ id: "mobile", label: "Mobile", width: "390px", height: "844px", icon: Smartphone },
] as const;

const STORAGE_KEY = "connexio.preview.recentUrls";
const IFRAME_BLOCK_TIMEOUT = 6000;

type ViewportId = (typeof VIEWPORTS)[number]["id"];

function isLocalPreviewTarget(target: string) {
	return /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d+)?(?:\/|$)/i.test(target);
}

function normalizeUrl(value: string) {
	const target = value.trim();
	if (!target) return DEFAULT_URL;
	if (/^https?:\/\//i.test(target)) return target;
	return `${isLocalPreviewTarget(target) ? "http" : "https"}://${target}`;
}

async function openExternalUrl(targetUrl: string) {
	try {
		await explorer.openPath(targetUrl);
	} catch (error) {
		console.error("[Connexio] Failed to open external URL:", error);
	}
}

export default function WebPreview({
	onClose,
	initialUrl = DEFAULT_URL,
	projectPath,
	onUrlChange,
}: Props) {
	const normalizedInitialUrl = useMemo(() => normalizeUrl(initialUrl), [initialUrl]);
	const [url, setUrl] = useState(normalizedInitialUrl);
	const [inputUrl, setInputUrl] = useState(normalizedInitialUrl);
	const [key, setKey] = useState(0); // Force iframe reload
	const [isLoading, setIsLoading] = useState(true);
	const [loadFailed, setLoadFailed] = useState(false);
	const [viewport, setViewport] = useState<ViewportId>("desktop");
	const [isLandscape, setIsLandscape] = useState(false);
	const [showDualPreview, setShowDualPreview] = useState(false);
	const [recentUrls, setRecentUrls] = useState<string[]>([]);
	const [history, setHistory] = useState<string[]>([normalizedInitialUrl]);
	const [historyIndex, setHistoryIndex] = useState(0);
	const [detectedPorts, setDetectedPorts] = useState<number[]>([]);
	const [suggestedCommand, setSuggestedCommand] = useState<string | null>(null);
	const [showBlockedHint, setShowBlockedHint] = useState(false);

	const selectedViewport = VIEWPORTS.find((item) => item.id === viewport) ?? VIEWPORTS[0];

	const rememberUrl = (nextUrl: string) => {
		const nextRecent = [nextUrl, ...recentUrls.filter((item) => item !== nextUrl)].slice(0, 8);
		setRecentUrls(nextRecent);
		localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRecent));
	};

	const navigateTo = (nextUrl: string, addToHistory = true) => {
		setUrl(nextUrl);
		setInputUrl(nextUrl);
		setIsLoading(true);
		setLoadFailed(false);
		setShowBlockedHint(false);
		setKey((k) => k + 1);
		onUrlChange?.(nextUrl);
		rememberUrl(nextUrl);
		if (addToHistory) {
			const nextHistory = [...history.slice(0, historyIndex + 1), nextUrl];
			setHistory(nextHistory);
			setHistoryIndex(nextHistory.length - 1);
		}
	};

	const handleNavigate = (e?: FormEvent) => {
		e?.preventDefault();
		navigateTo(normalizeUrl(inputUrl));
	};

	const handleRefresh = () => {
		setIsLoading(true);
		setLoadFailed(false);
		setShowBlockedHint(false);
		setKey((k) => k + 1);
	};

	const handleHardRefresh = () => {
		const separator = url.includes("?") ? "&" : "?";
		navigateTo(`${url}${separator}connexioReload=${Date.now()}`);
	};

	const goHistory = (direction: -1 | 1) => {
		const nextIndex = historyIndex + direction;
		const nextUrl = history[nextIndex];
		if (!nextUrl) return;
		setHistoryIndex(nextIndex);
		navigateTo(nextUrl, false);
	};

	const handleQuickPort = (port: number) => {
		navigateTo(`http://localhost:${port}`);
	};

	const isPublicUrl = !/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])/i.test(url);
	const frameWidth =
		isLandscape && viewport !== "desktop" ? selectedViewport.height : selectedViewport.width;
	const frameHeight =
		isLandscape && viewport !== "desktop" ? selectedViewport.width : selectedViewport.height;

	useEffect(() => {
		try {
			const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
			if (Array.isArray(saved)) setRecentUrls(saved.filter((item) => typeof item === "string"));
		} catch {
			setRecentUrls([]);
		}
	}, []);

	useEffect(() => {
		const timeout = window.setTimeout(() => {
			if (isLoading && isPublicUrl) setShowBlockedHint(true);
		}, IFRAME_BLOCK_TIMEOUT);
		return () => window.clearTimeout(timeout);
	}, [isLoading, isPublicUrl]);

	useEffect(() => {
		const controllers: AbortController[] = [];
		for (const { port } of COMMON_PORTS) {
			const controller = new AbortController();
			controllers.push(controller);
			const timeout = window.setTimeout(() => controller.abort(), 900);
			fetch(`http://localhost:${port}`, { mode: "no-cors", signal: controller.signal })
				.then(() => setDetectedPorts((ports) => (ports.includes(port) ? ports : [...ports, port])))
				.catch(() => undefined)
				.finally(() => window.clearTimeout(timeout));
		}
		return () => controllers.forEach((controller) => controller.abort());
	}, []);

	useEffect(() => {
		if (!projectPath || !loadFailed) return;
		window.connexio.tasks
			.detect(projectPath)
			.then((tasks) => {
				const devTask =
					tasks.find((task) => /^(dev|start|serve)$/i.test(task.name)) ??
					tasks.find((task) => /(vite|next|serve|dev)/i.test(task.command));
				if (devTask)
					setSuggestedCommand(
						devTask.command.startsWith("npm") || devTask.command.includes(" ")
							? devTask.command
							: `npm run ${devTask.name}`,
					);
			})
			.catch(() => undefined);
	}, [loadFailed, projectPath]);

	return (
		<div className="flex flex-col h-full bg-connexio-bg">
			{/* Header */}
			<div className="flex items-center gap-2 px-2 py-1.5 border-b border-connexio-border bg-connexio-bg-secondary">
				<div className="flex items-center gap-1.5 text-connexio-text-muted">
					<Globe size={12} className="text-connexio-accent flex-shrink-0" />
					<span className="hidden sm:inline text-[10px] font-medium uppercase tracking-wide">
						Preview
					</span>
				</div>

				{/* URL bar */}
				<form onSubmit={handleNavigate} className="flex-1 flex items-center">
					<input
						type="text"
						value={inputUrl}
						onChange={(e) => setInputUrl(e.target.value)}
						className="flex-1 text-[11px] px-2 py-1 bg-connexio-bg-tertiary border border-connexio-border rounded text-connexio-text outline-none focus:border-connexio-accent/50"
						placeholder="http://localhost:3000"
					/>
				</form>

				{/* Controls */}
				<button
					onClick={() => goHistory(-1)}
					disabled={historyIndex === 0}
					className="px-1 text-[11px] rounded hover:bg-connexio-bg-tertiary disabled:opacity-30"
					title="Back"
					type="button"
				>
					‹
				</button>
				<button
					onClick={() => goHistory(1)}
					disabled={historyIndex >= history.length - 1}
					className="px-1 text-[11px] rounded hover:bg-connexio-bg-tertiary disabled:opacity-30"
					title="Forward"
					type="button"
				>
					›
				</button>
				<button
					onClick={handleRefresh}
					className="p-1 rounded hover:bg-connexio-bg-tertiary transition-colors"
					title="Refresh"
					type="button"
				>
					<RefreshCw
						size={11}
						className={isLoading ? "text-connexio-accent animate-spin" : "text-connexio-text-muted"}
					/>
				</button>
				<button
					onClick={handleHardRefresh}
					className="px-1 text-[10px] rounded text-connexio-text-muted hover:bg-connexio-bg-tertiary"
					title="Hard refresh / cache bust"
					type="button"
				>
					HR
				</button>
				<button
					onClick={() => openExternalUrl(url)}
					className="p-1 rounded hover:bg-connexio-bg-tertiary transition-colors"
					title="Open in browser"
					type="button"
				>
					<ExternalLink size={11} className="text-connexio-text-muted" />
				</button>
				<button
					onClick={onClose}
					className="p-1 rounded hover:bg-connexio-bg-tertiary transition-colors"
					title="Close preview"
					type="button"
				>
					<X size={11} className="text-connexio-text-muted" />
				</button>
			</div>

			{/* Quick port buttons */}
			<div className="flex items-center gap-1 px-2 py-1 border-b border-connexio-border bg-connexio-bg-secondary/50 overflow-x-auto">
				{isPublicUrl && (
					<span className="mr-1 whitespace-nowrap rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] text-amber-300">
						Public URLs may block iframe preview
					</span>
				)}
				{COMMON_PORTS.map(({ port, label }) => (
					<button
						key={port}
						onClick={() => handleQuickPort(port)}
						className={`text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap transition-colors ${
							url.includes(`:${port}`)
								? "bg-connexio-accent/10 text-connexio-accent border border-connexio-accent/30"
								: "text-connexio-text-muted hover:bg-connexio-bg-tertiary border border-transparent"
						}`}
						title={label}
						type="button"
					>
						:{port}
					</button>
				))}
				{recentUrls.length > 0 && (
					<select
						value=""
						onChange={(e) => e.target.value && navigateTo(e.target.value)}
						className="ml-1 max-w-[150px] rounded border border-connexio-border bg-connexio-bg-tertiary px-1 py-0.5 text-[9px] text-connexio-text-muted"
						title="Recent URLs"
					>
						<option value="">Recent</option>
						{recentUrls.map((item) => (
							<option key={item} value={item}>
								{item}
							</option>
						))}
					</select>
				)}
				<div className="ml-auto flex items-center gap-1 pl-2">
					{detectedPorts.length > 0 && (
						<span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] text-emerald-300">
							Detected :{detectedPorts.join(", :")}
						</span>
					)}
					<button
						onClick={() => setShowDualPreview((value) => !value)}
						className={`px-1.5 py-0.5 rounded text-[9px] ${showDualPreview ? "bg-connexio-accent/10 text-connexio-accent" : "text-connexio-text-muted hover:bg-connexio-bg-tertiary"}`}
						type="button"
						title="Show desktop and mobile together"
					>
						Dual
					</button>
					<button
						onClick={() => setIsLandscape((value) => !value)}
						className="px-1.5 py-0.5 rounded text-[9px] text-connexio-text-muted hover:bg-connexio-bg-tertiary"
						type="button"
						title="Rotate viewport"
					>
						Rotate
					</button>
					{VIEWPORTS.map(({ id, label, icon: Icon }) => (
						<button
							key={id}
							onClick={() => setViewport(id)}
							className={`p-1 rounded transition-colors ${viewport === id ? "bg-connexio-accent/10 text-connexio-accent" : "text-connexio-text-muted hover:bg-connexio-bg-tertiary"}`}
							title={label}
							type="button"
						>
							<Icon size={11} />
						</button>
					))}
				</div>
			</div>

			{/* Preview iframe */}
			<div className="flex-1 min-h-0 bg-[radial-gradient(circle_at_top,#2a2f3d_0,#111827_42%,#0b1020_100%)] p-3 overflow-auto">
				<div
					className={
						showDualPreview
							? "grid h-full min-h-[320px] grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_390px]"
							: "h-full min-h-[320px]"
					}
				>
					<div
						className="relative mx-auto h-full min-h-[320px] overflow-hidden rounded-lg border border-connexio-border bg-white shadow-2xl transition-[width] duration-200"
						style={{ width: frameWidth, height: frameHeight, maxWidth: "100%", maxHeight: "100%" }}
					>
						{isLoading && (
							<div className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-connexio-bg-tertiary">
								<div className="h-full w-1/2 animate-pulse bg-connexio-accent" />
							</div>
						)}
						{(loadFailed || showBlockedHint) && (
							<div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-connexio-bg/95 p-4 text-center text-connexio-text">
								<Globe size={28} className="text-connexio-text-muted" />
								<div>
									<p className="text-sm font-semibold">
										{showBlockedHint ? "Site may block embedded preview" : "Preview could not load"}
									</p>
									<p className="mt-1 max-w-sm text-xs text-connexio-text-muted">
										{isPublicUrl
											? "Public sites like Google often block iframe embedding. Open externally if it stays blank."
											: "Make sure your dev server is running and allows iframe previews."}
									</p>
									{suggestedCommand && (
										<p className="mt-2 text-[11px] text-connexio-text-muted">
											Try running{" "}
											<code className="rounded bg-connexio-bg-tertiary px-1 py-0.5">
												{suggestedCommand}
											</code>
										</p>
									)}
								</div>
								<div className="flex items-center gap-2">
									<button
										onClick={handleRefresh}
										className="inline-flex items-center gap-1 rounded border border-connexio-border px-2 py-1 text-xs text-connexio-text-muted hover:bg-connexio-bg-secondary"
										type="button"
									>
										<RotateCcw size={12} /> Retry
									</button>
									<button
										onClick={() => openExternalUrl(url)}
										className="inline-flex items-center gap-1 rounded border border-connexio-accent/40 px-2 py-1 text-xs text-connexio-accent hover:bg-connexio-accent/10"
										type="button"
									>
										<ExternalLink size={12} /> Open externally
									</button>
									<button
										onClick={() => setShowBlockedHint(false)}
										className="rounded border border-connexio-border px-2 py-1 text-xs text-connexio-text-muted hover:bg-connexio-bg-secondary"
										type="button"
									>
										Continue
									</button>
								</div>
							</div>
						)}
						<iframe
							key={key}
							src={url}
							className="h-full w-full border-none"
							title="Web Preview"
							sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
							onLoad={() => setIsLoading(false)}
							onError={() => {
								setIsLoading(false);
								setLoadFailed(true);
							}}
						/>
					</div>
					{showDualPreview && (
						<div className="relative mx-auto h-full min-h-[320px] w-[390px] max-w-full overflow-hidden rounded-lg border border-connexio-border bg-white shadow-2xl">
							<iframe
								key={`mobile-${key}`}
								src={url}
								className="h-full w-full border-none"
								title="Mobile Web Preview"
								sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
							/>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
