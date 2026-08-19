import { registerSpawnComplete, setSpawnStart } from "../../core/instrumentation/startup-metrics";
import { runWithSpawnLimit } from "./spawn-pool";

type SpawnResult = { terminalId: string } | { error: unknown };

/** Records a terminal creation under the terminal ID returned by the backend. */
export async function createTerminalWithTiming(
	createTerminal: () => Promise<string>,
): Promise<string> {
	const startedAt = performance.now();
	const terminalId = await createTerminal();
	setSpawnStart(terminalId, startedAt);
	registerSpawnComplete(terminalId);
	return terminalId;
}

/** Routes one terminal creation through the global pool and records its timings. */
export async function createTerminalWithLimit(
	createTerminal: () => Promise<string>,
): Promise<string> {
	const [result] = await runWithSpawnLimit<SpawnResult>([
		async () => {
			try {
				return { terminalId: await createTerminalWithTiming(createTerminal) };
			} catch (error) {
				return { error };
			}
		},
	]);
	if (!result || "error" in result) throw result?.error;
	return result.terminalId;
}
