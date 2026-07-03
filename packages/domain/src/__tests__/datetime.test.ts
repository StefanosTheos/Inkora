import { describe, expect, it } from "vitest";

import { fmtDate, fmtDateTime, fmtMonthYear, fmtTime } from "../datetime";

// Build the ISO from LOCAL components so the round-trip is timezone-stable
// (local → toISOString → parsed back to the same local wall-clock).
const iso = new Date(2026, 6, 10, 14, 30).toISOString();

describe("datetime formatters", () => {
  it("formats time as 24h", () => {
    expect(fmtTime(iso)).toBe("14:30");
  });
  it("formats date as 'D Mon'", () => {
    expect(fmtDate(iso)).toContain("10 Jul");
  });
  it("joins date and time", () => {
    expect(fmtDateTime(iso)).toBe(`${fmtDate(iso)} · 14:30`);
  });
  it("formats month + year", () => {
    expect(fmtMonthYear(iso)).toBe("Jul 2026");
  });
});
