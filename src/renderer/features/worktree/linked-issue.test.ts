import { describe, expect, it } from "vitest";
import { parseLinkedIssueUrl } from "./linked-issue";

describe("parseLinkedIssueUrl", () => {
	it("parses a GitHub PR url", () => {
		expect(parseLinkedIssueUrl("https://github.com/yandanp/Connexio/pull/42")).toEqual({
			kind: "github-pr",
			repo: "yandanp/Connexio",
			number: 42,
			title: null,
		});
	});

	it("parses a GitHub issue url", () => {
		expect(parseLinkedIssueUrl("https://github.com/yandanp/Connexio/issues/7")).toEqual({
			kind: "github-issue",
			repo: "yandanp/Connexio",
			number: 7,
			title: null,
		});
	});

	it("rejects non-issue urls", () => {
		expect(parseLinkedIssueUrl("https://github.com/yandanp/Connexio")).toBeNull();
	});

	it("rejects plain text", () => {
		expect(parseLinkedIssueUrl("fix login")).toBeNull();
	});
});
