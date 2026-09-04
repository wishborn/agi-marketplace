import { describe, it, expect } from "vitest";
import { testActivate } from "@agi/sdk/testing";
import plugin from "./index.js";

describe("MariaDB plugin", () => {
  it("registers 3 services and 3 stacks", async () => {
    const reg = await testActivate(plugin);
    expect(reg.services).toHaveLength(3);
    expect(reg.stacks).toHaveLength(3);
  });

  it("uses GHCR mariadb images for services", async () => {
    const reg = await testActivate(plugin);
    for (const svc of reg.services) {
      expect(svc.containerImage).toMatch(/^ghcr\.io\/civicognita\/mariadb:/);
    }
  });

  it("uses GHCR mariadb images for stack containers", async () => {
    const reg = await testActivate(plugin);
    for (const stack of reg.stacks) {
      expect(stack.containerConfig).toBeDefined();
      expect(stack.containerConfig!.image).toMatch(/^ghcr\.io\/civicognita\/mariadb:/);
      expect(stack.containerConfig!.shared).toBe(true);
    }
  });
});
