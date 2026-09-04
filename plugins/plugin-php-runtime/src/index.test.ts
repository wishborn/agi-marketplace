import { describe, it, expect } from "vitest";
import { testActivate } from "@agi/sdk/testing";
import plugin from "./index.js";

describe("PHP runtime plugin", () => {
  it("registers 3 runtimes (8.5, 8.4, 8.3)", async () => {
    const reg = await testActivate(plugin);
    expect(reg.runtimes).toHaveLength(3);
    const versions = reg.runtimes.map((r) => r.version);
    expect(versions).toContain("8.5");
    expect(versions).toContain("8.4");
    expect(versions).toContain("8.3");
  });

  it("uses GHCR php-apache images", async () => {
    const reg = await testActivate(plugin);
    for (const rt of reg.runtimes) {
      expect(rt.containerImage).toMatch(/^ghcr\.io\/civicognita\/php-apache:8\.\d$/);
    }
  });

  it("all runtimes listen on port 80", async () => {
    const reg = await testActivate(plugin);
    for (const rt of reg.runtimes) {
      expect(rt.internalPort).toBe(80);
    }
  });
});
