import { useState } from "react";
import SettingsCard from "../../core/ui/SettingsCard";
import { getStartupMetrics } from "../../core/instrumentation/startup-metrics";
import type { StartupMetrics } from "../../core/instrumentation/startup-metrics";
import PerformanceStatsTable from "./PerformanceStatsTable";

/**
 * Performance panel — startup phase metrics, terminal spawn stats, and first-output latency.
 * Relocated from About settings to improve discoverability and separation of concerns.
 */
export default function PerformanceSettings() {
	const [metrics, setMetrics] = useState<StartupMetrics>(() => getStartupMetrics());

	// Manual refresh button for user-initiated re-measurement
	const handleRefresh = () => setMetrics(getStartupMetrics());

	return (
		<SettingsCard
			title="Performance"
			description="Startup phases, spawn timing, and output latency metrics."
		>
			<div className="flex items-center justify-between py-3">
				<p className="text-[11px] text-connexio-text-muted max-w-xs">
					Shows measured startup duration and per-terminal performance statistics since the last
					restart.
				</p>
				<button
					onClick={handleRefresh}
					type="button"
					className="rounded-lg bg-white/[0.035] px-3 py-1.5 text-xs font-medium text-connexio-text-secondary transition-colors hover:bg-white/[0.055] hover:text-connexio-accent"
				>
					Refresh Metrics
				</button>
			</div>
			<PerformanceStatsTable metrics={metrics} />
		</SettingsCard>
	);
}
