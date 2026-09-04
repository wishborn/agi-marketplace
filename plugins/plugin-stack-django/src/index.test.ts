import { describe, it, expect } from "vitest";
import { testActivate } from "@agi/sdk/testing";
import plugin from "./index.js";

describe("Django stack plugin", () => {
  it("registers the stack-django stack", async () => {
    const reg = await testActivate(plugin);
    expect(reg.stacks).toHaveLength(1);
    expect(reg.stacks[0]!.id).toBe("stack-django");
  });

  it("expects python-runtime (dependency on Python runtime)", async () => {
    const reg = await testActivate(plugin);
    const django = reg.stacks[0]!;
    const expected = django.requirements.filter((r) => r.type === "expected");
    expect(expected).toHaveLength(1);
    expect(expected[0]!.id).toBe("python-runtime");
  });

  it("provides django requirement", async () => {
    const reg = await testActivate(plugin);
    const django = reg.stacks[0]!;
    const provided = django.requirements.filter((r) => r.type === "provided");
    expect(provided.map((r) => r.id)).toContain("django");
  });

  it("uses GHCR python image in containerConfig", async () => {
    const reg = await testActivate(plugin);
    const django = reg.stacks[0]!;
    expect(django.containerConfig).toBeDefined();
    expect(django.containerConfig!.image).toMatch(/^ghcr\.io\/civicognita\/python:/);
  });

  it("has containerConfig defined", async () => {
    const reg = await testActivate(plugin);
    const django = reg.stacks[0]!;
    expect(django.containerConfig).toBeDefined();
  });
});
