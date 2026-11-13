import { describe, expect, it } from "vitest";

import { parseGitHubUrl } from "@/lib/github/urls";

describe("GitHub evidence URLs", () => {
  it("parses repositories, pull requests, commits and issues", () => {
    expect(parseGitHubUrl("https://github.com/near/nearcore")).toEqual({
      kind: "repository",
      owner: "near",
      repo: "nearcore",
    });
    expect(parseGitHubUrl("https://github.com/near/nearcore/pull/42/files")).toEqual({
      kind: "pull_request",
      owner: "near",
      repo: "nearcore",
      number: 42,
    });
    expect(parseGitHubUrl("https://github.com/near/nearcore/issues/7")).toMatchObject({
      kind: "issue",
      number: 7,
    });
    expect(parseGitHubUrl("https://github.com/near/nearcore/commit/ABCDEF1")).toMatchObject({
      kind: "commit",
      sha: "abcdef1",
    });
  });

  it.each([
    "http://github.com/near/nearcore",
    "https://github.com.evil.example/near/nearcore",
    "https://evil.example/github.com/near/nearcore",
    "https://user@github.com/near/nearcore",
    "https://github.com:8443/near/nearcore",
    "https://api.github.com/repos/near/nearcore",
    "https://github.com/near",
    "https://github.com/near/../../etc",
    "https://github.com/near/nearcore/pull/0",
    "https://github.com/near/nearcore/pull/abc",
    "https://github.com/near/nearcore/commit/not-a-sha",
    "not a url",
  ])("refuses %s", (value) => {
    expect(parseGitHubUrl(value)).toBeNull();
  });
});
