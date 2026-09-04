import { describe, it, expect } from "vitest";
import { testActivate } from "@agi/sdk/testing";
import plugin from "./index.js";

describe("Rust App stack plugin", () => {
  it("registers the stack-rust-app stack", async () => {
    const reg = await testActivate(plugin);
    expect(reg.stacks).toHaveLength(1);
    expect(reg.stacks[0]!.id).toBe("stack-rust-app");
  });

  it("expects rust-runtime (dependency on Rust runtime)", async () => {
    const reg = await testActivate(plugin);
    const rustApp = reg.stacks[0]!;
    const expected = rustApp.requirements.filter((r) => r.type === "expected");
    expect(expected).toHaveLength(1);
    expect(expected[0]!.id).toBe("rust-runtime");
  });

  it("uses GHCR rust image in containerConfig", async () => {
    const reg = await testActivate(plugin);
    const rustApp = reg.stacks[0]!;
    expect(rustApp.containerConfig).toBeDefined();
    expect(rustApp.containerConfig!.image).toMatch(/^ghcr\.io\/civicognita\/rust:/);
  });

  it("has containerConfig with port 8080", async () => {
    const reg = await testActivate(plugin);
    const rustApp = reg.stacks[0]!;
    expect(rustApp.containerConfig).toBeDefined();
    expect(rustApp.containerConfig!.internalPort).toBe(8080);
  });
});
