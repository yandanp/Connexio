import { useState, useEffect } from "react";
import { isRemoteMode } from "../lib/tauri-shim";
import { authenticate, isAuthenticated, logout, getInitData } from "../lib/remote-api";

/**
 * Remote login gate — wraps the app and shows a PIN login screen
 * when accessed from a browser in remote mode.
 */
export default function RemoteLoginGate({
	children,
}: { children: React.ReactNode }) {
	const [authed, setAuthed] = useState(isAuthenticated());
	const [pin, setPin] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	// If not remote mode, just render children
	if (!isRemoteMode()) {
		return <>{children}</>;
	}

	// Re-check auth on mount (token might be in sessionStorage)
	useEffect(() => {
		setAuthed(isAuthenticated());
	}, []);

	const handleLogin = async () => {
		if (pin.length !== 6) return;
		setLoading(true);
		setError("");
		try {
			await authenticate(pin);
			// Pre-fetch all init data before showing the app
			await getInitData();
			setAuthed(true);
		} catch (err: any) {
			setError(err.message || "Authentication failed");
			setPin("");
		} finally {
			setLoading(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") handleLogin();
	};

	if (authed) {
		return <>{children}</>;
	}

	return (
		<div className="flex flex-col items-center justify-center min-h-screen bg-connexio-bg p-6 gap-6">
			<div className="text-center">
				<h1 className="text-2xl font-bold text-connexio-text">
					Connexio <span className="text-connexio-accent">Remote</span>
				</h1>
				<p className="text-sm text-connexio-text-secondary mt-2">
					Enter the PIN shown on your desktop app
				</p>
			</div>

			<div className="flex flex-col items-center gap-4 w-full max-w-xs">
				<input
					type="tel"
					maxLength={6}
					value={pin}
					onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
					onKeyDown={handleKeyDown}
					placeholder="000000"
					className="w-full text-center text-2xl font-mono font-bold tracking-[0.5em] px-4 py-3 bg-connexio-bg-secondary border border-connexio-border rounded-lg text-connexio-text placeholder:text-connexio-text-secondary/30 focus:outline-none focus:border-connexio-accent"
					autoFocus
					inputMode="numeric"
					autoComplete="off"
				/>

				<button
					onClick={handleLogin}
					disabled={pin.length !== 6 || loading}
					className="w-full py-3 bg-connexio-accent text-white font-semibold rounded-lg hover:bg-connexio-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					type="button"
				>
					{loading ? "Connecting..." : "Connect"}
				</button>

				{error && (
					<p className="text-xs text-red-400 text-center">{error}</p>
				)}
			</div>
		</div>
	);
}
