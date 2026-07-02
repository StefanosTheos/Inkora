import { describe, expect, it } from "vitest";
import { notificationHref } from "../models/notification";
import { journeyProgress } from "../models/journey";
import { isPreviewPending } from "../models/ai";

describe("notificationHref", () => {
  it("prefers explicit data deep-links", () => {
    expect(notificationHref({ type: "booking_update", data: { appointmentId: "a1" }, entityId: null, entityType: null })).toBe("/booking/a1");
    expect(notificationHref({ type: "offer", data: { requestId: "r1" }, entityId: null, entityType: null })).toBe("/booking/r1");
  });
  it("routes a message notification to its conversation", () => {
    expect(notificationHref({ type: "message", data: {}, entityId: "c9", entityType: "conversation" })).toBe("/chats/c9");
  });
  it("falls back per type", () => {
    expect(notificationHref({ type: "reward", data: {}, entityId: null, entityType: null })).toBe("/rewards");
    expect(notificationHref({ type: "system", data: {}, entityId: null, entityType: null })).toBe("/notifications");
  });
});

describe("journeyProgress", () => {
  it("is empty with no entries", () => {
    expect(journeyProgress([])).toEqual({ stageIndex: -1, pct: 0 });
  });
  it("uses the furthest stage reached", () => {
    const p = journeyProgress([{ entryType: "idea" }, { entryType: "appointment" }, { entryType: "consultation" }]);
    expect(p.stageIndex).toBe(2); // appointment is index 2
    expect(p.pct).toBeCloseTo(3 / 5);
  });
});

describe("isPreviewPending", () => {
  it("is pending with no result and non-failed status", () => {
    expect(isPreviewPending({ status: "queued", resultImagePath: null })).toBe(true);
  });
  it("is not pending once a result exists or it failed", () => {
    expect(isPreviewPending({ status: "completed", resultImagePath: "x.jpg" })).toBe(false);
    expect(isPreviewPending({ status: "failed", resultImagePath: null })).toBe(false);
  });
});
