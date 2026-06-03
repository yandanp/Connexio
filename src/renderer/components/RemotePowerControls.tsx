import { Lock, Moon } from "lucide-react";
import { useState } from "react";

export default function RemotePowerControls() {
	const [busy, setBusy] = useState<"lock" | "sleep" | null>(null);

	if (!(window as any).__CONNEXIO_REMOTE__) return null;

	const run = async (action: "lock" | "sleep") => {
		const label = action === "lock" ? "lock this PC" : "put this PC to sleep";
		if (!window.confirm(`Are you sure you want to ${label}?`)) return;
		setBusy(action);
		try {
			if (action === "lock") {
				await ((window as any).connexio.remote as any).lockHost();
			} else {
				await ((window as any).connexio.remote as any).sleepHost();
			}
		} catch (err: any) {
			window.alert(err?.message || `Failed to ${action} host`);
		} finally {
			setBusy(null);
		}
	};

	return (
		<div className="flex items-center gap-1">
			<button
				onClick={() => run("lock")}
				disabled={busy !== null}
				className="flex items-center gap-1 rounded border border-connexio-border bg-connexio-bg-tertiary px-2 py-0.5 text-[10px] text-connexio-text-muted hover:text-connexio-text-secondary disabled:opacity-50"
				title="Lock host PC"
				type="button"
			>
				<Lock size={11} />
				Lock
			</button>
			<button
				onClick={() => run("sleep")}
				disabled={busy !== null}
				className="flex items-center gap-1 rounded border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 text-[10px] text-yellow-400 disabled:opacity-50"
				title="Sleep host PC"
				type="button"
			>
				<Moon size={11} />
				Sleep
			</button>
		</div>
	);
}
