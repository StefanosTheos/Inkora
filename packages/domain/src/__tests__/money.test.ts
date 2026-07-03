import { describe, expect, it } from "vitest";

import { formatAmount, formatMoney, formatRange, money } from "../money";

describe("money value object", () => {
  it("stores decimals as integer minor units", () => {
    expect(money(90.5, "EUR")).toEqual({ minor: 9050, currency: "EUR" });
    expect(money(140, "GBP")).toEqual({ minor: 14000, currency: "GBP" });
  });
  it("rounds to the nearest cent (no float drift)", () => {
    expect(money(0.1 + 0.2).minor).toBe(30); // 0.30000000000000004 → 30
  });
});

describe("formatMoney / formatAmount", () => {
  it("uses the currency symbol and drops trailing .00", () => {
    expect(formatMoney(money(90, "EUR"))).toBe("€90");
    expect(formatMoney(money(140.5, "GBP"))).toBe("£140.50");
    expect(formatAmount(120, "USD")).toBe("$120");
  });
  it("falls back to the code for unknown currencies", () => {
    expect(formatAmount(50, "SEK")).toBe("SEK 50");
  });
  it("renders an em dash for null", () => {
    expect(formatMoney(null)).toBe("—");
    expect(formatAmount(null)).toBe("—");
  });
});

describe("formatRange", () => {
  it("joins a min–max band", () => {
    expect(formatRange(100, 300, "EUR")).toBe("€100 – €300");
  });
});
