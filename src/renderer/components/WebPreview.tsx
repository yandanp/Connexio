import { ExternalLink, Globe, RefreshCw, X } from "lucide-react";
import { useState } from "react";

interface Props {
	onClose: () => void;
}

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

export default function WebPreview({ onClose }: Props) {
	const [url, setUrl] = useState("http://localhost:3000");
	const [inputUrl, setInputUrl] = useState("http://localhost:3000");
	const [key, setKey] = useState(0); // Force iframe reload

	const handleNavigate = (e?: React.FormEvent) => {
		e?.preventDefault();
		let target = inputUrl.trim();
		if (!target.startsWith("http://") && !target.startsWith("https://")) {
			target = `http://${target}`;
		}
		setUrl(target);
		setInputUrl(target);
	};

	const handleRefresh = () => {
		setKey((k) => k + 1);
	};

	const handleQuickPort = (port: number) => {
		const newUrl = `http://localhost:${port}`;
		setUrl(newUrl);
		setInputUrl(newUrl);
		setKey((k) => k + 1);
	};

	return (
		<div className="flex flex-col h-full">
			{/* Header */}
			<div className="flex items-center gap-2 px-2 py-1.5 border-b border-connexio-border bg-connexio-bg-secondary">
				<Globe size={12} className="text-connexio-accent flex-shrink-0" />

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
					onClick={handleRefresh}
					className="p-1 rounded hover:bg-connexio-bg-tertiary transition-colors"
					title="Refresh"
					type="button"
				>
					<RefreshCw size={11} className="text-connexio-text-muted" />
				</button>
				<button
					onClick={() => window.open(url, "_blank")}
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
				{COMMON_PORTS.map(({ port, label }) => (
					<button
						key={port}
						onClick={() => handleQuickPort(port)}
						className={`text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap transition-colors ${
							url.includes(`:${port}`)
								? "bg-connexio-accent/10 text-connexio-accent border border-connexio-accent/30"
								: "text-connexio-text-muted hover:bg-connexio-bg-tertiary border border-transparent"
						}`}
						type="button"
					>
						:{port}
					</button>
				))}
			</div>

			{/* Preview iframe */}
			<div className="flex-1 bg-white">
				<iframe
					key={key}
					src={url}
					className="w-full h-full border-none"
					title="Web Preview"
					sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
				/>
			</div>
		</div>
	);
}
