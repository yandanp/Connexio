import type { StartupMetrics, Stats } from "../../core/instrumentation/startup-metrics";

interface Props {
	metrics: StartupMetrics;
}

function formatDuration(value: number | null): string {
	return value === null ? "—" : `${value.toFixed(1)} ms`;
}

function AggregateRow({ label, stats }: { label: string; stats: Stats }) {
	return (
		<tr className="soft-separator-top">
			<th className="py-1.5 text-left text-[11px] font-medium text-connexio-text-secondary">
				{label}
			</th>
			<td className="py-1.5 text-right font-mono text-[10px] text-connexio-text">
				{stats.count ? formatDuration(stats.min) : "—"}
			</td>
			<td className="py-1.5 text-right font-mono text-[10px] text-connexio-text">
				{stats.count ? formatDuration(stats.median) : "—"}
			</td>
			<td className="py-1.5 text-right font-mono text-[10px] text-connexio-text">
				{stats.count ? formatDuration(stats.max) : "—"}
			</td>
			<td className="py-1.5 text-right font-mono text-[10px] text-connexio-text-muted">
				{stats.count} samples
			</td>
		</tr>
	);
}

export default function PerformanceStatsTable({ metrics }: Props) {
	return (
		<section className="soft-separator-top space-y-3 pt-4" aria-label="Performance">
			<h3 className="section-label">Performance</h3>
			<div className="soft-card overflow-hidden p-3">
				<p className="mb-2 text-[11px] font-medium text-connexio-text-secondary">Startup phases</p>
				{metrics.phases.length ? (
					<ul className="space-y-1" aria-label="Startup phase timings">
						{metrics.phases.map((phase) => (
							<li key={phase.name} className="flex items-center justify-between gap-3 text-[10px]">
								<span className="text-connexio-text-secondary">{phase.name}</span>
								<span className="font-mono text-connexio-text">
									{formatDuration(phase.duration)}
								</span>
							</li>
						))}
					</ul>
				) : (
					<p className="text-[10px] text-connexio-text-muted">No startup phases recorded yet.</p>
				)}
			</div>
			<div className="soft-card overflow-x-auto p-3">
				<table className="w-full border-collapse" aria-label="Terminal startup timing aggregates">
					<thead>
						<tr className="text-[9px] uppercase tracking-wide text-connexio-text-muted">
							<th className="pb-1 text-left font-medium">Metric</th>
							<th className="pb-1 text-right font-medium">Min</th>
							<th className="pb-1 text-right font-medium">Median</th>
							<th className="pb-1 text-right font-medium">Max</th>
							<th className="pb-1 text-right font-medium">Samples</th>
						</tr>
					</thead>
					<tbody>
						<AggregateRow label="Spawn" stats={metrics.spawnStats} />
						<AggregateRow label="First output" stats={metrics.outputStats} />
					</tbody>
				</table>
			</div>
			<div className="flex items-center justify-between rounded-lg bg-connexio-bg-tertiary px-3 py-2">
				<span className="text-[10px] text-connexio-text-secondary">First terminal ready</span>
				<span className="font-mono text-[10px] text-connexio-accent">
					{formatDuration(metrics.firstTerminalReadyAt)}
				</span>
			</div>
		</section>
	);
}
