import { Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

type Status = "connected" | "connecting" | "reconnecting" | "disconnected";

export default function RemoteConnectionBadge() {
	const [state, setState] = useState<{ status: Status; latencyMs: number | null }>({
		status: "connected",
		latencyMs: null,
	});

	useEffect(() => {
		if (!(window as any).__CONNEXIO_REMOTE__) return;
		const unsubscribe = ((window as any).connexio.remote as any).onStatus?.(setState);
		return unsubscribe;
	}, []);

	if (!(window as any).__CONNEXIO_REMOTE__) return null;

	const connected = state.status === "connected";
	const label = connected
		? state.latencyMs != null
			? `${state.latencyMs}ms`
			: "online"
		: state.status;

	return (
		<div
			className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] ${
				connected
					? "text-green-400 border-green-500/30 bg-green-500/10"
					: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10"
			}`}
			title="Remote connection status"
		>
			{connected ? <Wifi size={11} /> : <WifiOff size={11} />}
			<span>{label}</span>
		</div>
	);
}
