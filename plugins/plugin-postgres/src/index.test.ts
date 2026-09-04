import { describe, it, expect } from "vitest";
import { testActivate } from "@agi/sdk/testing";
import plugin from "./index.js";

describe("PostgreSQL plugin", () => {
  it("registers 3 services and 3 stacks", async () => {
    const reg = await testActivate(plugin);
    expect(reg.services).toHaveLength(3);
    expect(reg.stacks).toHaveLength(3);
  });

  it("uses GHCR postgres images for services", async () => {
    const reg = await testActivate(plugin);
    for (const svc of reg.services) {
      expect(svc.containerImage).toMatch(/^ghcr\.io\/civicognita\/postgres:\d+$/);
    }
  });

  it("uses GHCR postgres images for stack containers", async () => {
    const reg = await testActivate(plugin);
    for (const stack of reg.stacks) {
      expect(stack.containerConfig).toBeDefined();
      expect(stack.containerConfig!.image).toMatch(/^ghcr\.io\/civicognita\/postgres:\d+$/);
      expect(stack.containerConfig!.shared).toBe(true);
    }
  });

  it("registers shared database stacks with setup/teardown scripts", async () => {
    const reg = await testActivate(plugin);
    for (const stack of reg.stacks) {
      expect(stack.databaseConfig).toBeDefined();
      expect(stack.databaseConfig!.engine).toBe("postgresql");
      expect(stack.databaseConfig!.setupScript).toBeDefined();
      expect(stack.databaseConfig!.teardownScript).toBeDefined();
    }
  });

  it("targets app and web project categories", async () => {
    const reg = await testActivate(plugin);
    for (const stack of reg.stacks) {
      expect(stack.projectCategories).toContain("app");
      expect(stack.projectCategories).toContain("web");
    }
  });
});
