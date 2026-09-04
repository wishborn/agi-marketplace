import { describe, it, expect } from "vitest";
import { testActivate } from "@agi/sdk/testing";
import plugin from "./index.js";

describe("Python runtime plugin", () => {
  it("registers 3 runtimes (3.13, 3.12, 3.11)", async () => {
    const reg = await testActivate(plugin);
    expect(reg.runtimes).toHaveLength(3);
    const versions = reg.runtimes.map((r) => r.version);
    expect(versions).toContain("3.13");
    expect(versions).toContain("3.12");
    expect(versions).toContain("3.11");
  });

  it("uses GHCR python images", async () => {
    const reg = await testActivate(plugin);
    for (const rt of reg.runtimes) {
      expect(rt.containerImage).toMatch(/^ghcr\.io\/civicognita\/python:\d+\.\d+$/);
    }
  });

  it("all runtimes listen on port 8000", async () => {
    const reg = await testActivate(plugin);
    for (const rt of reg.runtimes) {
      expect(rt.internalPort).toBe(8000);
    }
  });
});
