import { describe, it, expect } from "vitest";
import { testActivate } from "@agi/sdk/testing";
import plugin from "./index.js";

describe("FastAPI stack plugin", () => {
  it("registers the stack-fastapi stack", async () => {
    const reg = await testActivate(plugin);
    expect(reg.stacks).toHaveLength(1);
    expect(reg.stacks[0]!.id).toBe("stack-fastapi");
  });

  it("expects python-runtime (dependency on Python runtime)", async () => {
    const reg = await testActivate(plugin);
    const fastapi = reg.stacks[0]!;
    const expected = fastapi.requirements.filter((r) => r.type === "expected");
    expect(expected).toHaveLength(1);
    expect(expected[0]!.id).toBe("python-runtime");
  });

  it("provides fastapi requirement", async () => {
    const reg = await testActivate(plugin);
    const fastapi = reg.stacks[0]!;
    const provided = fastapi.requirements.filter((r) => r.type === "provided");
    expect(provided.map((r) => r.id)).toContain("fastapi");
  });

  it("uses GHCR python image in containerConfig", async () => {
    const reg = await testActivate(plugin);
    const fastapi = reg.stacks[0]!;
    expect(fastapi.containerConfig).toBeDefined();
    expect(fastapi.containerConfig!.image).toMatch(/^ghcr\.io\/civicognita\/python:/);
  });

  it("has containerConfig defined", async () => {
    const reg = await testActivate(plugin);
    const fastapi = reg.stacks[0]!;
    expect(fastapi.containerConfig).toBeDefined();
  });
});
