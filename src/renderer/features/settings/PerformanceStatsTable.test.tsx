import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { StartupMetrics } from "../../core/instrumentation/startup-metrics";
import PerformanceStatsTable from "./PerformanceStatsTable";

const metrics: StartupMetrics = {
	phases: [
		{ name: "app-mount", duration: 12.4 },
		{ name: "projects-loaded", duration: 42.6 },
	],
	spawnStats: { min: 4.2, median: 8.8, max: 14.1, count: 3 },
	outputStats: { min: 1.6, median: 3.2, max: 6.4, count: 2 },
	firstTerminalReadyAt: 95.7,
};

describe("PerformanceStatsTable", () => {
	it("renders startup phases, aggregate timings, and first-terminal readiness", () => {
		const markup = renderToStaticMarkup(<PerformanceStatsTable metrics={metrics} />);

		expect(markup).toContain("Startup phases");
		expect(markup).toContain("<ul");
		expect(markup).toContain("app-mount");
		expect(markup).toContain("12.4 ms");
		const spawnRow = markup.match(/<tr[^>]*><th[^>]*>Spawn<\/th>(.*?)<\/tr>/)?.[1] ?? "";
		const outputRow = markup.match(/<tr[^>]*><th[^>]*>First output<\/th>(.*?)<\/tr>/)?.[1] ?? "";
		expect(spawnRow).toContain("4.2 ms");
		expect(spawnRow).toContain("8.8 ms");
		expect(spawnRow).toContain("14.1 ms");
		expect(spawnRow).toContain("3 samples");
		expect(outputRow).toContain("1.6 ms");
		expect(outputRow).toContain("3.2 ms");
		expect(outputRow).toContain("6.4 ms");
		expect(outputRow).toContain("2 samples");
		expect(markup).toContain("95.7 ms");
	});

	it("renders zero-sample aggregates and pending terminal readiness", () => {
		const markup = renderToStaticMarkup(
			<PerformanceStatsTable
				metrics={{
					phases: [],
					spawnStats: { min: 0, median: 0, max: 0, count: 0 },
					outputStats: { min: 0, median: 0, max: 0, count: 0 },
					firstTerminalReadyAt: null,
				}}
			/>,
		);

		expect(markup).toContain("No startup phases recorded yet.");
		expect(markup).toContain("—");
		expect(markup).toContain("0 samples");
	});
});
