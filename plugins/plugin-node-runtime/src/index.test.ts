import { describe, it, expect } from "vitest";
import { testActivate } from "@agi/sdk/testing";
import plugin from "./index.js";

describe("Node.js runtime plugin", () => {
  it("registers 3 runtimes (24, 22, 20)", async () => {
    const reg = await testActivate(plugin);
    expect(reg.runtimes).toHaveLength(3);
    const versions = reg.runtimes.map((r) => r.version);
    expect(versions).toContain("24");
    expect(versions).toContain("22");
    expect(versions).toContain("20");
  });

  it("uses GHCR node images", async () => {
    const reg = await testActivate(plugin);
    for (const rt of reg.runtimes) {
      expect(rt.containerImage).toMatch(/^ghcr\.io\/civicognita\/node:\d+$/);
    }
  });

  it("all runtimes listen on port 3000", async () => {
    const reg = await testActivate(plugin);
    for (const rt of reg.runtimes) {
      expect(rt.internalPort).toBe(3000);
    }
  });
});
