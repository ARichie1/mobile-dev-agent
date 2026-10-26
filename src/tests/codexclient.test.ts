
import { describe, expect, it } from "vitest";
import { CodexClient } from "../codex/CodexClient.js";

describe("CodexClient", () => {
  it("returns the installed Codex version", async () => {
    const client = new CodexClient();

    const version = await client.getVersion();

    expect(version).toMatch(/^codex-cli \d+\.\d+\.\d+$/);
  });
});