import { describe, it, expect } from "vitest";
import { testActivate } from "@agi/sdk/testing";
import plugin from "./index.js";

describe("Flask stack plugin", () => {
  it("registers the stack-flask stack", async () => {
    const reg = await testActivate(plugin);
    expect(reg.stacks).toHaveLength(1);
    expect(reg.stacks[0]!.id).toBe("stack-flask");
  });

  it("expects python-runtime (dependency on Python runtime)", async () => {
    const reg = await testActivate(plugin);
    const flask = reg.stacks[0]!;
    const expected = flask.requirements.filter((r) => r.type === "expected");
    expect(expected).toHaveLength(1);
    expect(expected[0]!.id).toBe("python-runtime");
  });

  it("provides flask requirement", async () => {
    const reg = await testActivate(plugin);
    const flask = reg.stacks[0]!;
    const provided = flask.requirements.filter((r) => r.type === "provided");
    expect(provided.map((r) => r.id)).toContain("flask");
  });

  it("uses GHCR python image in containerConfig", async () => {
    const reg = await testActivate(plugin);
    const flask = reg.stacks[0]!;
    expect(flask.containerConfig).toBeDefined();
    expect(flask.containerConfig!.image).toMatch(/^ghcr\.io\/civicognita\/python:/);
  });

  it("has containerConfig defined", async () => {
    const reg = await testActivate(plugin);
    const flask = reg.stacks[0]!;
    expect(flask.containerConfig).toBeDefined();
  });
});
