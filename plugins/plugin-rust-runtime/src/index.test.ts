import { describe, it, expect } from "vitest";
import { testActivate } from "@agi/sdk/testing";
import plugin from "./index.js";

describe("Rust runtime plugin", () => {
  it("registers 2 runtimes (1.87, 1.86)", async () => {
    const reg = await testActivate(plugin);
    expect(reg.runtimes).toHaveLength(2);
    const versions = reg.runtimes.map((r) => r.version);
    expect(versions).toContain("1.87");
    expect(versions).toContain("1.86");
  });

  it("uses GHCR rust images", async () => {
    const reg = await testActivate(plugin);
    for (const rt of reg.runtimes) {
      expect(rt.containerImage).toMatch(/^ghcr\.io\/civicognita\/rust:\d+\.\d+$/);
    }
  });

  it("all runtimes listen on port 8080", async () => {
    const reg = await testActivate(plugin);
    for (const rt of reg.runtimes) {
      expect(rt.internalPort).toBe(8080);
    }
  });
});
