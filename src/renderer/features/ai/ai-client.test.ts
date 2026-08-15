import { expect, it, vi } from "vitest";
import { readSSEStream } from "./ai-client";

it("readSSEStream emits each data frame", async () => {
	const res = new Response("data: hello\n\ndata: world\n\n");
	const onData = vi.fn();
	await readSSEStream(res, new AbortController().signal, onData);
	expect(onData.mock.calls.map((c) => c[0])).toEqual(["hello", "world"]);
});
