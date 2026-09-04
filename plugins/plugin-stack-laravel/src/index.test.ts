import { describe, it, expect } from "vitest";
import { testActivate } from "@agi/sdk/testing";
import plugin from "./index.js";

describe("Laravel stack plugin", () => {
  it("registers the stack-laravel stack", async () => {
    const reg = await testActivate(plugin);
    expect(reg.stacks).toHaveLength(1);
    expect(reg.stacks[0]!.id).toBe("stack-laravel");
  });

  it("provides laravel requirement", async () => {
    const reg = await testActivate(plugin);
    const laravel = reg.stacks[0]!;
    const provided = laravel.requirements.filter((r) => r.type === "provided");
    expect(provided.map((r) => r.id)).toContain("laravel");
  });

  it("uses GHCR php-apache image", async () => {
    const reg = await testActivate(plugin);
    const laravel = reg.stacks[0]!;
    expect(laravel.containerConfig).toBeDefined();
    expect(laravel.containerConfig!.image).toMatch(/^ghcr\.io\/civicognita\/php-apache:/);
  });
});
