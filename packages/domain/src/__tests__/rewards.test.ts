import { describe, expect, it } from "vitest";

import { TIER_THRESHOLD, tierProgress } from "../models/rewards";

describe("tierProgress", () => {
  it("starts at bronze with no earnings", () => {
    const p = tierProgress(0);
    expect(p.current).toBe("bronze");
    expect(p.next).toBe("silver");
    expect(p.toNext).toBe(TIER_THRESHOLD.silver);
    expect(p.pct).toBeCloseTo(0);
  });

  it("is halfway to silver at 250 pts", () => {
    const p = tierProgress(250);
    expect(p.current).toBe("bronze");
    expect(p.pct).toBeCloseTo(0.5);
    expect(p.toNext).toBe(250);
  });

  it("promotes to gold at the threshold", () => {
    const p = tierProgress(2000);
    expect(p.current).toBe("gold");
    expect(p.next).toBe("platinum");
  });

  it("caps at platinum with full progress", () => {
    const p = tierProgress(9999);
    expect(p.current).toBe("platinum");
    expect(p.next).toBeNull();
    expect(p.toNext).toBe(0);
    expect(p.pct).toBe(1);
  });
});
