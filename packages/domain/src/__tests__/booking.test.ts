import { describe, expect, it } from "vitest";
import { statusTone } from "../models/booking";
import { estimatePrice } from "../models/artist-profile";

describe("statusTone", () => {
  it("maps happy-path statuses to positive", () => {
    expect(statusTone("completed")).toBe("positive");
    expect(statusTone("accepted")).toBe("positive");
    expect(statusTone("scheduled")).toBe("positive");
  });
  it("maps in-flight statuses to warning", () => {
    expect(statusTone("pending")).toBe("warning");
    expect(statusTone("offered")).toBe("warning");
  });
  it("maps terminal-negative statuses to danger", () => {
    expect(statusTone("cancelled")).toBe("danger");
    expect(statusTone("declined")).toBe("danger");
    expect(statusTone("no_show")).toBe("danger");
  });
});

describe("estimatePrice", () => {
  it("scales a band with the hourly rate and complexity", () => {
    const est = estimatePrice("medium", 100, 0, "EUR");
    expect(est).toEqual({ min: 200, max: 400, currencyCode: "EUR" });
  });
  it("falls back to a default rate when none is set", () => {
    const est = estimatePrice("simple", null, null, "EUR");
    expect(est.min).toBeGreaterThan(0);
    expect(est.max).toBeGreaterThanOrEqual(est.min);
  });
  it("never returns below the minimum charge", () => {
    const est = estimatePrice("simple", 50, 300, "EUR");
    expect(est.min).toBeGreaterThanOrEqual(300);
  });
});
