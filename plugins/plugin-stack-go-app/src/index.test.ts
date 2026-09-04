import { describe, it, expect } from "vitest";
import { testActivate } from "@agi/sdk/testing";
import plugin from "./index.js";

describe("Go App stack plugin", () => {
  it("registers the stack-go-app stack", async () => {
    const reg = await testActivate(plugin);
    expect(reg.stacks).toHaveLength(1);
    expect(reg.stacks[0]!.id).toBe("stack-go-app");
  });

  it("expects go-runtime (dependency on Go runtime)", async () => {
    const reg = await testActivate(plugin);
    const goApp = reg.stacks[0]!;
    const expected = goApp.requirements.filter((r) => r.type === "expected");
    expect(expected).toHaveLength(1);
    expect(expected[0]!.id).toBe("go-runtime");
  });

  it("uses GHCR go image in containerConfig", async () => {
    const reg = await testActivate(plugin);
    const goApp = reg.stacks[0]!;
    expect(goApp.containerConfig).toBeDefined();
    expect(goApp.containerConfig!.image).toMatch(/^ghcr\.io\/civicognita\/go:/);
  });

  it("has containerConfig with port 8080", async () => {
    const reg = await testActivate(plugin);
    const goApp = reg.stacks[0]!;
    expect(goApp.containerConfig).toBeDefined();
    expect(goApp.containerConfig!.internalPort).toBe(8080);
  });
});
