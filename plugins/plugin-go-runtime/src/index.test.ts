import { describe, it, expect } from "vitest";
import { testActivate } from "@agi/sdk/testing";
import plugin from "./index.js";

describe("Go runtime plugin", () => {
  it("registers 3 runtimes (1.24, 1.23, 1.22)", async () => {
    const reg = await testActivate(plugin);
    expect(reg.runtimes).toHaveLength(3);
    const versions = reg.runtimes.map((r) => r.version);
    expect(versions).toContain("1.24");
    expect(versions).toContain("1.23");
    expect(versions).toContain("1.22");
  });

  it("uses GHCR go images", async () => {
    const reg = await testActivate(plugin);
    for (const rt of reg.runtimes) {
      expect(rt.containerImage).toMatch(/^ghcr\.io\/civicognita\/go:\d+\.\d+$/);
    }
  });

  it("all runtimes listen on port 8080", async () => {
    const reg = await testActivate(plugin);
    for (const rt of reg.runtimes) {
      expect(rt.internalPort).toBe(8080);
    }
  });
});
